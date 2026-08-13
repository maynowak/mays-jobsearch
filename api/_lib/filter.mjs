const API_BASE = "https://www.arbeitnow.com/api/job-board-api";
const MAX_JOBS_TO_AI = 40;

export class HttpError extends Error {
  constructor(status, message, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function tokenize(input) {
  if (!input) return [];
  return String(input)
    .toLowerCase()
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function stripHtml(html) {
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

function locationMatches(job, cityQueries) {
  if (!cityQueries.length) return true;
  const locs = jobLocations(job);
  const isRemote = job.remote === true;
  return (
    isRemote ||
    locs.some((l) => cityQueries.some((cq) => l.includes(cq) || cq.includes(l)))
  );
}

function keywordHits(job, keywordTokens) {
  if (!keywordTokens.length) return 0;
  const title = (job.title || "").toLowerCase();
  const tags = (job.tags || []).join(" ").toLowerCase();
  const description = stripHtml(job.description || "").toLowerCase();
  const haystack = `${title} ${tags} ${description}`;
  return keywordTokens.filter((kw) => kw.length > 1 && haystack.includes(kw)).length;
}

function compactJob(job) {
  const loc = job.location || [];
  return {
    slug: job.slug,
    title: job.title,
    company_name: job.company_name,
    location: Array.isArray(loc) ? loc : [loc],
    remote: job.remote === true,
    tags: job.tags || [],
    url: job.url,
    created_at: job.created_at,
  };
}

export async function fetchArbeitnow() {
  let response;
  try {
    response = await fetch(API_BASE, {
      headers: { "Accept": "application/json" },
    });
  } catch {
    throw new HttpError(502, "Couldn't reach the job board right now. Please try again in a moment.", "network");
  }

  if (response.status === 429) {
    throw new HttpError(429, "The job board is busy right now. Give it a minute and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(502, `The job board returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new HttpError(502, "The job board sent back something unreadable. Try again shortly.", "upstream");
  }

  if (!json || !Array.isArray(json.data)) {
    throw new HttpError(502, "The job board sent an unexpected response. Try again shortly.", "upstream");
  }
  return json.data;
}

export async function fetchFilteredJobs({ skills, targetRole, city }) {
  const jobs = await fetchArbeitnow();

  const keywordTokens = [...tokenize(targetRole), ...tokenize(skills)];
  const cityQueries = String(city || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const candidates = jobs.filter((job) => {
    if (!locationMatches(job, cityQueries)) return false;
    if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
    return true;
  });

  const ranked = candidates
    .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
    .sort((a, b) => b.hits - a.hits || b.job.created_at - a.job.created_at)
    .map(({ job }) => compactJob(job));

  return {
    jobs: ranked.slice(0, MAX_JOBS_TO_AI),
    meta: {
      totalScanned: jobs.length,
      totalFiltered: ranked.length,
      city: cityQueries,
      keywords: keywordTokens,
    },
  };
}
