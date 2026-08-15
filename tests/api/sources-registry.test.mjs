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

const { cacheGet, cacheSet } = await import("../../api/_lib/cache.mjs");
const { apifyRunLimitReached } = await import("../../api/_lib/usage.mjs");
const { fetchAllJobs } = await import("../../api/_lib/sources/index.mjs");

const baseArbeitnowJob = {
  slug: "job-1",
  title: "Frontend Developer",
  company_name: "Acme",
  location: ["Berlin"],
  remote: false,
  tags: ["react"],
  url: "https://example.com/job-1",
  created_at: Date.now() / 1000,
  job_types: ["full-time"],
};

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

function setupFetchMock(overrides = {}) {
  const {
    arbeitnowJobs = [baseArbeitnowJob],
    apifyRecords = [baseApifyRecord],
    datasetFresh = false,
  } = overrides;

  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("arbeitnow.com")) {
      return new Response(JSON.stringify({ data: arbeitnowJobs }), { status: 200 });
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

  if (datasetFresh) {
    vi.mocked(cacheGet).mockImplementation(async (key) => {
      if (key && String(key).startsWith("job-source:arbeitsagentur:dataset:")) {
        return { datasetId: "ds-1", createdAt: Date.now() };
      }
      return null;
    });
  } else {
    vi.mocked(cacheGet).mockResolvedValue(null);
  }
}

function setupAllDisabled() {
  globalThis.fetch = vi.fn(() => {
    throw new Error("should not be called");
  });
  vi.mocked(cacheGet).mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
  vi.mocked(apifyRunLimitReached).mockResolvedValue(false);
  process.env.JOB_SOURCE_ARBEITNOW_ENABLED = "true";
  process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED = "true";
  process.env.APIFY_API_TOKEN = "test-token";
});

describe("Job Sources Registry (sources/index.mjs)", () => {
  it("A) Arbeitnow enabled -> Jobs", async () => {
    setupFetchMock({ arbeitnowJobs: [baseArbeitnowJob] });
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.jobs[0].source).toContain("arbeitnow");
  });

  it("B) Arbeitnow disabled -> keine Requests", async () => {
    process.env.JOB_SOURCE_ARBEITNOW_ENABLED = "false";
    setupAllDisabled();
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBe(0);
    expect(result.meta.disabledSources).toContain("arbeitnow");
  });

  it("E) beide enabled -> kombinierter Pool", async () => {
    setupFetchMock();
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.meta.sources.arbeitnow).toBeGreaterThan(0);
    expect(result.meta.sourceDetails.some((s) => s.id === "arbeitnow" && s.enabled)).toBe(true);
    expect(result.meta.sourceDetails.some((s) => s.id === "arbeitsagentur" && s.enabled)).toBe(true);
  });

  it("F) beide disabled -> sauberer Empty-State", async () => {
    process.env.JOB_SOURCE_ARBEITNOW_ENABLED = "false";
    process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED = "false";
    setupAllDisabled();
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBe(0);
    expect(result.meta.totalFiltered).toBe(0);
    expect(result.meta.disabledSources).toContain("arbeitnow");
    expect(result.meta.disabledSources).toContain("arbeitsagentur");
    expect(result.meta.apify.enabled).toBe(false);
    expect(result.meta.apify.reason).toBe("disabled");
  });

  it("G) Cross-Source Dedup -> ein Job, source[] enthält beide Quellen", async () => {
    const arbeitnowJob = { ...baseArbeitnowJob, slug: "j1", title: "Frontend Developer", company_name: "Acme", location: ["Berlin"] };
    const apifyRecord = { ...baseApifyRecord, referenceId: "aa-1", title: "Frontend Developer", employer: "Acme", location: "Berlin" };
    setupFetchMock({ arbeitnowJobs: [arbeitnowJob], apifyRecords: [apifyRecord], datasetFresh: true });
    const result = await fetchAllJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    const job = result.jobs.find((j) => j.title === "Frontend Developer" && j.company_name === "Acme");
    expect(job).toBeDefined();
    expect(job.source).toEqual(expect.arrayContaining(["arbeitnow", "arbeitsagentur"]));
  });

  it("L) neue Source kann registriert werden ohne jobs.mjs umzubauen", async () => {
    const { createApifySource } = await import("../../api/_lib/sources/apify/index.mjs");
    const fakeActor = {
      sourceId: "example-jobs",
      displayName: "Example Jobs",
      actorId: "someuser~some-job-actor",
      maxJobs: 10,
      enabled: () => true,
      buildInput: (query, location, maxJobs) => ({ query, location, maxResults: maxJobs, mode: "full" }),
      normalize: (record) => ({
        slug: `ex-${record.id}`,
        title: record.title,
        company_name: record.company,
        location: [record.location],
        remote: false,
        tags: [],
        url: record.url,
        created_at: Date.now() / 1000,
        source: ["example-jobs"],
      }),
    };
    vi.mocked(cacheGet).mockResolvedValue(null);
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/v2/acts/")) {
        return new Response(JSON.stringify({ data: { id: "run-1", defaultDatasetId: "ds-1" } }), { status: 201 });
      }
      if (u.includes("/v2/actor-runs/")) {
        return new Response(JSON.stringify({ data: { id: "run-1", status: "SUCCEEDED", defaultDatasetId: "ds-1" } }), { status: 200 });
      }
      if (u.includes("/v2/datasets/")) {
        return new Response(JSON.stringify([{ id: "1", title: "Test", company: "Co", location: "Berlin", url: "https://x" }]), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    const source = createApifySource(fakeActor);
    const result = await source.fetchJobs({ skills: "", targetRole: "Test", city: "" });
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.jobs[0].source).toContain("example-jobs");
  });
});