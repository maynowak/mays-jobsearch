import { getOpenRouterModel } from "../model.mjs";
import { getConfig } from "../config.mjs";
import {
  aiError,
  ERROR_CODES,
} from "./errors.mjs";
import {
  aiLimitReached,
  countAiAttempt,
  countAiFailure,
  countAiRequest,
} from "../usage.mjs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS_URL = "https://openrouter.ai/api/v1/models";
const TIMEOUT_MS = 40_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = null;

// Safety observation (optional, enabled when observer is set)
let safetyObserver = null;

export const PROVIDER_ID = "openrouter";
export const PROVIDER_NAME = "OpenRouter";

export function setSafetyObserver(observer) {
  safetyObserver = observer;
}

export function getSafetyObserver() {
  return safetyObserver;
}

export function isConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function enabled() {
  return getConfig().openRouterEnabled && isConfigured();
}

export function requireApiKey() {
  if (!isConfigured()) {
    throw aiError(
      500,
      "The server is missing the OPENROUTER_API_KEY environment variable, so AI features aren't available yet. Ask your developer to add it on Vercel.",
      ERROR_CODES.missingKey
    );
  }
  return process.env.OPENROUTER_API_KEY;
}

export function isFreeDailyQuotaError(providerError) {
  return typeof providerError === "string" && /free-models-per-day/i.test(providerError);
}

function logModelError(stage, { model, attempt, status, providerError, retryAfter }) {
  const parts = [`[ai] provider=openrouter model=${model ?? "(none)"}`];
  parts.push(`stage=${stage}`);
  if (attempt) parts.push(`attempt=${attempt}`);
  if (status) parts.push(`status=${status}`);
  if (retryAfter) parts.push(`retryAfter=${retryAfter}`);
  if (providerError) parts.push(`provider=${providerError}`);
  console.error(parts.join(" "));
}

function pricingIsFree(m) {
  const p = (m && m.pricing) || {};
  const requiredFree = ["prompt", "completion", "request"];
  return requiredFree.every((key) => String(p[key] ?? "0") === "0");
}

function supportsTextInput(m) {
  return (
    Array.isArray(m?.architecture?.input_modalities) &&
    m.architecture.input_modalities.includes("text")
  );
}

function supportsTextOutput(m) {
  return (
    Array.isArray(m?.architecture?.output_modalities) &&
    m.architecture.output_modalities.includes("text")
  );
}

function isNotExpired(m) {
  if (!m?.expiration_date) return true;
  const t = Date.parse(m.expiration_date);
  return Number.isFinite(t) && t > Date.now();
}

function supportsReasoning(m) {
  return m?.architecture?.supports_reasoning === true;
}

function supportsStructuredOutput(m) {
  const params = Array.isArray(m?.supported_parameters) ? m.supported_parameters : [];
  return params.includes("response_format") || params.includes("json_schema");
}

function isEligible(m) {
  return (
    pricingIsFree(m) &&
    supportsTextInput(m) &&
    supportsTextOutput(m) &&
    isNotExpired(m) &&
    !supportsReasoning(m)
  );
}

async function fetchEligibleModels() {
  const res = await fetch(MODELS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw aiError(
      502,
      "OpenRouter couldn't provide the model list right now. Please try again shortly.",
      ERROR_CODES.modelsUnavailable
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw aiError(
      502,
      "OpenRouter sent back an unreadable model list. Please try again shortly.",
      ERROR_CODES.modelsUnavailable
    );
  }

  const list = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
  return list
    .filter(isEligible)
    .map((m) => ({
      id: String(m.id || "").trim(),
      name: String(m.name || m.id || "").trim(),
      structured: supportsStructuredOutput(m),
    }))
    .filter((m) => m.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getModels() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.models;
  try {
    const models = await fetchEligibleModels();
    cache = { fetchedAt: Date.now(), models };
    return models;
  } catch (err) {
    if (cache) return cache.models;
    throw err;
  }
}

export function __resetModelsCacheForTests() {
  cache = null;
}

export async function ownsModel(id) {
  const models = await getModels();
  return models.some((m) => m.id === id);
}

export async function getCompatibleFallback(preferred) {
  let models;
  try {
    models = await getModels();
  } catch {
    return null;
  }
  if (!models.length) return null;
  if (preferred && models.some((m) => m.id === preferred)) return preferred;

  const ranked = [...models].sort((a, b) => {
    const aFree = a.id.includes(":free") ? 1 : 0;
    const bFree = b.id.includes(":free") ? 1 : 0;
    if (aFree !== bFree) return bFree - aFree;
    if (a.structured !== b.structured) return a.structured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return ranked[0].id;
}

export async function getEligibleModel(preferred) {
  const configured = getOpenRouterModel();
  const fallback = await getCompatibleFallback(configured);
  const candidate = preferred && (await ownsModel(preferred)) ? preferred : fallback || configured;
  return candidate || null;
}

export async function getDefaultModel() {
  const configured = getOpenRouterModel();
  const fallback = await getCompatibleFallback(configured);
  return fallback || configured;
}

export async function limitReached() {
  return aiLimitReached(PROVIDER_ID);
}

export function countRequest(model) {
  return countAiRequest(PROVIDER_ID, model);
}

export function countFailure() {
  return countAiFailure(PROVIDER_ID);
}

export function countAttempt() {
  return countAiAttempt(PROVIDER_ID);
}

export async function chat({ system, prompt, json, temperature, maxTokens, model, attempt }) {
  const apiKey = requireApiKey();
  // Safety observation: emit event based on current environment before provider request
  if (safetyObserver) {
    const isProduction = String(process.env.OPENROUTER_ENV || "").trim().toLowerCase() === "production";
    const isSandbox = !isProduction;
    let eventCategory = "NONE";
    if (isSandbox) {
      eventCategory = "FREE_QUOTA_REQUEST";
    } else if (isProduction) {
      eventCategory = "PRODUCTION_REQUEST";
    }
    safetyObserver.emit({
      type: "openrouter_provider_request",
      source: "openrouter",
      category: eventCategory,
      model,
      blocked: eventCategory !== "NONE" && eventCategory !== "FREE_QUOTA_REQUEST",
    });
  }
  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = Boolean(err && (err.name === "TimeoutError" || err.name === "AbortError"));
    logModelError(timedOut ? "timeout" : "network", { model, attempt });
    throw aiError(502, "This AI model is temporarily unavailable. Please choose another model.", ERROR_CODES.modelUnavailable);
  }

  if (response.status === 401) {
    logModelError("http-401", { model, attempt, status: response.status });
    throw aiError(
      502,
      "The OpenRouter API key on the server is invalid. Check the OPENROUTER_API_KEY environment variable.",
      ERROR_CODES.keyInvalid
    );
  }
  if (response.status === 402) {
    logModelError("http-402", { model, attempt, status: response.status });
    throw aiError(
      402,
      "The OpenRouter account has run out of credits. Top up at openrouter.ai to keep matching.",
      ERROR_CODES.insufficientCredits
    );
  }
  if (response.status === 429) {
    let providerError = "";
    try {
      const errBody = await response.json();
      providerError = String(errBody?.error?.message ?? "").slice(0, 180);
    } catch {
      /* body not readable */
    }
    logModelError("http-429", {
      model,
      attempt,
      status: response.status,
      retryAfter: response.headers?.get?.("retry-after") ?? "",
      providerError,
    });
    if (isFreeDailyQuotaError(providerError)) {
      throw aiError(
        429,
        "The free AI request quota for today has been used up. Please try again later.",
        ERROR_CODES.freeQuotaExceeded
      );
    }
    throw aiError(502, "This AI model is temporarily unavailable. Please choose another model.", ERROR_CODES.modelUnavailable);
  }
  if (!response.ok) {
    let providerError = "";
    try {
      const errBody = await response.json();
      providerError = String(errBody?.error?.message ?? errBody?.message ?? "").slice(0, 180);
    } catch {
      /* body not readable */
    }
    logModelError("http-error", { model, attempt, status: response.status, providerError });
    throw aiError(502, "This AI model is temporarily unavailable. Please choose another model.", ERROR_CODES.modelUnavailable);
  }

  let jsonBody;
  try {
    jsonBody = await response.json();
  } catch {
    logModelError("json-parse", { model, attempt, status: response.status });
    throw aiError(502, "This AI model is temporarily unavailable. Please choose another model.", ERROR_CODES.modelUnavailable);
  }

  const content = jsonBody?.choices?.[0]?.message?.content;
  if (!content) {
    logModelError("empty-content", { model, attempt, status: response.status });
    throw aiError(502, "This AI model is temporarily unavailable. Please choose another model.", ERROR_CODES.modelUnavailable);
  }
  return content;
}
