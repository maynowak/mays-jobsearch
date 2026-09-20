// @vitest-environment node
import { describe, expect, it } from "vitest";
import { 
  generateImprovementPlan, 
  getRecommendationSummary,
  formatRecommendation,
  CV_IMPROVEMENT_VERSION,
  SUPPORTED_CHANGE_TYPES,
  SUPPORTED_PRIORITIES,
  SUPPORTED_SAFETY_STATUSES,
} from "../../src/lib/cv-improvement.js";

describe("CV Improvement Module", () => {
  const mockAnalysisResult = {
    requirements: [
      { id: "req_1", text: "react", category: "skill", importance: "high", normalized: "react", source: "tags" },
      { id: "req_2", text: "kubernetes", category: "skill", importance: "high", normalized: "kubernetes", source: "tags" },
      { id: "req_3", text: "docker", category: "skill", importance: "medium", normalized: "docker", source: "tags" },
    ],
    matches: [
      { requirementId: "req_1", status: "MATCHED", confidence: "HIGH" },
      { requirementId: "req_2", status: "UNKNOWN", confidence: "LOW" },
      { requirementId: "req_3", status: "PARTIAL", confidence: "MEDIUM" },
    ],
    criticalGaps: [],
    recommendations: [],
    summary: { matched: 1, partial: 1, gap: 0, unknown: 1 },
  };

  const cvSkills = ["react", "javascript"];

  it("A) generates improvement plan with recommendations", () => {
    const plan = generateImprovementPlan(mockAnalysisResult, cvSkills);
    
    expect(plan).toHaveProperty("recommendations");
    expect(plan).toHaveProperty("summary");
    expect(Array.isArray(plan.recommendations)).toBe(true);
    expect(plan.recommendations.length).toBeGreaterThan(0);
  });

  it("B) recommendation has all required fields", () => {
    const plan = generateImprovementPlan(mockAnalysisResult, cvSkills);
    
    for (const rec of plan.recommendations) {
      expect(rec).toHaveProperty("requirementId");
      expect(rec).toHaveProperty("changeType");
      expect(rec).toHaveProperty("changeTypeLabel");
      expect(rec).toHaveProperty("priority");
      expect(rec).toHaveProperty("priorityLabel");
      expect(rec).toHaveProperty("currentEvidence");
      expect(rec).toHaveProperty("proposedChange");
      expect(rec).toHaveProperty("rationale");
      expect(rec).toHaveProperty("safetyStatus");
      expect(rec).toHaveProperty("safetyStatusLabel");
    }
  });

  it("C) summary contains correct structure", () => {
    const plan = generateImprovementPlan(mockAnalysisResult, cvSkills);
    
    expect(plan.summary).toHaveProperty("total");
    expect(plan.summary).toHaveProperty("byType");
    expect(plan.summary).toHaveProperty("byPriority");
    expect(plan.summary).toHaveProperty("bySafety");
    expect(typeof plan.summary.total).toBe("number");
  });

  it("D) getRecommendationSummary works correctly", () => {
    const plan = generateImprovementPlan(mockAnalysisResult, cvSkills);
    const summary = getRecommendationSummary(plan.recommendations);
    
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("byType");
    expect(summary).toHaveProperty("byPriority");
    expect(summary).toHaveProperty("bySafety");
    expect(summary).toHaveProperty("actionable");
    expect(summary).toHaveProperty("requiresReview");
  });

  it("E) formatRecommendation adds labels correctly", () => {
    const rawRec = {
      requirementId: "req_1",
      changeType: "KEYWORD_REINFORCEMENT",
      priority: "high",
      currentEvidence: "present",
      proposedChange: "Test change",
      rationale: "Test rationale",
      relatedCVEvidence: "react",
      safetyStatus: "SAFE_EVIDENCE",
    };
    
    const formatted = formatRecommendation(rawRec);
    
    expect(formatted.changeTypeLabel).toBe("Keyword Reinforcement");
    expect(formatted.priorityLabel).toBe("High");
    expect(formatted.safetyStatusLabel).toBe("Safe - Evidence Based");
  });

  it("F) constants are exported correctly", () => {
    expect(CV_IMPROVEMENT_VERSION).toBeDefined();
    expect(SUPPORTED_CHANGE_TYPES).toContain("KEYWORD_REINFORCEMENT");
    expect(SUPPORTED_CHANGE_TYPES).toContain("EVIDENCE_CLARIFICATION");
    expect(SUPPORTED_CHANGE_TYPES).toContain("GAP_FLAG");
    expect(SUPPORTED_CHANGE_TYPES).toContain("UNKNOWN_REVIEW");
    
    expect(SUPPORTED_PRIORITIES).toContain("critical");
    expect(SUPPORTED_PRIORITIES).toContain("high");
    expect(SUPPORTED_PRIORITIES).toContain("medium");
    expect(SUPPORTED_PRIORITIES).toContain("low");
    
    expect(SUPPORTED_SAFETY_STATUSES).toContain("SAFE_EVIDENCE");
    expect(SUPPORTED_SAFETY_STATUSES).toContain("SAFE_REVIEW");
    expect(SUPPORTED_SAFETY_STATUSES).toContain("CRITICAL_GAP");
    expect(SUPPORTED_SAFETY_STATUSES).toContain("DO_NOT_GENERATE");
    expect(SUPPORTED_SAFETY_STATUSES).toContain("REVIEW_REQUIRED");
  });

  it("G) handles empty analysis result", () => {
    const emptyAnalysis = {
      requirements: [],
      matches: [],
      criticalGaps: [],
      recommendations: [],
      summary: { matched: 0, partial: 0, gap: 0, unknown: 0 },
    };
    
    const plan = generateImprovementPlan(emptyAnalysis, []);
    
    expect(plan.recommendations).toEqual([]);
    expect(plan.summary.total).toBe(0);
    expect(plan.summary.byType).toEqual({});
  });

  it("H) handles critical gaps correctly", () => {
    const analysisWithGaps = {
      ...mockAnalysisResult,
      criticalGaps: [{ id: "req_2", text: "kubernetes" }],
    };
    
    const plan = generateImprovementPlan(analysisWithGaps, cvSkills);
    
    const gapRec = plan.recommendations.find(r => r.changeType === "GAP_FLAG");
    expect(gapRec).toBeDefined();
    expect(gapRec.safetyStatus).toBe("CRITICAL_GAP");
  });
});