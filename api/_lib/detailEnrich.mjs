import { createHash } from "node:crypto";
import { getConfig } from "./config.mjs";
import { cacheGet, cacheSet, cacheReserveIncr, cacheDecrBy } from "./cache.mjs";
import {
  apifyRunLimitReached,
  countApifyRun,
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

function ipHash(clientIp) {
  const raw = String(clientIp ?? "").trim() || "unknown";
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function currentDay() {
  return new Date().toISOString().slice(0, 10);
}

function quotaKey(clientIp) {
  return `mj-usage:detail:${ipHash(clientIp)}:${currentDay()}`;
}

// Refund quota that was reserved but not actually spent (best-effort): safety
// direction is that a failed/partial run may leave the counter slightly higher,
// never lower than the truly enriched count.
async function refundUnspent(key, amount) {
  if (amount > 0) await cacheDecrBy(key, amount);
}

/**
 * Enrich Arbeitsagentur jobs by slug. Only missing (uncached) jobs trigger an
 * Apify run; all missing jobs are batched into ONE run. The per-user-per-day
 * quota counts only newly enriched jobs (cache hits cost 0).
 *
 * @returns {Promise<{ jobs: Record<string, Job>, enrichedCount: number } | { error: string }>}
 */
export async function enrichArbeitsagenturDetails(slugs, { clientIp } = {}) {
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

  // 2. Global monthly run backstop (unchanged).
  if (await apifyRunLimitReached()) {
    return { error: "apify_limit_reached" };
  }

  // 3. Server-side per-user quota (atomic; fail closed on Redis outage).
  const limit = getConfig().apifyDetailMaxPerUserPerDay;
  const key = quotaKey(clientIp);
  const reserved = await cacheReserveIncr(key, missing.length, limit, QUOTA_TTL_SEC);
  if (reserved === null) {
    return { error: "quota_unavailable" };
  }
  if (reserved === -1) {
    return { error: "quota_exceeded" };
  }

  // 4. One batched targeted run.
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    await refundUnspent(key, missing.length);
    return { error: "missing_config" };
  }

  const input = actor.buildTargetedDetailInput(missing.map((m) => portalUrlForRefNr(m.refNr)));
  const started = await startApifyRun(apiToken, actor.actorId, input);
  if (started.error) {
    await refundUnspent(key, missing.length);
    return { error: started.error };
  }
  await countApifyRun();
  await countJobSourceRun(SOURCE_ID);

  const waited = await waitForRun(apiToken, started.run.id, DETAIL_SYNC_TIMEOUT_SEC * 1000);
  if (waited.error) {
    await refundUnspent(key, missing.length);
    return { error: waited.error };
  }

  const read = await readDataset(apiToken, waited.run.defaultDatasetId);
  if (read.error) {
    await refundUnspent(key, missing.length);
    return { error: read.error };
  }

  // 5. Map results back to the requested slugs and cache them.
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
    await refundUnspent(key, missing.length - enrichedCount);
  }

  return { jobs, enrichedCount };
}