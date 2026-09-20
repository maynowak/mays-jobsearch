import {
  extractRequirementsFromJob,
  matchRequirement,
  analyzeJobForAts,
  generateCVRecommendations,
  formulateCVText,
  formulateAllRecommendations,
  validateRecommendationSafety,
  getPrivacyNotice,
} from "../../api/_lib/ats.mjs";

const CHANGE_TYPE_LABELS = {
  KEYWORD_REINFORCEMENT: "Keyword Reinforcement",
  EVIDENCE_CLARIFICATION: "Evidence Clarification",
  GAP_FLAG: "Gap Identified",
  UNKNOWN_REVIEW: "Review Needed",
};

const PRIORITY_LABELS = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SAFETY_STATUS_LABELS = {
  SAFE_EVIDENCE: "Safe - Evidence Based",
  SAFE_REVIEW: "Review Required",
  CRITICAL_GAP: "Critical Gap",
  DO_NOT_GENERATE: "Do Not Generate",
  REVIEW_REQUIRED: "Review Required",
};

function formatRecommendation(rec) {
  return {
    requirementId: rec.requirementId,
    changeType: rec.changeType,
    changeTypeLabel: CHANGE_TYPE_LABELS[rec.changeType] || rec.changeType,
    priority: rec.priority,
    priorityLabel: PRIORITY_LABELS[rec.priority] || rec.priority,
    currentEvidence: rec.currentEvidence,
    proposedChange: rec.proposedChange,
    rationale: rec.rationale,
    relatedCVEvidence: rec.relatedCVEvidence ?? null,
    safetyStatus: rec.safetyStatus,
    safetyStatusLabel: SAFETY_STATUS_LABELS[rec.safetyStatus] || rec.safetyStatus,
  };
}

export function generateImprovementPlan(analysisResult, cvSkills = []) {
  const recommendations = generateCVRecommendations(analysisResult, cvSkills);

  return {
    recommendations: recommendations.map(formatRecommendation),
    summary: {
      total: recommendations.length,
      byType: recommendations.reduce((acc, r) => {
        acc[r.changeType] = (acc[r.changeType] || 0) + 1;
        return acc;
      }, {}),
      byPriority: recommendations.reduce((acc, r) => {
        acc[r.priority] = (acc[r.priority] || 0) + 1;
        return acc;
      }, {}),
      bySafety: recommendations.reduce((acc, r) => {
        acc[r.safetyStatus] = (acc[r.safetyStatus] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

export async function generateImprovementFormulations(analysisResult, cvSkills = [], aiOptions = {}) {
  const recommendations = generateCVRecommendations(analysisResult, cvSkills);

  const formulations = await Promise.allSettled(
    recommendations.map(async (rec) => {
      const safety = validateRecommendationSafety(rec, cvSkills);

      if (!safety.safe) {
        return {
          recommendationId: rec.requirementId,
          changeType: rec.changeType,
          safetyStatus: "DO_NOT_GENERATE",
          safetyReason: safety.reason,
        };
      }

      return await formulateCVText(rec, cvSkills, { mock: true });
    })
  );

  const successfulFormulations = [];
  for (const form of formulations) {
    if (form.status === "fulfilled") {
      successfulFormulations.push(form.value);
    }
  }

  return successfulFormulations;
}

export function getRecommendationSummary(recommendations) {
  return {
    total: recommendations.length,
    byType: recommendations.reduce((acc, r) => {
      acc[r.changeType] = (acc[r.changeType] || 0) + 1;
      return acc;
    }, {}),
    byPriority: recommendations.reduce((acc, r) => {
      acc[r.priority] = (acc[r.priority] || 0) + 1;
      return acc;
    }, {}),
    bySafety: recommendations.reduce((acc, r) => {
      acc[r.safetyStatus] = (acc[r.safetyStatus] || 0) + 1;
      return acc;
    }, {}),
    actionable: recommendations.filter((r) =>
      r.safetyStatus === "SAFE_EVIDENCE" || r.safetyStatus === "SAFE_REVIEW"
    ).length,
    requiresReview: recommendations.filter((r) =>
      r.safetyStatus === "REVIEW_REQUIRED" || r.safetyStatus === "DO_NOT_GENERATE"
    ).length,
  };
}

export function applyRecommendations(profile, selectedRecommendationIds, allRecommendations) {
  if (!selectedRecommendationIds || selectedRecommendationIds.length === 0) {
    return {
      improvedProfile: { ...profile },
      appliedCount: 0,
      appliedRecommendations: [],
    };
  }

  const selectedRecommendations = allRecommendations.filter(rec =>
    selectedRecommendationIds.includes(rec.requirementId)
  );

  if (selectedRecommendations.length === 0) {
    return {
      improvedProfile: { ...profile },
      appliedCount: 0,
      appliedRecommendations: [],
    };
  }

  let improvedProfile = { ...profile };
  const appliedRecommendations = [];

  for (const rec of selectedRecommendations) {
    if (rec.safetyStatus === "DO_NOT_GENERATE" || rec.safetyStatus === "REVIEW_REQUIRED") {
      continue;
    }

    if (rec.changeType === "KEYWORD_REINFORCEMENT" && rec.relatedCVEvidence) {
      const skill = rec.relatedCVEvidence.toLowerCase().trim();
      const currentSkills = improvedProfile.skills.toLowerCase().split(",").map(s => s.trim());
      if (!currentSkills.includes(skill.toLowerCase())) {
        improvedProfile.skills = improvedProfile.skills ? `${improvedProfile.skills}, ${rec.relatedCVEvidence}` : rec.relatedCVEvidence;
        appliedRecommendations.push(rec.requirementId);
      }
    }
  }

  return {
    improvedProfile,
    appliedCount: appliedRecommendations.length,
    appliedRecommendations,
  };
}

export {
  extractRequirementsFromJob,
  matchRequirement,
  analyzeJobForAts,
  generateCVRecommendations,
  formulateCVText,
  formulateAllRecommendations,
  validateRecommendationSafety,
  getPrivacyNotice,
  formatRecommendation,
};

export const CV_IMPROVEMENT_VERSION = "1.0.0";
export const SUPPORTED_CHANGE_TYPES = Object.keys(CHANGE_TYPE_LABELS);
export const SUPPORTED_PRIORITIES = Object.keys(PRIORITY_LABELS);
export const SUPPORTED_SAFETY_STATUSES = Object.keys(SAFETY_STATUS_LABELS);