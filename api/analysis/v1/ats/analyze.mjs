import {
  AnalysisError, authenticateService, requireScope, requireAnalysisConsent,
  requestIdFor, requireSchemaVersion, assertTenantAndUser, readJsonBody, ok, fail,
} from "../../../_lib/analysis/security.mjs";
import { analyzeJobForAts, generateCVRecommendations } from "../../../_lib/ats.mjs";
import { validateJob, validateProfile } from "../../../_lib/analysis/validation.mjs";

function parseSkills(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    if (req.method !== "POST") {
      throw new AnalysisError(405, "method_not_allowed", "This endpoint accepts POST requests only.");
    }
    const identity = authenticateService(req);
    requireScope(identity, "ats:analyze");
    requireAnalysisConsent(req, identity);

    const body = await readJsonBody(req);
    requireSchemaVersion(body.schemaVersion);
    assertTenantAndUser(body, identity);
    const job = validateJob(body.job);
    const profile = validateProfile(body.profile);
    const analysis = analyzeJobForAts(job, profile);
    const recommendations = generateCVRecommendations(analysis, parseSkills(profile.skills));

    return ok(res, requestId, {
      analysis: {
        score: analysis.scores.overall,
        keywordCoverage: { overall: analysis.scores.keywordMatch },
        requirementCoverage: analysis.scores.requirementMatch,
        profileEvidenceCoverage: analysis.scores.profileEvidence,
        roleMatch: analysis.scores.roleMatch,
        analysisStatus: analysis.analysisStatus,
        basis: analysis.basis,
        metadata: analysis.metadata,
        criticalGaps: analysis.criticalGaps,
        requirements: analysis.requirements.map((requirement) => ({
          id: requirement.id,
          text: requirement.text,
          category: requirement.category,
          importance: requirement.importance,
          source: requirement.source,
        })),
        matches: analysis.matches.map((match) => ({
          requirementId: match.requirementId,
          status: match.status,
          confidence: match.confidence,
        })),
      },
      recommendations: recommendations.map((recommendation) => ({
        requirementId: recommendation.requirementId,
        changeType: recommendation.changeType,
        priority: recommendation.priority,
        proposedChange: recommendation.proposedChange,
        rationale: recommendation.rationale,
        evidence: recommendation.relatedCVEvidence,
      })),
      ai: { requested: false, executed: false },
    });
  } catch (error) {
    return fail(res, requestId, error);
  }
}
