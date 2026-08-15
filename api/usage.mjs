import { getUsageSnapshot } from "./_lib/usage.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "This endpoint accepts GET requests only.",
      code: "method",
    });
  }

  try {
    const snapshot = await getUsageSnapshot();
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error("[/api/usage] unexpected:", err);
    return res.status(500).json({
      error: "Couldn't read the usage counters. Please try again in a moment.",
      code: "internal",
    });
  }
}
