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

export function stripHtml(html) {
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
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
  // Ohne Beschäftigungs-Information wird die Stelle nicht ausgeschlossen
  // (dann wäre die Standard-Suche "Vollzeit" künstlich leer).
  if (tokens.size === 0) return true;
  return employmentTypes.some((type) => {
    const aliases = EMPLOYMENT_ALIASES[type];
    return Boolean(aliases) && [...tokens].some((token) => aliases.has(token));
  });
}

export function workModeMatches(job, workModes) {
  if (!workModes.length) return true;
  const requested = new Set(workModes);
  // "remote" ist anhand der Daten bestimmbar (job.remote). "hybrid"/"onsite"
  // sind aus den aktuellen Jobdaten nicht ableitbar -> offener Punkt, kein Filter.
  if (requested.has("remote") && !requested.has("hybrid") && !requested.has("onsite")) {
    if (job.remote === true) return true;
    if (job.remote === false) return false;
  }
  return true;
}

export function applySearchFilters(jobs, { radiusKm, workMode, employmentType }) {
  const employmentTypes = parseList(employmentType);
  const workModes = parseList(workMode);
  // radiusKm (Umkreis) ist ohne Geocoding nicht filterbar -> offener Punkt.
  if (!employmentTypes.length && !workModes.length) return jobs;
  return jobs.filter(
    (job) => employmentMatches(job, employmentTypes) && workModeMatches(job, workModes)
  );
}