export class HttpError extends Error {
  constructor(status, message, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function tokenize(input) {
  if (!input) return [];
  return String(input)
    .toLowerCase()
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$")
    .replace(/&amp;/g, "&");
}

function decodeHtmlEntities(html) {
  let current = String(html);
  for (let i = 0; i < 4; i++) {
    const next = decodeHtmlEntitiesOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

export function stripHtml(html) {
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlToPlainText(html) {
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GERMAN_STOPWORDS = new Set([
  "der", "die", "das", "und", "für", "mit", "den", "dem", "des",
  "ein", "eine", "einen", "einer", "einem", "eines", "nicht", "ist",
  "sind", "von", "zu", "zum", "zur", "auf", "bei", "als", "auch",
  "sich", "über", "nach", "aus", "an", "am", "im", "um", "wird",
  "werden", "wurde", "hat", "haben", "hatte", "sie", "er", "es",
  "wir", "ich", "ihr", "sehr", "wie", "was", "wo", "wann", "warum",
  "aber", "oder", "wenn", "dann", "denn", "dass", "dieser", "diese",
  "dieses", "kein", "keine", "gegen", "ohne", "mehr", "noch",
  "bereits", "wieder", "sowie", "durch", "hier", "dort",
]);

const ENGLISH_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "these", "those",
  "you", "your", "yours", "we", "our", "ours", "they", "them",
  "their", "theirs", "are", "were", "been", "being", "have", "has",
  "had", "does", "did", "will", "would", "should", "could", "may",
  "might", "must", "not", "but", "from", "into", "onto", "about",
  "over", "after", "before", "through", "during", "between", "among",
  "than", "more", "most", "some", "any", "all", "both", "each",
  "few", "many", "such", "who", "whom", "whose", "when", "where",
  "why", "how", "because", "although", "while", "whether", "which",
  "its", "it", "to",
]);

export function detectLanguage(text) {
  if (!text) return undefined;
  const words = stripHtml(text)
    .toLowerCase()
    .split(/[^a-zäöüß]+/)
    .filter((word) => word.length > 1);
  if (!words.length) return undefined;

  let german = 0;
  let english = 0;
  for (const word of words) {
    if (GERMAN_STOPWORDS.has(word)) german += 1;
    if (ENGLISH_STOPWORDS.has(word)) english += 1;
  }

  const max = Math.max(german, english);
  if (max < 3) return undefined;
  if (german === english) return undefined;
  return german > english ? "de" : "en";
}

function jobLocations(job) {
  const loc = job.location || [];
  return (Array.isArray(loc) ? loc : [loc]).map((l) => String(l).toLowerCase());
}

export function locationMatches(job, cityQueries) {
  if (!cityQueries.length) return true;
  const locs = jobLocations(job);
  const isRemote = job.remote === true;
  return (
    isRemote ||
    locs.some((l) => cityQueries.some((cq) => l.includes(cq) || cq.includes(l)))
  );
}

export function keywordHits(job, keywordTokens) {
  if (!keywordTokens.length) return 0;
  const title = (job.title || "").toLowerCase();
  const tags = (job.tags || []).join(" ").toLowerCase();
  const description = stripHtml(job.description || "").toLowerCase();
  const haystack = `${title} ${tags} ${description}`;
  return keywordTokens.filter((kw) => kw.length > 1 && haystack.includes(kw)).length;
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const EMPLOYMENT_ALIASES = {
  full_time: new Set([
    "full_time",
    "fulltime",
    "full-time",
    "full time",
    "vollzeit",
    "full-time position",
  ]),
  part_time: new Set([
    "part_time",
    "parttime",
    "part-time",
    "part time",
    "teilzeit",
    "part-time position",
  ]),
};

function jobEmploymentTokens(job) {
  const raw = [];
  if (Array.isArray(job.jobTypes)) raw.push(...job.jobTypes);
  if (job.contractType) raw.push(job.contractType);
  return new Set(raw.map((t) => String(t).toLowerCase().trim()).filter(Boolean));
}

export function employmentMatches(job, employmentTypes) {
  if (!employmentTypes.length) return true;
  const tokens = jobEmploymentTokens(job);
  if (tokens.size === 0) return true;
  return employmentTypes.some((type) => {
    const aliases = EMPLOYMENT_ALIASES[type];
    return Boolean(aliases) && [...tokens].some((token) => aliases.has(token));
  });
}

export function workModeMatches(job, workModes) {
  if (!workModes.length) return true;
  const requested = new Set(workModes);
  if (requested.has("remote") && !requested.has("hybrid") && !requested.has("onsite")) {
    if (job.remote === true) return true;
    if (job.remote === false) return false;
  }
  return true;
}

export function applySearchFilters(jobs, { radiusKm, workMode, employmentType }) {
  const employmentTypes = parseList(employmentType);
  const workModes = parseList(workMode);
  if (!employmentTypes.length && !workModes.length) return jobs;
  return jobs.filter(
    (job) => employmentMatches(job, employmentTypes) && workModeMatches(job, workModes)
  );
}
