// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

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
const { normalizeSkills } = await import("../../api/_lib/searchStrategy.mjs");
const { tokenize } = await import("../../api/_lib/filter.mjs");

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
  description: "We need Cloud Engineer with AWS, Terraform, Docker, Kubernetes, Linux, Spring Boot",
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

describe("REGRESSION: 20 Skills Multi-Word Preservation", () => {
  const TWENTY_SKILLS = [
    "Java",
    "Java EE/J2EE",
    "Spring Boot",
    "Microservices",
    "JPA",
    "Hibernate",
    "JUnit",
    "Software Architecture",
    "Database Systems",
    "AWS",
    "Terraform",
    "Docker",
    "Linux",
    "CI/CD",
    "Infrastructure as Code",
    "DevOps",
    "Automation",
    "SQL",
    "PL/SQL",
    "Oracle"
  ];

  it("tokenize preserves multi-word skills from array input", () => {
    const tokens = tokenize(TWENTY_SKILLS);
    expect(tokens).toHaveLength(20);
    expect(tokens).toContain("spring boot");
    expect(tokens).toContain("java ee/j2ee");
    expect(tokens).not.toContain("spring");
    expect(tokens).not.toContain("boot");
  });

  it("fetchAllJobs receives skills as array and preserves multi-word skills", async () => {
    setupFetchMock();
    
    const skillsArray = [
      "Java",
      "Spring Boot",
      "AWS",
      "Terraform",
      "Docker",
      "Kubernetes",
      "Linux"
    ];

    const result = await fetchAllJobs({ 
      skills: skillsArray, 
      targetRole: "Cloud Engineer", 
      city: "Frankfurt" 
    });

    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.meta.searchStrategy.skillsUsed).toBe(7);
  });

  it("search strategy preserves multi-word skills in candidate pool", async () => {
    const { applySearchStrategyWithTargetRole } = await import("../../api/_lib/searchStrategy.mjs");
    
    const skills = [
      "Java",
      "Spring Boot",
      "AWS",
      "Terraform",
      "Docker",
      "Kubernetes",
      "Linux"
    ];

    const allJobs = [
      { slug: "1", title: "Cloud Engineer", tags: ["aws", "terraform", "docker", "kubernetes", "linux"], description: "Cloud Engineer with AWS, Terraform, Docker, Kubernetes, Linux", source: ["test"] },
      { slug: "2", title: "Java Developer", tags: ["java", "spring boot", "hibernate", "jpa", "junit"], description: "Java Developer with Spring Boot, Hibernate, JPA, JUnit", source: ["test"] },
      { slug: "3", title: "DevOps Engineer", tags: ["aws", "docker", "kubernetes", "ci/cd", "terraform"], description: "DevOps with AWS, Docker, Kubernetes, CI/CD, Terraform", source: ["test"] },
      { slug: "4", title: "Frontend Developer", tags: ["react", "typescript"], description: "Frontend Developer", source: ["test"] },
    ];

    const result = applySearchStrategyWithTargetRole(skills, "Cloud Engineer", allJobs, { 
      id: "combined", 
      provider: "search-strategy" 
    });

    expect(result.jobs.length).toBeGreaterThan(0);
    const cloudJob = result.jobs.find(j => j.title.includes("Cloud"));
    expect(cloudJob).toBeDefined();
  });

  it("tokenize preserves multi-word skills from array input", () => {
    const skills = [
      "Java",
      "Java EE/J2EE",
      "Spring Boot",
      "Microservices",
      "JPA",
      "Hibernate",
      "JUnit",
      "Software Architecture",
      "Database Systems",
      "AWS",
      "Terraform",
      "Docker",
      "Linux",
      "CI/CD",
      "Infrastructure as Code",
      "DevOps",
      "Automation",
      "SQL",
      "PL/SQL",
      "Oracle"
    ];

    const tokens = tokenize(TWENTY_SKILLS);
    expect(tokens).toHaveLength(20);
    expect(tokens).toContain("spring boot");
    expect(tokens).toContain("java ee/j2ee");
  });

  it("targetRole is preserved and used separately from skills", async () => {
    setupFetchMock();
    
    const skills = ["Java", "Spring Boot", "AWS"];
    const targetRole = "Cloud Engineer";
    
    const result = await fetchAllJobs({ 
      skills, 
      targetRole, 
      city: "Frankfurt" 
    });

    expect(result.meta.searchStrategy).toBeDefined();
    expect(result.meta.searchStrategy.targetRoleMatches).toBeDefined();
  });

  it("does not break existing single-word skill searches", () => {
    const skills = ["Java", "AWS", "Docker", "Linux"];
    const tokens = tokenize(skills);
    expect(tokens).toEqual(["java", "aws", "docker", "linux"]);
  });

  it("handles empty skills array", () => {
    const tokens = tokenize([]);
    expect(tokens).toEqual([]);
  });

  it("handles mixed case and whitespace", () => {
    const skills = ["  Java  ", "  AWS  ", " Spring Boot "];
    const tokens = tokenize(skills);
    expect(tokens).toEqual(["java", "aws", "spring boot"]);
  });
});
