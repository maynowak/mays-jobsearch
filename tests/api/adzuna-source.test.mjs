// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/config.mjs", () => ({
  getConfig: vi.fn(() => ({
    jobSourceAdzunaEnabled: true,
    adzunaAppId: "test-app-id",
    adzunaAppKey: "test-app-key",
    adzunaCountries: "de",
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
const { fetchJobs, normalizeAdzunaJob } = await import("../../api/_lib/sources/adzuna.mjs");

const sampleAdzunaJob = {
  id: "1234567890",
  title: "Senior Frontend Engineer (m/w/d)",
  company: { display_name: "Acme GmbH" },
  location: { display_name: "Berlin", area: ["Berlin", "Deutschland"] },
  description: "<p>We are hiring a <strong>Senior Frontend Engineer</strong> to join our team in Berlin. You will work with modern tools and help us build great products for our customers across Europe.</p>",
  redirect_url: "https://www.adzuna.de/details/1234567890",
  created: "2026-09-20T10:30:00Z",
  salary_min: 70000,
  salary_max: 90000,
  contract_time: "full_time",
  category: { label: "IT-Jobs" },
  latitude: 52.52,
  longitude: 13.405,
};

const sampleAdzunaJobMinimal = {
  id: "999",
  title: "Aushilfe",
  company: { display_name: "" },
  location: { display_name: "Hamburg" },
  description: "",
  redirect_url: "https://www.adzuna.de/details/999",
  created: null,
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
    jobSourceAdzunaEnabled: true,
    adzunaAppId: "test-app-id",
    adzunaAppKey: "test-app-key",
    adzunaCountries: "de",
  });
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
});

describe("Adzuna Source Adapter", () => {
  describe("Configuration", () => {
    it("returns empty result when credentials are missing", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceAdzunaEnabled: true,
        adzunaAppId: "",
        adzunaAppKey: "",
        adzunaCountries: "de",
      });
      setupFetchMock(() => {
        throw new Error("fetch must not be called without credentials");
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(false);
      expect(result.meta.reason).toBe("missing_config");
    });

    it("returns empty result when no countries configured", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceAdzunaEnabled: true,
        adzunaAppId: "id",
        adzunaAppKey: "key",
        adzunaCountries: "",
      });
      setupFetchMock(() => {
        throw new Error("fetch must not be called without countries");
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.reason).toBe("no_countries_configured");
    });

    it("sends app_id/app_key and native what/where params", async () => {
      let seenUrl = "";
      setupFetchMock((url) => {
        seenUrl = url;
        return okResponse({ count: 0, results: [] });
      });
      await fetchJobs({ skills: "react", targetRoles: ["frontend"], city: "berlin" });
      expect(seenUrl).toContain("api.adzuna.com/v1/api/jobs/de/search/1");
      expect(seenUrl).toContain("app_id=test-app-id");
      // Adzuna auth is query-param based by design (server-side only, never in frontend)
      expect(seenUrl).toContain("app_key=test-app-key");
      expect(seenUrl).toContain("what=");
      expect(seenUrl).toContain("where=berlin");
    });
  });

  describe("fetchJobs - Happy Path", () => {
    it("fetches and normalizes jobs with geodata and salary", async () => {
      setupFetchMock(() => okResponse({ count: 1, results: [sampleAdzunaJob] }));
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      const job = result.jobs[0];
      expect(job.slug).toBe("az-de-1234567890");
      expect(job.externalId).toBe("az-de-1234567890");
      expect(job.title).toBe("Senior Frontend Engineer (m/w/d)");
      expect(job.company_name).toBe("Acme GmbH");
      expect(job.location).toEqual(["Berlin", "Deutschland"]);
      expect(job.tags).toEqual(["IT-Jobs"]);
      expect(job.url).toBe("https://www.adzuna.de/details/1234567890");
      expect(job.source).toEqual(["adzuna"]);
      expect(job.description).toContain("<strong>Senior Frontend Engineer</strong>");
      expect(job.descriptionPlain).toContain("Senior Frontend Engineer");
      expect(job.language).toBe("en");
      expect(job.jobTypes).toEqual(["full_time"]);
      expect(job.applyUrl).toBe("https://www.adzuna.de/details/1234567890");
      expect(job.salary).toBe("70000 - 90000");
      expect(job.latitude).toBe(52.52);
      expect(job.longitude).toBe(13.405);
      expect(job.department).toBe("IT-Jobs");
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(1);
    });

    it("handles minimal job data (missing optional fields)", async () => {
      setupFetchMock(() => okResponse({ count: 1, results: [sampleAdzunaJobMinimal] }));
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      const job = result.jobs[0];
      expect(job.title).toBe("Aushilfe");
      expect(job.location).toEqual(["Hamburg"]);
      expect(job.description).toBeUndefined();
      expect(job.jobTypes).toBeUndefined();
      expect(job.salary).toBeUndefined();
      expect(job.latitude).toBeUndefined();
      expect(job.longitude).toBeUndefined();
    });

    it("continues with other countries when one fails, but throws when all fail", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceAdzunaEnabled: true,
        adzunaAppId: "id",
        adzunaAppKey: "key",
        adzunaCountries: "de,xx",
      });
      setupFetchMock((url) => {
        if (url.includes("/jobs/xx/search/")) {
          return new Response("not found", { status: 404 });
        }
        return okResponse({ count: 1, results: [sampleAdzunaJobMinimal] });
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      expect(result.meta.totalScanned).toBe(1);
    });

    it("queries multiple countries and merges results", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceAdzunaEnabled: true,
        adzunaAppId: "id",
        adzunaAppKey: "key",
        adzunaCountries: "de,gb",
      });
      const seen = [];
      setupFetchMock((url) => {
        seen.push(url);
        return okResponse({ count: 1, results: [{ ...sampleAdzunaJobMinimal, id: `job-${seen.length}` }] });
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(2);
      expect(result.meta.totalScanned).toBe(2);
      expect(seen.some((u) => u.includes("/jobs/de/search/"))).toBe(true);
      expect(seen.some((u) => u.includes("/jobs/gb/search/"))).toBe(true);
    });

    it("filters by city and keywords", async () => {
      setupFetchMock(() => okResponse({ count: 2, results: [sampleAdzunaJob, sampleAdzunaJobMinimal] }));
      const result = await fetchJobs({ skills: "frontend", targetRoles: [], city: "berlin" });
      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].title).toContain("Frontend");
    });

    it("respects MAX_JOBS_TO_AI limit (40)", async () => {
      const many = Array.from({ length: 50 }, (_, i) => ({ ...sampleAdzunaJobMinimal, id: `j-${i}` }));
      setupFetchMock(() => okResponse({ count: 50, results: many }));
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(40);
    });
  });

  describe("fetchJobs - Error Handling", () => {
    it("throws HttpError on invalid credentials (401)", async () => {
      setupFetchMock(() => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });

    it("throws HttpError on unknown country (404)", async () => {
      setupFetchMock(() => new Response("not found", { status: 404 }));
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 404,
        code: "not_found",
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

    it("throws HttpError on non-results JSON response", async () => {
      setupFetchMock(() => okResponse({ count: 0 }));
      await expect(fetchJobs({ skills: "", targetRoles: [], city: "" })).rejects.toMatchObject({
        status: 502,
        code: "upstream",
      });
    });
  });

  describe("normalizeAdzunaJob - Contract Compliance", () => {
    it("produces stable provider-prefixed externalId with country", () => {
      const job = normalizeAdzunaJob(sampleAdzunaJob, "de");
      expect(job.externalId).toBe("az-de-1234567890");
      expect(job.slug).toBe(job.externalId);
    });

    it("detects remote from location", () => {
      const job = normalizeAdzunaJob(
        { ...sampleAdzunaJob, location: { display_name: "Remote", area: [] } },
        "de"
      );
      expect(job.remote).toBe(true);
    });

    it("formats salary variants without inventing currency", () => {
      expect(normalizeAdzunaJob({ ...sampleAdzunaJob, salary_min: 50000, salary_max: null }, "de").salary).toBe("ab 50000");
      expect(normalizeAdzunaJob({ ...sampleAdzunaJob, salary_min: null, salary_max: 80000 }, "de").salary).toBe("bis 80000");
      expect(normalizeAdzunaJob({ ...sampleAdzunaJob, salary_min: null, salary_max: null }, "de").salary).toBeUndefined();
    });

    it("strips HTML from description for descriptionPlain", () => {
      const job = normalizeAdzunaJob(sampleAdzunaJob, "de");
      expect(job.descriptionPlain).not.toContain("<p>");
      expect(job.descriptionPlain).toContain("Senior Frontend Engineer");
    });
  });

  describe("L1 result cache (quota protection)", () => {
    it("serves cached country payload without paid API call on repeat search", async () => {
      vi.mocked(cacheGet).mockResolvedValue([{ job: sampleAdzunaJob, country: "de" }]);
      setupFetchMock(() => {
        throw new Error("fetch must not be called on cache hit");
      });
      const result = await fetchJobs({ skills: "frontend", targetRoles: [], city: "berlin" });
      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].slug).toBe("az-de-1234567890");
      expect(result.meta.totalScanned).toBe(1);
    });

    it("stores fresh country payload under namespaced key after miss", async () => {
      setupFetchMock(() => okResponse({ count: 1, results: [sampleAdzunaJob] }));
      await fetchJobs({ skills: "frontend", targetRoles: [], city: "berlin" });
      expect(vi.mocked(cacheSet)).toHaveBeenCalledTimes(1);
      const [key, value, ttl] = vi.mocked(cacheSet).mock.calls[0];
      expect(String(key).startsWith("job-source:adzuna:de|")).toBe(true);
      expect(Array.isArray(value)).toBe(true);
      expect(ttl).toBe(600);
    });

    it("caches per country independently", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceAdzunaEnabled: true,
        adzunaAppId: "id",
        adzunaAppKey: "key",
        adzunaCountries: "de,gb",
      });
      vi.mocked(cacheGet).mockImplementation(async (key) =>
        String(key).includes(":de|") ? [{ job: sampleAdzunaJobMinimal, country: "de" }] : null
      );
      const seen = [];
      setupFetchMock((url) => {
        seen.push(url);
        return okResponse({ count: 0, results: [] });
      });
      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      expect(seen.some((u) => u.includes("/jobs/gb/search/"))).toBe(true);
      expect(seen.some((u) => u.includes("/jobs/de/search/"))).toBe(false);
    });

    it("does not cache empty results", async () => {
      setupFetchMock(() => okResponse({ count: 0, results: [] }));
      const result = await fetchJobs({ skills: "nothingmatchesthis", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
    });
  });
});
