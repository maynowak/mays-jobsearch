import { HttpError } from "./_lib/filter.mjs";
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "This endpoint accepts POST requests only.", code: "method" });
  }

  try {
    const body = req.body || (await readBody(req));
    const slugs = Array.isArray(body.jobs) ? body.jobs.filter((s) => typeof s === "string") : [];
    if (!slugs.length) {
      return res.status(400).json({
        error: "Provide at least one job slug to enrich.",
        code: "bad_request",
      });
    }

    const identity = anonymousIdentity(req);
    res.setHeader("Set-Cookie", sessionCookieHeader(identity.sessionId));
    const result = await enrichArbeitsagenturDetails(slugs, {
      clientIp: identity.ip,
      sessionId: identity.sessionId,
    });

    if (result.error) {
      const codes = {
        invalid_slug: { status: 400, message: "Invalid job reference.", code: "invalid_slug" },
        quota_exceeded: { status: 429, message: "Detail requests exhausted for today. Please try again tomorrow.", code: "quota_exceeded" },
        quota_unavailable: { status: 503, message: "The detail service is temporarily unavailable.", code: "quota_unavailable" },
        apify_limit_reached: { status: 429, message: "Detail enrichment is temporarily unavailable.", code: "apify_limit_reached" },
        missing_config: { status: 503, message: "The detail service isn't configured yet.", code: "missing_config" },
        source_not_found: { status: 404, message: "Job source not found.", code: "source_not_found" },
      };
      const mapped = codes[result.error] || {
        status: 502,
        message: "Couldn't load job details. Please try again in a moment.",
        code: result.error,
      };
      return res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }

    return res.status(200).json({
      jobs: result.jobs,
      meta: { enrichedCount: result.enrichedCount },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/job-details] unexpected:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}