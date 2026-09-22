import { HttpError } from "./_lib/filter.mjs";
import { computeMatch } from "./_lib/matching.mjs";
import { enrichArbeitsagenturDetails } from "./_lib/detailEnrich.mjs";
import { anonymousIdentity, sessionCookieHeader } from "./_lib/identity.mjs";

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

async function enrichMatchedBAJobs(matches, identity) {
  const slugs = [...new Set(
    matches
      .map((m) => m.job)
      .filter((job) => job && (job.source || []).includes("arbeitsagentur") && !job.description)
      .map((job) => job.slug)
      .filter((slug) => typeof slug === "string" && slug.startsWith("aa-"))
  )];

  if (!slugs.length) return matches;

  try {
    const result = await enrichArbeitsagenturDetails(slugs, identity);
    if (result.error || !result.jobs) return matches;

    for (const m of matches) {
      const enriched = m.job ? result.jobs[m.job.slug] : null;
      if (m.job && enriched) {
        m.job.description = enriched.description;
        m.job.descriptionPlain = enriched.descriptionPlain;
        m.job.language = enriched.language;
      }
    }
  } catch {
    // Detail enrichment is best-effort; the match itself must not fail.
  }
  return matches;
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

    const result = await computeMatch({ profile, jobs, model: body.model, attempt });

    const identity = anonymousIdentity(req);
    res.setHeader("Set-Cookie", sessionCookieHeader(identity.sessionId));
    await enrichMatchedBAJobs(result.matches, identity);

    return res.status(200).json({
      matches: result.matches,
      meta: result.meta,
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