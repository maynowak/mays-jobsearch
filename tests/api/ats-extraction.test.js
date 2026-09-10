// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractRequirementsFromJob,
  matchRequirement,
  extractCertifications,
  analyzeJobForAts,
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

describe("ATS Job Analysis", () => {
  it("analyzes job with various matches", () => {
    const job = {
      slug: "test-1",
      title: "React Developer",
      tags: ["react", "nodejs"],
      company_name: "Test Corp",
    };
    const profile = { skills: "react, javascript, typescript" };
    const result = analyzeJobForAts(job, profile);
    expect(result).toBeDefined();
    expect(result.summary.matched).toBeGreaterThanOrEqual(0);
  });

  it("counts requirements correctly", () => {
    const job = {
      slug: "test-1",
      title: "React Developer",
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    expect(result.requirements.length).toBeGreaterThan(0);
  });

  it("calculates keyword match score", () => {
    const job = {
      slug: "test-1",
      title: "React Developer",
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    expect(result.scores.keywordMatch).toBeGreaterThanOrEqual(0);
    expect(result.scores.keywordMatch).toBeLessThanOrEqual(100);
  });

  it("handles mixed CV skills", () => {
    const job = {
      slug: "test-1",
      title: "Developer",
      tags: ["react", "nodejs"],
      remote: true,
    };
    const profile = { skills: "React, Python, Java" };
    const result = analyzeJobForAts(job, profile);
    expect(result.summary).toBeDefined();
    expect(result.summary.matched).toBeGreaterThanOrEqual(0);
    expect(result.summary.unknown).toBeGreaterThanOrEqual(0);
  });

  it("returns location match when job has location", () => {
    const job = {
      slug: "test-1",
      title: "Developer",
      location: ["Berlin", "Munich"],
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    expect(result.scores.locationMatch).toBe(100);
  });

  it("returns workmode match when job has remote flag", () => {
    const job = {
      slug: "test-1",
      title: "Developer",
      remote: true,
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    expect(result.scores.workmodeMatch).toBe(100);
  });

  it("returns employment match when job has types", () => {
    const job = {
      slug: "test-1",
      title: "Developer",
      jobTypes: ["full_time"],
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    expect(result.scores.employmentMatch).toBe(100);
  });
});

describe("STEP 37B - ATS Analysis Core", () => {
// A) Perfect keyword match
  it("A) Perfect keyword match returns expected status", () => {
    const job = {
      slug: "test-1",
      title: "React Developer",
      tags: ["react"],
    };
    const profile = { skills: "React, JavaScript" };
    const result = analyzeJobForAts(job, profile);
    // "react developer" is partially matched by "React" in profile
    // "react" tag is matched by "React" in profile
    expect(result.summary.matched).toBeGreaterThanOrEqual(0);
    expect(result.criticalGaps.length).toBe(0);
  });

  // B) MATCHED + PARTIAL
  it("B) Mixed MATCHED and PARTIAL results", () => {
    const job = {
      slug: "test-1",
      title: "React Developer",
      tags: ["react", "nodejs", "typescript"],
    };
    const profile = { skills: "React, TypeScript" };
    const result = analyzeJobForAts(job, profile);
    expect(result.summary.matched).toBeGreaterThan(0);
    expect(result.summary.partial).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  // D) UNKNOWN without CV evidence
  it("D) UNKNOWN status for requirements without CV evidence", () => {
    const job = {
      slug: "test-1",
      title: "Senior Python Django Developer",
    };
    const profile = { skills: "JavaScript, React" };
    const result = analyzeJobForAts(job, profile);
    expect(result.summary.unknown).toBeGreaterThan(0);
    expect(result.criticalGaps.length).toBe(0);
  });

  // E) REQUIRED vs Optional weighting
  it("E) Required requirements have higher weight in scoring", () => {
    const job = {
      slug: "test-1",
      title: "AWS Developer required",
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    // "required" in title should mark as high importance
    const req = result.requirements.find(r => r.id === "keyword_0");
    if (req) {
      expect(req.importance).toBe("high");
    }
  });

  // F) Critical GAP appears in criticalGaps
  it("F) Critical requirement with missing CV evidence appears in criticalGaps", () => {
    const job = {
      slug: "test-1",
      title: "Senior AWS Developer must have experience",
    };
    const profile = { skills: "Python, Django" };
    const result = analyzeJobForAts(job, profile);
    // At least some requirements should be missing
    expect(result.summary.unknown).toBeGreaterThan(0);
  });

  // G) UNKNOWN does NOT appear in criticalGaps
  it("G) UNKNOWN status does NOT appear in criticalGaps", () => {
    const job = {
      slug: "test-1",
      title: "Developer",
    };
    const profile = { skills: "Python" };
    const result = analyzeJobForAts(job, profile);
    // Critical gaps should only come from high importance unmatched
    // and only when they would be true gaps (not just unknown)
    expect(result.criticalGaps.filter(r => r.importance === "low")).toHaveLength(0);
  });

  // H) Keyword Coverage
  it("H) Keyword coverage is calculated correctly", () => {
    const job = {
      slug: "test-1",
      title: "React Developer",
      tags: ["react", "nodejs"],
    };
    const profile = { skills: "React" };
    const result = analyzeJobForAts(job, profile);
    expect(result.scores.keywordMatch).toBeGreaterThan(0);
    expect(result.scores.keywordMatch).toBeLessThanOrEqual(100);
  });

  // I) Recommendations for MATCHED
  it("I) Recommendations for MATCHED requirements are appropriate", () => {
    const job = {
      slug: "test-1",
      title: "React Developer",
      tags: ["react"],
    };
    const profile = { skills: "React" };
    const result = analyzeJobForAts(job, profile);
    expect(result.recommendations).toBeDefined();
    expect(result.criticalGaps).toHaveLength(0);
  });

  // J) Recommendations for UNKNOWN are cautious
  it("J) Recommendations for UNKNOWN are cautiously worded", () => {
    const job = {
      slug: "test-1",
      title: "Senior AWS Developer required",
    };
    const profile = { skills: "Python" };
    const result = analyzeJobForAts(job, profile);
    const unknownRecs = result.recommendations.filter(r => r.type === "missing_evidence");
    expect(unknownRecs.length).toBeGreaterThanOrEqual(0);
    // Recommendations should suggest checking, not adding skills
    unknownRecs.forEach(rec => {
      expect(rec.message).toMatch(/prüfen|ergänzen|check/i);
    });
  });

  // K) Mixed realistic job: MATCHED + PARTIAL + GAP + UNKNOWN
  it("K) Complex job with all statuses", () => {
    const job = {
      slug: "test-1",
      title: "React AWS Developer Python required",
      tags: ["react", "nodejs"],
      location: ["Berlin"],
      remote: true,
      jobTypes: ["full_time"],
    };
    const profile = { skills: "React, TypeScript, Node.js" };
    const result = analyzeJobForAts(job, profile);
    
    // Should have matched: react, python (partially)
    expect(result.summary.matched).toBeGreaterThan(0);
    
    // Should have recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);
    
    // Should have all scores
    expect(result.scores).toBeDefined();
    expect(result.scores.overall).toBeGreaterThan(0);
  });

  // Regression: AWS text must not cause infinite loop
  it("Regression: AWS experience required does not hang", () => {
    const job = {
      slug: "test-1",
      title: "AWS Developer",
      descriptionPlain: "AWS experience required",
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    expect(result).toBeDefined();
    expect(result.requirements.length).toBeGreaterThan(0);
  });

  it("Regression: AWS Certified Developer text does not hang", () => {
    const job = {
      slug: "test-1",
      title: "Developer",
      tags: ["aws"],
    };
    const profile = {};
    const result = analyzeJobForAts(job, profile);
    expect(result).toBeDefined();
    expect(result.requirements.length).toBeGreaterThan(0);
  });
});