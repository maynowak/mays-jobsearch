import type { Job } from "../../types";
import type {
  ApplicationJobReferenceV1,
  ApplicationJobOrigin,
} from "./contractTypes";
import {
  MAX_DESCRIPTION_INPUT_LENGTH,
  evaluateDescription,
  normalizeDescriptionText,
  type DescriptionCompleteness,
} from "../jobDescriptionReview";

export const MANUAL_JOB_SOURCE = "manual";
export const MANUAL_JOB_PREFIX = "manual:";
export const MANUAL_TITLE_FALLBACK = "Initiativbewerbung";
export const MANUAL_COMPANY_FALLBACK = "Unternehmen nicht angegeben";
export const MANUAL_TITLE_FALLBACK_EN = "Speculative application";
export const MANUAL_COMPANY_FALLBACK_EN = "Company not specified";
export const MAX_MANUAL_DESCRIPTION_LENGTH = MAX_DESCRIPTION_INPUT_LENGTH;
export const MAX_MANUAL_URL_LENGTH = 2000;

export interface ManualJobInput {
  description: string;
  title?: string;
  company?: string;
  location?: string;
  url?: string;
}

export interface ManualJobErrors {
  description?: "required" | "too_long" | "incomplete";
  url?: "invalid";
}

export interface ManualJobResult {
  job: Job | null;
  reference: ApplicationJobReferenceV1 | null;
  errors: ManualJobErrors;
  completeness: DescriptionCompleteness;
  normalizedDescription: string;
}

export function createManualJobId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${MANUAL_JOB_PREFIX}${crypto.randomUUID()}`;
  }
  return `${MANUAL_JOB_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isManualJob(job: Pick<Job, "source"> | null | undefined): boolean {
  return Boolean(job?.source?.includes(MANUAL_JOB_SOURCE));
}

function locationList(value: string | undefined): string[] {
  return String(value ?? "")
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizedUrl(value: string | undefined): { url?: string; invalid?: boolean } {
  const text = String(value ?? "").trim();
  if (!text) return {};
  if (text.length > MAX_MANUAL_URL_LENGTH) return { invalid: true };
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { invalid: true };
    }
    return { url: parsed.toString() };
  } catch {
    return { invalid: true };
  }
}

export function buildManualJob(
  input: ManualJobInput,
  jobId: string = createManualJobId(),
  fallbacks: { title?: string; company?: string } = {}
): ManualJobResult {
  const rawDescription = String(input.description ?? "");
  const errors: ManualJobErrors = {};
  const normalizedDescription = normalizeDescriptionText(rawDescription);
  let completeness: DescriptionCompleteness = "missing";

  if (!rawDescription.trim()) {
    errors.description = "required";
  } else if (rawDescription.length > MAX_MANUAL_DESCRIPTION_LENGTH) {
    errors.description = "too_long";
  } else if (!normalizedDescription) {
    errors.description = "required";
  } else {
    completeness = evaluateDescription(normalizedDescription).completeness;
    if (completeness === "missing") {
      errors.description = "incomplete";
    }
  }

  const urlResult = normalizedUrl(input.url);
  if (urlResult.invalid) errors.url = "invalid";

  const title = String(input.title ?? "").trim() ||
    fallbacks.title || MANUAL_TITLE_FALLBACK;
  const company = String(input.company ?? "").trim() ||
    fallbacks.company || MANUAL_COMPANY_FALLBACK;
  const location = locationList(input.location);
  const url = urlResult.url ?? "";
  const jobOrigin: ApplicationJobOrigin = "manual";
  const source = [MANUAL_JOB_SOURCE];

  if (errors.description || errors.url) {
    return {
      job: null,
      reference: null,
      errors,
      completeness,
      normalizedDescription,
    };
  }

  const job: Job = {
    slug: jobId,
    title,
    company_name: company,
    location,
    remote: false,
    tags: [],
    url,
    source,
    description: normalizedDescription,
    descriptionPlain: normalizedDescription,
  };
  const reference: ApplicationJobReferenceV1 = {
    jobId,
    title,
    companyName: company,
    location,
    source,
    ...(url ? { originalUrl: url } : {}),
    jobOrigin,
  };

  return {
    job,
    reference,
    errors,
    completeness,
    normalizedDescription,
  };
}
