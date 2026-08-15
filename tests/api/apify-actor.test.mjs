// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
  cacheDel: vi.fn(async () => undefined),
  cacheIncr: vi.fn(async () => 1),
  cacheHIncrBy: vi.fn(async () => 1),
  cacheHGetAll: vi.fn(async () => ({})),
}));

vi.mock("../../api/_lib/usage.mjs", () => ({
  apifyRunLimitReached: vi.fn(async () => false),
  countApifyCacheHit: vi.fn(async () => {}),
  countApifyCacheMiss: vi.fn(async () => {}),
  countApifyDatasetReuse: vi.fn(async () => {}),
  countApifyRun: vi.fn(async () => {}),
  countJobSourceRequest: vi.fn(async () => {}),
  countJobSourceRun: vi.fn(async () => {}),
  countJobSourceDatasetReuse: vi.fn(async () => {}),
  countJobSourceCacheHit: vi.fn(async () => {}),
  countJobSourceCacheMiss: vi.fn(async () => {}),
}));

const { cacheGet, cacheSet, cacheDel } = await import("../../api/_lib/cache.mjs");
const { apifyRunLimitReached } = await import("../../api/_lib/usage.mjs");
const { fetchAllJobs } = await import("../../api/_lib/sources/index.mjs");

const baseApifyRecord = {
  referenceId: "aa-1",
  title: "Frontend Developer",
  employer: "Acme",
  location: "Berlin",
  isRemote: false,
  description: "Great job",
  portalUrl: "https://example.com/job-1",
  publishedDate: new Date().toISOString(),
  contractType: "Vollzeit",
  salary: "60000",
  startDate: "2024-01-01",
};

function setupApifyFlow(overrides = {}) {
  const { apifyRecords = [baseApifyRecord], datasetFresh = false, limitReached = false } = overrides;
  
  vi.mocked(cacheGet).mockImplementation(async (key) => {
    if (datasetFresh && key && String(key).startsWith("job-source:arbeitsagentur:dataset:")) {
      return { datasetId: "ds-1", createdAt: Date.now() };
    }
    return null;
  });
  vi.mocked(apifyRunLimitReached).mockResolvedValue(limitReached);

  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("arbeitnow.com")) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (u.includes("/v2/acts/")) {
      return new Response(JSON.stringify({ data: { id: "run-1", defaultDatasetId: "ds-1" } }), { status: 201 });
    }
    if (u.includes("/v2/actor-runs/")) {
      return new Response(JSON.stringify({ data: { id: "run-1", status: "SUCCEEDED" } }), { status: 200 });
    }
    if (u.includes("/v2/datasets/")) {
      return new Response(JSON.stringify(apifyRecords), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${u}`);
  });
}

function setupApifyDisabled() {
  process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED = "false";
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("arbeitnow.com")) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    throw new Error(`should not call apify: ${u}`);
  });
  vi.mocked(cacheGet).mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
  vi.mocked(cacheDel).mockResolvedValue(undefined);
  vi.mocked(apifyRunLimitReached).mockResolvedValue(false);
  process.env.JOB_SOURCE_ARBEITNOW_ENABLED = "true";
  process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED = "true";
  process.env.APIFY_API_TOKEN = "test-token";
});

describe("Apify Actor (arbeitsagentur)", () => {
  it("C) Arbeitsagentur enabled -> Jobs", async () => {
    setupApifyFlow();
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.jobs[0].source).toContain("arbeitsagentur");
  });

  it("D) Arbeitsagentur disabled -> kein Apify Run", async () => {
    setupApifyDisabled();
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBe(0);
    expect(result.meta.disabledSources).toContain("arbeitsagentur");
    expect(result.meta.apify.enabled).toBe(false);
    expect(result.meta.apify.reason).toBe("disabled");
  });

  it("H) Cache Key enthält Source eindeutig", async () => {
    setupApifyFlow();
    await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    const cacheGetCalls = vi.mocked(cacheGet).mock.calls.map((c) => c[0]);
    const cacheSetCalls = vi.mocked(cacheSet).mock.calls.map((c) => c[0]);
    expect(cacheGetCalls.some((k) => String(k).startsWith("job-source:arbeitsagentur:"))).toBe(true);
    expect(cacheSetCalls.some((k) => String(k).startsWith("job-source:arbeitsagentur:"))).toBe(true);
    expect(cacheGetCalls.every((k) => !String(k).startsWith("apify-jobs:"))).toBe(true);
    expect(cacheSetCalls.every((k) => !String(k).startsWith("apify-jobs:"))).toBe(true);
  });

  it("I) Apify Dataset Reuse bleibt aktiv", async () => {
    setupApifyFlow({ datasetFresh: true });
    await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(fetchCalls.some((u) => u.includes("/v2/acts/"))).toBe(false);
    expect(vi.mocked(cacheGet).mock.calls.some((c) => String(c[0]).includes(":dataset:"))).toBe(true);
    const { countApifyDatasetReuse } = await import("../../api/_lib/usage.mjs");
    expect(vi.mocked(countApifyDatasetReuse)).toHaveBeenCalled();
  });

  it("J) Refresh Policy bleibt aktiv (stale dataset -> neuer Run)", async () => {
    setupApifyFlow({ datasetFresh: false });
    await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(fetchCalls.some((u) => u.includes("/v2/acts/"))).toBe(true);
  });

  it("K) Cost Guard verhindert neuen Apify Run", async () => {
    setupApifyFlow({ limitReached: true });
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    const aaJobs = result.jobs.filter((j) => j.source?.includes("arbeitsagentur"));
    expect(aaJobs.length).toBe(0);
    expect(result.meta.apify.enabled).toBe(false);
    expect(result.meta.apify.reason).toBe("limit_reached");
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(fetchCalls.some((u) => u.includes("/v2/acts/"))).toBe(false);
  });
});