import {
  AnalysisError, authenticateService, requireScope, requireAnalysisConsent,
  requestIdFor, requireSchemaVersion, assertTenantAndUser, readJsonBody, ok, fail,
} from "../../../_lib/analysis/security.mjs";
import { analyzeAts } from "../../../_lib/analysis/service.mjs";
import { validateJob, validateProfile } from "../../../_lib/analysis/validation.mjs";

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
    return ok(res, requestId, analyzeAts(job, profile).data);
  } catch (error) {
    return fail(res, requestId, error);
  }
}
