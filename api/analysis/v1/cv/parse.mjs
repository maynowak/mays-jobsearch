import { AnalysisError, authenticateService, requireScope, requireAnalysisConsent,
  requestIdFor, requireSchemaVersion, requirePdfContentType, readRawBody,
  getHeader, ok, fail } from "../../../_lib/analysis/security.mjs";
import { parseCvBuffer } from "../../../_lib/analysis/service.mjs";

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
    const includePersonal = String(getHeader(req, "x-cv-include-personal") ?? "").toLowerCase() === "true";
    const result = await parseCvBuffer(buffer, { includePersonal });
    return ok(res, requestId, result.data, result.warnings);
  } catch (error) {
    return fail(res, requestId, error);
  }
}
