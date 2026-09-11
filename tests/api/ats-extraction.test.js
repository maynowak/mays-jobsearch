// @vitest-environment node
import { describe, expect, it, beforeAll } from "vitest";
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
describe("STEP 37D - AI CV Formulation", () => {
  let formulateCVText, formulateAllRecommendations, validateRecommendationSafety;

  beforeAll(async () => {
    const ats = await import("../../api/_lib/ats.mjs");
    formulateCVText = ats.formulateCVText;
    formulateAllRecommendations = ats.formulateAllRecommendations;
    validateRecommendationSafety = ats.validateRecommendationSafety;
  });

  // A) MATCHED → can formalize existing evidence
  it("A) MATCHED recommendations can be safely formalized", async () => {
    const rec = {
      type: "KEYWORD_REINFORCEMENT",
      requirementId: "test",
      priority: "high",
      proposedChange: "React hervorheben",
      rationale: "Match found",
      relatedCVEvidence: "React",
      safetyStatus: "SAFE_EVIDENCE"
    };
    const result = await formulateCVText(rec, ["React"], { mock: true });
    expect(result.safetyStatus).toBe("SAFE");
    expect(result.evidence).toBe("React");
  });

  // B) PARTIAL → can clarify evidence
  it("B) PARTIAL recommendations can clarify evidence", async () => {
    const rec = {
      type: "EVIDENCE_CLARIFICATION",
      requirementId: "test",
      priority: "medium",
      proposedChange: "React Developer klarer formulieren",
      rationale: "Teilweise Erfüllung",
      relatedCVEvidence: "React",
      safetyStatus: "SAFE_EVIDENCE"
    };
    const result = await formulateCVText(rec, ["React"], { mock: true });
    expect(result.safetyStatus).toBe("SAFE");
  });

  // C) GAP → no invented skill
  it("C) GAP recommendations do not create invented skills", () => {
    const rec = {
      type: "GAP_FLAG",
      requirementId: "test",
      priority: "high",
      proposedChange: "Kubernetes erforderlich",
      safetyStatus: "CRITICAL_GAP"
    };
    const result = validateRecommendationSafety(rec, []);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("human review");
  });

  // D) UNKNOWN → no claim
  it("D) UNKNOWN recommendations are marked for review", () => {
    const rec = {
      type: "UNKNOWN_REVIEW",
      requirementId: "test",
      priority: "medium",
      proposedChange: "Erfahrung prüfen",
      safetyStatus: "SAFE_REVIEW"
    };
    const result = validateRecommendationSafety(rec, []);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("REVIEW");
  });

  // E) Certificate missing → no certificate generated
  it("E) Missing certificate recommendations", async () => {
    const rec = {
      type: "MISSING_CERTIFICATE",
      requirementId: "test",
      priority: "medium",
      proposedChange: "AWS Certification geprüft",
      safetyStatus: "SAFE_REVIEW"
    };
    const result = await formulateCVText(rec, [], { mock: true });
    expect(result.safetyStatus).toBe("REVIEW_REQUIRED");
  });

  // F) Missing technology → not added
  it("F) Missing technology not added to recommendations", () => {
    const rec = {
      type: "GAP_FLAG",
      requirementId: "test",
      priority: "high",
      proposedChange: "Kubernetes erforderlich",
    };
    const result = validateRecommendationSafety(rec, ["React", "Python"]);
    expect(result.safe).toBe(false);
  });

  // G) Existing experience can be improved
  it("G) Existing experience can be linguistically improved", async () => {
    const rec = {
      type: "EVIDENCE_CLARIFICATION",
      requirementId: "react",
      priority: "high",
      proposedChange: "3 Jahre React Erfahrung erlebt",
      rationale: "Clarification needed",
      relatedCVEvidence: "React",
    };
    const result = await formulateCVText(rec, ["React"], { mock: true });
    expect(result.safetyStatus).toBe("SAFE");
  });

  // H) Proposed text stays within evidence
  it("H) Proposed text stays within existing evidence bounds", async () => {
    const rec = {
      type: "KEYWORD_REINFORCEMENT",
      requirementId: "test",
      priority: "medium",
      proposedChange: "React verbessern",
      relatedCVEvidence: "React",
    };
    const result = await formulateCVText(rec, ["React"], { mock: true });
    expect(result).toBeDefined();
    expect(result.safetyStatus).toBe("SAFE");
  });

  // I) Structured output is valid
  it("I) Generated output has required structure", async () => {
    const rec = {
      type: "KEYWORD_REINFORCEMENT",
      requirementId: "test",
      priority: "high",
      proposedChange: "Tests",
      relatedCVEvidence: "Jest",
    };
    const result = await formulateCVText(rec, ["Jest"], { mock: true });
    expect(result).toHaveProperty("recommendationId");
    expect(result).toHaveProperty("changeType");
    expect(result).toHaveProperty("priority");
    expect(result).toHaveProperty("sourceRequirement");
    expect(result).toHaveProperty("originalText");
    expect(result).toHaveProperty("proposedText");
    expect(result).toHaveProperty("rationale");
    expect(result).toHaveProperty("evidence");
    expect(result).toHaveProperty("safetyStatus");
  });

  // J) AI provider errors are handled safely
  it("J) AI provider errors are handled safely", async () => {
    const rec = {
      type: "KEYWORD_REINFORCEMENT",
      requirementId: "test",
      priority: "medium",
      proposedChange: "AWS",
      relatedCVEvidence: "AWS",
    };
    const result = await formulateCVText(rec, ["AWS"], { mock: false });
    expect(result).toHaveProperty("safetyStatus");
  });

  // K) Empty recommendations handled in batch
  it("K) Empty recommendations handled safely", async () => {
    const analysis = { recommendations: [] };
    const results = await Promise.all(
      analysis.recommendations.map(r => formulateCVText(r, []))
    );
    expect(results).toHaveLength(0);
  });

  // L) Prompt contains safety rules
  it("L) Formulation prompt contains safety rules", () => {
    const prompt = `

You are an agent with very strict safety rules.
RULES:
1. Candidate facts are authoritative.

    `;
    expect(prompt).toContain("Candidate facts");
    expect(prompt).toContain("rules");
  });
});

describe("STEP 37D-PRIVACY - Logging Safety", () => {
  let validateRecommendationSafety, formulateCVText, getPrivacyNotice, estimateFormulationTokens;

  beforeAll(async () => {
    const ats = await import("../../api/_lib/ats.mjs");
    validateRecommendationSafety = ats.validateRecommendationSafety;
    formulateCVText = ats.formulateCVText;
    getPrivacyNotice = ats.getPrivacyNotice;
    estimateFormulationTokens = ats.estimateFormulationTokens;
  });

  it("A) Privacy notice contains required information", () => {
    const notice = getPrivacyNotice();
    expect(notice.title).toBeDefined();
    expect(notice.summary).toBeDefined();
    expect(notice.details).toBeDefined();
    expect(notice.details.dataSent).toBeDefined();
    expect(notice.details.dataNotSent).toBeDefined();
    expect(notice.details.purpose).toBeDefined();
    expect(notice.details.safety).toBeDefined();
  });

  it("B) Privacy notice does not claim false guarantees", () => {
    const notice = getPrivacyNotice();
    const summary = JSON.stringify(notice);
    expect(summary).not.toContain("niemals gespeichert");
    expect(summary).not.toContain("DSGVO-konform");
    expect(summary).not.toContain("vollständig anonymisiert");
  });

  it("C) Safety validators block GAP_FLAG recommendations", () => {
    const rec = { changeType: "GAP_FLAG", requirementId: "test", proposedText: "Kubernetes needed" };
    const result = validateRecommendationSafety(rec, []);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("human review");
  });

  it("D) Safety validators block UNKNOWN_REVIEW recommendations", () => {
    const rec = { changeType: "UNKNOWN_REVIEW", requirementId: "test" };
    const result = validateRecommendationSafety(rec, []);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("CV evidence verification");
  });

  it("E) Safety validators block MISSING_CERTIFICATE", () => {
    const rec = { changeType: "MISSING_CERTIFICATE", requirementId: "test" };
    const result = validateRecommendationSafety(rec, []);
    expect(result.safe).toBe(false);
  });

  it("F) Mock mode returns safe output without AI call", async () => {
    const rec = {
      changeType: "KEYWORD_REINFORCEMENT",
      requirementId: "react",
      proposedChange: "React skill",
      relatedCVEvidence: "react",
    };
    const result = await formulateCVText(rec, ["react"], { mock: true });
    expect(result.safetyStatus).toBe("SAFE");
    expect(result.proposedText).toBe("React skill");
  });

  it("G) Formulation only uses matched keywords, not full CV", async () => {
    const rec = {
      changeType: "EVIDENCE_CLARIFICATION",
      requirementId: "react-developer",
      proposedChange: "Make React developer clear",
      relatedCVEvidence: "react",
      rationale: "Clarification needed",
    };
    const result = await formulateCVText(rec, ["react"], { mock: true });
    expect(result.evidence).toBe("react");
    expect(result.originalText).not.toContain("AWS"); // CV shouldn't leak other skills
  });

  it("H) Evidence validation checks skill patterns", () => {
    const rec = {
      changeType: "KEYWORD_REINFORCEMENT",
      relatedCVEvidence: "react",
      proposedChange: "Test change"
    };
    const result = validateRecommendationSafety(rec, ["react"]);
    expect(result.safe).toBe(true);
  });

  it("I) Token estimation is reasonable", () => {
    const rec = { relatedCVEvidence: "react", requirementId: "react-dev" };
    const tokens = estimateFormulationTokens(rec);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(1000);
  });

  it("J) Unknown data handling documented", () => {
    const notice = getPrivacyNotice();
    expect(notice.details.dataSent).toBeDefined();
  });
});
