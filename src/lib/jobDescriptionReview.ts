import type { Job } from "../types";

// JM-COVER-LETTER-02
// Deterministic job-description review. No AI call, no network access and no
// persistence. The result is a session-only input for the later CL-04 flow.

export const MAX_DESCRIPTION_INPUT_LENGTH = 20000;

export type DescriptionCompleteness = "sufficient" | "limited" | "missing";
export type DescriptionPlausibility = "plausible" | "uncertain" | "mismatch";
export type DescriptionOrigin = "original" | "enriched" | "user_supplied";
export type ReviewConfirmation = "none" | "required" | "confirmed";

export type ReviewReason =
  | "company_match"
  | "title_match"
  | "location_match"
  | "tag_match"
  | "shared_terms"
  | "company_mismatch"
  | "role_mismatch"
  | "no_signals";

export interface DescriptionEvaluation {
  completeness: DescriptionCompleteness;
  wordCount: number;
  hasResponsibilities: boolean;
  hasRequirements: boolean;
  hasPlaceholder: boolean;
  repetitive: boolean;
  marketingOnly: boolean;
  reasons: Array<"tasks" | "requirements" | "placeholder" | "repetitive" | "marketing" | "short">;
}

export interface DescriptionPlausibilityResult {
  status: DescriptionPlausibility;
  companyMatch: boolean;
  titleMatch: boolean;
  locationMatch: boolean;
  tagMatches: number;
  explicitCompanyMismatch: boolean;
  explicitRoleMismatch: boolean;
  reasons: ReviewReason[];
}

export interface SelectedDescription {
  origin: DescriptionOrigin;
  text: string;
  completeness: DescriptionCompleteness;
}

export interface DescriptionReviewState {
  jobSlug: string;
  originalText: string;
  enrichedText: string;
  original: DescriptionEvaluation;
  enriched: DescriptionEvaluation | null;
  plausibility: DescriptionPlausibilityResult | null;
  selected: SelectedDescription | null;
  confirmation: ReviewConfirmation;
  insufficient: boolean;
}

const TASK_SIGNAL =
  /\b(entwickel|betreu|koordinier|verantwort|erstell|analysier|berat|unterstütz|manage|develop|build|maintain|support|lead|design|implement|create|coordinate|organi[sz]e|plan|test|review)\w*/i;
const REQUIREMENT_SIGNAL =
  /\b(erfahrung|kenntnisse|abschluss|studium|qualifikation|voraussetzung|skills?|experience|degree|requirements?|knowledge|qualifications?|profil|ausbildung)\b/i;
const MARKETING_SIGNAL =
  /\b(wir bieten|benefits?|great team|competitive salary|work-life|obstkorb|team events?|kultur|career growth)\b/i;
const PLACEHOLDER_SIGNAL =
  /\b(lorem ipsum|todo|tbd|n\/a|xxx+|platzhalter|placeholder|coming soon|keine beschreibung|no description|mustertext|beispieltext)\b/i;
const LEGAL_ENTITY =
  /\b([A-ZÄÖÜ][\p{L}\d&.'-]+(?:\s+[A-ZÄÖÜ][\p{L}\d&.'-]+){0,3})\s+(GmbH|AG|Inc\.?|Ltd\.?|UG|OHG|KG|SE)\b/gu;
const EMPLOYER_LABEL =
  /\b(?:arbeitgeber|unternehmen|firma|company|employer)\s*[:\-]?\s*([A-ZÄÖÜ][^\n,.;]{2,80})/giu;
const ROLE_CONTEXT =
  /\b(?:position|stelle|rolle|role|job)\s+(?:als|as)\s+([^\n,.;]{3,80})/giu;
const GENERIC_ROLE_WORDS = new Set([
  "engineer",
  "developer",
  "manager",
  "specialist",
  "consultant",
  "architect",
  "analyst",
  "designer",
  "scientist",
  "administrator",
  "coordinator",
]);

function stripHtml(value: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(value, "text/html");
    doc.querySelectorAll("script,style,noscript,iframe,object,embed,svg,math").forEach((node) => node.remove());
    doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    doc.querySelectorAll("p,div,li,h1,h2,h3,h4,h5,h6,tr").forEach((node) => node.append("\n"));
    return doc.body?.textContent ?? "";
  }
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export function normalizeDescriptionText(value: string | null | undefined): string {
  const raw = String(value ?? "").replace(/\r\n?/g, "\n");
  if (!raw.trim()) return "";
  return stripHtml(raw)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_DESCRIPTION_INPUT_LENGTH);
}

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+#.-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function significantTokens(value: string): string[] {
  const stop = new Set([
    "und", "oder", "der", "die", "das", "ein", "eine", "mit", "für", "von", "bei", "im",
    "in", "the", "and", "or", "a", "an", "with", "for", "of", "to", "at", "as", "is",
    "are", "we", "you", "your", "our", "senior", "junior", "lead", "m/w/d", "all",
  ]);
  return [...new Set(wordsOf(value).filter((word) => word.length >= 3 && !stop.has(word)))];
}

function normalizeCompany(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(gmbh|ag|inc\.?|ltd\.?|ug|ohg|kg|se)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s&.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companyVariants(job: Job): string[] {
  const raw = String(job.company_name ?? "").trim();
  if (!raw) return [];
  const variants = [normalizeCompany(raw), ...(raw.match(/[A-ZÄÖÜ][\p{L}\d&.'-]{2,}/gu) ?? [])];
  return [...new Set(variants.map(normalizeCompany).filter((value) => value.length >= 3))];
}

function textHasCompany(text: string, job: Job): boolean {
  const lower = text.toLowerCase();
  return companyVariants(job).some((variant) => lower.includes(variant));
}

function explicitOtherCompany(text: string, job: Job): boolean {
  const original = companyVariants(job);
  if (original.length === 0) return false;
  const candidates = [
    ...[...text.matchAll(LEGAL_ENTITY)].map((match) => `${match[1] ?? ""} ${match[2] ?? ""}`),
    ...[...text.matchAll(EMPLOYER_LABEL)].map((match) => match[1] ?? ""),
  ];
  for (const raw of candidates) {
    const candidate = normalizeCompany(raw);
    if (candidate.length < 4) continue;
    if (/^(der|die|das|dem|den|unserem|unserer|einem|einer|team|arbeit)\b/.test(candidate)) continue;
    if (original.some((variant) => candidate.includes(variant) || variant.includes(candidate))) continue;
    return true;
  }
  return false;
}

function titleTokens(job: Job): string[] {
  return significantTokens(job.title ?? "");
}

function textHasTitle(text: string, job: Job): boolean {
  const lower = text.toLowerCase();
  const tokens = titleTokens(job);
  return tokens.length > 0 && tokens.some((token) => lower.includes(token));
}

function explicitOtherRole(text: string, job: Job): boolean {
  const originalCore = titleTokens(job).filter((token) => !GENERIC_ROLE_WORDS.has(token));
  if (originalCore.length === 0) return false;
  for (const match of text.matchAll(ROLE_CONTEXT)) {
    const candidate = match[1] ?? "";
    const candidateCore = significantTokens(candidate).filter((token) => !GENERIC_ROLE_WORDS.has(token));
    if (candidateCore.length === 0) continue;
    if (candidateCore.some((token) => originalCore.includes(token))) continue;
    return true;
  }
  return false;
}

function textHasLocation(text: string, job: Job): boolean {
  const lower = text.toLowerCase();
  return (job.location ?? []).some((location) => {
    const value = String(location ?? "").toLowerCase().trim();
    return value.length >= 3 && lower.includes(value);
  });
}

function tagMatchCount(text: string, job: Job): number {
  const lower = text.toLowerCase();
  return (job.tags ?? []).filter((tag) => {
    const value = String(tag ?? "").toLowerCase().trim();
    return value.length >= 2 && lower.includes(value);
  }).length;
}

function sharedTermCount(text: string, originalDescription: string): number {
  const enriched = new Set(significantTokens(text));
  return significantTokens(originalDescription).filter((token) => enriched.has(token)).length;
}

export function evaluateDescription(value: string | null | undefined): DescriptionEvaluation {
  const text = normalizeDescriptionText(value);
  if (!text) {
    return {
      completeness: "missing",
      wordCount: 0,
      hasResponsibilities: false,
      hasRequirements: false,
      hasPlaceholder: false,
      repetitive: false,
      marketingOnly: false,
      reasons: ["short"],
    };
  }

  const words = wordsOf(text);
  const wordCount = words.length;
  const hasResponsibilities = TASK_SIGNAL.test(text);
  const hasRequirements = REQUIREMENT_SIGNAL.test(text);
  const hasPlaceholder = PLACEHOLDER_SIGNAL.test(text);
  const uniqueRatio = wordCount ? new Set(words).size / wordCount : 0;
  const repetitive = wordCount > 40 && uniqueRatio < 0.34;
  const marketingOnly = wordCount > 30 && !hasResponsibilities && !hasRequirements && MARKETING_SIGNAL.test(text);
  const reasons: DescriptionEvaluation["reasons"] = [];
  if (hasResponsibilities) reasons.push("tasks");
  if (hasRequirements) reasons.push("requirements");
  if (hasPlaceholder) reasons.push("placeholder");
  if (repetitive) reasons.push("repetitive");
  if (marketingOnly) reasons.push("marketing");
  if (wordCount < 8) reasons.push("short");

  let completeness: DescriptionCompleteness = "limited";
  if (wordCount < 3 || (hasPlaceholder && wordCount < 8) || !/[\p{L}\p{N}]/u.test(text)) {
    completeness = "missing";
  } else if (
    !hasPlaceholder &&
    !repetitive &&
    !marketingOnly &&
    wordCount >= 8 &&
    (hasResponsibilities || hasRequirements)
  ) {
    completeness = "sufficient";
  }

  return {
    completeness,
    wordCount,
    hasResponsibilities,
    hasRequirements,
    hasPlaceholder,
    repetitive,
    marketingOnly,
    reasons,
  };
}

export function checkPlausibility(job: Job, enrichedInput: string | null | undefined): DescriptionPlausibilityResult {
  const text = normalizeDescriptionText(enrichedInput);
  const originalText = normalizeDescriptionText(job.descriptionPlain || job.description);
  const companyMatch = textHasCompany(text, job);
  const titleMatch = textHasTitle(text, job);
  const locationMatch = textHasLocation(text, job);
  const tagMatches = tagMatchCount(text, job);
  const shared = sharedTermCount(text, originalText);
  const explicitCompanyMismatch = explicitOtherCompany(text, job);
  const explicitRoleMismatch = explicitOtherRole(text, job);

  const reasons: ReviewReason[] = [];
  if (companyMatch) reasons.push("company_match");
  if (titleMatch) reasons.push("title_match");
  if (locationMatch) reasons.push("location_match");
  if (tagMatches > 0) reasons.push("tag_match");
  if (shared >= 3) reasons.push("shared_terms");
  if (explicitCompanyMismatch) reasons.push("company_mismatch");
  if (explicitRoleMismatch) reasons.push("role_mismatch");
  if (reasons.length === 0) reasons.push("no_signals");

  let status: DescriptionPlausibility = "uncertain";
  if (explicitCompanyMismatch || explicitRoleMismatch) {
    status = "mismatch";
  } else {
    const positiveSignals =
      (companyMatch ? 2 : 0) +
      (titleMatch ? 2 : 0) +
      (locationMatch ? 1 : 0) +
      Math.min(tagMatches, 3) +
      (shared >= 3 ? 1 : 0);
    if (positiveSignals >= 2) status = "plausible";
  }

  return {
    status,
    companyMatch,
    titleMatch,
    locationMatch,
    tagMatches,
    explicitCompanyMismatch,
    explicitRoleMismatch,
    reasons,
  };
}

export function buildDescriptionReview({
  job,
  enrichedInput,
  confirmed = false,
}: {
  job: Job;
  enrichedInput?: string | null;
  confirmed?: boolean;
}): DescriptionReviewState {
  const originalText = normalizeDescriptionText(job.descriptionPlain || job.description);
  const enrichedText = normalizeDescriptionText(enrichedInput);
  const original = evaluateDescription(originalText);
  const enriched = enrichedText ? evaluateDescription(enrichedText) : null;
  const plausibility = enrichedText ? checkPlausibility(job, enrichedText) : null;

  if (!enrichedText) {
    const selected =
      original.completeness === "missing"
        ? null
        : { origin: "original" as const, text: originalText, completeness: original.completeness };
    return {
      jobSlug: job.slug,
      originalText,
      enrichedText: "",
      original,
      enriched,
      plausibility,
      selected,
      confirmation: "none",
      insufficient: selected === null,
    };
  }

  if (enriched!.completeness === "missing" || plausibility!.status === "mismatch") {
    const selected =
      original.completeness === "missing"
        ? null
        : { origin: "original" as const, text: originalText, completeness: original.completeness };
    return {
      jobSlug: job.slug,
      originalText,
      enrichedText,
      original,
      enriched,
      plausibility,
      selected,
      confirmation: "none",
      insufficient: selected === null,
    };
  }

  if (plausibility!.status === "uncertain" && !confirmed) {
    const selected =
      original.completeness === "missing"
        ? null
        : { origin: "original" as const, text: originalText, completeness: original.completeness };
    return {
      jobSlug: job.slug,
      originalText,
      enrichedText,
      original,
      enriched,
      plausibility,
      selected,
      confirmation: "required",
      insufficient: selected === null,
    };
  }

  return {
    jobSlug: job.slug,
    originalText,
    enrichedText,
    original,
    enriched,
    plausibility,
    selected: {
      origin: plausibility!.status === "plausible" ? "enriched" : "user_supplied",
      text: enrichedText,
      completeness: enriched!.completeness,
    },
    confirmation: plausibility!.status === "uncertain" && confirmed ? "confirmed" : "none",
    insufficient: false,
  };
}
