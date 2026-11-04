import {
  CV_BUILDER_SCHEMA_VERSION,
  hasCvBuilderContent,
  type CvBuilderDraftV1,
} from "./contractTypes";
import type { CvBuilderTemplate } from "./templates";
import { CV_BUILDER_TEMPLATES } from "./templates";

export const CV_BUILDER_PROFILE_SCHEMA_VERSION = 1 as const;
export const CV_BUILDER_NAME_MAX_LENGTH = 80;

export interface CvBuilderProfileV1 {
  schemaVersion: typeof CV_BUILDER_PROFILE_SCHEMA_VERSION;
  cvId: string;
  name: string;
  cvData: CvBuilderDraftV1;
  template: CvBuilderTemplate;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type CvBuilderProfileErrorCode =
  | "validation_error"
  | "not_found"
  | "version_conflict"
  | "id_conflict"
  | "session_ended";

export class CvBuilderProfileError extends Error {
  readonly code: CvBuilderProfileErrorCode;

  constructor(message: string, code: CvBuilderProfileErrorCode = "validation_error") {
    super(message);
    this.name = "CvBuilderProfileError";
    this.code = code;
  }
}

export function createCvBuilderProfileId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cvb-${crypto.randomUUID()}`;
  }
  return `cvb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function cloneCvBuilderDraft(draft: CvBuilderDraftV1): CvBuilderDraftV1 {
  if (typeof structuredClone === "function") {
    return structuredClone(draft);
  }
  return JSON.parse(JSON.stringify(draft)) as CvBuilderDraftV1;
}

export function cloneCvBuilderProfile(profile: CvBuilderProfileV1): CvBuilderProfileV1 {
  return {
    ...profile,
    cvData: cloneCvBuilderDraft(profile.cvData),
  };
}

export function validateCvBuilderProfileName(value: unknown): string {
  if (typeof value !== "string") {
    throw new CvBuilderProfileError("A CV name is required");
  }
  const name = value.trim();
  if (!name || name.length > CV_BUILDER_NAME_MAX_LENGTH) {
    throw new CvBuilderProfileError(
      `A CV name must contain 1-${CV_BUILDER_NAME_MAX_LENGTH} characters`
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new CvBuilderProfileError("A CV name contains invalid characters");
  }
  return name;
}

export function validateCvBuilderTemplate(value: unknown): CvBuilderTemplate {
  if (typeof value !== "string" ||
      !CV_BUILDER_TEMPLATES.includes(value as CvBuilderTemplate)) {
    throw new CvBuilderProfileError("Unknown CV template");
  }
  return value as CvBuilderTemplate;
}

function validTimestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new CvBuilderProfileError("Invalid CV timestamp");
  }
  return value;
}

export function validateCvBuilderProfile(profile: CvBuilderProfileV1): void {
  if (profile.schemaVersion !== CV_BUILDER_PROFILE_SCHEMA_VERSION) {
    throw new CvBuilderProfileError("Unsupported CV profile schema version");
  }
  if (typeof profile.cvId !== "string" || !profile.cvId.trim()) {
    throw new CvBuilderProfileError("A CV id is required");
  }
  validateCvBuilderProfileName(profile.name);
  validateCvBuilderTemplate(profile.template);
  validTimestamp(profile.createdAt);
  validTimestamp(profile.updatedAt);
  if (!Number.isInteger(profile.version) || profile.version < 1) {
    throw new CvBuilderProfileError("Invalid CV profile version");
  }
  if (profile.cvData.schemaVersion !== CV_BUILDER_SCHEMA_VERSION) {
    throw new CvBuilderProfileError("Unsupported CV data schema version");
  }
}

export function cvBuilderProfileHasContent(profile: CvBuilderProfileV1): boolean {
  return hasCvBuilderContent(profile.cvData);
}
