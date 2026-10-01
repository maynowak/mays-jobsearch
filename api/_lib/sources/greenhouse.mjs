import { HttpError, tokenize, stripHtml, locationMatches, keywordHits, detectLanguage } from "../filter.mjs";
import { getConfig } from "../config.mjs";

const API_BASE = "https://boards-api.greenhouse.io/v1/boards";
const MAX_JOBS_TO_AI = 40;

const SOURCE_ID = "greenhouse";

export const id = SOURCE_ID;
export const displayName = "Greenhouse";
export const provider = "ats";

export function enabled() {
  // Ehrlich: Flag UND konfigurierte Boards (sonst nur
  // no_boards_configured-Leermengen).
  return getConfig().jobSourceGreenhouseEnabled && parseGreenhouseBoards().length > 0;
}

function parseGreenhouseBoards() {
  const boards = getConfig().jobSourceGreenhouseBoards || "";
  return boards
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

export async function fetchGreenhouseJobs({ skills, targetRoles, targetRole, city }) {
  const boards = parseGreenhouseBoards();
  if (!boards.length) {
    return emptyResult("no_boards_configured");
  }

  // Backward compatibility: support both targetRoles (array) and targetRole (string)
  const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
  const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
  const cityQueries = String(city || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const allJobs = [];

  for (const board of boards) {
    try {
      const jobs = await fetchBoardJobs(board);
      allJobs.push(...jobs);
    } catch (err) {
      console.error(`[greenhouse] Board ${board} failed:`, err);
      // Continue with other boards
    }
  }

  const candidates = allJobs
    .map(normalizeGreenhouseJob)
    .filter((job) => {
      if (!locationMatches(job, cityQueries)) return false;
      if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
      return true;
    });

  const ranked = candidates
    .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
    .sort((a, b) => b.hits - a.hits || (b.job.created_at || 0) - (a.job.created_at || 0))
    .map(({ job }) => job);

  return {
    jobs: ranked.slice(0, MAX_JOBS_TO_AI),
    meta: {
      enabled: true,
      reason: null,
      totalScanned: allJobs.length,
      totalFiltered: ranked.length,
    },
  };
}

async function fetchBoardJobs(board) {
  const url = `${API_BASE}/${encodeURIComponent(board)}/jobs?content=true`;
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new HttpError(502, "Couldn't reach Greenhouse API right now. Please try again in a moment.", "network");
  }

  if (response.status === 404) {
    throw new HttpError(404, `Greenhouse board "${board}" not found.`, "not_found");
  }
  if (response.status === 429) {
    throw new HttpError(429, "Greenhouse API is busy right now. Give it a minute and try again.", "rate_limited");
  }
  if (!response.ok) {
    throw new HttpError(502, `Greenhouse API returned an error (HTTP ${response.status}). Try again shortly.`, "upstream");
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new HttpError(502, "Greenhouse API sent back something unreadable. Try again shortly.", "upstream");
  }

  if (!json || !Array.isArray(json)) {
    throw new HttpError(502, "Greenhouse API sent an unexpected response. Try again shortly.", "upstream");
  }

  return json;
}

export function normalizeGreenhouseJob(job) {
  const location = job.location?.name ? [job.location.name] : [];
  const offices = job.offices?.map((o) => o.name).filter(Boolean) || [];
  const allLocations = [...new Set([...location, ...offices])];

  const departments = job.departments?.map((d) => d.name).filter(Boolean) || [];
  const tags = job.tags?.filter(Boolean) || [];

  const descriptionHtml = job.content || "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.updated_at ? Date.parse(job.updated_at) : NaN;

  // External ID for deduplication
  const externalId = `gh-${job.id}`;

  return {
    slug: externalId,
    title: String(job.title || "").trim(),
    company_name: String(job.company_name || "").trim(),
    location: allLocations,
    remote: job.location?.name?.toLowerCase().includes("remote") || offices.some((o) => o?.toLowerCase().includes("remote")),
    tags: [...departments, ...tags],
    url: job.absolute_url || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [SOURCE_ID, "ats"],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: job.employment_type ? [job.employment_type] : undefined,
    // ATS-specific fields
    applyUrl: job.absolute_url || undefined,
    jobUrl: job.absolute_url || undefined,
    workplaceType: undefined, // not provided by Greenhouse
    department: departments[0] || undefined,
    externalId: externalId,
  };
}

function emptyResult(reason) {
  return {
    jobs: [],
    meta: { enabled: false, reason, totalScanned: 0, totalFiltered: 0 },
  };
}

export async function fetchJobs(params) {
  return fetchGreenhouseJobs(params);
}

// Factory adapter: single board instance, configured at creation time.
// Standard input stays comma-separated skills entry; the board token is
// bound per source so the registry needs no source-specific logic.
export function createGreenhouseSource({ identifier, enabled = true, label } = {}) {
  const board = String(identifier ?? "").trim();
  const sourceId = `greenhouse:${board}`;
  return {
    id: sourceId,
    displayName: label || `Greenhouse (${board})`,
    provider: "ats",
    enabled: () => enabled === true,
    fetchJobs: async ({ skills, targetRoles, targetRole, city }) => {
      if (!board) {
        return emptyResult("no_boards_configured");
      }
      const roles = Array.isArray(targetRoles) ? targetRoles : (targetRole ? [targetRole] : []);
      const keywordTokens = [...roles.flatMap(tokenize), ...tokenize(skills)];
      const cityQueries = String(city || "")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

      const rawJobs = await fetchBoardJobs(board);
      const candidates = rawJobs
        .map((job) => ({ ...normalizeGreenhouseJob(job), source: [sourceId, "ats"] }))
        .filter((job) => {
          if (!locationMatches(job, cityQueries)) return false;
          if (keywordTokens.length) return keywordHits(job, keywordTokens) > 0;
          return true;
        });

      const ranked = candidates
        .map((job) => ({ job, hits: keywordHits(job, keywordTokens) }))
        .sort((a, b) => b.hits - a.hits || (b.job.created_at || 0) - (a.job.created_at || 0))
        .map(({ job }) => job);

      return {
        jobs: ranked.slice(0, MAX_JOBS_TO_AI),
        meta: {
          enabled: true,
          reason: null,
          totalScanned: rawJobs.length,
          totalFiltered: ranked.length,
        },
      };
    },
  };
}