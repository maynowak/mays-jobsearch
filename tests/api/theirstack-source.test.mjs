// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/config.mjs", () => ({
  getConfig: vi.fn(() => ({
    jobSourceTheirstackEnabled: true,
    theirstackApiKey: "test-theirstack-key",
    theirstackMonthlyMaxCredits: 200,
  })),
}));

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
}));

vi.mock("../../api/_lib/usage.mjs", () => ({
  countJobSourceCacheHit: vi.fn(async () => {}),
  countJobSourceCacheMiss: vi.fn(async () => {}),
  countTheirstackCredits: vi.fn(async () => {}),
  theirstackCreditLimitReached: vi.fn(async () => false),
}));

const { getConfig } = await import("../../api/_lib/config.mjs");
const { cacheGet, cacheSet } = await import("../../api/_lib/cache.mjs");
const { countTheirstackCredits, theirstackCreditLimitReached } = await import("../../api/_lib/usage.mjs");
const { fetchJobs, normalizeTheirstackJob } = await import("../../api/_lib/sources/theirstack.mjs");

const sampleTheirstackJob = {
  id: 1234,
  job_title: "Senior Data Engineer",
  company: "Google",
  company_object: { name: "Google", domain: "google.com" },
  location: "New York",
  long_location: "New York, NY",
  country_code: "US",
  description: "## About the Role\nWe are looking for a Senior Data Engineer with Python and SQL skills...",
  date_posted: "2026-09-20",
  discovered_at: "2026-09-20T10:30:00Z",
  remote: false,
  hybrid: true,
  employment_statuses: ["full_time"],
  seniority: "senior",
  technology_slugs: ["python", "postgresql"],
  min_annual_salary_usd: 100000,
  max_annual_salary_usd: 150000,
  salary_currency: "USD",
  salary_string: "$100,000 - $150,000",
  latitude: 40.7128,
  longitude: -74.006,
  url: "https://example.com/job/1234",
  final_url: "https://careers.google.com/jobs/1234",
  source_url: "https://www.linkedin.com/jobs/view/1234567890",
};

const sampleTheirstackJobMinimal = {
  id: 999,
  job_title: "Aushilfe",
  company: "",
  location: "",
  description: "",
  date_posted: null,
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
    jobSourceTheirstackEnabled: true,
    theirstackApiKey: "test-theirstack-key",
    theirstackMonthlyMaxCredits: 200,
  });
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
  vi.mocked(theirstackCreditLimitReached).mockResolvedValue(false);
  vi.mocked(countTheirstackCredits).mockResolvedValue(undefined);
});

describe("Theirstack Source Adapter", () => {
  describe("Configuration", () => {
    it("returns empty result when API key is missing", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceTheirstackEnabled: true,
        theirstackApiKey: "",
        theirstackMonthlyMaxCredits: 200,
      });
      setupFetchMock(() => {
        throw new Error("fetch must not be called without API key");
      });
      const result = await fetchJobs({ skills: "python", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(false);
      expect(result.meta.reason).toBe("missing_config");
    });

    it("returns empty result when credit contingent is exhausted", async () => {
      vi.mocked(theirstackCreditLimitReached).mockResolvedValue(true);
      setupFetchMock(() => {
        throw new Error("fetch must not be called when limit reached");
      });
      const result = await fetchJobs({ skills: "python", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(false);
      expect(result.meta.reason).toBe("limit_reached");
    });

    it("returns empty result without query terms (protects credits)", async () => {
      setupFetchMock(() => {
        throw new Error("fetch must not be called without query");
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.reason).toBe("no_query");
    });

    it("uses Bearer auth and always sends the required posted_at filter", async () => {
      let seenUrl = "";
      let seenOptions = null;
      setupFetchMock((url, options) => {
        seenUrl = url;
        seenOptions = options;
        return okResponse({ data: [], metadata: {} });
      });
      await fetchJobs({ skills: "python", targetRoles: ["engineer"], city: "" });
      expect(seenUrl).toBe("https://api.theirstack.com/v1/jobs/search");
      expect(seenOptions.method).toBe("POST");
      expect(seenOptions.headers.Authorization).toBe("Bearer test-theirstack-key");
      const body = JSON.parse(seenOptions.body);
      expect(body.posted_at_max_age_days).toBe(30);
      expect(body.job_description_contains_or).toContain("python");
      expect(body.job_title_or).toEqual(["engineer"]);
      expect(body.limit).toBeLessThanOrEqual(40);
    });
  });

  describe("fetchJobs - Happy Path", () => {
    it("fetches and normalizes jobs (geo, salary, employment, remote/hybrid)", async () => {
      setupFetchMock(() => okResponse({ data: [sampleTheirstackJob], metadata: {} }));
      const result = await fetchJobs({ skills: "python", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      const job = result.jobs[0];
      expect(job.slug).toBe("ts-1234");
      expect(job.externalId).toBe("ts-1234");
      expect(job.title).toBe("Senior Data Engineer");
      expect(job.company_name).toBe("Google");
      expect(job.location).toEqual(["New York"]);
      expect(job.remote).toBe(false);
      expect(job.workplaceType).toBe("hybrid");
      expect(job.tags).toContain("python");
      expect(job.tags).toContain("senior");
      expect(job.url).toBe("https://careers.google.com/jobs/1234");
      expect(job.source).toEqual(["theirstack"]);
      expect(job.descriptionPlain).toContain("Senior Data Engineer");
      expect(job.jobTypes).toEqual(["full_time"]);
      expect(job.salary).toBe("$100,000 - $150,000");
      expect(job.latitude).toBe(40.7128);
      expect(job.longitude).toBe(-74.006);
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(1);
    });

    it("counts returned records as credits (1 per record)", async () => {
      setupFetchMock(() => okResponse({ data: [sampleTheirstackJob, sampleTheirstackJobMinimal], metadata: {} }));
      await fetchJobs({ skills: "", targetRoles: ["engineer"], city: "" });
      expect(vi.mocked(countTheirstackCredits)).toHaveBeenCalledWith(2);
    });

    it("handles minimal job data (missing optional fields)", async () => {
      setupFetchMock(() => okResponse({ data: [sampleTheirstackJobMinimal], metadata: {} }));
      const result = await fetchJobs({ skills: "", targetRoles: ["aushilfe"], city: "" });
      const job = result.jobs[0];
      expect(job.title).toBe("Aushilfe");
      expect(job.company_name).toBe("");
      expect(job.location).toEqual([]);
      expect(job.description).toBeUndefined();
      expect(job.jobTypes).toBeUndefined();
      expect(job.salary).toBeUndefined();
      expect(job.latitude).toBeUndefined();
      expect(job.workplaceType).toBeUndefined();
      expect(job.department).toBeUndefined();
    });

    it("respects MAX_JOBS_TO_AI limit (40)", async () => {
      const many = Array.from({ length: 50 }, (_, i) => ({ ...sampleTheirstackJobMinimal, id: 1000 + i, job_title: `Job ${i} engineer` }));
      setupFetchMock(() => okResponse({ data: many, metadata: {} }));
      const result = await fetchJobs({ skills: "", targetRoles: ["engineer"], city: "" });
      expect(result.jobs.length).toBe(40);
    });
  });

  describe("fetchJobs - Error Handling", () => {
    it("throws HttpError on invalid API key (401)", async () => {
      setupFetchMock(() => new Response(JSON.stringify({ error: { code: "E-001" } }), { status: 401 }));
      await expect(fetchJobs({ skills: "python", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });

    it("throws HttpError on exhausted credits upstream (402)", async () => {
      setupFetchMock(() => new Response(JSON.stringify({ error: {} }), { status: 402 }));
      await expect(fetchJobs({ skills: "python", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });

    it("throws HttpError on rate limit (429)", async () => {
      setupFetchMock(() => new Response("busy", { status: 429 }));
      await expect(fetchJobs({ skills: "python", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 429,
        code: "rate_limited",
      });
    });

    it("throws HttpError on network failure", async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error("Network error");
      });
      await expect(fetchJobs({ skills: "python", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "network",
      });
    });

    it("throws HttpError on invalid JSON response", async () => {
      setupFetchMock(() => new Response("not json", { status: 200 }));
      await expect(fetchJobs({ skills: "python", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });

    it("throws HttpError on non-data JSON response", async () => {
      setupFetchMock(() => okResponse({ metadata: {} }));
      await expect(fetchJobs({ skills: "python", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });
  });

  describe("normalizeTheirstackJob - Contract Compliance", () => {
    it("produces stable provider-prefixed externalId", () => {
      const job = normalizeTheirstackJob(sampleTheirstackJob);
      expect(job.externalId).toBe("ts-1234");
      expect(job.slug).toBe(job.externalId);
    });

    it("prefers company_object name, falls back to company string", () => {
      expect(normalizeTheirstackJob(sampleTheirstackJob).company_name).toBe("Google");
      expect(normalizeTheirstackJob({ ...sampleTheirstackJob, company_object: null }).company_name).toBe("Google");
    });

    it("detects remote from flag, prefers final_url", () => {
      expect(normalizeTheirstackJob({ ...sampleTheirstackJob, remote: true }).remote).toBe(true);
      expect(normalizeTheirstackJob({ ...sampleTheirstackJob, remote: true }).workplaceType).toBe("remote");
    });

    it("builds salary from min/max when no salary_string present", () => {
      const { salary_string, ...rest } = sampleTheirstackJob;
      const job = normalizeTheirstackJob(rest);
      expect(job.salary).toBe("$100000 - $150000");
      expect(normalizeTheirstackJob({ ...rest, min_annual_salary_usd: null, max_annual_salary_usd: null }).salary).toBeUndefined();
    });
  });

  describe("L1 result cache (credit protection)", () => {
    it("serves cached records without paid API call on repeat search", async () => {
      vi.mocked(cacheGet).mockResolvedValue([sampleTheirstackJob]);
      setupFetchMock(() => {
        throw new Error("fetch must not be called on cache hit");
      });
      const result = await fetchJobs({ skills: "python", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].slug).toBe("ts-1234");
      expect(vi.mocked(countTheirstackCredits)).not.toHaveBeenCalled();
    });

    it("stores fresh records under namespaced key after miss", async () => {
      setupFetchMock(() => okResponse({ data: [sampleTheirstackJob], metadata: {} }));
      await fetchJobs({ skills: "python", targetRoles: [], city: "" });
      expect(vi.mocked(cacheSet)).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = vi.mocked(cacheSet).mock.calls[0];
      expect(String(key).startsWith("job-source:theirstack:")).toBe(true);
      expect(Array.isArray(value)).toBe(true);
      expect(ttl).toBe(600);
    });

    it("does not cache empty results", async () => {
      setupFetchMock(() => okResponse({ data: [], metadata: {} }));
      const result = await fetchJobs({ skills: "nothingmatchesthis", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
    });
  });
});
