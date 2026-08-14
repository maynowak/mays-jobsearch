import { HttpError } from "./filter.mjs";
import { getOpenRouterModel } from "./model.mjs";

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = null;

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

function supportsStructuredOutput(m) {
  const params = Array.isArray(m?.supported_parameters) ? m.supported_parameters : [];
  return params.includes("response_format") || params.includes("json_schema");
}

function isEligible(m) {
  return (
    pricingIsFree(m) &&
    supportsTextInput(m) &&
    supportsTextOutput(m) &&
    isNotExpired(m)
  );
}

async function fetchEligibleModels() {
  const res = await fetch(MODELS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new HttpError(
      502,
      "OpenRouter couldn't provide the model list right now. Please try again shortly.",
      "models_unavailable"
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new HttpError(
      502,
      "OpenRouter sent back an unreadable model list. Please try again shortly.",
      "models_unavailable"
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

export async function getFreeModels() {
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

export async function assertFreeModel(id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*\/[a-zA-Z0-9][a-zA-Z0-9._:+~-]*$/.test(id)) {
    throw new HttpError(400, "The requested model ID isn't valid.", "model_invalid");
  }
  const models = await getFreeModels();
  if (!models.some((m) => m.id === id)) {
    throw new HttpError(
      400,
      "The selected model isn't currently available as a free compatible model.",
      "model_not_free"
    );
  }
}

export async function getCompatibleFallback(preferred) {
  let models;
  try {
    models = await getFreeModels();
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

export async function resolveDefaultModel() {
  const configured = getOpenRouterModel();
  const fallback = await getCompatibleFallback(configured);
  return fallback || configured;
}