import { getCompatibleFallback, getFreeModels, resolveDefaultModel } from "./_lib/models.mjs";
import { allProvidersInfo } from "./_lib/providers/index.mjs";
import { getOpenRouterModel } from "./_lib/model.mjs";
import { getConfig } from "./_lib/config.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "This endpoint accepts GET requests only.", code: "method" });
  }

  try {
    const models = await getFreeModels();
    const configured = getOpenRouterModel();
    // Wenn das konfigurierte Modell nicht in der freien Modelliste ist
    // (z. B. veraltete/kostenpflichtige Env-Konfiguration), darf es nicht als
    // defaultModel ausgespielt werden — sonst würde jeder Default-Aufruf mit
    // model_not_free scheitern (Befund: Production, API-DOC/Repro).
    const compatible = await getCompatibleFallback(configured);
    return res.status(200).json({
      models: models.map(({ id, name, provider }) => ({ id, name, provider })),
      providers: allProvidersInfo().map(({ id, name, enabled, configured: providerConfigured }) => ({
        id,
        name,
        enabled,
        configured: providerConfigured,
      })),
      defaultModel: compatible ?? configured,
      fallbackModel: await getCompatibleFallback(configured),
      recommendedModel: await resolveDefaultModel(),
      fallbackMaxAttempts: getConfig().modelFallbackMaxAttempts,
    });
  } catch (err) {
    const status = err && err.status ? err.status : 502;
    return res.status(status).json({
      error: err && err.message ? err.message : "Couldn't load the model list. Please try again shortly.",
      code: (err && err.code) || "models_unavailable",
    });
  }
}
