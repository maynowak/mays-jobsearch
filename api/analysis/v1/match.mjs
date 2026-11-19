import {
  AnalysisError, authenticateService, requireScope, requireAnalysisConsent,
  requestIdFor, requireSchemaVersion, assertTenantAndUser, readJsonBody, ok, fail,
} from "../../_lib/analysis/security.mjs";
import { computeMatch } from "../../_lib/matching.mjs";
import { validateJobs, validateProfile } from "../../_lib/analysis/validation.mjs";

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    if (req.method !== "POST") {
      throw new AnalysisError(405, "method_not_allowed", "This endpoint accepts POST requests only.");
    }
    const identity = authenticateService(req);
    requireScope(identity, "match:evaluate");
    requireAnalysisConsent(req, identity);

    const body = await readJsonBody(req);
    requireSchemaVersion(body.schemaVersion);
    assertTenantAndUser(body, identity);
    const profile = validateProfile(body.profile);
    const jobs = validateJobs(body.jobs);
    const result = await computeMatch({ profile, jobs });

    return ok(res, requestId, {
      matches: result.matches,
      meta: result.meta,
    });
  } catch (error) {
    if (error && Number.isInteger(error.status) && typeof error.code === "string") {
      return fail(res, requestId, new AnalysisError(error.status, error.code, error.message));
    }
    return fail(res, requestId, error);
  }
}
