// @vitest-environment node
// LIVE TheirStack tests — OPT-IN ONLY, spends real credits.
//
// These tests call the real TheirStack API (api.theirstack.com) and are
// SKIPPED by default. Run them only deliberately when needed ("nur bei
// Bedarf"), e.g. after adapter changes or key rotation:
//
//   THEIRSTACK_LIVE_TESTS=1 THEIRSTACK_API_KEY=<key> npm test -- tests/api/theirstack-live.test.mjs
//
// Cost discipline: exactly ONE search with limit 3 (see LIVE_LIMIT —
// TheirStack bills 1 credit per returned record). Never raise this in
// committed code without explicit approval.
import { describe, expect, it, beforeAll } from "vitest";
import { normalizeTheirstackJob } from "../../api/_lib/sources/theirstack.mjs";

const LIVE =
  process.env.THEIRSTACK_LIVE_TESTS === "1" && Boolean(process.env.THEIRSTACK_API_KEY);
const LIVE_LIMIT = 3;

let payload = null;

describe.skipIf(!LIVE)("TheirStack live search (opt-in, costs credits)", () => {
  beforeAll(async () => {
    const apiKey = process.env.THEIRSTACK_API_KEY;
    const response = await fetch("https://api.theirstack.com/v1/jobs/search", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        job_description_contains_or: ["docker"],
        limit: LIVE_LIMIT,
        page: 0,
        posted_at_max_age_days: 30,
      }),
    });
    if (!response.ok) {
      const excerpt = (await response.text().catch(() => "")).slice(0, 200);
      throw new Error(`TheirStack live call -> HTTP ${response.status} ${excerpt}`);
    }
    payload = await response.json();
    console.log(
      "[theirstack-live] data:",
      Array.isArray(payload?.data) ? payload.data.length : "n/a"
    );
  }, 120000);

  it("returns live docker jobs in TheirStack schema", () => {
    expect(Array.isArray(payload?.data)).toBe(true);
    if (payload.data.length > 0) {
      const job = normalizeTheirstackJob(payload.data[0]);
      expect(job.slug.startsWith("ts-")).toBe(true);
      expect(typeof job.title).toBe("string");
      expect(job.source).toContain("theirstack");
    }
  });
});
