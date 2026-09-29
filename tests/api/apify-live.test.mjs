// @vitest-environment node
// LIVE actor tests — OPT-IN ONLY, spends real money.
//
// These tests call the real Apify actor (blackfalcondata~arbeitsagentur-jobs-feed)
// and are SKIPPED by default. Run them only deliberately during development:
//
//   APIFY_LIVE_TESTS=1 APIFY_API_TOKEN=<token> npm test -- tests/api/apify-live.test.mjs
//
// Cost discipline: maxResults is capped at 5 per run (see LIVE_MAX_RESULTS).
// Never raise this in committed code without explicit approval.
import { describe, expect, it } from "vitest";

const LIVE =
  process.env.APIFY_LIVE_TESTS === "1" && Boolean(process.env.APIFY_API_TOKEN);
const LIVE_MAX_RESULTS = 5;

const { startApifyRun, waitForRun, readDataset } = await import(
  "../../api/_lib/sources/apify/client.mjs"
);
const { actorById, SOURCE_ID } = await import("../../api/_lib/sources/apify/actors.mjs");

async function runStandardQuery(query, location = "") {
  const apiToken = process.env.APIFY_API_TOKEN;
  const actor = actorById(SOURCE_ID);
  const input = actor.buildInput(query, location, LIVE_MAX_RESULTS);
  const started = await startApifyRun(apiToken, actor.actorId, input);
  expect(started.error ?? null).toBeNull();
  const waited = await waitForRun(apiToken, started.run.id, 120000);
  expect(waited.error ?? null).toBeNull();
  const read = await readDataset(apiToken, waited.run.defaultDatasetId);
  expect(read.error ?? null).toBeNull();
  return { input, records: read.records };
}

describe.skipIf(!LIVE)("Apify live actor (opt-in, costs money)", () => {
  it(
    "standard query 'java' returns records with expected shape",
    async () => {
      const { input, records } = await runStandardQuery("java");
      expect(input.maxResults).toBe(LIVE_MAX_RESULTS);
      expect(Array.isArray(records)).toBe(true);
      if (records.length > 0) {
        const actor = actorById(SOURCE_ID);
        const job = actor.normalize(records[0]);
        expect(job.slug.startsWith("aa-")).toBe(true);
        expect(typeof job.title).toBe("string");
        expect(job.source).toContain("arbeitsagentur");
      }
    },
    150000
  );

  it(
    "standard query 'Software Developer' returns records",
    async () => {
      const { records } = await runStandardQuery("Software Developer");
      expect(Array.isArray(records)).toBe(true);
    },
    150000
  );
});
