import { fetchAllJobs } from "./_lib/jobs.mjs";
import { HttpError } from "./_lib/filter.mjs";

function parseArrayParam(value, delimiters = /[,;]+/) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];
  // Try JSON array first
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return str.split(delimiters).map(s => s.trim()).filter(Boolean);
}

function parseNumberParam(value) {
  if (!value && value !== 0) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { 
      skills = "", 
      targetRole = "", 
      city = "", 
      radiusKm, 
      workMode, 
      employmentType 
    } = req.query || {};

    // Parse skills - support JSON array, comma-separated, or legacy string
    const skillsArray = parseArrayParam(skills);

    // Parse targetRole - support multiple values (array) or single string
    const targetRoles = parseArrayParam(targetRole);

    // Parse workMode - comma-separated or JSON array
    const workModes = parseArrayParam(workMode);

    // Parse employmentType - comma-separated or JSON array
    const employmentTypes = parseArrayParam(employmentType);

    // Parse radiusKm - number or string
    const radiusKmNum = parseNumberParam(radiusKm);

    const result = await fetchAllJobs({ 
      skills: skillsArray, 
      targetRoles, 
      city, 
      radiusKm: radiusKmNum, 
      workMode: workModes, 
      employmentType: employmentTypes 
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/jobs] unexpected:", err);
    console.error("[/api/jobs] error stack:", err?.stack);
    console.error("[/api/jobs] request query:", req.query);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}
