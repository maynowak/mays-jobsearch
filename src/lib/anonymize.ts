const NAME_PATTERNS = [
  /\b\p{Lu}[\p{Ll}]+ \p{Lu}\. \p{Lu}[\p{Ll}]+\b/gu,
  /\bDR\.? \p{Lu}[\p{Ll}]+ \p{Lu}[\p{Ll}]+\b/giu,
  /\bPROF\.? \p{Lu}[\p{Ll}]+ \p{Lu}[\p{Ll}]+\b/giu,
];

const GENERIC_NAME_PATTERN = /\b\p{Lu}[\p{Ll}]+ \p{Lu}[\p{Ll}]+\b/gu;

// Protect complete, known role phrases before applying the generic name
// matcher. A word allowlist is not safe here: names such as "Cloud Schmidt"
// and "Data Müller" must not be retained merely because their first word is
// also common in job descriptions.
const JOB_RELEVANT_PHRASES = [
  "React Developer",
  "Software Engineer",
  "Machine Learning Engineer",
  "Human Resources Specialist",
  "Customer Success Manager",
  "Data Scientist",
  "Cloud Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Product Manager",
  "Project Manager",
  "UX Designer",
  "Business Analyst",
];

const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

const PHONE_PATTERNS = [
  /\+?\d[\d\s\-()]{8,}\d/g,
  /\b\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}\b/g,
  /\(\d{3,5}\)\s*\d{3,4}[\s\-]?\d{3,4}/g,
];

const ADDRESS_PATTERNS = [
  /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?/g,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s+[A-Z]{2}\s+\d{5}/g,
];

const DATE_PATTERNS = [
  /\b\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}\b/g,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
];

const URL_PATTERN = /\bhttps?:\/\/[^\s]+/gi;

const LINKEDIN_PATTERN = /linkedin\.com\/in\/[a-zA-Z0-9\-_]+/gi;
const XING_PATTERN = /xing\.com\/profile\/[a-zA-Z0-9\-_]+/gi;
const GITHUB_PATTERN = /github\.com\/[a-zA-Z0-9\-_]+/gi;

function replaceWithPlaceholder(text: string, pattern: RegExp, placeholder: string): string {
  return text.replace(pattern, placeholder);
}

function replaceAllPatterns(text: string, patterns: RegExp | RegExp[], placeholder: string): string {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  return patternArray.reduce((acc, pattern) => replaceWithPlaceholder(acc, pattern, placeholder), text);
}

function anonymizeNames(text: string): string {
  const protectedPhrases: string[] = [];
  const protectedText = JOB_RELEVANT_PHRASES.reduce((result, phrase) => {
    const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "giu");
    return result.replace(pattern, (candidate) => {
      const marker = `\u0000ROLE_${protectedPhrases.length}\u0000`;
      protectedPhrases.push(candidate);
      return marker;
    });
  }, text);

  const titledNamesRemoved = NAME_PATTERNS.reduce(
    (result, pattern) => replaceWithPlaceholder(result, pattern, "[NAME]"),
    protectedText
  );

  const anonymized = titledNamesRemoved.replace(GENERIC_NAME_PATTERN, "[NAME]");
  return anonymized.replace(/\u0000ROLE_(\d+)\u0000/g, (_, index: string) => protectedPhrases[Number(index)]);
}

export function anonymizeText(text: string): string {
  let result = text;

  result = replaceAllPatterns(result, EMAIL_PATTERN, "[E-MAIL]");
  result = replaceAllPatterns(result, PHONE_PATTERNS, "[TELEFON]");
  result = replaceAllPatterns(result, ADDRESS_PATTERNS, "[ADRESSE]");
  result = replaceAllPatterns(result, DATE_PATTERNS, "[DATUM]");
  result = replaceAllPatterns(result, URL_PATTERN, "[URL]");
  result = replaceAllPatterns(result, LINKEDIN_PATTERN, "[LINKEDIN]");
  result = replaceAllPatterns(result, XING_PATTERN, "[XING]");
  result = replaceAllPatterns(result, GITHUB_PATTERN, "[GITHUB]");

  result = anonymizeNames(result);

  return result;
}

export function anonymizeSuggestedProfile(profile: {
  skills: string[];
  experienceLevel: string;
  targetRoles: string[];
  location: string;
}): {
  skills: string[];
  experienceLevel: string;
  targetRoles: string[];
  location: string;
} {
  return {
    skills: profile.skills,
    experienceLevel: profile.experienceLevel,
    targetRoles: profile.targetRoles,
    location: profile.location ? "[STANDORT]" : "",
  };
}
