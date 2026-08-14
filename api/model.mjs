import { resolveDefaultModel } from "./_lib/models.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  const model = await resolveDefaultModel();
  return res.status(200).json({ model });
}