import type {
  CvBuilderCertificateV1,
  CvBuilderDraftV1,
  CvBuilderEducationV1,
  CvBuilderExperienceV1,
  CvBuilderLanguageLevel,
  CvBuilderLinkV1,
  CvBuilderProjectV1,
} from "./contractTypes";
import { isCvBuilderEntryEmpty } from "./contractTypes";

export type CvBuilderValidationCode =
  | "required"
  | "too_long"
  | "invalid_email"
  | "invalid_url"
  | "invalid_month"
  | "end_before_start"
  | "current_with_end"
  | "duplicate"
  | "limit_exceeded"
  | "invalid_level";

export interface CvBuilderValidationError {
  path: string;
  code: CvBuilderValidationCode;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH_RE = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
const LEVELS: readonly CvBuilderLanguageLevel[] = [
  "basic",
  "conversational",
  "professional",
  "fluent",
  "native",
];

const LIMITS = {
  fullName: 200,
  email: 320,
  phone: 80,
  location: 200,
  headline: 200,
  summary: 4000,
  employer: 200,
  position: 200,
  institution: 200,
  degree: 200,
  description: 5000,
  projectDescription: 3000,
  projectName: 200,
  technologies: 500,
  certificateName: 200,
  issuer: 200,
  language: 100,
  linkLabel: 200,
  linkUrl: 1000,
  maxEntries: 20,
  maxSkills: 100,
  skillLength: 100,
} as const;

function push(errors: CvBuilderValidationError[], path: string, code: CvBuilderValidationCode): void {
  errors.push({ path, code });
}

function checkText(
  errors: CvBuilderValidationError[],
  value: string | undefined,
  path: string,
  maxLength: number
): void {
  if (value !== undefined && value.length > maxLength) push(errors, path, "too_long");
}

function checkRequired(
  errors: CvBuilderValidationError[],
  value: string | undefined,
  path: string
): void {
  if (!String(value ?? "").trim()) push(errors, path, "required");
}

function checkMonth(
  errors: CvBuilderValidationError[],
  value: string | undefined,
  path: string
): void {
  if (value && !MONTH_RE.test(value)) push(errors, path, "invalid_month");
}

function checkPeriod(
  errors: CvBuilderValidationError[],
  entry: { startMonth: string; endMonth?: string; current: boolean },
  basePath: string
): void {
  checkMonth(errors, entry.startMonth, `${basePath}.startMonth`);
  checkMonth(errors, entry.endMonth, `${basePath}.endMonth`);
  if (entry.current && entry.endMonth) push(errors, `${basePath}.endMonth`, "current_with_end");
  if (
    !entry.current &&
    entry.startMonth &&
    entry.endMonth &&
    MONTH_RE.test(entry.startMonth) &&
    MONTH_RE.test(entry.endMonth) &&
    entry.endMonth < entry.startMonth
  ) {
    push(errors, `${basePath}.endMonth`, "end_before_start");
  }
}

function validateExperience(errors: CvBuilderValidationError[], entries: CvBuilderExperienceV1[]): void {
  if (entries.length > LIMITS.maxEntries) push(errors, "experience", "limit_exceeded");
  entries.forEach((entry, index) => {
    if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return;
    const base = `experience.${index}`;
    checkRequired(errors, entry.employer, `${base}.employer`);
    checkRequired(errors, entry.position, `${base}.position`);
    checkText(errors, entry.employer, `${base}.employer`, LIMITS.employer);
    checkText(errors, entry.position, `${base}.position`, LIMITS.position);
    checkText(errors, entry.description, `${base}.description`, LIMITS.description);
    checkPeriod(errors, entry, base);
  });
}

function validateEducation(errors: CvBuilderValidationError[], entries: CvBuilderEducationV1[]): void {
  if (entries.length > LIMITS.maxEntries) push(errors, "education", "limit_exceeded");
  entries.forEach((entry, index) => {
    if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return;
    const base = `education.${index}`;
    checkRequired(errors, entry.institution, `${base}.institution`);
    checkText(errors, entry.institution, `${base}.institution`, LIMITS.institution);
    checkText(errors, entry.degree, `${base}.degree`, LIMITS.degree);
    checkText(errors, entry.description, `${base}.description`, LIMITS.description);
    checkPeriod(errors, entry, base);
  });
}

function validateProjects(errors: CvBuilderValidationError[], entries: CvBuilderProjectV1[]): void {
  if (entries.length > LIMITS.maxEntries) push(errors, "projects", "limit_exceeded");
  entries.forEach((entry, index) => {
    if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return;
    const base = `projects.${index}`;
    checkRequired(errors, entry.name, `${base}.name`);
    checkText(errors, entry.name, `${base}.name`, LIMITS.projectName);
    checkText(errors, entry.description, `${base}.description`, LIMITS.projectDescription);
    checkText(errors, entry.technologies.join(", "), `${base}.technologies`, LIMITS.technologies);
  });
}

function validateCertificates(errors: CvBuilderValidationError[], entries: CvBuilderCertificateV1[]): void {
  if (entries.length > LIMITS.maxEntries) push(errors, "certificates", "limit_exceeded");
  entries.forEach((entry, index) => {
    if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return;
    const base = `certificates.${index}`;
    checkRequired(errors, entry.name, `${base}.name`);
    checkText(errors, entry.name, `${base}.name`, LIMITS.certificateName);
    checkText(errors, entry.issuer, `${base}.issuer`, LIMITS.issuer);
    checkMonth(errors, entry.date, `${base}.date`);
  });
}

function validateLinks(errors: CvBuilderValidationError[], entries: CvBuilderLinkV1[]): void {
  if (entries.length > LIMITS.maxEntries) push(errors, "links", "limit_exceeded");
  entries.forEach((entry, index) => {
    if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return;
    const base = `links.${index}`;
    checkRequired(errors, entry.label, `${base}.label`);
    checkRequired(errors, entry.url, `${base}.url`);
    checkText(errors, entry.label, `${base}.label`, LIMITS.linkLabel);
    checkText(errors, entry.url, `${base}.url`, LIMITS.linkUrl);
    if (entry.url) {
      try {
        const url = new URL(entry.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          push(errors, `${base}.url`, "invalid_url");
        }
      } catch {
        push(errors, `${base}.url`, "invalid_url");
      }
    }
  });
}

export function validateCvBuilderDraft(draft: CvBuilderDraftV1): CvBuilderValidationError[] {
  const errors: CvBuilderValidationError[] = [];
  const { personal, profile } = draft;

  checkText(errors, personal.fullName, "personal.fullName", LIMITS.fullName);
  checkText(errors, personal.email, "personal.email", LIMITS.email);
  checkText(errors, personal.phone, "personal.phone", LIMITS.phone);
  checkText(errors, personal.location, "personal.location", LIMITS.location);
  if (personal.email?.trim() && !EMAIL_RE.test(personal.email.trim())) {
    push(errors, "personal.email", "invalid_email");
  }

  checkText(errors, profile.headline, "profile.headline", LIMITS.headline);
  checkText(errors, profile.summary, "profile.summary", LIMITS.summary);

  if (draft.skills.length > LIMITS.maxSkills) push(errors, "skills", "limit_exceeded");
  const seenSkills = new Set<string>();
  draft.skills.forEach((skill, index) => {
    checkText(errors, skill, `skills.${index}`, LIMITS.skillLength);
    const normalized = skill.trim().toLocaleLowerCase();
    if (normalized && seenSkills.has(normalized)) push(errors, `skills.${index}`, "duplicate");
    if (normalized) seenSkills.add(normalized);
  });

  validateExperience(errors, draft.experience);
  validateEducation(errors, draft.education);
  validateProjects(errors, draft.projects);
  validateCertificates(errors, draft.certificates);

  if (draft.languages.length > LIMITS.maxEntries) push(errors, "languages", "limit_exceeded");
  draft.languages.forEach((entry, index) => {
    if (!entry.language.trim()) return;
    checkText(errors, entry.language, `languages.${index}.language`, LIMITS.language);
    if (!LEVELS.includes(entry.level)) push(errors, `languages.${index}.level`, "invalid_level");
  });

  validateLinks(errors, draft.links);
  return errors;
}

export function cvBuilderErrorsFor(errors: CvBuilderValidationError[], path: string): CvBuilderValidationError[] {
  return errors.filter((error) => error.path === path);
}
