import { getConfig } from "../config.mjs";
import { getOpenRouterModel, getEdenaiModel } from "../model.mjs";
import { aiError, ERROR_CODES, isProviderExhausted } from "./errors.mjs";
import * as openrouter from "./openrouter.mjs";
import * as edenai from "./edenai.mjs";

export const PROVIDERS = [openrouter, edenai];

const MODEL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:@+-]*(\/[a-zA-Z0-9@][a-zA-Z0-9._:@+~-]*)+$/;

export function enabledProviders() {
  return PROVIDERS.filter((p) => p.enabled());
}

export function allProvidersInfo() {
  return PROVIDERS.map((p) => ({
    id: p.PROVIDER_ID,
    name: p.PROVIDER_NAME,
    enabled: p.enabled(),
    configured: p.isConfigured(),
    mode: p.keyMode ? p.keyMode() : undefined,
  }));
}

export async function providerForModel(model) {
  for (const provider of PROVIDERS) {
    if (provider.enabled() && (await provider.ownsModel(model))) return provider;
  }
  return null;
}

function budgetReached() {
  return aiError(
    503,
    "The free AI request budget for this month has been reached. Please try again next month.",
    ERROR_CODES.limitReached
  );
}

export async function chat({
  system,
  prompt,
  json = false,
  temperature = 0.3,
  maxTokens = 1500,
  model,
  attempt = 0,
}) {
  const providers = enabledProviders();
  if (providers.length === 0) {
    throw aiError(
      500,
      "No AI provider is configured. Ask your developer to add an AI provider API key on Vercel.",
      ERROR_CODES.missingKey
    );
  }

  if (model) {
    await assertFreeModel(model);
  }

  const primary = model ? await providerForModel(model) : providers[0];
  if (!primary) {
    throw aiError(400, "The selected model isn't currently available as a free compatible model.", ERROR_CODES.modelNotFree);
  }

  const order = [primary, ...providers.filter((p) => p !== primary)];
  const maxAttempts = Math.min(order.length, getConfig().modelFallbackMaxAttempts);

  let lastError = null;
  for (let i = 0; i < maxAttempts; i++) {
    const provider = order[i];
    let resolvedModel = i === 0 && model ? model : await provider.getEligibleModel(model);
    if (!resolvedModel) continue;

    if (await provider.limitReached()) {
      lastError = budgetReached();
      continue;
    }

    await provider.countRequest(resolvedModel);
    if (attempt > 1) {
      await provider.countAttempt();
    }

    try {
      return await provider.chat({ system, prompt, json, temperature, maxTokens, model: resolvedModel, attempt });
    } catch (err) {
      await provider.countFailure();
      if (!isProviderExhausted(err)) throw err;
      lastError = err;
    }
  }
  throw lastError || budgetReached();
}

export async function getFreeModels() {
  const seen = new Set();
  const all = [];
  for (const provider of PROVIDERS) {
    if (!provider.enabled()) continue;
    let models;
    try {
      models = await provider.getModels();
    } catch (err) {
      if (err.code === ERROR_CODES.modelsUnavailable) continue;
      throw err;
    }
    for (const m of models) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      all.push({
        id: m.id,
        name: m.name,
        structured: m.structured,
        provider: { id: provider.PROVIDER_ID, name: provider.PROVIDER_NAME },
      });
    }
  }
  return all;
}

export async function assertFreeModel(id) {
  if (typeof id !== "string" || !MODEL_ID_RE.test(id)) {
    throw aiError(400, "The requested model ID isn't valid.", ERROR_CODES.modelInvalid);
  }
  const models = await getFreeModels();
  if (!models.some((m) => m.id === id)) {
    throw aiError(400, "The selected model isn't currently available as a free compatible model.", ERROR_CODES.modelNotFree);
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
  const providers = enabledProviders();
  if (providers.length === 0) return null;
  const configured = providers[0] === edenai ? getEdenaiModel() : getOpenRouterModel();
  const fallback = await getCompatibleFallback(configured);
  return fallback || configured;
}

export function isFreeDailyQuotaError(providerError) {
  return openrouter.isFreeDailyQuotaError(providerError);
}
