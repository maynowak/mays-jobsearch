import type { CvDocument, Job, Profile } from "../types";
import type { DescriptionOrigin } from "./jobDescriptionReview";

export type CoverLetterLanguage = "German" | "English";
export type CoverLetterStyle = "professional" | "warm" | "concise";
export type CoverLetterLength = "short" | "one_page" | "detailed";
export type CandidateMode = "cv" | "manual";

export const MAX_CV_TEXT_LENGTH = 30000;
export const MAX_REVISION_DRAFT_LENGTH = 20000;
export const MAX_REVISION_FEEDBACK_LENGTH = 2000;

export interface CoverLetterJobContext {
  title: string;
  company_name: string;
  location: string[];
  url: string;
  source: string[];
  tags: string[];
  description: string;
  description_origin: DescriptionOrigin;
}

export interface CoverLetterCandidateContext {
  mode: CandidateMode;
  skills: string[];
  experience: string;
  qualifications: string;
  motivation: string;
  cv_text?: string;
  cv_anonymized?: boolean;
  start_date?: string;
  salary_expectation?: string;
}

export interface CoverLetterGenerationOptions {
  language: CoverLetterLanguage;
  style: CoverLetterStyle;
  length: CoverLetterLength;
  target_roles: string[];
  model?: string | null;
}

export type CoverLetterOperation = "generate" | "revise";

export interface CoverLetterRevisionContext {
  draft_text: string;
  draft_anonymized?: boolean;
  feedback?: string;
}

export interface CoverLetterGenerationRequest {
  job: CoverLetterJobContext;
  candidate: CoverLetterCandidateContext;
  options: CoverLetterGenerationOptions;
  operation?: CoverLetterOperation;
  revision?: CoverLetterRevisionContext;
}

export interface CoverLetterGenerationResponse {
  letter: string;
  meta?: {
    operation?: CoverLetterOperation;
    job?: { title?: string; company_name?: string };
    language?: string;
    description_origin?: string;
    candidate_mode?: string;
    cv_anonymized?: boolean;
    draft_anonymized?: boolean;
  };
}

export function buildJobContext(
  job: Job,
  selectedDescription: string,
  descriptionOrigin: DescriptionOrigin
): CoverLetterJobContext {
  return {
    title: String(job.title ?? "").trim(),
    company_name: String(job.company_name ?? "").trim(),
    location: (job.location ?? []).map((entry) => String(entry)).filter(Boolean),
    url: String(job.url ?? "").trim(),
    source: (job.source ?? []).map((entry) => String(entry)).filter(Boolean),
    tags: (job.tags ?? []).map((entry) => String(entry)).filter(Boolean),
    description: String(selectedDescription ?? "").trim(),
    description_origin: descriptionOrigin,
  };
}

export function buildTargetRoles(profile: Profile | null | undefined): string[] {
  if (!profile) return [];
  return (profile.targetRoles ?? [])
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

export function cvIsUsable(document: CvDocument | null | undefined): boolean {
  return Boolean(document && document.processedAt && document.hash);
}
