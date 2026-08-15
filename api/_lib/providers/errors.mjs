import { HttpError } from "../filter.mjs";

export const ERROR_CODES = {
  modelUnavailable: "model_unavailable",
  quotaExhausted: "quota_exhausted",
  freeQuotaExceeded: "free_quota_exceeded",
  rateLimited: "rate_limited",
  timeout: "timeout",
  networkError: "network_error",
  authenticationFailed: "authentication_failed",
  modelInvalid: "model_invalid",
  badRequest: "bad_request",
  badAiResponse: "bad_ai_response",
  keyInvalid: "key_invalid",
  insufficientCredits: "insufficient_credits",
  limitReached: "limit_reached",
  missingKey: "missing_key",
  modelsUnavailable: "models_unavailable",
  modelNotFree: "model_not_free",
};

const CATEGORIES = {
  model: "model",
  provider: "provider",
  client: "client",
};

const CODE_CATEGORY = {
  model_unavailable: CATEGORIES.model,
  model_invalid: CATEGORIES.client,
  model_not_free: CATEGORIES.client,
  bad_request: CATEGORIES.client,
  bad_ai_response: CATEGORIES.model,
  rate_limited: CATEGORIES.provider,
  timeout: CATEGORIES.provider,
  network_error: CATEGORIES.provider,
  authentication_failed: CATEGORIES.provider,
  quota_exhausted: CATEGORIES.provider,
  free_quota_exceeded: CATEGORIES.provider,
  insufficient_credits: CATEGORIES.provider,
  limit_reached: CATEGORIES.provider,
  key_invalid: CATEGORIES.provider,
  missing_key: CATEGORIES.provider,
  models_unavailable: CATEGORIES.provider,
};

const PROVIDER_EXHAUSTED_CODES = new Set([
  ERROR_CODES.freeQuotaExceeded,
  ERROR_CODES.quotaExhausted,
  ERROR_CODES.insufficientCredits,
  ERROR_CODES.limitReached,
]);

export class AiError extends HttpError {
  constructor(status, message, code = ERROR_CODES.modelUnavailable, category) {
    super(status, message, code);
    this.category = category || CODE_CATEGORY[code] || CATEGORIES.model;
  }
}

export function aiError(status, message, code, category) {
  return new AiError(status, message, code, category);
}

export function isAiError(err) {
  return err instanceof AiError || err instanceof HttpError;
}

export function isProviderExhausted(err) {
  return (
    err instanceof HttpError &&
    PROVIDER_EXHAUSTED_CODES.has(err.code)
  );
}

export function isModelLevelError(err) {
  return err instanceof HttpError && !PROVIDER_EXHAUSTED_CODES.has(err.code);
}
