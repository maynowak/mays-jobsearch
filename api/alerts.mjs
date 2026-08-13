import { HttpError } from "./_lib/filter.mjs";
import { listSubscriptions, saveSubscription, deleteSubscription } from "./_lib/alerts.mjs";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "POST") {
      const body = req.body || (await readBody(req));
      const email = String(body.email || "").trim().toLowerCase();
      const skills = String(body.skills || "").trim();
      const targetRole = String(body.targetRole || "").trim();
      const city = String(body.city || "").trim();

      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address.", code: "bad_request" });
      }
      if (!skills && !targetRole) {
        return res.status(400).json({ error: "Add at least a skill or a target role.", code: "bad_request" });
      }

      await saveSubscription({ email, skills, targetRole, city, createdAt: Date.now() });
      return res.status(200).json({
        ok: true,
        message: "Done! You'll get a daily digest of new matching jobs.",
      });
    }

    if (req.method === "DELETE") {
      const body = req.body || (await readBody(req));
      const email = String(body.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address.", code: "bad_request" });
      }
      await deleteSubscription(email);
      return res.status(200).json({ ok: true, message: "Your alert has been cancelled." });
    }

    if (req.method === "GET") {
      const subs = await listSubscriptions();
      return res.status(200).json({ count: subs.length });
    }

    return res.status(405).json({ error: "This endpoint accepts POST, DELETE and GET only.", code: "method" });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("[/api/alerts] unexpected:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please try again in a moment.",
      code: "internal",
    });
  }
}
