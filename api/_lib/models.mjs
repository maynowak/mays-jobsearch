import { HttpError } from "./filter.mjs";

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = null;

function isFreeModel(m) {
  const pricing = m && m.pricing ? m.pricing : {};
  const prompt = parseFloat(pricing.prompt);
  const completion = parseFloat(pricing.completion);
  return prompt === 0 && completion === 0;
}

async function fetchFreeModels() {
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
    .filter(isFreeModel)
    .map((m) => ({
      id: String(m.id || "").trim(),
      name: String(m.name || m.id || "").trim(),
    }))
    .filter((m) => m.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFreeModels() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.models;
  try {
    const models = await fetchFreeModels();
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
      "The selected model isn't currently available as a free OpenRouter model.",
      "model_not_free"
    );
  }
}