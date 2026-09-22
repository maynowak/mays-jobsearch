import { fetchAllJobs } from "./_lib/jobs.mjs";
import { HttpError } from "./_lib/filter.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { skills = "", targetRole = "", city = "", radiusKm, workMode, employmentType } =
      req.query || {};

    // Parse skills - support both JSON array and legacy string format
    let skillsArray = [];
    if (skills) {
      try {
        const parsed = JSON.parse(skills);
        if (Array.isArray(parsed)) {
          skillsArray = parsed;
        } else if (typeof parsed === "string") {
          skillsArray = parsed.split(/[;,]+/).map(s => s.trim()).filter(Boolean);
        }
      } catch {
        // Legacy format: split on semicolon, comma, whitespace
        skillsArray = skills.split(/[;,]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    const result = await fetchAllJobs({ skills: skillsArray, targetRole, city, radiusKm, workMode, employmentType });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/jobs] unexpected:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}
