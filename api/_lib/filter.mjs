export class HttpError extends Error {
  constructor(status, message, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function splitQuotedPhrases(input) {
  // Splits on comma/semicolon/newline; a "..." phrase inside a segment
  // counts as ONE token, remaining text splits on whitespace.
  // Stray quotes are dropped. Contract shared with src/lib/skills.ts.
  const tokens = [];
  for (const segment of String(input ?? "").split(/[,;\n]+/)) {
    const seg = segment.trim();
    if (!seg) continue;
    const re = /"([^"]*)"|[^\s"]+/g;
    let m;
    let matched = false;
    while ((m = re.exec(seg)) !== null) {
      matched = true;
      const token = (m[1] !== undefined ? m[1] : m[0]).trim();
      if (token) tokens.push(token);
    }
    if (!matched) {
      const fallback = seg.replace(/"/g, "").trim();
      if (fallback) tokens.push(fallback);
    }
  }
  return tokens;
}

export function tokenize(input) {
  if (!input) return [];

  // Handle array input (skills array) - preserve multi-word skills as single tokens
  if (Array.isArray(input)) {
    return input
      .map((skill) => String(skill).toLowerCase().trim())
      .filter((t) => t.length > 0);
  }

  // Handle string input (legacy format, quote-aware)
  return splitQuotedPhrases(input)
    .map((t) => t.toLowerCase().trim())
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

const REMOTE_TEXT_MARKERS = ["100% remote", "100 % remote", "vollständig im homeoffice", "vollstaendig im homeoffice"];
const HYBRID_KEYWORDS = [
  "hybrid",
  "teilweise homeoffice",
  "homeoffice möglich",
  "homeoffice moeglich",
  "flexibles arbeiten",
  "remote-anteil",
  "remoteanteil",
  "präsenz und homeoffice",
  "praesenz und homeoffice",
  "bzw. homeoffice",
  "blended working",
];
const ONSITE_KEYWORDS = [
  "vor ort",
  "präsenz",
  "praesenz",
  "im büro",
  "im buero",
  "werkstatt",
  "baustelle",
  "kein homeoffice",
  "ladenlokal",
  "on-site",
  "onsite",
];

/**
 * Bestimmt das wahrscheinlichste Arbeitsmodell eines Jobs.
 * Reihenfolge: Provider-Metadaten (workplaceType, remote-Flag),
 * dann starke Remote-Textmarker, dann Hybrid-, dann Onsite-Keywords.
 * Fallback ohne Signal: "onsite" (Branchen-Standard).
 * Vorschlag: Google AI (Feldzugriffe ans Jobmodell angepasst).
 */
export function deriveWorkMode(job) {
  const workplace = String(job?.workplaceType || "").trim().toLowerCase();
  if (workplace === "remote" || workplace === "hybrid" || workplace === "onsite") {
    return workplace;
  }
  if (job?.remote === true) return "remote";
  const text = `${job?.title || ""} ${job?.descriptionPlain || job?.description || ""} ${(job?.tags || []).join(" ")}`.toLowerCase();
  if (REMOTE_TEXT_MARKERS.some((marker) => text.includes(marker))) return "remote";
  if (HYBRID_KEYWORDS.some((keyword) => text.includes(keyword))) return "hybrid";
  if (ONSITE_KEYWORDS.some((keyword) => text.includes(keyword))) return "onsite";
  return "onsite";
}

export function workModeMatches(job, workModes) {
  const requested = new Set(
    (Array.isArray(workModes) ? workModes : []).map((m) => String(m).toLowerCase().trim()).filter(Boolean)
  );
  if (!requested.size) return true;
  if (requested.size === 1 && requested.has("remote")) {
    if (job.remote === true) return true;
    if (job.remote === false) return false;
  }
  return requested.has(deriveWorkMode(job));
}

export function applySearchFilters(jobs, { radiusKm, workMode, employmentType }) {
  const employmentTypes = parseList(employmentType);
  const workModes = parseList(workMode);
  if (!employmentTypes.length && !workModes.length) return jobs;
  return jobs.filter(
    (job) => employmentMatches(job, employmentTypes) && workModeMatches(job, workModes)
  );
}
