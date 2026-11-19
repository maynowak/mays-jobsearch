import {
  AnalysisError, authenticateService, requireScope, requireAnalysisConsent,
  requestIdFor, requireSchemaVersion, assertTenantAndUser, readJsonBody, ok, fail,
} from "../../../_lib/analysis/security.mjs";
import { extractRequirementsFromJob, extractJobMetadata } from "../../../_lib/ats.mjs";
import { validateJob, validateProfile } from "../../../_lib/analysis/validation.mjs";

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    if (req.method !== "POST") {
      throw new AnalysisError(405, "method_not_allowed", "This endpoint accepts POST requests only.");
    }
    const identity = authenticateService(req);
    requireScope(identity, "ats:requirements");
    requireAnalysisConsent(req, identity);

    const body = await readJsonBody(req);
    requireSchemaVersion(body.schemaVersion);
    assertTenantAndUser(body, identity);
    const job = validateJob(body.job);
    const profile = validateProfile(body.profile);
    const requirements = extractRequirementsFromJob(job, profile);
    const metadata = extractJobMetadata(job);
    const hasDescription = Boolean(job.descriptionPlain || job.description);

    return ok(res, requestId, {
      analysisStatus: requirements.length === 0 ? "insufficient" : hasDescription ? "complete" : "limited",
      metadata,
      basis: {
        requirementCount: requirements.length,
        titleRequirementCount: metadata.titleTokens.length,
        hasDescription,
      },
      requirements,
    });
  } catch (error) {
    return fail(res, requestId, error);
  }
}
