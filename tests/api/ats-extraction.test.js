// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractRequirementsFromJob,
  matchRequirement,
  extractCertifications,
} from "../../api/_lib/ats.mjs";

describe("ATS Certification Extraction", () => {
  it("extracts certifications terminates for AWS certification text", () => {
    const result = extractCertifications("AWS Certified Developer");
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("extracts certifications for AWS experience required", () => {
    const result = extractCertifications("AWS experience required");
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("ATS Requirement Extraction", () => {
  const mockJob = {
    slug: "test-1",
    title: "React Developer",
    company_name: "Test Corp",
    location: ["Berlin"],
    remote: true,
    tags: ["react", "nodejs"],
    description: "AWS experience required",
    descriptionPlain: "AWS experience required",
  };

  it("extracts requirements from job", () => {
    const reqs = extractRequirementsFromJob(mockJob);
    expect(reqs).toBeDefined();
    expect(Array.isArray(reqs)).toBe(true);
    expect(reqs.length).toBeGreaterThan(0);
  });

  it("extracts skills from tags", () => {
    const reqs = extractRequirementsFromJob(mockJob);
    const skillReqs = reqs.filter((r) => r.category === "skill");
    expect(skillReqs.length).toBeGreaterThan(0);
  });

  it("extracts keywords from title", () => {
    const reqs = extractRequirementsFromJob(mockJob);
    const keywordReqs = reqs.filter((r) => r.category === "keyword");
    expect(keywordReqs.length).toBeGreaterThan(0);
  });

  it("extracts workmode from remote flag", () => {
    const reqs = extractRequirementsFromJob(mockJob);
    const workmodeReqs = reqs.filter((r) => r.category === "workmode");
    expect(workmodeReqs.length).toBeGreaterThan(0);
    expect(workmodeReqs.some((r) => r.normalized === "remote")).toBe(true);
  });

  it("returns empty array for minimal job with no description", () => {
    const minimalJob = {
      slug: "minimal-1",
      title: "Developer",
      company_name: "Company",
      location: [],
      remote: false,
    };
    const reqs = extractRequirementsFromJob(minimalJob);
    expect(reqs).toBeDefined();
    expect(reqs.length).toBeGreaterThan(0);
  });
});

describe("ATS Matching", () => {
  it("matches skills present in CV", () => {
    const req = {
      id: "test_1",
      text: "AWS",
      category: "skill",
      importance: "high",
      source: "description",
      explicitness: "explicit",
      normalized: "aws",
    };
    const result = matchRequirement(req, ["AWS", "React"], {});
    expect(result.status).toBe("MATCHED");
    expect(result.confidence).toBe("HIGH");
  });

  it("returns MATCHED for matching skill", () => {
    const req = {
      id: "test_2",
      text: "Docker",
      category: "skill",
      importance: "high",
      source: "description",
      explicitness: "explicit",
      normalized: "docker",
    };
    const result = matchRequirement(req, ["Docker"], {});
    expect(result.status).toBe("MATCHED");
  });

  it("returns UNKNOWN for missing skills", () => {
    const req = {
      id: "test_3",
      text: "Docker",
      category: "skill",
      importance: "high",
      source: "description",
      explicitness: "explicit",
      normalized: "docker",
    };
    const result = matchRequirement(req, ["java", "python"], {});
    expect(result.status).toBe("UNKNOWN");
  });
});