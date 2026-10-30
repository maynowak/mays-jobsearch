const NAME_PATTERNS = [
  /\b\p{Lu}[\p{Ll}]+ \p{Lu}\. \p{Lu}[\p{Ll}]+\b/gu,
  /\bDR\.? \p{Lu}[\p{Ll}]+ \p{Lu}[\p{Ll}]+\b/giu,
  /\bPROF\.? \p{Lu}[\p{Ll}]+ \p{Lu}[\p{Ll}]+\b/giu,
];

const APOSTROPHE_NAME_PATTERNS = [
  /\b\p{Lu}[\p{Ll}]+['’]\p{Ll}+\b/gu,
  /\b\p{Lu}[\p{Ll}]*['’]\p{Lu}[\p{Ll}]+\b/gu,
];

const GENERIC_NAME_PATTERN = /\b\p{Lu}[\p{Ll}]+ \p{Lu}[\p{Ll}]+\b/gu;

// CV headers often use all capitals (for example "MAY NOWAK · PROFESSIONAL
// CV"). Only treat an all-caps pair as a name when it starts a line/header and
// is immediately followed by a visual separator. This avoids replacing normal
// all-caps labels such as "PROFESSIONAL CV" throughout the document.
const ALL_CAPS_HEADER_NAME_PATTERN =
  /(^|[\r\n])([ \t]*)([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’-]{1,}\s+[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’-]{1,})(?=\s*[·|•–—-])/gm;

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
  "Senior DevOps Engineer",
  "Senior Software Architect",
  "Full-Stack Developer",
  "Event-Driven Architecture",
  "Spring Boot",
  "Software Architect",
  "Generative AI",
  "Retrieval Augmented Generation",
  "AWS Solutions Architect",
  "AWS Solutions Architect - Associate",
  "HashiCorp Terraform Associate",
  "Event-Driven Architecture",
  "Bachelor of Science",
  "Amazon Web Services",
  "AWS Cloud Practitioner",
  "AWS Solutions Architect - Associate",
  "Professional Training",
  "Language Skills",
  "Information Systems",
  "Data Warehouse",
  "Streams",
  "Microservices",
];

// This is the product name, not a candidate name. Protect it before the
// apostrophe-name patterns run; ordinary "May's" occurrences remain subject
// to the existing name heuristic.
const PROTECTED_PRODUCT_PHRASES = ["May's Job Matcher", "May’s Job Matcher"];

// PDF extraction can insert whitespace around @ or dots. Keep the match
// deliberately email-shaped so prose such as "E-Mail" or "@Override" is not
// treated as a personal address.
const EMAIL_PATTERN =
  /\b[a-zA-Z0-9.!#$%&'*+\/?^_`{|}~-]+\s*@\s*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\s*\.\s*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\s*\.\s*[a-zA-Z]{2,}(?=$|[^\p{L}\p{N}_])/gu;

const PHONE_PATTERNS = [
  /\+?\d[\d\s\-()]{8,}\d/g,
  /\b\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}\b/g,
  /\(\d{3,5}\)\s*\d{3,4}[\s\-]?\d{3,4}/g,
];

const ADDRESS_PATTERNS = [
  /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?/g,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s+[A-Z]{2}\s+\d{5}/g,
  /\b[\p{L}][\p{L}.'’-]*(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|ufer|damm|chaussee)\s+\d{1,5}\s*[a-zA-Z]?(?:\s*[-/]\s*\d{1,5}\s*[a-zA-Z]?)?\s*,?\s+\d{5}\s+[\p{L}][\p{L}.'’-]*(?:[ \t]+[\p{L}][\p{L}.'’-]*){0,2}(?=$|[\r\n,.;])/giu,
];

const DATE_PATTERNS = [
  /\b\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}\b/g,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi,
];

// Employment ranges and page-style ranges are contextual document structure,
// not contact data. Protect them before the broad phone matcher runs.
const DATE_RANGE_PATTERN =
  /\b(?:\d{1,2}[./]\d{4}|(?:19|20)\d{2})\s*[–—-]\s*(?:\d{1,2}[./]\d{4}|(?:19|20)\d{2})\b/g;

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
  const protectedText = [...JOB_RELEVANT_PHRASES, ...PROTECTED_PRODUCT_PHRASES].reduce((result, phrase) => {
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

  const apostropheNamesRemoved = APOSTROPHE_NAME_PATTERNS.reduce(
    (result, pattern) => replaceWithPlaceholder(result, pattern, "[NAME]"),
    titledNamesRemoved
  );

  const headerNamesRemoved = apostropheNamesRemoved.replace(
    ALL_CAPS_HEADER_NAME_PATTERN,
    "$1$2[NAME]"
  );
  const anonymized = headerNamesRemoved.replace(GENERIC_NAME_PATTERN, "[NAME]");
  return anonymized.replace(/\u0000ROLE_(\d+)\u0000/g, (_, index: string) => protectedPhrases[Number(index)]);
}

export function anonymizeText(text: string): string {
  let result = text;

  const protectedDateRanges: string[] = [];
  result = result.replace(DATE_RANGE_PATTERN, (match) => {
    const marker = `\u0000DATE_RANGE_${protectedDateRanges.length}\u0000`;
    protectedDateRanges.push(match);
    return marker;
  });

  result = replaceAllPatterns(result, EMAIL_PATTERN, "[E-MAIL]");
  result = replaceAllPatterns(result, PHONE_PATTERNS, "[TELEFON]");
  result = replaceAllPatterns(result, ADDRESS_PATTERNS, "[ADRESSE]");
  result = replaceAllPatterns(result, DATE_PATTERNS, "[DATUM]");
  result = replaceAllPatterns(result, URL_PATTERN, "[URL]");
  result = replaceAllPatterns(result, LINKEDIN_PATTERN, "[LINKEDIN]");
  result = replaceAllPatterns(result, XING_PATTERN, "[XING]");
  result = replaceAllPatterns(result, GITHUB_PATTERN, "[GITHUB]");

  result = anonymizeNames(result);

  result = result.replace(/\u0000DATE_RANGE_(\d+)\u0000/g, (_, index: string) => protectedDateRanges[Number(index)]);

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
