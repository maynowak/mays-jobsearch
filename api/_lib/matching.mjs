import { HttpError } from "./filter.mjs";
import { chat } from "./ai.mjs";
import { tokenize, keywordHits } from "./filter.mjs";

const MATCH_EVAL_LIMIT = 10;

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

export async function computeMatch({ profile, jobs, model, attempt = 0 }) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new HttpError(400, "Job list is required", "bad_request");
  }

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
    system: "You are a precise career-matching assistant. You always reply with valid JSON only.",
    prompt,
    json: true,
    maxTokens: 2500,
    attempt,
    model: typeof model === "string" && model.trim() ? model.trim() : undefined,
  });
  const parsed = parseMatches(content);

  if (!parsed || !parsed.length) {
    throw new HttpError(502, "The AI didn't return usable scores. Please try again in a moment.", "bad_ai_response");
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

  return {
    matches,
    meta: {
      evaluated: matches.length,
      totalFound: jobs.length,
      displayedInitially: 5,
    },
  };
}

export async function computeMatchForJob({ profile, job, model, attempt = 0 }) {
  const result = await computeMatch({ profile, jobs: [job], model, attempt });
  return result.matches[0] || null;
}