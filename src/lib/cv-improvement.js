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

function compareAtsResults(before, after) {
  const beforeSummary = before.summary;
  const afterSummary = after.summary;

  const scoreDelta = after.scores.overall - before.scores.overall;
  const coverageDelta = after.scores.keywordMatch - before.scores.keywordMatch;
  const matchedDelta = after.summary.matched - before.summary.matched;
  const partialDelta = after.summary.partial - before.summary.partial;
  const gapDelta = after.summary.gap - before.summary.gap;
  const unknownDelta = after.summary.unknown - before.summary.unknown;

  // Compare requirements
  const beforeMatches = new Map(before.matches.map(m => [m.requirementId, m]));
  const afterMatches = new Map(after.matches.map(m => [m.requirementId, m]));
  const beforeReqMap = new Map(before.requirements.map(r => [r.id, r]));
  const afterReqMap = new Map(after.requirements.map(r => [r.id, r]));

  // Use all requirement IDs from both analyses
  const allReqIds = new Set([...before.requirements.map(r => r.id), ...after.requirements.map(r => r.id)]);

  let requirementsImproved = 0;
  let requirementsUnchanged = 0;
  let requirementsRegressed = 0;
  const requirementsImprovedDetails = [];
  const requirementsUnchangedDetails = [];
  const requirementsRegressedDetails = [];
  const requirementDeltas = [];

  for (const reqId of allReqIds) {
    const beforeMatch = beforeMatches.get(reqId);
    const afterMatch = afterMatches.get(reqId);
    const beforeReq = beforeReqMap.get(reqId);
    const afterReq = afterReqMap.get(reqId);

    const req = beforeReq || afterReq;
    if (!req) continue;

    const beforeStatus = beforeMatch?.status || "UNKNOWN";
    const afterStatus = afterMatch?.status || "UNKNOWN";
    const beforeConfidence = beforeMatch?.confidence || "LOW";
    const afterConfidence = afterMatch?.confidence || "LOW";

    let category = "unchanged";
    if (beforeStatus !== afterStatus) {
      const statusOrder = { MATCHED: 3, PARTIAL: 2, GAP: 1, UNKNOWN: 0 };
      const beforeOrder = statusOrder[beforeStatus] || 0;
      const afterOrder = statusOrder[afterStatus] || 0;

      if (afterOrder > beforeOrder) {
        category = "improved";
      } else if (afterOrder < beforeOrder) {
        category = "regressed";
      } else {
        category = "unchanged";
      }
    }

    const delta = {
      requirementId: req.id,
      requirementText: req.text,
      beforeStatus: beforeStatus,
      afterStatus: afterStatus,
      beforeConfidence,
      afterConfidence: afterConfidence,
      category,
    };

    if (category === "improved") {
      requirementsImproved++;
      requirementsImprovedDetails.push(req.text);
    } else if (category === "regressed") {
      requirementsRegressed++;
      requirementsRegressedDetails.push(req.text);
    } else {
      requirementsUnchanged++;
      requirementsUnchangedDetails.push(req.text);
    }

    requirementDeltas.push(delta);
  }

  return {
    scoreDelta: after.scores.overall - before.scores.overall,
    coverageDelta: after.scores.keywordMatch - before.scores.keywordMatch,
    matchedDelta: after.summary.matched - before.summary.matched,
    partialDelta: after.summary.partial - before.summary.partial,
    gapDelta: after.summary.gap - before.summary.gap,
    unknownDelta: after.summary.unknown - before.summary.unknown,
    requirementsImproved,
    requirementsUnchanged,
    requirementsRegressed,
    requirementsImprovedDetails,
    requirementsUnchangedDetails,
    requirementsRegressedDetails,
    requirementDeltas: Object.values(requirementDeltas),
  };
}

export function computeImprovementDelta(before, after) {
  // Compare scores
  const scoreDelta = after.scores.overall - before.scores.overall;
  const coverageDelta = after.scores.keywordMatch - before.scores.keywordMatch;
  const matchedDelta = after.summary.matched - before.summary.matched;
  const partialDelta = after.summary.partial - before.summary.partial;
  const gapDelta = after.summary.gap - before.summary.gap;
  const unknownDelta = after.summary.unknown - before.summary.unknown;

  // Compare requirements
  const beforeMatches = new Map(before.matches.map(m => [m.requirementId, m]));
  const afterMatches = new Map(after.matches.map(m => [m.requirementId, m]));
  const beforeReqMap = new Map(before.requirements.map(r => [r.id, r]));
  const afterReqMap = new Map(after.requirements.map(r => [r.id, r]));

  const allReqIds = new Set([...before.requirements.map(r => r.id), ...after.requirements.map(r => r.id)]);

  let requirementsImproved = 0;
  let requirementsUnchanged = 0;
  let requirementsRegressed = 0;
  const requirementsImprovedDetails = [];
  const requirementsUnchangedDetails = [];
  const requirementsRegressedDetails = [];
  const requirementDeltas = [];

  const statusOrder = { MATCHED: 3, PARTIAL: 2, GAP: 1, UNKNOWN: 0 };

  for (const reqId of allReqIds) {
    const beforeMatch = beforeMatches.get(reqId);
    const afterMatch = afterMatches.get(reqId);
    const beforeReq = before.requirements.find(r => r.id === reqId);
    const afterReq = after.requirements.find(r => r.id === reqId);

    const req = beforeReq || afterReq;
    if (!req) continue;

    const beforeStatus = beforeMatch?.status || "UNKNOWN";
    const afterStatus = afterMatch?.status || "UNKNOWN";
    const beforeConfidence = beforeMatch?.confidence || "LOW";
    const afterConfidence = afterMatch?.confidence || "LOW";

    let category = "unchanged";
    if (beforeStatus !== afterStatus) {
      const beforeOrder = statusOrder[beforeStatus] || 0;
      const afterOrder = statusOrder[afterStatus] || 0;

      if (afterOrder > beforeOrder) {
        category = "improved";
      } else if (afterOrder < beforeOrder) {
        category = "regressed";
      } else {
        category = "unchanged";
      }
    }

    const delta = {
      requirementId: req.id,
      requirementText: req.text,
      beforeStatus,
      afterStatus,
      beforeConfidence,
      afterConfidence: afterConfidence,
      category,
    };

    if (category === "improved") {
      requirementsImproved++;
    } else if (category === "regressed") {
      requirementsRegressed++;
    } else {
      requirementsUnchanged++;
    }

    // Add to details
    if (category === "improved") {
      requirementsImprovedDetails.push(req.text);
    } else if (category === "regressed") {
      requirementsRegressedDetails.push(req.text);
    } else {
      requirementsUnchangedDetails.push(req.text);
    }

    requirementDeltas.push({
      requirementId: req.id,
      requirementText: req.text,
      beforeStatus,
      afterStatus,
      beforeConfidence,
      afterConfidence,
      category,
    });
  }

  return {
    scoreDelta: after.scores.overall - before.scores.overall,
    coverageDelta: after.scores.keywordMatch - before.scores.keywordMatch,
    matchedDelta: after.summary.matched - before.summary.matched,
    partialDelta: after.summary.partial - before.summary.partial,
    gapDelta: after.summary.gap - before.summary.gap,
    unknownDelta: after.summary.unknown - before.summary.unknown,
    requirementsImproved,
    requirementsUnchanged,
    requirementsRegressed,
    requirementsImprovedDetails,
    requirementsUnchangedDetails,
    requirementsRegressedDetails,
    requirementDeltas,
  };
}

export const CV_IMPROVEMENT_VERSION = "1.0.0";
export const SUPPORTED_CHANGE_TYPES = Object.keys(CHANGE_TYPE_LABELS);
export const SUPPORTED_PRIORITIES = Object.keys(PRIORITY_LABELS);
export const SUPPORTED_SAFETY_STATUSES = Object.keys(SAFETY_STATUS_LABELS);

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