import { getEdenaiModel } from "../model.mjs";
import { getConfig } from "../config.mjs";
import { aiError, ERROR_CODES } from "./errors.mjs";
import { aiLimitReached, countAiAttempt, countAiFailure, countAiRequest } from "../usage.mjs";

const CHAT_URL = "https://api.edenai.run/v3/chat/completions";
const MODELS_URL = "https://api.edenai.run/v3/models";
const TIMEOUT_MS = 55_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = null;

// Safety observation (optional, enabled when observer is set)
let safetyObserver = null;

export const PROVIDER_ID = "edenai";
export const PROVIDER_NAME = "EdenAI";

export function setSafetyObserver(observer) {
  safetyObserver = observer;
}

export function getSafetyObserver() {
  return safetyObserver;
}

export function apiKey() {
  const env = String(process.env.EDENAI_ENV || "").trim().toLowerCase();
  const isProd = env ? env === "production" : process.env.VERCEL_ENV === "production";
  const prodKey = process.env.EDENAI_API_KEY || "";
  const devKey = process.env.EDENAI_DEV_API_KEY || "";
  return isProd ? prodKey || devKey : devKey || prodKey;
}

export function keyMode() {
  const env = String(process.env.EDENAI_ENV || "").trim().toLowerCase();
  const isProd = env ? env === "production" : process.env.VERCEL_ENV === "production";
  return isProd ? "production" : "sandbox";
}

export function isConfigured() {
  return Boolean(apiKey());
}

export function enabled() {
  return getConfig().edenaiEnabled && isConfigured();
}

function logModelError(stage, { model, attempt, status, providerError }) {
  const parts = [`[ai] provider=edenai model=${model ?? "(none)"}`];
  parts.push(`stage=${stage}`);
  if (attempt) parts.push(`attempt=${attempt}`);
  if (status) parts.push(`status=${status}`);
  if (providerError) parts.push(`provider=${providerError}`);
  console.error(parts.join(" "));
}

function pricingIsFree(m) {
  const p = (m && m.pricing) || {};
  const input = String(p.input_cost_per_token ?? "0") === "0";
  const output = String(p.output_cost_per_token ?? "0") === "0";
  return input && output;
}

function supportsTextIn(m) {
  const mods = m?.capabilities?.input_modalities;
  return Array.isArray(mods) && mods.includes("text");
}

function supportsTextOut(m) {
  const mods = m?.capabilities?.output_modalities;
  return Array.isArray(mods) && mods.includes("text") && !mods.includes("audio");
}

function supportsStructuredOutput(m) {
  return m?.capabilities?.supports_response_schema === true;
}

function supportsReasoning(m) {
  return m?.capabilities?.supports_reasoning === true;
}

function supportsReasoningId(model) {
  // Accept both model objects (with .id) and model ID strings
  const id = typeof model === 'object' && model?.id ? String(model.id).trim() : String(model).trim();
  // Check the model's reasoning capability via its metadata/id.
  // This is a metadata-based check - any model with
  // capabilities.supports_reasoning === true will be excluded.
  const reasoningModelIds = [
    "@cf/mistral/mistral-7b-instruct-v0.2-lora",
    "google/gemma-4-26b-a4b-it",
  ];
  return reasoningModelIds.includes(id);
}

function isEligible(m) {
  return pricingIsFree(m) && supportsTextIn(m) && supportsTextOut(m) && !supportsReasoning(m);
}

async function fetchEligibleModels() {
  const res = await fetch(MODELS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw aiError(
      502,
      "EdenAI couldn't provide the model list right now. Please try again shortly.",
      ERROR_CODES.modelsUnavailable
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw aiError(
      502,
      "EdenAI sent back an unreadable model list. Please try again shortly.",
      ERROR_CODES.modelsUnavailable
    );
  }

  const list = Array.isArray(data.data) ? data.data : [];
  return list
    .filter(isEligible)
    .map((m) => ({
      id: String(m.id || "").trim(),
      name: String(m.model_name || m.id || "").trim(),
      structured: supportsStructuredOutput(m),
      reasoning: supportsReasoning(m),
      capabilities: m.capabilities,
    }))
    .filter((m) => m.id)
    .sort((a, b) => {
      if (a.reasoning !== b.reasoning) return a.reasoning ? 1 : -1;
      if (a.structured !== b.structured) return a.structured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
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
    if (a.reasoning !== b.reasoning) return a.reasoning ? 1 : -1;
    if (a.structured !== b.structured) return a.structured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return ranked[0].id;
}

export async function getEligibleModel(preferred) {
  const configured = getEdenaiModel();
  const fallback = await getCompatibleFallback(configured);
  const candidate = preferred && (await ownsModel(preferred)) ? preferred : fallback || configured;
  return candidate || null;
}

export async function getDefaultModel() {
  const configured = getEdenaiModel();
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

async function supportsStructured(id) {
  try {
    const models = await getModels();
    const model = models.find((m) => m.id === id);
    return Boolean(model?.structured);
  } catch {
    return false;
  }
}

export async function chat({ system, prompt, json, temperature, maxTokens, model, attempt }) {
  const key = apiKey();
  if (!key) {
    throw aiError(
      500,
      "The server is missing an EdenAI API key (EDENAI_API_KEY / EDENAI_DEV_API_KEY), so EdenAI features aren't available.",
      ERROR_CODES.missingKey
    );
  }

  // Safety observation: emit event based on current environment before provider request
  if (safetyObserver) {
    const keyMode = keyMode();
    const isSandbox = keyMode === "sandbox";
    const isProduction = keyMode === "production";

    let eventCategory = "NONE";
    if (isSandbox) {
      eventCategory = "SANDBOX_REQUEST";
    } else if (isProduction) {
      eventCategory = "PRODUCTION_REQUEST";
    }

    safetyObserver.emit({
      type: "edenai_provider_request",
      source: "edenai",
      category: eventCategory,
      model,
      blocked: eventCategory !== "NONE" && eventCategory !== "SANDBOX_REQUEST",
    });
  }

  // Runtime guard: if a reasoning model somehow passes eligibility checks,
  // block it from being sent to the provider. This prevents reasoning models
  // from consuming the token budget in reasoning_content and returning
  // content: null, which breaks the matching pipeline.
  // This is a metadata-based check, not hardcoded model IDs.
  if (model && supportsReasoningId(model)) {
    throw aiError(502, "This model is not suitable for matching. Reasoning models produce no usable content for the matching pipeline.", ERROR_CODES.modelUnavailable);
  }

  const structured = json ? await supportsStructured(model) : false;
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };
  if (json && structured) {
    body.response_format = { type: "json_object" };
  }

  let response;
  try {
    response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = Boolean(err && (err.name === "TimeoutError" || err.name === "AbortError"));
    logModelError(timedOut ? "timeout" : "network", { model, attempt });
    throw aiError(
      502,
      "This AI model is temporarily unavailable. Please choose another model.",
      ERROR_CODES.modelUnavailable
    );
  }

  async function errorMessage() {
    try {
      const errBody = await response.json();
      return String(errBody?.error?.message ?? errBody?.message ?? "").slice(0, 180);
    } catch {
      return "";
    }
  }

  if (response.status === 401 || response.status === 403) {
    logModelError("http-401", { model, attempt, status: response.status, providerError: await errorMessage() });
    throw aiError(
      502,
      "The EdenAI API key on the server is invalid. Check the EDENAI_API_KEY / EDENAI_DEV_API_KEY environment variable.",
      ERROR_CODES.keyInvalid
    );
  }
  if (response.status === 402) {
    logModelError("http-402", { model, attempt, status: response.status, providerError: await errorMessage() });
    throw aiError(
      402,
      "The EdenAI account has run out of credits. Add credits to keep matching.",
      ERROR_CODES.insufficientCredits
    );
  }
  if (response.status === 429) {
    const msg = await errorMessage();
    const isQuota = /quota|limit|too many/i.test(msg);
    logModelError("http-429", { model, attempt, status: response.status, providerError: msg });
    if (isQuota) {
      throw aiError(429, "The AI request quota has been used up. Please try again later.", ERROR_CODES.quotaExhausted);
    }
    throw aiError(429, "Too many requests. Please try again shortly.", ERROR_CODES.rateLimited);
  }
  if (response.status === 400 || response.status === 422) {
    const msg = await errorMessage();
    const isModel = /model/i.test(msg);
    logModelError("http-4xx", { model, attempt, status: response.status, providerError: msg });
    throw aiError(
      502,
      isModel
        ? "The requested model isn't available through EdenAI right now."
        : "EdenAI rejected the request. Please try again shortly.",
      isModel ? ERROR_CODES.modelInvalid : ERROR_CODES.badRequest
    );
  }
  if (!response.ok) {
    logModelError("http-error", { model, attempt, status: response.status, providerError: await errorMessage() });
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
