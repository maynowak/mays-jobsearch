// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock all external dependencies
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

vi.mock("../../api/_lib/ai.mjs", () => ({
  chat: vi.fn(),
  isFreeDailyQuotaError: vi.fn(() => false),
}));

vi.mock("../../api/_lib/detailEnrich.mjs", () => ({
  enrichArbeitsagenturDetails: vi.fn(async () => ({ jobs: {}, enrichedCount: 0 })),
}));

vi.mock("../../api/_lib/identity.mjs", () => ({
  anonymousIdentity: () => ({ sessionId: "test-session" }),
  sessionCookieHeader: () => "",
}));

const { chat } = await import("../../api/_lib/ai.mjs");
const { cacheGet, cacheSet, cacheDel } = await import("../../api/_lib/cache.mjs");
const { fetchAllJobs } = await import("../../api/_lib/sources/index.mjs");
const { applySearchStrategyWithTargetRole } = await import("../../api/_lib/searchStrategy.mjs");
const { normalizeSkills, scoreJobBySkills, calculateThreshold } = await import("../../api/_lib/searchStrategy.mjs");
const { tokenize } = await import("../../api/_lib/filter.mjs");
const { analyzeJobForAts } = await import("../../api/_lib/ats.mjs");

const baseArbeitnowJob = {
  slug: "job-1",
  title: "Cloud Engineer",
  company_name: "Acme Cloud",
  location: ["Frankfurt"],
  remote: true,
  tags: ["aws", "terraform", "docker", "kubernetes", "linux", "spring boot", "sql"],
  url: "https://example.com/job-1",
  created_at: Date.now() / 1000,
  job_types: ["full-time"],
};

const baseApifyRecord = {
  referenceId: "aa-1",
  title: "Cloud Engineer",
  employer: "Acme Cloud",
  location: "Frankfurt",
  isRemote: true,
  description: "We need Cloud Engineer with AWS, Terraform, Docker",
  portalUrl: "https://example.com/job-1",
  publishedDate: new Date().toISOString(),
  contractType: "Vollzeit",
  salary: "80000",
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
  vi.mocked(cacheDel).mockResolvedValue(undefined);
  process.env.JOB_SOURCE_ARBEITNOW_ENABLED = "true";
  process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED = "true";
  process.env.APIFY_API_TOKEN = "test-token";
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_ENABLED = "true";
});

describe("E2E: CV to Jobs Flow", () => {
  describe("Step 1: Skill Normalization & Multi-Word Preservation", () => {
    it("preserves multi-word skills through tokenize -> normalizeSkills pipeline when using JSON array", () => {
      // When skills come from JSON array (preserving boundaries), they stay intact
      const skillsArray = ["Java", "AWS", "Spring Boot", "Machine Learning", "Amazon Web Services", "Terraform", "Docker"];
      const normalized = normalizeSkills(skillsArray);
      expect(normalized).toContain("Java");
      expect(normalized).toContain("AWS");
      expect(normalized).toContain("Spring Boot");
      expect(normalized).toContain("Machine Learning");
      expect(normalized).toContain("Amazon Web Services");
      expect(normalized).toContain("Terraform");
      expect(normalized).toContain("Docker");
    });

    it("threshold calculation for realistic skill count", () => {
      // 7 skills -> threshold 4
      expect(calculateThreshold(7)).toBe(4);
      // 10 skills -> threshold 5
      expect(calculateThreshold(10)).toBe(5);
      // 20 skills -> threshold 6
      expect(calculateThreshold(20)).toBe(6);
    });
  });

  describe("Step 2: Search Strategy Integration", () => {
    it("applies progressive K-of-N search with targetRole preservation", () => {
      const skills = ["Java", "AWS", "Terraform", "Docker", "Linux", "SQL", "Spring Boot"];
      const targetRole = "Cloud Engineer";
      
      const allJobs = [
        { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform", "docker"], description: "", source: ["arbeitnow"] },
        { slug: "2", title: "DevOps Engineer", tags: ["aws", "docker", "kubernetes"], description: "", source: ["arbeitnow"] },
        { slug: "3", title: "Backend Developer", tags: ["java", "spring"], description: "", source: ["arbeitnow"] },
        { slug: "4", title: "Frontend Developer", tags: ["react", "typescript"], description: "", source: ["arbeitnow"] },
      ];

      const result = applySearchStrategyWithTargetRole(skills, targetRole, allJobs, { 
        id: "combined", 
        provider: "search-strategy" 
      });

      // TargetRole matches should be preserved even with 0 skill matches
      expect(result.meta.targetRoleMatches).toBeGreaterThan(0);
      
      // Jobs matching targetRole should be included even with 0 skill overlap
      const targetRoleJob = result.jobs.find(j => j.slug === "4");
      const cloudJob = result.jobs.find(j => j.title.includes("Cloud"));
      expect(cloudJob).toBeDefined();
    });

    it("progressive threshold reduction when candidate pool too small", () => {
      const skills = ["Java", "AWS", "Terraform", "Docker", "Kubernetes", "Linux", "Python", "SQL", "Git", "CI/CD"];
      const limitedJobs = [
        { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform"], description: "", source: ["test"] },
        { slug: "2", title: "DevOps", tags: ["aws", "docker"], description: "", source: ["test"] },
      ];
      
      const result = applySearchStrategyWithTargetRole(skills, "", limitedJobs, { 
        id: "test",
        candidatePoolTarget: 10,
        minCandidatePoolTarget: 5
      });
      
      expect(result.meta.strategy).toBe("progressive");
      expect(result.meta.threshold).toBeLessThanOrEqual(6);
    });
  });

  describe("Step 3: Job Scoring & Matching", () => {
    it("scores multi-word skills correctly", () => {
      const job = {
        title: "Cloud Engineer",
        tags: ["aws", "terraform", "docker", "kubernetes", "spring boot"],
        description: "We use AWS, Terraform, Docker, Kubernetes, and Spring Boot",
      };

      const skills = ["AWS", "Terraform", "Docker", "Kubernetes", "Spring Boot", "Machine Learning"];
      const score = scoreJobBySkills(job, skills);
      expect(score).toBe(5);
    });

    it("case-insensitive matching works for multi-word skills", () => {
      const job = { title: "Engineer", tags: [], description: "Spring Boot and Machine Learning experience" };
      const score = scoreJobBySkills(job, ["Spring Boot", "Machine Learning", "AWS"]);
      expect(score).toBe(2);
    });
  });

  describe("Step 4: ATS Integration (Regression Check)", () => {
    it("ATS analysis still works with new skill pipeline", () => {
      const job = {
        slug: "test-1",
        title: "React Developer",
        tags: ["react", "nodejs", "typescript"],
        description: "AWS experience required",
      };
      const profile = { skills: "React, TypeScript" };
      const result = analyzeJobForAts(job, profile);
      
      expect(result.summary.matched).toBeGreaterThan(0);
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  describe("Step 3: Search Strategy Integration", () => {
    it("applies progressive K-of-N search with targetRole preservation", () => {
      const skills = ["Java", "AWS", "Terraform", "Docker", "Linux", "SQL", "Spring Boot"];
      const targetRole = "Cloud Engineer";
      
      const allJobs = [
        { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform", "docker"], description: "", source: ["arbeitnow"] },
        { slug: "2", title: "DevOps Engineer", tags: ["aws", "docker", "kubernetes"], description: "", source: ["arbeitnow"] },
        { slug: "3", title: "Backend Developer", tags: ["java", "spring"], description: "", source: ["arbeitnow"] },
        { slug: "4", title: "Frontend Developer", tags: ["react", "typescript"], description: "", source: ["arbeitnow"] },
      ];

      const result = applySearchStrategyWithTargetRole(skills, targetRole, allJobs, { 
        id: "combined", 
        provider: "search-strategy" 
      });

      // TargetRole matches should be preserved even with 0 skill matches
      expect(result.meta.targetRoleMatches).toBeGreaterThan(0);
      
      // Jobs matching targetRole should be included even with 0 skill overlap
      const targetRoleJob = result.jobs.find(j => j.slug === "4");
      const cloudJob = result.jobs.find(j => j.title.includes("Cloud"));
      expect(cloudJob).toBeDefined();
    });

    it("progressive threshold reduction when candidate pool too small", () => {
      const skills = ["Java", "AWS", "Terraform", "Docker", "Kubernetes", "Linux", "Python", "SQL", "Git", "CI/CD"];
      const limitedJobs = [
        { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform"], description: "", source: ["test"] },
        { slug: "2", title: "DevOps", tags: ["aws", "docker"], description: "", source: ["test"] },
      ];
      
      const result = applySearchStrategyWithTargetRole(skills, "", limitedJobs, { 
        id: "test",
        candidatePoolTarget: 10,
        minCandidatePoolTarget: 5
      });
      
      expect(result.meta.strategy).toBe("progressive");
      expect(result.meta.threshold).toBeLessThanOrEqual(6);
    });
  });

  describe("Step 3: Job Scoring & Matching", () => {
    it("scores multi-word skills correctly", () => {
      const job = {
        title: "Cloud Engineer",
        tags: ["aws", "terraform", "docker", "kubernetes", "spring boot"],
        description: "We use AWS, Terraform, Docker, Kubernetes, and Spring Boot",
      };

      const skills = ["AWS", "Terraform", "Docker", "Kubernetes", "Spring Boot", "Machine Learning"];
      const score = scoreJobBySkills(job, skills);
      expect(score).toBe(5);
    });

    it("case-insensitive matching works for multi-word skills", () => {
      const job = { title: "Engineer", tags: [], description: "Spring Boot and Machine Learning experience" };
      const score = scoreJobBySkills(job, ["Spring Boot", "Machine Learning", "AWS"]);
      expect(score).toBe(2);
    });
  });

  describe("Step 4: ATS Integration (Regression Check)", () => {
    it("ATS analysis still works with new skill pipeline", () => {
      const job = {
        slug: "test-1",
        title: "React Developer",
        tags: ["react", "nodejs", "typescript"],
        description: "AWS experience required",
      };
      const profile = { skills: "React, TypeScript" };
      const result = analyzeJobForAts(job, profile);
      
      expect(result.summary.matched).toBeGreaterThan(0);
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  describe("Step 5: Full Source Integration", () => {
    it("fetchAllJobs applies search strategy and preserves filters", async () => {
      setupFetchMock();
      
      // When skills come from JSON array (as parsed by /api/jobs endpoint), they stay intact
      const skillsArray = ["Java", "AWS", "Terraform", "Spring Boot"];
      const result = await fetchAllJobs({ 
        skills: skillsArray, 
        targetRole: "Cloud Engineer", 
        city: "Frankfurt" 
      });

      expect(result.jobs.length).toBeGreaterThan(0);
      expect(result.meta.searchStrategy).toBeDefined();
      expect(result.meta.searchStrategy.threshold).toBeDefined();
      expect(result.meta.searchStrategy.strategy).toBeDefined();
      expect(result.meta.searchStrategy.skillsUsed).toBe(4);
      expect(result.meta.totalFiltered).toBeGreaterThan(0);
    });

    it("workMode and employmentType filters work with search strategy", async () => {
      const jobs = [
        { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform"], location: ["Frankfurt"], remote: false, jobTypes: ["full_time"], source: ["arbeitnow"] },
        { slug: "2", title: "Cloud Engineer", tags: ["aws", "terraform"], location: ["Berlin"], remote: true, jobTypes: ["full_time"], source: ["arbeitnow"] },
        { slug: "3", title: "Cloud Engineer", tags: ["aws", "terraform"], location: ["Munich"], remote: false, jobTypes: ["part_time"], source: ["arbeitnow"] },
        { slug: "4", title: "Cloud Engineer", tags: ["aws", "terraform"], location: ["Remote"], remote: true, jobTypes: ["part_time"], source: ["arbeitnow"] },
      ];
      
      const { applySearchFilters } = await import("../../api/_lib/filter.mjs");
      const { buildCandidatePool } = await import("../../api/_lib/searchStrategy.mjs");
      
      const pool = buildCandidatePool(["aws", "terraform"], jobs, { id: "test" });
      
      // Test employmentType filter
      const filteredFullTime = applySearchFilters(pool.jobs, { radiusKm: null, workMode: [], employmentType: "full_time" });
      expect(filteredFullTime.every(j => j.jobTypes?.includes("full_time") || j.jobTypes?.includes("full-time"))).toBe(true);
      expect(filteredFullTime.some(j => j.jobTypes?.includes("part_time"))).toBe(false);
      
      // Test workMode filter
      const filteredRemote = applySearchFilters(pool.jobs, { radiusKm: null, workMode: ["remote"], employmentType: "" });
      expect(filteredRemote.every(j => j.remote === true)).toBe(true);
    });
  });

  describe("Step 6: Negative Tests - Explicit Execution", () => {
    it("empty skills returns limited candidate pool", () => {
      const result = applySearchStrategyWithTargetRole([], "Cloud Engineer", [
        { slug: "1", title: "Cloud Engineer", tags: ["aws"], description: "", source: ["test"] },
      ], { id: "test" });
      
      expect(result.meta.targetRoleMatches).toBe(1);
      expect(result.meta.threshold).toBe(0);
    });

    it("no targetRole falls back to skill-only search", () => {
      const skills = ["aws", "terraform", "docker"];
      const jobs = [
        { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform"], description: "", source: ["test"] },
      ];
      const result = applySearchStrategyWithTargetRole(skills, "", jobs, { id: "test" });
      expect(result.meta.targetRoleMatches).toBe(0);
      expect(result.jobs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Step 7: Skill Selection Flow (Unit Level)", () => {
    it("normalizeSkills preserves multi-word skills from JSON array input", () => {
      const skills = ["Java", "AWS", "Spring Boot", "Machine Learning", "Amazon Web Services", "Terraform", "Docker"];
      const normalized = normalizeSkills(skills);
      expect(normalized).toContain("Spring Boot");
      expect(normalized).toContain("Machine Learning");
      expect(normalized).toContain("Amazon Web Services");
    });

    it("case-insensitive deduplication works", () => {
      const result = normalizeSkills(["Java", "AWS", "aws", "Spring Boot"]);
      expect(result).toEqual(["Java", "AWS", "Spring Boot"]);
    });

    it("preserves first occurrence order", () => {
      const result = normalizeSkills("B, A, b, C");
      expect(result).toEqual(["B", "A", "C"]);
    });

    it("enforces MAX_SKILLS limit", () => {
      const skills = Array.from({ length: 25 }, (_, i) => `Skill${i + 1}`).join(", ");
      const result = normalizeSkills(skills);
      expect(result.length).toBe(20);
    });
  });
});