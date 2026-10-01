// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/config.mjs", () => ({
  getConfig: vi.fn(() => ({
    jobSourceJobspipeEnabled: true,
    jobspipeApiKey: "test-jobspipe-key",
    jobspipeMonthlyMaxCredits: 200,
    jobspipeMaxCreditsPerUser: 20,
  })),
}));

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
}));

vi.mock("../../api/_lib/usage.mjs", () => ({
  countJobSourceCacheHit: vi.fn(async () => {}),
  countJobSourceCacheMiss: vi.fn(async () => {}),
  countJobspipeCredits: vi.fn(async () => {}),
  countJobspipeUserCredits: vi.fn(async () => {}),
  jobspipeCreditLimitReached: vi.fn(async () => false),
  jobspipeUserCreditLimitReached: vi.fn(async () => false),
}));

const { getConfig } = await import("../../api/_lib/config.mjs");
const { cacheGet, cacheSet } = await import("../../api/_lib/cache.mjs");
const { fetchJobs, normalizeJobspipeJob, enabled } = await import(
  "../../api/_lib/sources/jobspipe.mjs"
);

const sampleJobspipeJob = {
  id: "abc-123",
  job_title: "Senior Frontend Developer",
  company: "Tech Corp",
  company_object: { name: "Tech Corp" },
  location: "Berlin, Germany",
  long_location: "Berlin, Berlin, Germany",
  cities: ["Berlin"],
  country_code: "DE",
  remote: false,
  hybrid: false,
  technology_slugs: ["react", "typescript"],
  keyword_slugs: ["frontend", "css"],
  seniority: "senior",
  employment_statuses: ["full_time"],
  salary_string: "$80,000 - $100,000",
  min_annual_salary_usd: 80000,
  max_annual_salary_usd: 100000,
  date_posted: "2026-09-20T10:30:00+02:00",
  url: "https://example.com/jobs/abc-123",
  source_url: "https://source.example/j/1",
  description: "We are hiring a Senior Frontend Developer with React experience...",
  language: "en",
};

function setupFetchMock(respond) {
  globalThis.fetch = vi.fn(async (url, options) => respond(String(url), options));
}

function okResponse(body) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function baseConfig() {
  return {
    jobSourceJobspipeEnabled: true,
    jobspipeApiKey: "test-jobspipe-key",
    jobspipeMonthlyMaxCredits: 200,
    jobspipeMaxCreditsPerUser: 20,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfig).mockReturnValue(baseConfig());
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
});

describe("JobsPipe Source Adapter", () => {
  describe("Configuration", () => {
    it("enabled() is true with flag + key", () => {
      expect(enabled()).toBe(true);
    });

    it("enabled() is false without key (honest enabled)", () => {
      vi.mocked(getConfig).mockReturnValue({ ...baseConfig(), jobspipeApiKey: "" });
      expect(enabled()).toBe(false);
    });

    it("enabled() is false when flag off", () => {
      vi.mocked(getConfig).mockReturnValue({ ...baseConfig(), jobSourceJobspipeEnabled: false });
      expect(enabled()).toBe(false);
    });

    it("returns empty result when API key is missing", async () => {
      vi.mocked(getConfig).mockReturnValue({ ...baseConfig(), jobspipeApiKey: "" });
      setupFetchMock(() => {
        throw new Error("fetch must not be called without API key");
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(false);
      expect(result.meta.reason).toBe("missing_config");
    });

    it("returns no_query without search terms", async () => {
      setupFetchMock(() => {
        throw new Error("fetch must not be called without query");
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.reason).toBe("no_query");
    });

    it("uses Bearer auth and skills_or/job_title_or body", async () => {
      let seenUrl = "";
      let seenOptions = null;
      setupFetchMock((url, options) => {
        seenUrl = url;
        seenOptions = options;
        return okResponse({ metadata: {}, data: [] });
      });
      await fetchJobs({ skills: "react", targetRoles: ["frontend"], city: "" });
      expect(seenUrl).toBe("https://api.jobspipe.dev/v1/jobs/search");
      expect(seenOptions.method).toBe("POST");
      expect(seenOptions.headers.Authorization).toBe("Bearer test-jobspipe-key");
      const body = JSON.parse(seenOptions.body);
      expect(body.skills_or).toContain("react");
      expect(body.job_title_or).toContain("frontend");
      expect(body.limit).toBe(40);
      expect(body.posted_at_max_age_days).toBe(30);
    });
  });

  describe("fetchJobs - Happy Path", () => {
    it("fetches and normalizes jobs", async () => {
      setupFetchMock(() => okResponse({ metadata: {}, data: [sampleJobspipeJob] }));
      const result = await fetchJobs({ skills: "react", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      const job = result.jobs[0];
      expect(job.slug).toBe("jp-abc-123");
      expect(job.externalId).toBe("jp-abc-123");
      expect(job.title).toBe("Senior Frontend Developer");
      expect(job.company_name).toBe("Tech Corp");
      expect(job.source).toEqual(["jobspipe"]);
      expect(job.tags).toEqual(expect.arrayContaining(["react", "typescript", "frontend", "senior"]));
      expect(job.url).toBe("https://example.com/jobs/abc-123");
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.reason).toBeNull();
    });

    it("normalize handles minimal job", () => {
      const job = normalizeJobspipeJob({ id: 999, job_title: "Aushilfe" });
      expect(job.slug).toBe("jp-999");
      expect(job.title).toBe("Aushilfe");
      expect(job.source).toEqual(["jobspipe"]);
    });
  });

  describe("fetchJobs - Errors", () => {
    it("401 maps to upstream (bad credentials)", async () => {
      setupFetchMock(() => new Response("unauthorized", { status: 401 }));
      const result = await fetchJobs({ skills: "react", targetRoles: [], city: "" }).catch((e) => e);
      expect(result.code ?? result.meta?.reason).toBe("upstream");
    });

    it("429 maps to rate_limited", async () => {
      setupFetchMock(() => new Response("busy", { status: 429 }));
      const result = await fetchJobs({ skills: "react", targetRoles: [], city: "" }).catch((e) => e);
      expect(result.code ?? result.meta?.reason).toBe("rate_limited");
    });

    it("invalid JSON maps to upstream", async () => {
      setupFetchMock(() => new Response("not-json{{", { status: 200 }));
      const result = await fetchJobs({ skills: "react", targetRoles: [], city: "" }).catch((e) => e);
      expect(result.code ?? result.meta?.reason).toBe("upstream");
    });

    it("non-array data maps to upstream", async () => {
      setupFetchMock(() => okResponse({ metadata: {}, data: null }));
      const result = await fetchJobs({ skills: "react", targetRoles: [], city: "" }).catch((e) => e);
      expect(result.code ?? result.meta?.reason).toBe("upstream");
    });
  });
});
