import { HttpError, keywordHits, tokenize } from "./_lib/filter.mjs";
import { chat } from "./_lib/ai.mjs";

const MATCH_EVAL_LIMIT = 10;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new HttpError(400, "The request body wasn't valid JSON.", "bad_request"));
      }
    });
    req.on("error", () => reject(new HttpError(400, "Couldn't read the request.", "bad_request")));
  });
}

function buildPrompt(profile, jobs, limit, detailCount) {
  const compactJobs = jobs.map((job, i) => ({
    id: i + 1,
    slug: job.slug,
    title: job.title,
    company: job.company_name,
    location: (job.location || []).join(", ") || (job.remote ? "Remote" : "Not stated"),
    remote: job.remote === true,
    tags: job.tags || [],
    source: job.source || [],
  }));

  return `You are a career coach. Match a candidate's profile to the list of job openings below.

CANDIDATE PROFILE
- Skills: ${profile.skills || "(not provided)"}
- Target role: ${profile.targetRole || "(not provided)"}
- Preferred city: ${profile.city || "(not provided)"}

JOBS (JSON):
${JSON.stringify(compactJobs)}

The "source" field only tells you which job board a listing came from. It is NOT a quality signal: evaluate every job purely on how well it fits the candidate, regardless of its source.

Evaluate how well EACH job fits the candidate. Score every job from 0 to 100, where 100 is a perfect match. Consider the overlap between the candidate's skills and the job's tags, how well the target role matches the job title, and location/remote preference.

Respond ONLY with valid JSON in exactly this shape (no markdown fences, no commentary):
{"matches":[{"slug":"<exact job slug from the list>","score":<integer 0-100>,"why":"<EXACTLY two concise sentences explaining why this job fits the candidate>","prepare":"<ONE specific question the candidate should prepare for this interview>"}]}

There are exactly ${jobs.length} jobs. Include ALL ${jobs.length} jobs in the "matches" array, one entry per job, and sort the array by score descending (highest score first).

Only the ${detailCount} highest-scoring entries must contain a filled "why" (EXACTLY two concise sentences) and "prepare" (EXACTLY one question). For every other entry set "why" and "prepare" to exactly an empty string "" — do NOT write any explanation for those jobs. Keep the JSON compact.`;
}

function toScore(raw) {
  if (typeof raw === "number") return raw;
  const asString = String(raw ?? "").trim();
  const fraction = asString.match(/^(\d+(?:\.\d+)?)\s*\/\s*100$/);
  if (fraction) return Number(fraction[1]);
  const digits = asString.replace(/[^0-9.]/g, "");
  return digits ? Number(digits) : NaN;
}

function parseMatches(content) {
  let text = String(content).trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  let list = parsed.matches || parsed.top_matches || parsed.results;
  if (Array.isArray(parsed)) list = parsed;
  if (!Array.isArray(list)) return null;

  return list
    .map((m) => ({
      slug: m.slug || m.id,
      score: toScore(m.score),
      why: m.why || m.reason || m.fit || "",
      prepare: m.prepare || m.question || "",
    }))
    .filter((m) => m.slug && Number.isFinite(m.score))
    .sort((a, b) => b.score - a.score);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "This endpoint accepts POST requests only.", code: "method" });
  }

  try {
    const attempt = Number.parseInt(req.headers["x-mj-attempt"] ?? "", 10) || 0;
    const body = req.body || (await readBody(req));
    const profile = {
      skills: String(body.skills || "").trim(),
      targetRole: String(body.targetRole || "").trim(),
      city: String(body.city || "").trim(),
    };

    if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
      return res.status(400).json({
        error: "This endpoint requires the job list. Run a search first to get jobs.",
        code: "bad_request",
      });
    }
    const jobs = body.jobs;

    const limit = Math.min(MATCH_EVAL_LIMIT, jobs.length);
    const detailCount = Math.min(5, limit);

    let evalJobs = jobs;
    if (jobs.length > limit) {
      const keywordTokens = [...tokenize(profile.targetRole), ...tokenize(profile.skills)];
      evalJobs = jobs
        .map((job, index) => ({ job, index, hits: keywordHits(job, keywordTokens) }))
        .sort((a, b) => b.hits - a.hits || a.index - b.index)
        .slice(0, limit)
        .map((entry) => entry.job);
    }

    const prompt = buildPrompt(profile, evalJobs, limit, detailCount);
    const content = await chat({
      system:
        "You are a precise career-matching assistant. You always reply with valid JSON only.",
      prompt,
      json: true,
      maxTokens: 2500,
      attempt,
      model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined,
    });
    const parsed = parseMatches(content);

    if (!parsed || !parsed.length) {
      return res.status(502).json({
        error: "The AI didn't return usable scores. Please try again in a moment.",
        code: "bad_ai_response",
      });
    }

    const bySlug = new Map(evalJobs.map((job) => [job.slug, job]));
    const matches = parsed
      .map((m) => ({
        score: m.score,
        why: m.why,
        prepare: m.prepare,
        job: bySlug.get(m.slug) || null,
      }))
      .filter((m) => m.job)
      .slice(0, limit);

    return res.status(200).json({
      matches,
      meta: {
        evaluated: matches.length,
        totalFound: jobs.length,
        displayedInitially: 5,
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/match] unexpected:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}
