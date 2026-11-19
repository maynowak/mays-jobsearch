import { createHash } from "node:crypto";
import { AnalysisError, authenticateService, requireScope, requireAnalysisConsent,
  requestIdFor, requireSchemaVersion, requirePdfContentType, readRawBody,
  getHeader, ok, fail } from "../../../_lib/analysis/security.mjs";
import { extractPdfDocument } from "../../../_lib/analysis/pdf.mjs";
import { parseCvBuilderImportText } from "../../../_lib/analysis/cvParser.mjs";

function confidenceOf(parsed) {
  const values = Object.values(parsed.uncertain ?? {});
  if (values.some(Boolean)) return "uncertain";
  return Object.values(parsed.detected ?? {}).some(Boolean) ? "confirmed" : "uncertain";
}

function profileOf(draft) {
  return {
    headline: draft.profile?.headline ?? null,
    skills: Array.isArray(draft.skills) ? [...draft.skills] : [],
    targetRoles: [],
    experienceLevel: null,
  };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    if (req.method !== "POST") {
      throw new AnalysisError(405, "method_not_allowed", "This endpoint accepts POST requests only.");
    }
    const identity = authenticateService(req);
    requireScope(identity, "cv:parse");
    requireAnalysisConsent(req, identity);
    requirePdfContentType(req);
    requireSchemaVersion(Number(getHeader(req, "x-schema-version")));

    const buffer = await readRawBody(req);
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

    const includePersonal = String(getHeader(req, "x-cv-include-personal") ?? "").toLowerCase() === "true";
    const draft = {
      ...parsed.draft,
      personal: includePersonal ? { ...parsed.draft.personal } : {},
    };
    const warnings = [];
    if (!includePersonal) warnings.push({
      code: "personal_fields_omitted",
      message: "Personal contact fields were omitted from the default response.",
    });

    return ok(res, requestId, {
      parserVersion: "cv-import-03b-server-1",
      document: {
        sha256: createHash("sha256").update(buffer).digest("hex"),
        sizeBytes: buffer.length,
        pageCount: document.pageCount,
        textLength: document.text.length,
      },
      draft,
      confidence: confidenceOf(parsed),
      sectionConfidence: parsed.uncertain,
      unrecognizedCount: parsed.unrecognized.length,
      mapping: parsed.mapping,
      anonymizedProfile: profileOf(draft),
    }, warnings);
  } catch (error) {
    return fail(res, requestId, error);
  }
}
