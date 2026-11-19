import {
  AnalysisError,
  MAX_JOBS,
  MAX_TEXT_CHARS,
} from "./security.mjs";

function record(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AnalysisError(422, "validation_error", `${name} must be an object.`);
  }
  return value;
}

function text(value, name, max = MAX_TEXT_CHARS) {
  if (typeof value !== "string") {
    throw new AnalysisError(422, "validation_error", `${name} must be a string.`);
  }
  if (value.length > max) {
    throw new AnalysisError(413, "text_too_long", `${name} is too long.`);
  }
  return value;
}

function stringArray(value, name, maxItems = 100) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new AnalysisError(422, "validation_error", `${name} must be an array of strings.`);
  }
  if (value.length > maxItems) {
    throw new AnalysisError(413, "payload_too_large", `${name} has too many entries.`);
  }
  return value;
}

export function validateJob(value) {
  const job = record(value, "job");
  if (!job.title || typeof job.title !== "string") {
    throw new AnalysisError(422, "validation_error", "job.title is required.");
  }
  text(job.title, "job.title", 300);
  if (job.description !== undefined) text(job.description, "job.description");
  if (job.descriptionPlain !== undefined) text(job.descriptionPlain, "job.descriptionPlain");
  stringArray(job.tags, "job.tags", 100);
  stringArray(job.location, "job.location", 20);
  stringArray(job.jobTypes, "job.jobTypes", 20);
  return job;
}

export function validateProfile(value) {
  if (value === undefined) return {};
  const profile = record(value, "profile");
  if (profile.skills !== undefined && typeof profile.skills !== "string") {
    throw new AnalysisError(422, "validation_error", "profile.skills must be a string.");
  }
  if (profile.skills && profile.skills.length > MAX_TEXT_CHARS) {
    throw new AnalysisError(413, "text_too_long", "profile.skills is too long.");
  }
  if (profile.targetRoles !== undefined) stringArray(profile.targetRoles, "profile.targetRoles", 20);
  if (profile.targetRole !== undefined) text(profile.targetRole, "profile.targetRole", 300);
  if (profile.city !== undefined) text(profile.city, "profile.city", 200);
  if (profile.criteria !== undefined) record(profile.criteria, "profile.criteria");
  return profile;
}

export function validateJobs(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AnalysisError(422, "validation_error", "jobs must be a non-empty array.");
  }
  if (value.length > MAX_JOBS) {
    throw new AnalysisError(422, "jobs_too_many", `At most ${MAX_JOBS} jobs are allowed.`);
  }
  return value.map(validateJob);
}
