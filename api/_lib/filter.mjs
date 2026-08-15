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