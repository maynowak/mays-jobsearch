import { getConfig } from "../../config.mjs";
import { stripHtml, htmlToPlainText, detectLanguage } from "../../filter.mjs";

export const SOURCE_ID = "arbeitsagentur";

function normalizeArbeitsagentur(record) {
  const published = record.publishedDate ? Date.parse(record.publishedDate) : NaN;
  const location = record.location ? [String(record.location).trim()].filter(Boolean) : [];
  const slugSource = record.referenceId || record.contentHash || record.title || "job";
  const descriptionHtml = record.description || "";
  const descriptionPlain = htmlToPlainText(descriptionHtml);
  const contractType = typeof record.contractType === "string" ? record.contractType.trim() : "";
  const salary = typeof record.salary === "string" ? record.salary.trim() : "";
  const startDate = typeof record.startDate === "string" ? record.startDate.trim() : "";
  return {
    slug: `aa-${String(slugSource).replace(/\s+/g, "-")}`,
    title: String(record.title || "").trim(),
    company_name: String(record.employer || "").trim(),
    location,
    remote: record.isRemote === true,
    tags: [],
    url: String(record.portalUrl || "").trim(),
    created_at: Number.isFinite(published) ? Math.floor(published / 1000) : undefined,
    source: [SOURCE_ID],
    description: descriptionHtml || undefined,
    descriptionPlain: descriptionPlain || undefined,
    language: detectLanguage(descriptionPlain),
    contractType: contractType || undefined,
    salary: salary || undefined,
    startDate: startDate || undefined,
  };
}

export const APIFY_ACTORS = [
  {
    sourceId: SOURCE_ID,
    displayName: "Arbeitsagentur",
    actorId: "blackfalcondata~arbeitsagentur-jobs-feed",
    maxJobs: 40,
    enabled: () => getConfig().jobSourceArbeitsagenturEnabled,
    buildInput: (query, location, maxJobs) => ({
      query,
      location,
      maxResults: maxJobs,
      mode: "full",
      includeDetails: false,
      compact: true,
      excludeEmptyFields: false,
    }),
    normalize: normalizeArbeitsagentur,
  },
];

export function actorById(sourceId) {
  return APIFY_ACTORS.find((actor) => actor.sourceId === sourceId) || null;
}