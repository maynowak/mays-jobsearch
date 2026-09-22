import { HttpError } from "./_lib/filter.mjs";
import {
  analyzeJobForAts,
  generateCVRecommendations,
  generateImprovementPlan,
  getRecommendationSummary,
  applyRecommendations,
  computeImprovementDelta,
  computeMatchImpact,
} from "../src/lib/cv-improvement.js";
import { computeMatchForJob } from "./_lib/matching.mjs";
import { getConfig } from "./_lib/config.mjs";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new HttpError(400, "The request body wasn't valid JSON.", "bad_request"));
      }
    });
    req.on("error", () => reject(new HttpError(400, "Couldn't read the request.", "bad_request")));
  });
}

function validateRequest(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object", code: "bad_request" };
  }

  if (!body.job || typeof body.job !== "object") {
    return { valid: false, error: "Job must be an object", code: "bad_request" };
  }

  if (!body.profile || typeof body.profile !== "object") {
    return { valid: false, error: "Profile must be an object", code: "bad_request" };
  }

  return { valid: true };
}

function parseSkills(skills) {
  if (typeof skills === "string") {
    return skills.split(",").map(s => s.trim()).filter(s => s);
  }
  if (Array.isArray(skills)) {
    return skills;
  }
  return [];
}

function getProviderInfo() {
  const cfg = getConfig();
  const openRouterEnabled = cfg.openRouterEnabled;
  const edenaiEnabled = cfg.edenaiEnabled;

  if (openRouterEnabled) {
    return {
      provider: "OpenRouter",
      privacyStatus: "VERIFIED",
      privacyPolicy: "https://openrouter.ai/privacy (Last Updated: August 31, 2026)",
    };
  }

  if (edenaiEnabled) {
    return {
      provider: "EdenAI",
      privacyStatus: "UNKNOWN",
      privacyPolicy: "Privacy policy to be investigated",
    };
  }

  return {
    provider: "unavailable",
    privacyStatus: "NO_PROVIDER_CONFIGURED",
    privacyPolicy: "No AI provider available"
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "This endpoint accepts POST requests only.", code: "method" });
  }

  try {
    const body = req.body || (await readBody(req));

    // Determine which endpoint is being called
    const isApplyEndpoint = req.url && req.url.endsWith("/apply");
    const isReanalyzeEndpoint = req.url && req.url.endsWith("/reanalyze");
    const isMatchImpactEndpoint = req.url && req.url.endsWith("/match-impact");

    if (isMatchImpactEndpoint) {
      // Handle match impact analysis endpoint
      const validation = validateRequest(body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, code: validation.code });
      }

      const { job, originalProfile, improvedProfile } = body;

      if (!job || typeof job !== "object") {
        return res.status(400).json({ error: "Job must be an object", code: "bad_request" });
      }

      if (!originalProfile || typeof originalProfile !== "object") {
        return res.status(400).json({ error: "Original profile must be an object", code: "bad_request" });
      }

      if (!improvedProfile || typeof improvedProfile !== "object") {
        return res.status(400).json({ error: "Improved profile must be an object", code: "bad_request" });
      }

      // Run MATCHING on original profile using the existing matching infrastructure
      const beforeMatch = await computeMatchForJob({
        profile: { skills: originalProfile.skills || "", targetRole: originalProfile.targetRole || "", city: originalProfile.city || "" },
        job,
      });

      // Run MATCHING on improved profile using the existing matching infrastructure
      const afterMatch = await computeMatchForJob({
        profile: { skills: improvedProfile.skills || "", targetRole: improvedProfile.targetRole || "", city: improvedProfile.city || "" },
        job,
      });

      // Compute match impact delta from actual match scores
      const beforeScore = beforeMatch?.score || 0;
      const afterScore = afterMatch?.score || 0;
      const matchImpact = computeMatchImpact(
        { score: beforeScore, coverage: 0 }, // Match scores don't have coverage; use 0 or compute separately
        { score: afterScore, coverage: 0 }
      );

      const response = {
        data: {
          before: {
            score: matchImpact.before.score,
            coverage: matchImpact.before.coverage,
          },
          after: {
            score: matchImpact.after.score,
            coverage: matchImpact.after.coverage,
          },
          delta: {
            score: matchImpact.delta.score,
            coverage: matchImpact.delta.coverage,
          },
          changes: matchImpact.changes,
        },
        meta: {
          version: "v1",
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };

      return res.status(200).json(response);
    } else if (isApplyEndpoint) {
      // Handle apply improvements endpoint
      const validation = validateRequest(body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, code: validation.code });
      }

      const { profile, selectedRecommendationIds, allRecommendations } = body;

      if (!selectedRecommendationIds || !Array.isArray(selectedRecommendationIds) || selectedRecommendationIds.length === 0) {
        return res.status(400).json({ error: "No recommendations selected", code: "bad_request" });
      }

      if (!allRecommendations || !Array.isArray(allRecommendations)) {
        return res.status(400).json({ error: "All recommendations required", code: "bad_request" });
      }

      if (!body.profile || typeof body.profile !== "object") {
        return res.status(400).json({ error: "Profile must be an object", code: "bad_request" });
      }

      const cvSkills = parseSkills(body.profile?.skills);

      // Apply selected recommendations
      const result = applyRecommendations(body.profile, selectedRecommendationIds, body.allRecommendations);

      return res.status(200).json({
        data: {
          improvedProfile: result.improvedProfile,
          appliedCount: result.appliedCount,
          appliedRecommendations: result.appliedRecommendations,
        },
        meta: {
          version: "v1",
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    } else if (isReanalyzeEndpoint) {
      // Handle re-analysis endpoint
      const validation = validateRequest(body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, code: validation.code });
      }

      const { job, originalProfile, improvedProfile } = body;

      if (!job || typeof job !== "object") {
        return res.status(400).json({ error: "Job must be an object", code: "bad_request" });
      }

      if (!originalProfile || typeof originalProfile !== "object") {
        return res.status(400).json({ error: "Original profile must be an object", code: "bad_request" });
      }

      if (!improvedProfile || typeof improvedProfile !== "object") {
        return res.status(400).json({ error: "Improved profile must be an object", code: "bad_request" });
      }

      const cvSkills = parseSkills(originalProfile?.skills);

      // Run ATS analysis on original profile
      const beforeAnalysis = analyzeJobForAts(job, { skills: originalProfile.skills });

      // Run ATS analysis on improved profile
      const afterAnalysis = analyzeJobForAts(job, { skills: improvedProfile.skills });

      // Compute delta
      const delta = computeImprovementDelta(beforeAnalysis, afterAnalysis);

      const response = {
        data: {
          before: beforeAnalysis,
          after: afterAnalysis,
          delta: delta,
        },
        meta: {
          version: "v1",
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };

      return res.status(200).json(response);
    } else {
      // Original endpoint: generate improvement plan
      const body2 = req.body || (await readBody(req));

      // Validate request
      const validation = validateRequest(body2);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, code: validation.code });
      }

      const { job, profile } = body2;
      const cvSkills = parseSkills(profile?.skills);

      // Step 1: ATS Analysis (deterministic)
      const analysis = analyzeJobForAts(job, profile || {});

      // Step 2: Generate CV Improvement Plan
      const improvementPlan = generateImprovementPlan(analysis, parseSkills(profile?.skills));
      const summary = getRecommendationSummary(improvementPlan.recommendations);

      const response = {
        improvement: {
          plan: improvementPlan.recommendations,
          summary,
          totalRequirements: improvementPlan.recommendations.length,
          generatedAt: new Date().toISOString(),
        },
        analysis: {
          score: analysis.scores.overall,
          keywordCoverage: { overall: analysis.scores.keywordMatch },
          criticalGaps: analysis.criticalGaps.map(g => ({ id: g.id, text: g.text })),
          summary: analysis.summary,
        },
        meta: {
          version: "v1",
          generatedAt: new Date().toISOString(),
        },
      };

      return res.status(200).json(response);
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/cv-improvement] unexpected:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}