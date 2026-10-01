// @vitest-environment node
// LIVE /api/jobs meta tests — OPT-IN ONLY, can spend real money/credits.
//
// These tests call a DEPLOYED (preview) or local (`vercel dev`) /api/jobs
// endpoint and are SKIPPED by default. A single call fires ALL enabled
// sources (Apify Actor runs cost money, Theirstack bills per returned
// record) and pollutes usage counters:
//
//   LIVE_API_TESTS=1 LIVE_API_BASE=https://<preview-url> npm test -- tests/api/sources-live.test.mjs
//
// Local development runtime (`VERCEL_ENV=development`):
//   vercel dev   # then: LIVE_API_TESTS=1 npm test -- tests/api/sources-live.test.mjs
//   (default base is http://localhost:3000)
//
// NEVER point this at production for routine checks.
// Cost discipline: exactly ONE /api/jobs call for the whole file (shared
// response); repeated identical queries hit the 600 s result cache anyway.
import { describe, expect, it, beforeAll } from "vitest";

const LIVE =
  process.env.LIVE_API_TESTS === "1" && Boolean(process.env.LIVE_API_BASE);
const BASE = (process.env.LIVE_API_BASE || "http://localhost:3000").replace(/\/$/, "");

let payload = null;

async function fetchJobsOnce() {
  const url = `${BASE}/api/jobs?skills=${encodeURIComponent("docker")}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} -> HTTP ${response.status}`);
  }
  return response.json();
}

describe.skipIf(!LIVE)("Live /api/jobs meta (opt-in, costs money/credits)", () => {
  beforeAll(async () => {
    payload = await fetchJobsOnce();
    const meta = payload?.meta ?? {};
    // Proof output: per-source table for the execution log.
    const rows = Object.keys({
      ...(meta.sources ?? {}),
      ...Object.fromEntries((meta.disabledSources ?? []).map((id) => [id, 0])),
    }).map((id) => ({
      source: id,
      raw: meta.sources?.[id] ?? 0,
      shown: meta.sourceCounts?.[id] ?? 0,
      reason: meta.sourceReasons?.[id] ?? (meta.disabledSources?.includes(id) ? "disabled" : null),
    }));
    console.log("[sources-live] totalFiltered:", meta.totalFiltered);
    console.log("[sources-live] per-source:", JSON.stringify(rows));
    console.log("[sources-live] disabledSources:", JSON.stringify(meta.disabledSources ?? []));
  }, 180000);

  it("returns 200 with jobs array and full sources meta", () => {
    expect(Array.isArray(payload.jobs)).toBe(true);
    const meta = payload.meta ?? {};
    expect(meta.sources && typeof meta.sources === "object").toBe(true);
    expect(meta.sourceReasons && typeof meta.sourceReasons === "object").toBe(true);
    expect(Array.isArray(meta.disabledSources)).toBe(true);
    expect(Array.isArray(meta.sourceDetails)).toBe(true);
    expect(typeof meta.totalFiltered).toBe("number");
  });

  it("JOB-SOURCES-01: enabled reporting is honest (no silent zero-delivery)", () => {
    const meta = payload.meta;
    // Every source that delivered raw jobs must NOT be reported as disabled.
    for (const [id, count] of Object.entries(meta.sources ?? {})) {
      if (count > 0) expect(meta.disabledSources).not.toContain(id);
    }
    // Every disabled source must deliver nothing.
    for (const id of meta.disabledSources ?? []) {
      expect(meta.sources?.[id] ?? 0).toBe(0);
    }
    // Reasons are either null (ok) or a non-empty string code.
    for (const [id, reason] of Object.entries(meta.sourceReasons ?? {})) {
      expect(reason === null || (typeof reason === "string" && reason.length > 0)).toBe(true);
    }
  });
});
