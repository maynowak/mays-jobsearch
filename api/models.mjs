import { getCompatibleFallback, getFreeModels } from "./_lib/models.mjs";
import { getOpenRouterModel } from "./_lib/model.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "This endpoint accepts GET requests only.", code: "method" });
  }

  try {
    const models = await getFreeModels();
    const configured = getOpenRouterModel();
    return res.status(200).json({
      models: models.map(({ id, name }) => ({ id, name })),
      defaultModel: configured,
      fallbackModel: await getCompatibleFallback(configured),
    });
  } catch (err) {
    const status = err && err.status ? err.status : 502;
    return res.status(status).json({
      error: err && err.message ? err.message : "Couldn't load the model list. Please try again shortly.",
      code: (err && err.code) || "models_unavailable",
    });
  }
}