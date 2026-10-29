const NAME_PATTERNS = [
  /\b[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+\b/g,
  /\bDR\.? [A-Z][a-z]+ [A-Z][a-z]+\b/gi,
  /\bPROF\.? [A-Z][a-z]+ [A-Z][a-z]+\b/gi,
];

const GENERIC_NAME_PATTERN = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
const JOB_RELEVANT_WORDS = new Set([
  "analyst",
  "architect",
  "berater",
  "cloud",
  "consultant",
  "data",
  "designer",
  "developer",
  "devops",
  "engineer",
  "entwickler",
  "frontend",
  "full",
  "ingenieur",
  "manager",
  "backend",
  "product",
  "project",
  "react",
  "scientist",
  "software",
  "stack",
]);

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
  const titledNamesRemoved = NAME_PATTERNS.reduce(
    (result, pattern) => replaceWithPlaceholder(result, pattern, "[NAME]"),
    text
  );

  return titledNamesRemoved.replace(GENERIC_NAME_PATTERN, (candidate) => {
    const words = candidate.toLowerCase().split(" ");
    return words.some((word) => JOB_RELEVANT_WORDS.has(word)) ? candidate : "[NAME]";
  });
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
