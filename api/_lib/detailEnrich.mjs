import { getConfig } from "./config.mjs";
import { cacheGet, cacheSet, cacheReserveIncr, cacheDecrBy } from "./cache.mjs";
import { hashToken } from "./identity.mjs";
import {
  reserveApifyRunSlot,
  refundApifyRunSlot,
  countJobSourceRun,
} from "./usage.mjs";
import { startApifyRun, waitForRun, readDataset } from "./sources/apify/client.mjs";
import { actorById, SOURCE_ID } from "./sources/apify/actors.mjs";

const DETAIL_CACHE_PREFIX = "mj-detail:arbeitsagentur";
const DETAIL_TTL_SEC = 7 * 24 * 60 * 60;
const DETAIL_SYNC_TIMEOUT_SEC = 50;
const QUOTA_TTL_SEC = 24 * 60 * 60;

const ARBEITSAGENTUR_PORTAL_BASE = "https://www.arbeitsagentur.de/jobsuche/suche?id=";

// A BA refnr is a compact alphanumeric token (e.g. "13644-290571-S"). We only
// ever accept tokens matching this shape and build the portal URL server-side,
// so a client cannot forward arbitrary external URLs to Apify.
function isValidRefNr(refNr) {
  return /^[A-Za-z0-9][A-Za-z0-9-]{3,63}$/.test(refNr);
}

export function parseArbeitsagenturSlug(slug) {
  if (typeof slug !== "string") return null;
  const match = /^aa-([A-Za-z0-9][A-Za-z0-9-]*)$/.exec(slug.trim());
  if (!match) return null;
  const refNr = match[1];
  return isValidRefNr(refNr) ? refNr : null;
}

export function portalUrlForRefNr(refNr) {
  return `${ARBEITSAGENTUR_PORTAL_BASE}${encodeURIComponent(refNr)}`;
}

function currentDay() {
  return new Date().toISOString().slice(0, 10);
}

function sessionQuotaKey(sessionId) {
  return `mj-detail:quota:s:${hashToken(sessionId)}:${currentDay()}`;
}

function ipQuotaKey(clientIp) {
  return `mj-detail:quota:ip:${hashToken(clientIp)}:${currentDay()}`;
}

async function refundQuota(sessionKey, ipKey, amount) {
  if (amount > 0) {
    await cacheDecrBy(sessionKey, amount);
    await cacheDecrBy(ipKey, amount);
  }
}

/**
 * Enrich Arbeitsagentur jobs by slug. Only missing (uncached) jobs trigger an
 * Apify run; all missing jobs are batched into ONE run. Quota (per session +
 * per-IP backstop) counts only newly enriched jobs (cache hits cost 0), is
 * atomic/race-safe, and fails closed for the paid path.
 *
 * @returns {Promise<{ jobs: Record<string, Job>, enrichedCount: number } | { error: string }>}
 */
export async function enrichArbeitsagenturDetails(slugs, { clientIp, sessionId } = {}) {
  const actor = actorById(SOURCE_ID);
  if (!actor) return { error: "source_not_found" };

  const requests = [];
  const seen = new Set();
  for (const slug of slugs) {
    if (typeof slug !== "string") continue;
    const refNr = parseArbeitsagenturSlug(slug);
    if (!refNr) return { error: "invalid_slug", slug };
    if (seen.has(slug)) continue;
    seen.add(slug);
    requests.push({ slug, refNr });
  }
  if (!requests.length) return { jobs: {}, enrichedCount: 0 };

  // 1. Serve cache hits, collect misses.
  const jobs = {};
  const missing = [];
  for (const req of requests) {
    const cached = await cacheGet(`${DETAIL_CACHE_PREFIX}:${req.refNr}`);
    if (cached && cached.slug) {
      jobs[req.slug] = cached;
    } else {
      missing.push(req);
    }
  }

  if (!missing.length) {
    return { jobs, enrichedCount: 0 };
  }

  const cfg = getConfig();
  const sessionKey = sessionQuotaKey(sessionId);
  const ipKey = ipQuotaKey(clientIp);
  const n = missing.length;

  // 2. Global monthly run backstop (atomic; race-safe).
  const runSlot = await reserveApifyRunSlot();
  if (runSlot.error === "exceeded") return { error: "apify_limit_reached" };
  if (runSlot.error) return { error: "quota_unavailable" };

  // 3. Per-session quota (primary identity).
  const sessionReserved = await cacheReserveIncr(sessionKey, n, cfg.apifyDetailMaxPerUserPerDay, QUOTA_TTL_SEC);
  if (sessionReserved === null) {
    await refundApifyRunSlot();
    return { error: "quota_unavailable" };
  }
  if (sessionReserved === -1) {
    await refundApifyRunSlot();
    return { error: "quota_exceeded" };
  }

  // 4. Per-IP backstop (anti-abuse; tolerates NAT via a higher limit).
  const ipReserved = await cacheReserveIncr(ipKey, n, cfg.apifyDetailMaxPerIpPerDay, QUOTA_TTL_SEC);
  if (ipReserved === null) {
    await refundQuota(sessionKey, ipKey, n);
    await refundApifyRunSlot();
    return { error: "quota_unavailable" };
  }
  if (ipReserved === -1) {
    await refundQuota(sessionKey, ipKey, n);
    await refundApifyRunSlot();
    return { error: "quota_exceeded" };
  }

  // 5. One batched targeted run.
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    await refundQuota(sessionKey, ipKey, n);
    await refundApifyRunSlot();
    return { error: "missing_config" };
  }

  const input = actor.buildTargetedDetailInput(missing.map((m) => portalUrlForRefNr(m.refNr)));
  const started = await startApifyRun(apiToken, actor.actorId, input);
  if (started.error) {
    await refundQuota(sessionKey, ipKey, n);
    await refundApifyRunSlot();
    return { error: started.error };
  }
  await countJobSourceRun(SOURCE_ID);

  const waited = await waitForRun(apiToken, started.run.id, DETAIL_SYNC_TIMEOUT_SEC * 1000);
  if (waited.error) {
    await refundQuota(sessionKey, ipKey, n);
    return { error: waited.error };
  }

  const read = await readDataset(apiToken, waited.run.defaultDatasetId);
  if (read.error) {
    await refundQuota(sessionKey, ipKey, n);
    return { error: read.error };
  }

  // 6. Map results back to the requested slugs and cache them.
  const byRef = new Map();
  for (const record of read.records || []) {
    const ref = record?.referenceId ? String(record.referenceId).trim() : "";
    if (ref) byRef.set(ref, actor.normalize(record));
  }

  let enrichedCount = 0;
  for (const req of missing) {
    const enriched = byRef.get(req.refNr);
    if (enriched) {
      enrichedCount += 1;
      jobs[req.slug] = enriched;
      await cacheSet(`${DETAIL_CACHE_PREFIX}:${req.refNr}`, enriched, DETAIL_TTL_SEC);
    }
  }

  if (enrichedCount < missing.length) {
    await refundQuota(sessionKey, ipKey, n - enrichedCount);
  }

  return { jobs, enrichedCount };
}