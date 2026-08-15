import { HttpError } from "./_lib/filter.mjs";
import { chat } from "./_lib/ai.mjs";

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

function buildPrompt(profile, job, language, prepareQuestion) {
  const location = (job.location || []).join(", ") || (job.remote ? "Remote" : "");
  return `You are an expert German/European job application writer. Write a persuasive, natural cover letter on behalf of a candidate applying to one specific job.

CANDIDATE PROFILE
- Skills: ${profile.skills || "(not provided)"}
- Target role: ${profile.targetRole || "(not provided)"}
- Preferred city: ${profile.city || "(not provided)"}

THE JOB
- Title: ${job.title}
- Company: ${job.company_name}
- Location: ${location}${job.remote ? " (Remote)" : ""}
- Tags/skills: ${(job.tags || []).join(", ") || "(none listed)"}

Write the cover letter in ${language}.

Requirements:
- Address the requirements that fit the candidate's actual skills. DO NOT invent skills, experience, or facts that are not in the profile.
- Structure: a strong opening that matches the role, 2-3 short paragraphs connecting the candidate's skills to the job, and a confident closing with availability for an interview.
- Keep it to one page, use the candidate's voice, professional but warm. Use [Vorname Nachname] and [E-Mail] as placeholders where contact info would go.
- At the end add a separate section starting on a new line:
  PRAKTISCHE FRAGE:
  <exactly the question>: ${prepareQuestion}
  ANTWORTSKIZZE:
  Then write a 2-3 sentence suggested answer the candidate could give in the interview.

Output only the letter text, no commentary around it.`;
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
    const job = body.job || {};

    if (!job.title || !job.company_name) {
      return res.status(400).json({
        error: "A job with a title and company is required.",
        code: "bad_request",
      });
    }

    const language = String(body.language || "German").trim();
    const prepareQuestion = String(body.prepareQuestion || "").trim();

    const prompt = buildPrompt(profile, job, language, prepareQuestion);
    const letter = await chat({
      system: "You are a professional job-application copywriter. You write only the letter text, never extra commentary.",
      prompt,
      json: false,
      temperature: 0.5,
      maxTokens: 1200,
      attempt,
      model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined,
    });

    return res.status(200).json({
      letter: letter.trim(),
      meta: {
        job: { title: job.title, company_name: job.company_name },
        language,
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/cover-letter] unexpected:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}