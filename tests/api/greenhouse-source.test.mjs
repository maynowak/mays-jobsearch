// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/config.mjs", () => ({
  getConfig: vi.fn(() => ({
    jobSourceGreenhouseEnabled: true,
    jobSourceGreenhouseBoards: "test-board,another-board",
  })),
}));

vi.mock("../../api/_lib/usage.mjs", () => ({
  countJobSourceRequest: vi.fn(async () => {}),
}));

const { getConfig } = await import("../../api/_lib/config.mjs");
const { countJobSourceRequest } = await import("../../api/_lib/usage.mjs");
const { fetchJobs, normalizeGreenhouseJob } = await import("../../api/_lib/sources/greenhouse.mjs");
const { jobKey } = await import("../../api/_lib/sources/index.mjs");

const sampleGreenhouseJob = {
  id: 123456,
  title: "Senior Frontend Engineer",
  company_name: "Acme Corp",
  location: { name: "Berlin, Germany" },
  offices: [
    { name: "Berlin" },
    { name: "Munich" },
    { name: "Remote" },
  ],
  departments: [
    { name: "Engineering" },
  ],
  tags: ["react", "typescript", "frontend"],
  content: "<p><strong>About Acme</strong></p><p>We are hiring a Senior Frontend Engineer...</p>",
  absolute_url: "https://boards.greenhouse.io/test-board/jobs/123456",
  updated_at: "2024-01-15T10:30:00Z",
  employment_type: "full_time",
};

const sampleGreenhouseJobMinimal = {
  id: 789012,
  title: "Backend Developer",
  company_name: "Minimal Corp",
  location: { name: "Hamburg" },
  offices: [],
  departments: [],
  tags: [],
  content: "",
  absolute_url: "https://boards.greenhouse.io/test-board/jobs/789012",
  updated_at: null,
  employment_type: null,
};

function createBoardMock(boardsConfig) {
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("boards-api.greenhouse.io")) {
      const boardMatch = u.match(/\/boards\/([^/]+)\/jobs/);
      const board = boardMatch ? decodeURIComponent(boardMatch[1]) : "test-board";
      const config = boardsConfig[board] || { jobs: [], status: 200 };
      if (config.error) {
        return new Response(JSON.stringify(config.error), { status: config.status });
      }
      return new Response(JSON.stringify(config.jobs), { status: config.status });
    }
    throw new Error(`unexpected fetch: ${u}`);
  });
}

function setupFetchNetworkError() {
  globalThis.fetch = vi.fn(async () => {
    throw new Error("Network error");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfig).mockReturnValue({
    jobSourceGreenhouseEnabled: true,
    jobSourceGreenhouseBoards: "test-board,another-board",
  });
  vi.mocked(countJobSourceRequest).mockResolvedValue(undefined);
});

describe("Greenhouse Source Adapter", () => {
  describe("Configuration", () => {
    it("exports required interface fields", () => {
      expect(fetchJobs).toBeDefined();
    });

    it("enabled() returns true when configured", async () => {
      const { enabled } = await import("../../api/_lib/sources/greenhouse.mjs");
      expect(enabled()).toBe(true);
    });

    it("enabled() returns false when disabled", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceGreenhouseEnabled: false,
        jobSourceGreenhouseBoards: "",
      });
      const { enabled } = await import("../../api/_lib/sources/greenhouse.mjs");
      expect(enabled()).toBe(false);
    });

    it("JOB-SOURCES-01: enabled() returns false when enabled but no boards (honest enabled)", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceGreenhouseEnabled: true,
        jobSourceGreenhouseBoards: "",
      });
      const { enabled } = await import("../../api/_lib/sources/greenhouse.mjs");
      expect(enabled()).toBe(false);
    });
  });

  describe("fetchJobs - Happy Path", () => {
    it("fetches and normalizes jobs from multiple boards", async () => {
      const jobWithBerlin = { ...sampleGreenhouseJobMinimal, location: { name: "Berlin" }, tags: ["react"], title: "Frontend Engineer" };
      createBoardMock({
        "test-board": { jobs: [sampleGreenhouseJob], status: 200 },
        "another-board": { jobs: [jobWithBerlin], status: 200 },
      });

      const result = await fetchJobs({ skills: "react", targetRoles: ["frontend"], city: "berlin" });

      expect(result.jobs.length).toBe(2);
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.reason).toBeNull();
      expect(result.meta.totalScanned).toBe(2);
      expect(result.meta.totalFiltered).toBe(2);
    });

    it("returns jobs with all required normalized fields", async () => {
      createBoardMock({ "test-board": { jobs: [sampleGreenhouseJob], status: 200 } });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      const job = result.jobs[0];

      expect(job.slug).toBe("gh-123456");
      expect(job.externalId).toBe("gh-123456");
      expect(job.title).toBe("Senior Frontend Engineer");
      expect(job.company_name).toBe("Acme Corp");
      expect(job.location).toEqual(["Berlin, Germany", "Berlin", "Munich", "Remote"]);
      expect(job.remote).toBe(true);
      expect(job.tags).toEqual(["Engineering", "react", "typescript", "frontend"]);
      expect(job.url).toBe("https://boards.greenhouse.io/test-board/jobs/123456");
      expect(job.created_at).toBe(Math.floor(Date.parse("2024-01-15T10:30:00Z") / 1000));
      expect(job.source).toEqual(["greenhouse", "ats"]);
      expect(job.description).toContain("<p><strong>About Acme</strong></p>");
      expect(job.descriptionPlain).toContain("About Acme");
      expect(job.language).toBe("en");
      expect(job.jobTypes).toEqual(["full_time"]);
      expect(job.applyUrl).toBe("https://boards.greenhouse.io/test-board/jobs/123456");
      expect(job.jobUrl).toBe("https://boards.greenhouse.io/test-board/jobs/123456");
      expect(job.workplaceType).toBeUndefined();
      expect(job.department).toBe("Engineering");
    });

    it("handles minimal job data (missing optional fields)", async () => {
      createBoardMock({ "test-board": { jobs: [sampleGreenhouseJobMinimal], status: 200 } });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      const job = result.jobs[0];

      expect(job.slug).toBe("gh-789012");
      expect(job.externalId).toBe("gh-789012");
      expect(job.title).toBe("Backend Developer");
      expect(job.company_name).toBe("Minimal Corp");
      expect(job.location).toEqual(["Hamburg"]);
      expect(job.remote).toBe(false);
      expect(job.tags).toEqual([]);
      expect(job.description).toBeUndefined();
      expect(job.descriptionPlain).toBeUndefined();
      expect(job.language).toBeUndefined();
      expect(job.jobTypes).toBeUndefined();
      expect(job.applyUrl).toBe("https://boards.greenhouse.io/test-board/jobs/789012");
      expect(job.jobUrl).toBe("https://boards.greenhouse.io/test-board/jobs/789012");
      expect(job.department).toBeUndefined();
    });

    it("filters by city (location matching)", async () => {
      createBoardMock({
        "test-board": {
          jobs: [
            { ...sampleGreenhouseJob, id: 1, location: { name: "Berlin" }, offices: [] },
            { ...sampleGreenhouseJob, id: 2, location: { name: "Munich" }, offices: [] },
          ],
          status: 200,
        },
      });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "berlin" });
      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].location[0]).toBe("Berlin");
    });

    it("filters by keywords (skills + targetRoles)", async () => {
      const job1 = { ...sampleGreenhouseJob, id: 1, title: "React Developer", tags: ["react"], content: "" };
      const job2 = { ...sampleGreenhouseJob, id: 2, title: "Python Engineer", tags: ["python"], content: "" };
      createBoardMock({
        "test-board": {
          jobs: [job1, job2],
          status: 200,
        },
      });

      const result = await fetchJobs({ skills: "react", targetRoles: ["frontend"], city: "" });
      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].title).toBe("React Developer");
    });

    it("respects MAX_JOBS_TO_AI limit (40)", async () => {
      const manyJobs = Array.from({ length: 50 }, (_, i) => ({
        ...sampleGreenhouseJob,
        id: 1000 + i,
        title: `Job ${i}`,
      }));
      createBoardMock({ "test-board": { jobs: manyJobs, status: 200 } });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(40);
    });
  });

  describe("fetchJobs - Error Handling", () => {
    it("returns empty result when no boards configured", async () => {
      vi.mocked(getConfig).mockReturnValue({
        jobSourceGreenhouseEnabled: true,
        jobSourceGreenhouseBoards: "",
      });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(false);
      expect(result.meta.reason).toBe("no_boards_configured");
    });

    it("continues with other boards when one fails (404)", async () => {
      createBoardMock({
        "test-board": { jobs: [], status: 404, error: { error: "Not found" } },
        "another-board": { jobs: [sampleGreenhouseJob], status: 200 },
      });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs.length).toBe(1);
      expect(result.meta.totalScanned).toBe(1);
    });

    it("returns empty result when all boards rate limited (429)", async () => {
      createBoardMock({
        "test-board": { jobs: [], status: 429, error: { error: "Rate limited" } },
        "another-board": { jobs: [], status: 429, error: { error: "Rate limited" } },
      });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(0);
      expect(result.meta.totalFiltered).toBe(0);
    });

    it("returns empty result when all boards server error (500)", async () => {
      createBoardMock({
        "test-board": { jobs: [], status: 500, error: { error: "Server error" } },
        "another-board": { jobs: [], status: 500, error: { error: "Server error" } },
      });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(0);
      expect(result.meta.totalFiltered).toBe(0);
    });

    it("returns empty result on network failure", async () => {
      setupFetchNetworkError();

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(0);
      expect(result.meta.totalFiltered).toBe(0);
    });

    it("returns empty result on invalid JSON response", async () => {
      createBoardMock({
        "test-board": { jobs: "not json", status: 200 },
        "another-board": { jobs: "not json", status: 200 },
      });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(0);
      expect(result.meta.totalFiltered).toBe(0);
    });

    it("returns empty result on non-array JSON response", async () => {
      createBoardMock({
        "test-board": { jobs: { jobs: [] }, status: 200 },
        "another-board": { jobs: { jobs: [] }, status: 200 },
      });

      const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
      expect(result.jobs).toEqual([]);
      expect(result.meta.enabled).toBe(true);
      expect(result.meta.totalScanned).toBe(0);
      expect(result.meta.totalFiltered).toBe(0);
    });
  });

  describe("normalizeGreenhouseJob - Contract Compliance", () => {
    it("produces stable externalId with provider prefix", () => {
      const job = normalizeGreenhouseJob(sampleGreenhouseJob);
      expect(job.externalId).toBe("gh-123456");
      expect(job.externalId).toMatch(/^gh-\d+$/);
    });

    it("externalId equals slug", () => {
      const job = normalizeGreenhouseJob(sampleGreenhouseJob);
      expect(job.slug).toBe(job.externalId);
    });

    it("handles missing location gracefully", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, location: null, offices: [] });
      expect(job.location).toEqual([]);
      expect(job.remote).toBe(false);
    });

    it("handles missing departments gracefully", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, departments: null });
      expect(job.department).toBeUndefined();
      expect(job.tags).toEqual(["react", "typescript", "frontend"]);
    });

    it("handles missing tags gracefully", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, tags: null });
      expect(job.tags).toEqual(["Engineering"]);
    });

    it("detects remote from location name", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, location: { name: "Remote, Germany" }, offices: [] });
      expect(job.remote).toBe(true);
    });

    it("detects remote from offices", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, location: { name: "Berlin" }, offices: [{ name: "Remote" }] });
      expect(job.remote).toBe(true);
    });

    it("parses updated_at timestamp correctly", () => {
      const job = normalizeGreenhouseJob(sampleGreenhouseJob);
      expect(job.created_at).toBe(Math.floor(Date.parse("2024-01-15T10:30:00Z") / 1000));
    });

    it("handles null updated_at", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, updated_at: null });
      expect(job.created_at).toBeUndefined();
    });

    it("handles invalid updated_at", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, updated_at: "invalid" });
      expect(job.created_at).toBeUndefined();
    });

    it("strips HTML from description for descriptionPlain", () => {
      const job = normalizeGreenhouseJob(sampleGreenhouseJob);
      expect(job.descriptionPlain).not.toContain("<p>");
      expect(job.descriptionPlain).not.toContain("<strong>");
      expect(job.descriptionPlain).toContain("About Acme");
    });

    it("returns undefined for empty description", () => {
      const job = normalizeGreenhouseJob({ ...sampleGreenhouseJob, content: "" });
      expect(job.description).toBeUndefined();
      expect(job.descriptionPlain).toBeUndefined();
    });
  });

  describe("Deduplication Key Generation", () => {
    it("generates consistent jobKey for same job", () => {
      const job = normalizeGreenhouseJob(sampleGreenhouseJob);
      const key1 = jobKey(job);
      const key2 = jobKey(job);
      expect(key1).toBe(key2);
    });

    it("jobKey includes title, company, location", () => {
      const job = normalizeGreenhouseJob(sampleGreenhouseJob);
      const key = jobKey(job);
      expect(key).toContain("senior frontend engineer");
      expect(key).toContain("acme corp");
      expect(key).toContain("berlin");
    });
  });
});

describe("Common ATS Source Contract Compliance", () => {
  it("fetchJobs accepts targetRoles array (new format)", async () => {
    createBoardMock({ "test-board": { jobs: [sampleGreenhouseJob], status: 200 } });
    const result = await fetchJobs({ skills: "react", targetRoles: ["frontend", "engineer"], city: "berlin" });
    expect(result.jobs.length).toBeGreaterThanOrEqual(0);
  });

  it("fetchJobs accepts targetRole string (legacy format)", async () => {
    createBoardMock({ "test-board": { jobs: [sampleGreenhouseJob], status: 200 } });
    const result = await fetchJobs({ skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBeGreaterThanOrEqual(0);
  });

  it("fetchJobs handles empty params", async () => {
    createBoardMock({ "test-board": { jobs: [sampleGreenhouseJob], status: 200 } });
    const result = await fetchJobs({});
    expect(result.jobs.length).toBeGreaterThanOrEqual(0);
  });

  it("returns meta with required fields", async () => {
    createBoardMock({ "test-board": { jobs: [sampleGreenhouseJob], status: 200 } });
    const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
    expect(result.meta).toHaveProperty("enabled");
    expect(result.meta).toHaveProperty("reason");
    expect(result.meta).toHaveProperty("totalScanned");
    expect(result.meta).toHaveProperty("totalFiltered");
    expect(typeof result.meta.totalScanned).toBe("number");
    expect(typeof result.meta.totalFiltered).toBe("number");
  });

  it("all jobs have source array containing 'greenhouse' and 'ats'", async () => {
    createBoardMock({ "test-board": { jobs: [sampleGreenhouseJob], status: 200 } });
    const result = await fetchJobs({ skills: "", targetRoles: [], city: "" });
    for (const job of result.jobs) {
      expect(job.source).toContain("greenhouse");
      expect(job.source).toContain("ats");
    }
  });
});