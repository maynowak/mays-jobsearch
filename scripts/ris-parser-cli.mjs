#!/usr/bin/env node
/**
 * RIS parser CLI — the single Node execution boundary for the RIS agent body.
 *
 * It wraps the EXISTING Jobsearch parser implementation:
 *   - parse.cv  -> api/_lib/analysis/service.mjs::parseCvBuffer (pdf.mjs + cvParser.mjs)
 *   - parse.job -> service.mjs::extractAtsRequirements (api/_lib/ats.mjs)
 *   - parse.ats -> service.mjs::analyzeAts
 *
 * No second parser engine, no network call, no AI provider call, no file writes.
 *
 * Input (stdin JSON): {"input": <capability input>}
 * Output (stdout JSON): versioned result envelope.
 * Exit: 0 success, 2 invalid input/capability, 3 internal error.
 */
import { createHash } from "node:crypto";
import {
  parseCvBuffer,
  extractAtsRequirements,
  analyzeAts,
} from "../api/_lib/analysis/service.mjs";

export const PARSER_CLI_VERSION = "1.0.0";
export const SCHEMA_VERSION = "1.0";
const MAX_STDIN_BYTES = 6 * 1024 * 1024;

class CliError extends Error {
  constructor(code, message, status = 2) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function fail(error) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    error: {
      code: error?.code || "internal_error",
      message: error?.message || "parser failed",
    },
  };
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(error instanceof CliError ? error.status : 3);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError("invalid_input", `${name} must be an object`);
  }
  return value;
}

function requireString(value, name, { max = 100000 } = {}) {
  if (typeof value !== "string" || !value.trim()) {
    throw new CliError("invalid_input", `${name} must be a non-empty string`);
  }
  if (value.length > max) {
    throw new CliError("too_large", `${name} exceeds ${max} characters`);
  }
  return value;
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= 100) break;
  }
  return out;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > MAX_STDIN_BYTES) {
        reject(new CliError("too_large", "stdin exceeds the size limit"));
        process.stdin.destroy();
        return;
      }
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function cvTagsOf(draft) {
  const degrees = (draft.education || []).map((item) => item.degree).filter(Boolean);
  const languages = (draft.languages || []).map((item) => item.language).filter(Boolean);
  const roles = (draft.experience || []).map((item) => item.title || item.role).filter(Boolean);
  return unique([...(draft.skills || []), ...languages, ...degrees, ...roles]);
}

async function parseCv(input) {
  const payload = requireObject(input, "input");
  const base64 = requireString(payload.pdfBase64, "input.pdfBase64",
    { max: 6 * 1024 * 1024 });
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    throw new CliError("invalid_input", "input.pdfBase64 is not valid base64");
  }
  if (!buffer.length) {
    throw new CliError("invalid_input", "input.pdfBase64 is empty");
  }
  const { data } = await parseCvBuffer(buffer, { includePersonal: false });
  const draft = data.draft || {};
  return {
    schemaVersion: SCHEMA_VERSION,
    capability: "parse.cv",
    parserVersion: data.parserVersion || "unknown",
    data: {
      stableId: data.document?.sha256 || sha256(buffer),
      cvTags: cvTagsOf(draft),
      skills: unique(draft.skills || []),
      experience: draft.experience || [],
      education: draft.education || [],
      languages: draft.languages || [],
      location: draft.personal?.city || "",
      profile: draft.profile || {},
      confidence: data.confidence || "uncertain",
      sectionConfidence: data.sectionConfidence || {},
      document: data.document || {},
      provenance: {
        source: "mays-jobsearch",
        parser: "cvParser.mjs",
        parserVersion: data.parserVersion || "unknown",
      },
    },
    confidence: data.confidence || "uncertain",
  };
}

function jobResult(input, capability) {
  const payload = requireObject(input, "input");
  const job = requireObject(payload.job, "input.job");
  if (typeof job.title !== "string" || !job.title.trim()) {
    throw new CliError("invalid_input", "input.job.title is required");
  }
  if (job.descriptionPlain !== undefined && typeof job.descriptionPlain !== "string") {
    throw new CliError("invalid_input", "input.job.descriptionPlain must be a string");
  }
  if (typeof job.descriptionPlain === "string" && job.descriptionPlain.length > 100000) {
    throw new CliError("too_large", "input.job.descriptionPlain exceeds 100000 characters");
  }
  const profile = payload.profile && typeof payload.profile === "object"
    ? payload.profile : {};
  const stableId = sha256(canonical({
    title: job.title,
    company: job.company || "",
    location: job.location || [],
    descriptionPlain: job.descriptionPlain || "",
  }).toLowerCase());

  if (capability === "parse.ats") {
    const data = analyzeAts(job, profile).data;
    const atsTags = unique([
      ...(data.requirements || []).map((item) => item.text),
      ...(data.criticalGaps || []).map((item) => item.text),
    ]);
    return {
      schemaVersion: SCHEMA_VERSION,
      capability,
      parserVersion: PARSER_CLI_VERSION,
      data: {
        stableId,
        atsTags,
        requirements: data.requirements || [],
        matches: data.matches || [],
        criticalGaps: data.criticalGaps || [],
        score: data.analysis?.score ?? null,
        analysisStatus: data.analysisStatus || data.analysis?.analysisStatus || "",
        provenance: { source: "mays-jobsearch", parser: "ats.mjs" },
      },
      confidence: "confirmed",
    };
  }

  const data = extractAtsRequirements(job, profile);
  const metadata = data.metadata || {};
  const requirements = data.requirements || [];
  const required = unique(metadata.requiredSkills || []);
  const preferred = unique(metadata.preferredSkills || []);
  const experience = requirements.filter((item) => item.category === "experience");
  const jobTags = unique([...required, ...preferred, ...(metadata.titleTokens || [])]);
  return {
    schemaVersion: SCHEMA_VERSION,
    capability,
    parserVersion: PARSER_CLI_VERSION,
    data: {
      stableId,
      jobTags,
      requiredSkills: required,
      preferredSkills: preferred,
      experienceRequirements: experience,
      workMode: metadata.remote === true ? "remote"
        : metadata.remote === false ? "onsite" : "unknown",
      location: metadata.location || [],
      skills: unique(requirements
        .filter((item) => item.category === "skill")
        .map((item) => item.text)),
      analysisStatus: data.analysisStatus,
      basis: data.basis,
      provenance: { source: "mays-jobsearch", parser: "ats.mjs" },
    },
    confidence: requirements.length ? "confirmed" : "uncertain",
  };
}

async function main() {
  const index = process.argv.indexOf("--capability");
  const capability = index >= 0 ? process.argv[index + 1] : "";
  if (!["parse.cv", "parse.job", "parse.ats"].includes(capability)) {
    throw new CliError("unsupported_capability",
      `unsupported capability: ${capability || "<missing>"}`);
  }
  const raw = await readStdin();
  let parsed;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    throw new CliError("invalid_input", "stdin is not valid JSON");
  }
  if (capability === "parse.cv") {
    process.stdout.write(JSON.stringify(await parseCv(parsed.input)) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify(jobResult(parsed.input, capability)) + "\n");
}

main().catch(fail);
