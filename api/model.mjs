import { getOpenRouterModel } from "./_lib/model.mjs";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(200).json({ model: getOpenRouterModel() });
}