import { HttpError } from "./_lib/filter.mjs";
import { chat } from "./_lib/ai.mjs";
import { 
  analyzeJobForAts, 
  generateCVRecommendations,
  formulateCVText,
  formulateAllRecommendations,
  validateRecommendationSafety,
  getPrivacyNotice,
} from "./_lib/ats.mjs";
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

function getModelInfo(provider) {
  const { getOpenRouterModel, getEdenaiModel } = require("./_lib/model.mjs");
  
  if (provider === "OpenRouter") {
    return { model: getOpenRouterModel() };
  }
  
  if (provider === "EdenAI") {
    return { model: getEdenaiModel() };
  }
  
  return { model: null };
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
    
    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, code: validation.code });
    }
    
    const { job, profile } = body;
    const aiOptions = body.ai || {};
    const aiEnabled = aiOptions.enabled === true;
    const consentGiven = aiOptions.consent === true;
    
    // Parse skills properly
    const cvSkills = parseSkills(profile?.skills);
    
    // Step 1: Deterministic ATS Analysis (always executed)
    const analysis = analyzeJobForAts(job, profile || {});
    const recommendations = generateCVRecommendations(analysis, cvSkills);
    
    const response = {
      analysis: {
        score: analysis.scores.overall,
        keywordCoverage: { overall: analysis.scores.keywordMatch },
        criticalGaps: analysis.criticalGaps,
        requirements: analysis.requirements.map(r => ({
          id: r.id,
          text: r.text,
          category: r.category,
          importance: r.importance,
        })),
        matches: analysis.matches.map(m => ({
          requirementId: m.requirementId,
          status: m.status,
          confidence: m.confidence,
        })),
      },
      recommendations: recommendations.map(r => ({
        requirementId: r.requirementId,
        changeType: r.changeType,
        priority: r.priority,
        proposedChange: r.proposedChange,
        rationale: r.rationale,
        evidence: r.relatedCVEvidence,
      })),
      ai: {
        requested: aiEnabled,
        executed: false,
        consentRequired: true,
        consentGiven,
        provider: null,
        model: null,
        externalProcessing: false,
        dataMinimized: false,
        privacyStatus: null,
        dataCategories: [],
        privacyPolicy: null,
        formulations: [],
      },
    };
    
    // Step 2: AI Processing (only if enabled and consent given)
    if (aiEnabled && consentGiven) {
      const providerInfo = getProviderInfo();
      const modelInfo = getModelInfo(providerInfo.provider);
      
      response.ai = {
        requested: true,
        executed: false,
        consentRequired: true,
        consentGiven,
        provider: providerInfo.provider,
        model: modelInfo.model,
        externalProcessing: providerInfo.provider !== "unavailable",
        dataMinimized: true,
        privacyStatus: providerInfo.privacyStatus,
        dataCategories: providerInfo.provider !== "unavailable" 
          ? ["job requirement", "matched keyword", "change type"] 
          : [],
        privacyPolicy: providerInfo.privacyPolicy,
        formulations: [],
      };
      
      // Validate safety and get formulations
      const formulations = await Promise.allSettled(
        recommendations.map(async (rec) => {
          // Check safety first
          const safety = validateRecommendationSafety(rec, cvSkills);
          
          if (!safety.safe) {
            return {
              recommendationId: rec.requirementId,
              changeType: rec.changeType,
              safetyStatus: "DO_NOT_GENERATE",
              safetyReason: safety.reason,
            };
          }
          
          // Generate formulation
          return await formulateCVText(rec, cvSkills, {});
        })
      );
      
      // Separate fulfilled and rejected
      const successfulFormulations = [];
      
      for (let i = 0; i < formulations.length; i++) {
        const form = formulations[i];
        if (form.status === "fulfilled") {
          successfulFormulations.push(form.value);
        }
      }
      
      response.ai.formulations = successfulFormulations;
      response.ai.executed = successfulFormulations.length > 0;
    } else if (aiEnabled && !consentGiven) {
      // AI requested but no consent - provide provider info for UI notice
      const providerInfo = getProviderInfo();
      
      response.ai = {
        requested: true,
        executed: false,
        consentRequired: true,
        consentGiven: false,
        provider: providerInfo.provider,
        model: providerInfo.provider !== "unavailable" ? "default" : null,
        externalProcessing: providerInfo.provider !== "unavailable",
        dataMinimized: true,
        privacyStatus: providerInfo.privacyStatus,
        dataCategories: providerInfo.provider !== "unavailable" 
          ? ["job requirement", "matched keyword", "change type"] 
          : [],
        privacyPolicy: providerInfo.privacyPolicy,
        formulations: [],
      };
    }
    
    return res.status(200).json(response);
    
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/ats-analysis] unexpected:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}
