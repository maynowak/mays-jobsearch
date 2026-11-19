import { createHash } from "node:crypto";
import { AnalysisError } from "./security.mjs";
import {
  analyzeJobForAts,
  extractJobMetadata,
  extractRequirementsFromJob,
  generateCVRecommendations,
} from "../ats.mjs";
import { computeMatch } from "../matching.mjs";

/**
 * Core service layer shared by the versioned analysis endpoints and the
 * existing UI-facing adapters. HTTP auth, scopes and consent stay in the API
 * layer; this module contains business operations only.
 */

function unquote(value) {
  return String(value ?? "").trim().replace(/^"(.*)"$/s, "$1").trim();
}

export function parseSkills(value) {
  if (Array.isArray(value)) return value.map(unquote).filter(Boolean);
  return String(value ?? "").split(",").map(unquote).filter(Boolean);
}

const CV_SECTION_IDS = [
  "personal",
  "profile",
  "experience",
  "education",
  "skills",
  "projects",
  "certificates",
  "languages",
  "links",
];

function sectionConfidenceOf(parsed) {
  const result = {};
  for (const sectionId of CV_SECTION_IDS) {
    const mapped = (parsed.mapping?.sections ?? []).filter(
      (section) => section.category === sectionId || section.targets?.includes(sectionId)
    );
    const levels = mapped.map((section) => section.confidence);
    let value = null;
    if (parsed.uncertain?.[sectionId] || levels.includes("uncertain")) {
      value = "uncertain";
    } else if (levels.includes("partial")) {
      value = "partial";
    } else if (parsed.detected?.[sectionId]) {
      value = "confirmed";
    }
    if (value) result[sectionId] = value;
  }
  return result;
}

function overallConfidenceOf(sections) {
  const values = Object.values(sections);
  if (values.includes("uncertain")) return "uncertain";
  if (values.includes("partial")) return "partial";
  return values.length ? "confirmed" : "uncertain";
}

function profileOf(draft) {
  return {
    headline: draft.profile?.headline ?? null,
    skills: Array.isArray(draft.skills) ? [...draft.skills] : [],
    targetRoles: [],
    experienceLevel: null,
  };
}

export async function parseCvBuffer(buffer, { includePersonal = false } = {}) {
  // Keep the PDF/PDF.js dependency lazy so ATS and matching calls do not load
  // the PDF extraction bundle on their cold path.
  const [{ extractPdfDocument }, { parseCvBuilderImportText }] = await Promise.all([
    import("./pdf.mjs"),
    import("./cvParser.mjs"),
  ]);
  let document;
  try {
    document = await extractPdfDocument(buffer, { maxPages: 40 });
  } catch (error) {
    if (error?.code === "pdf_too_many_pages") {
      throw new AnalysisError(422, "pdf_too_many_pages", "The PDF has too many pages.");
    }
    if (error?.name === "PasswordException") {
      throw new AnalysisError(422, "pdf_encrypted", "Encrypted PDFs are not supported.");
    }
    throw new AnalysisError(422, "pdf_invalid", "The PDF could not be read.");
  }
  if (document.text.length > 60_000) {
    throw new AnalysisError(422, "text_too_long", "The extracted CV text is too long.");
  }

  let parsed;
  try {
    parsed = parseCvBuilderImportText(document.text, document);
  } catch {
    throw new AnalysisError(422, "pdf_parse_failed", "The PDF could not be parsed.");
  }

  const draft = {
    ...parsed.draft,
    personal: includePersonal ? { ...parsed.draft.personal } : {},
  };
  const sectionConfidence = sectionConfidenceOf(parsed);
  return {
    data: {
      parserVersion: "cv-import-03b-server-1",
      document: {
        sha256: createHash("sha256").update(buffer).digest("hex"),
        sizeBytes: buffer.length,
        pageCount: document.pageCount,
        textLength: document.text.length,
      },
      draft,
      confidence: overallConfidenceOf(sectionConfidence),
      sectionConfidence,
      unrecognizedCount: parsed.unrecognized.length,
      mapping: parsed.mapping,
      anonymizedProfile: profileOf(draft),
    },
    warnings: includePersonal ? [] : [{
      code: "personal_fields_omitted",
      message: "Personal contact fields were omitted from the default response.",
    }],
  };
}

export function extractAtsRequirements(job, profile = {}) {
  const requirements = extractRequirementsFromJob(job, profile);
  const metadata = extractJobMetadata(job);
  const hasDescription = Boolean(job.descriptionPlain || job.description);
  return {
    analysisStatus: requirements.length === 0 ? "insufficient" : hasDescription ? "complete" : "limited",
    metadata,
    basis: {
      requirementCount: requirements.length,
      titleRequirementCount: metadata.titleTokens.length,
      hasDescription,
    },
    requirements,
  };
}

export function analyzeAts(job, profile = {}) {
  const analysis = analyzeJobForAts(job, profile);
  const recommendations = generateCVRecommendations(analysis, parseSkills(profile.skills));
  return {
    analysis,
    recommendations,
    data: {
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
    },
  };
}

export async function matchJobs(profile, jobs, options = {}) {
  return computeMatch({ profile, jobs, ...options });
}
