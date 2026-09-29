import { stripHtml, detectLanguage } from "../../../filter.mjs";
import { createJsonFeedSource } from "../jsonFeedSource.mjs";

const API_BASE = "https://api.lever.co/v0/postings";

export function createLeverSource({ identifier, enabled, label, options = {} }) {
  return createJsonFeedSource({
    providerName: "lever",
    identifier,
    enabled,
    label,
    options,
    buildUrl: (id) => `${API_BASE}/${encodeURIComponent(id)}?mode=json`,
    extractList: (json) => json,
    normalizeJob: (raw) => normalizeLeverJob(raw, `lever:${identifier}`),
  });
}

function normalizeLeverJob(job, sourceId) {
  const location = job.categories?.location ? [job.categories.location] : [];
  const commitment = job.categories?.commitment || "";
  const team = job.categories?.team || "";
  const department = job.categories?.department || "";
  const level = job.categories?.level || "";
  const allLocations = job.categories?.allLocations?.map((l) => l.text).filter(Boolean) || [];

  const tags = [commitment, team, department, level].filter(Boolean);
  const descriptionHtml = job.description || job.descriptionPlain || "";
  const descriptionPlain = stripHtml(descriptionHtml);

  const createdAt = job.createdAt ? Date.parse(job.createdAt) : NaN;
  const updatedAt = job.updatedAt ? Date.parse(job.updatedAt) : NaN;

  const externalId = `lv-${job.id}`;

  const workplaceType = job.workplaceType || (commitment.toLowerCase().includes("remote") ? "remote" : undefined);
  const remote = workplaceType === "remote" || location.some((l) => l.toLowerCase().includes("remote"));

  return {
    slug: externalId,
    title: String(job.text || "").trim(),
    company_name: String(job.company || "").trim(),
    location: [...new Set([...location, ...allLocations])],
    remote,
    tags,
    url: job.hostedUrl || job.applyUrl || "",
    created_at: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    source: [sourceId, "ats"],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    jobTypes: commitment ? [commitment.toLowerCase().replace(/\s+/g, "_")] : undefined,
    applyUrl: job.applyUrl || job.hostedUrl,
    jobUrl: job.hostedUrl,
    workplaceType,
    department: department || team || undefined,
    salary: job.salaryRange ? `${job.salaryRange.currency} ${job.salaryRange.interval}: ${job.salaryRange.min}-${job.salaryRange.max}` : undefined,
    externalId,
  };
}
