/**
 * RIS parser library — shared, deterministic, versioned.
 *
 * Reuses the existing ATS/job extraction in `../ats.mjs`; it does not add a
 * second parser engine. No network, no AI provider, no file system access.
 *
 * Contract: RIS-JM-AGENT-STANDARDIZATION-01
 * Capabilities: parse.job, parse.cv
 */
import { createHash } from "node:crypto";
import { extractRequirementsFromJob } from "../ats.mjs";

export const PARSER_LIBRARY_VERSION = "1.0.0";
export const PARSER_SCHEMA_VERSION = "1.0";
export const PARSER_CAPABILITIES = ["parse.job", "parse.cv"];

const MAX_INPUT_CHARS = 100000;
const MAX_SKILLS = 50;

export class ParserError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ParserError";
    this.code = code;
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ParserError("invalid_input", `${name} must be an object`);
  }
  return value;
}

function requireText(value, name, { min = 1, max = MAX_INPUT_CHARS } = {}) {
  if (typeof value !== "string") {
    throw new ParserError("invalid_input", `${name} must be a string`);
  }
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (text.length < min) {
    throw new ParserError("invalid_input", `${name} is too short`);
  }
  if (text.length > max) {
    throw new ParserError("too_large", `${name} exceeds ${max} characters`);
  }
  return text;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function collapse(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values, limit = MAX_SKILLS) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const value = collapse(raw);
    if (!value || value.length > 80) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function splitList(line) {
  return line
    .split(/[,;|•·]/)
    .map((part) => part.replace(/^[-*–—\s]+/, "").trim())
    .filter(Boolean);
}

function detectSections(text) {
  const sections = { header: [], skills: [], experience: [], education: [], languages: [], summary: [] };
  let current = "header";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.toLowerCase().replace(/[:#]+$/, "").trim();
    if (/^(skills|kenntnisse|fähigkeiten|kompetenzen)$/.test(heading)) {
      current = "skills";
      continue;
    }
    if (/^(experience|berufserfahrung|werdegang|professional experience)$/.test(heading)) {
      current = "experience";
      continue;
    }
    if (/^(education|ausbildung|bildung|studium|qualifications)$/.test(heading)) {
      current = "education";
      continue;
    }
    if (/^(languages|sprachen)$/.test(heading)) {
      current = "languages";
      continue;
    }
    if (/^(summary|profil|profile|about)$/.test(heading)) {
      current = "summary";
      continue;
    }
    sections[current].push(line);
  }
  return sections;
}

function extractContact(text) {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+?\d[\d\s()/-]{7,}\d)/);
  return {
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? collapse(phoneMatch[0]) : "",
  };
}

function extractName(headerLines) {
  for (const line of headerLines) {
    if (line.includes("@")) continue;
    if (/^\+?\d[\d\s()/-]{6,}$/.test(line)) continue;
    if (line.length <= 80 && !/https?:|www\./i.test(line)) return line;
  }
  return "";
}

const DEGREE_PATTERN = /(bachelor|master|diplom|phd|doktor|ausbildung|studium|b\.?sc|m\.?sc|mba)/i;
const LANGUAGE_PATTERN = /(deutsch|german|englisch|english|französisch|french|spanisch|spanish|italienisch|italian)/i;
const YEAR_RANGE = /((?:19|20)\d{2})\s*(?:-|–|bis|to|until)\s*((?:19|20)\d{2}|present|heute|current|jetzt)/i;

function extractExperience(experienceLines) {
  const entries = [];
  const currentYear = new Date().getUTCFullYear();
  for (const line of experienceLines) {
    const range = line.match(YEAR_RANGE);
    if (!range) continue;
    const start = Number(range[1]);
    const endRaw = range[2].toLowerCase();
    const end = /^\d{4}$/.test(endRaw) ? Number(endRaw) : currentYear;
    if (!Number.isFinite(start) || start < 1950 || start > currentYear + 1) continue;
    if (end < start) continue;
    const before = collapse(line.slice(0, range.index)).replace(/[|,–-]+$/, "").trim();
    const after = collapse(line.slice(range.index + range[0].length)).replace(/^[|,–-]+/, "").trim();
    entries.push({
      title: before.slice(0, 120),
      company: after.slice(0, 120),
      startYear: start,
      endYear: end,
      years: Math.max(0, end - start),
    });
    if (entries.length >= 20) break;
  }
  return entries;
}

/**
 * Parse a job posting deterministically and reuse the ATS requirement engine.
 * @param {{job: object}} input
 */
export function parseJob(input) {
  const payload = requireObject(input, "input");
  const job = requireObject(payload.job, "job");
  const description = typeof job.descriptionPlain === "string"
    ? requireText(job.descriptionPlain, "job.descriptionPlain", { min: 0 })
    : "";
  const title = typeof job.title === "string" ? collapse(job.title).slice(0, 200) : "";
  const company = typeof job.company === "string" ? collapse(job.company).slice(0, 200) : "";
  if (!title && !description) {
    throw new ParserError("invalid_input", "job needs a title or descriptionPlain");
  }

  const normalizedJob = {
    ...job,
    title,
    descriptionPlain: description,
  };
  const requirements = extractRequirementsFromJob(normalizedJob);
  const required = requirements.filter((req) => req.importance === "high");
  const preferred = requirements.filter((req) => req.importance !== "high");
  const skills = uniqueStrings(
    requirements
      .filter((req) => ["skill", "keyword"].includes(String(req.category)))
      .map((req) => req.text)
  );
  const experience = requirements.filter((req) => req.category === "experience");
  const experienceYears = experience.reduce(
    (max, req) => Math.max(max, Number.parseInt(req.normalized, 10) || 0),
    0
  );
  const metadata = {
    title,
    company,
    location: Array.isArray(job.location) ? job.location.map(collapse).filter(Boolean) : [],
    remote: typeof job.remote === "boolean" ? job.remote : null,
    jobTypes: Array.isArray(job.jobTypes) ? job.jobTypes.map(collapse).filter(Boolean) : [],
    contractType: collapse(job.contractType),
    language: collapse(job.language),
  };
  const stableId = sha256(
    [title, company, metadata.location.join(","), description.slice(0, 4000)]
      .join("\u0000")
      .toLowerCase()
  );

  return {
    schemaVersion: PARSER_SCHEMA_VERSION,
    capability: "parse.job",
    parserVersion: PARSER_LIBRARY_VERSION,
    data: {
      stableId,
      title,
      company,
      location: metadata.location,
      language: metadata.language,
      requirements: {
        required: required.map((req) => req.text),
        preferred: preferred.map((req) => req.text),
      },
      skills,
      experienceYears,
      metadata,
    },
    confidence: {
      stableId: "high",
      title: title ? "high" : "low",
      company: company ? "high" : "low",
      requirements: "medium",
      skills: skills.length ? "medium" : "low",
      experienceYears: experience.length ? "medium" : "low",
    },
  };
}

/**
 * Parse CV text deterministically. Fields stay compatible with the existing
 * job-search profile (`skills`, `experienceLevel`, `targetRoles`, `location`)
 * and add education/experience sections plus per-field confidence.
 * @param {{text: string}} input
 */
export function parseCv(input) {
  const payload = requireObject(input, "input");
  const text = requireText(payload.text, "text", { min: 20 });
  const sections = detectSections(text);
  const contact = extractContact(text);
  const name = extractName(sections.header);

  const skills = uniqueStrings(sections.skills.flatMap(splitList));
  const degrees = uniqueStrings(sections.education.filter((line) => DEGREE_PATTERN.test(line)));
  const languages = uniqueStrings(
    sections.languages.flatMap(splitList).filter((line) => LANGUAGE_PATTERN.test(line))
  );
  const experience = extractExperience(sections.experience);
  const explicitYears = Number.parseInt(
    (text.match(/(\d+)\s*\+?\s*(?:jahre|years?)\s*(?:erfahrung|experience)?/i) || [])[1] || "0",
    10
  );
  const rangeYears = experience.reduce((sum, entry) => sum + entry.years, 0);
  const totalYears = Math.max(explicitYears, Math.min(rangeYears, 60));
  const experienceLevel = totalYears >= 5 ? "Senior" : totalYears >= 2 ? "Mid" : totalYears > 0 ? "Junior" : "";
  const summary = collapse(sections.summary.join(" ")).slice(0, 500);
  const stableId = sha256(`${name}\u0000${contact.email}\u0000${text.slice(0, 4000)}`.toLowerCase());

  return {
    schemaVersion: PARSER_SCHEMA_VERSION,
    capability: "parse.cv",
    parserVersion: PARSER_LIBRARY_VERSION,
    data: {
      stableId,
      name,
      email: contact.email,
      phone: contact.phone,
      skills,
      experienceLevel,
      targetRoles: [],
      location: "",
      summary,
      education: degrees,
      languages,
      experience,
      totalYears,
    },
    confidence: {
      stableId: "high",
      name: name ? "medium" : "low",
      email: contact.email ? "high" : "low",
      phone: contact.phone ? "medium" : "low",
      skills: skills.length ? "medium" : "low",
      experienceLevel: totalYears > 0 ? "medium" : "low",
      education: degrees.length ? "medium" : "low",
      experience: experience.length ? "low" : "low",
    },
  };
}

export function parse({ capability, input }) {
  if (capability === "parse.job") return parseJob(input);
  if (capability === "parse.cv") return parseCv(input);
  throw new ParserError("unsupported_capability", `unsupported capability: ${capability}`);
}
