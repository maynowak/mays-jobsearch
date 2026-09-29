// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/config.mjs", () => ({
  getConfig: vi.fn(() => ({
    jobSourceJoobleEnabled: true,
    joobleApiKey: "test-jooble-key",
  })),
}));

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
}));

vi.mock("../../api/_lib/usage.mjs", () => ({
  countJobSourceCacheHit: vi.fn(async () => {}),
  countJobSourceCacheMiss: vi.fn(async () => {}),
}));

const { getConfig } = await import("../../api/_lib/config.mjs");
const { cacheGet, cacheSet } = await import("../../api/_lib/cache.mjs");
const { fetchJobs, normalizeJoobleJob } = await import("../../api/_lib/sources/jooble.mjs");

const sampleJoobleJob = {
  id: 123456789,
  title: "Senior Frontend Developer",
  location: "Berlin, Germany",
  snippet: "We are hiring a <b>Senior Frontend Developer</b> with React experience...",
  salary: "$80,000 - $100,000",
  source: "Jooble",
  type: "Full-time",
  link: "https://de.jooble.org/jobs/123456789",
  company: "Tech Corp",
  updated: "2026-09-20T10:30:00+02:00",
};

const sampleJoobleJobMinimal = {
  id: 999,
  title: "Aushilfe",
  location: "Hamburg",
  snippet: "",
  salary: "",
  source: "Jooble",
  type: "",
  link: "https://de.jooble.org/jobs/999",
  company: "",
  updated: null,
};

function setupFetchMock(respond) {
  globalThis.fetch = vi.fn(async (url, options) => respond(String(url), options));
}

function okResponse(body) {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfig).mockReturnValue({
    jobSourceJoobleEnabled: true,
    joobleApiKey: "test-jooble-key",
  });
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
});

describe("Jooble Source Adapter", () => {
  describe("Configuration", () => {
    it("returns empty result when API key is missing", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceJoobleEnabled: true,
        joobleApiKey: "",
      });
      setupFetchMock(() => {
        throw new Error("fetch must not be called without API key");
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(false);
      expect(result.meta.reason).toBe("missing_config");
    });

    it("uses POST with key in path and keywords/location in body", async () => {
      let seenUrl = "";
      let seenOptions = null;
      setupFetchMock((url, options) => {
        seenUrl = url;
        seenOptions = options;
        return okResponse({ totalCount: 0, jobs: [] });
      });
      await fetchJobs({ skills: "react", targetRoles: ["frontend"], city: "berlin" });
      expect(seenUrl).toBe("https://jooble.org/api/test-jooble-key");
      expect(seenOptions.method).toBe("POST");
      expect(seenOptions.headers["Content-Type"]).toBe("application/json");
      const body = JSON.parse(seenOptions.body);
      expect(body.keywords).toContain("react");
      expect(body.location).toBe("berlin");
    });
  });

  describe("fetchJobs - Happy Path", () => {
    it("fetches and normalizes jobs (snippet, salary, type)", async () => {
      setupFetchMock(() => okResponse({ totalCount: 1, jobs: [sampleJoobleJob] }));
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      const job = result.jobs[0];
      expect(job.slug).toBe("jo-123456789");
      expect(job.externalId).toBe("jo-123456789");
      expect(job.title).toBe("Senior Frontend Developer");
      expect(job.company_name).toBe("Tech Corp");
      expect(job.location).toEqual(["Berlin, Germany"]);
      expect(job.tags).toEqual(["Full-time"]);
      expect(job.url).toBe("https://de.jooble.org/jobs/123456789");
      expect(job.source).toEqual(["jooble"]);
      expect(job.description).toContain("<b>Senior Frontend Developer</b>");
      expect(job.descriptionPlain).toContain("Senior Frontend Developer");
      expect(job.descriptionPlain).not.toContain("<b>");
      expect(job.jobTypes).toEqual(["full-time"]);
      expect(job.applyUrl).toBe("https://de.jooble.org/jobs/123456789");
      expect(job.salary).toBe("$80,000 - $100,000");
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(1);
    });

    it("handles minimal job data (missing optional fields)", async () => {
      setupFetchMock(() => okResponse({ totalCount: 1, jobs: [sampleJoobleJobMinimal] }));
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      const job = result.jobs[0];
      expect(job.title).toBe("Aushilfe");
      expect(job.description).toBeUndefined();
      expect(job.jobTypes).toBeUndefined();
      expect(job.salary).toBeUndefined();
      expect(job.department).toBeUndefined();
    });

    it("filters by city and keywords", async () => {
      setupFetchMock(() => okResponse({ totalCount: 2, jobs: [sampleJoobleJob, sampleJoobleJobMinimal] }));
      const result = await fetchJobs({ skills: "frontend", targetRoles: [], city: "berlin" });
      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].title).toContain("Frontend");
    });

    it("respects MAX_JOBS_TO_AI limit (40)", async () => {
      const many = Array.from({ length: 50 }, (_, i) => ({ ...sampleJoobleJobMinimal, id: 1000 + i }));
      setupFetchMock(() => okResponse({ totalCount: 50, jobs: many }));
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(40);
    });
  });

  describe("fetchJobs - Error Handling", () => {
    it("throws HttpError on invalid API key (401)", async () => {
      setupFetchMock(() => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });

    it("throws HttpError on rate limit (429)", async () => {
      setupFetchMock(() => new Response("busy", { status: 429 }));
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 429,
        code: "rate_limited",
      });
    });

    it("throws HttpError on network failure", async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error("Network error");
      });
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "network",
      });
    });

    it("throws HttpError on invalid JSON response", async () => {
      setupFetchMock(() => new Response("not json", { status: 200 }));
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });

    it("throws HttpError on non-jobs JSON response", async () => {
      setupFetchMock(() => okResponse({ totalCount: 0 }));
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });
  });

  describe("normalizeJoobleJob - Contract Compliance", () => {
    it("produces stable provider-prefixed externalId", () => {
      const job = normalizeJoobleJob(sampleJoobleJob);
      expect(job.externalId).toBe("jo-123456789");
      expect(job.slug).toBe(job.externalId);
    });

    it("detects remote from location", () => {
      const job = normalizeJoobleJob({ ...sampleJoobleJob, location: "Remote, Germany" });
      expect(job.remote).toBe(true);
    });

    it("passes salary string through unchanged (no invention)", () => {
      expect(normalizeJoobleJob(sampleJoobleJob).salary).toBe("$80,000 - $100,000");
      expect(normalizeJoobleJob({ ...sampleJoobleJob, salary: "" }).salary).toBeUndefined();
    });

    it("strips <b> highlights from snippet for descriptionPlain", () => {
      const job = normalizeJoobleJob(sampleJoobleJob);
      expect(job.descriptionPlain).not.toContain("<");
      expect(job.descriptionPlain).toContain("Senior Frontend Developer");
    });
  });

  describe("L1 result cache (quota protection)", () => {
    it("serves cached records without paid API call on repeat search", async () => {
      vi.mocked(cacheGet).mockResolvedValue([sampleJoobleJob]);
      setupFetchMock(() => {
        throw new Error("fetch must not be called on cache hit");
      });
      const result = await fetchJobs({ skills: "frontend", targetRoles: [], city: "berlin" });
      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].slug).toBe("jo-123456789");
      expect(result.meta.totalScanned).toBe(1);
    });

    it("stores fresh results under namespaced key after miss", async () => {
      setupFetchMock(() => okResponse({ totalCount: 1, jobs: [sampleJoobleJob] }));
      await fetchJobs({ skills: "frontend", targetRoles: [], city: "berlin" });
      expect(vi.mocked(cacheSet)).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = vi.mocked(cacheSet).mock.calls[0];
      expect(String(key).startsWith("job-source:jooble:")).toBe(true);
      expect(Array.isArray(value)).toBe(true);
      expect(ttl).toBe(600);
    });

    it("does not cache empty results", async () => {
      setupFetchMock(() => okResponse({ totalCount: 0, jobs: [] }));
      const result = await fetchJobs({ skills: "nothingmatchesthis", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
    });
  });
});
