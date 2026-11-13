/**
 * Browser client for the structured CV-builder profile BFF.
 *
 * The browser never supplies tenant/user identity, an owner key, a RIS
 * credential or a consent notice version. The server BFF selects the fixed
 * RIS path, validates profile ids and concurrency headers, and remains the
 * source of truth for the profile id, version and consent state.
 *
 * This module intentionally performs no automatic retry and writes nothing to
 * localStorage/sessionStorage. A caller that retries a create must reuse the
 * same idempotency key.
 */

import type { CvBuilderDraftV1 } from "./cvBuilder/contractTypes";
import type { CvBuilderTemplate } from "./cvBuilder/templates";
import {
  validateCvBuilderProfileName,
  validateCvBuilderTemplate,
} from "./cvBuilder/profileTypes";

export const STRUCTURED_CV_PROFILE_SCHEMA_VERSION = 1 as const;
export const STRUCTURED_CV_PROFILE_PATH = "/api/ris/cv-builder-profiles";
export const STRUCTURED_CV_CONSENT_PATH =
  "/api/ris/consents?purpose=cv-builder-profile-storage";
export const STRUCTURED_CV_PROFILE_ID_PATTERN = /^cvp-[A-Za-z0-9-]{8,80}$/;
export const STRUCTURED_CV_MAX_PAYLOAD_BYTES = 300000;

export type StructuredCvReviewTarget =
  | "ignore" | "profile" | "experience" | "education" | "skills"
  | "projects" | "certificates" | "links";
export type StructuredCvReviewStatus = "pending" | "accepted" | "ignored";
export type StructuredCvReviewReason =
  | "unknown-section" | "training" | "certification-goal" | "target-roles"
  | "document-notes" | "incomplete-experience" | "incomplete-education"
  | "incomplete-language" | "project-reference" | "ambiguous";

export interface StructuredCvReviewItemV1 {
  id: string;
  index: number;
  text: string;
  original: string;
  edited: boolean;
  target: StructuredCvReviewTarget;
  status: StructuredCvReviewStatus;
  applied: boolean;
  page?: number;
  sectionHeading?: string;
  reason: StructuredCvReviewReason;
  suggestedTarget: StructuredCvReviewTarget;
}

export interface StructuredCvImportReviewV1 {
  schemaVersion: 1;
  sourceName?: string;
  pageCount?: number;
  pendingAcknowledged?: boolean;
  selectedSections?: string[];
  skills?: { total: number; selected: number; unselected: number; limited: boolean };
  items: StructuredCvReviewItemV1[];
  total: number;
  pending: number;
  accepted: number;
  ignored: number;
}

export interface StructuredCvImportReviewInput extends Partial<Omit<StructuredCvImportReviewV1, "schemaVersion" | "items">> {
  schemaVersion?: 1;
  items?: Array<Partial<StructuredCvReviewItemV1> & { applied?: boolean }>;
}

export interface StructuredCvProfileV1 {
  schemaVersion: 1;
  profileId: string;
  name: string;
  cvData: CvBuilderDraftV1;
  template: CvBuilderTemplate;
  importReview?: StructuredCvImportReviewV1;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StructuredCvProfileSummary {
  profileId: string;
  name: string;
  template: CvBuilderTemplate;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StructuredCvProfileList {
  items: StructuredCvProfileSummary[];
  nextCursor: string | null;
}

export interface StructuredCvCreateInput {
  name: string;
  cvData: CvBuilderDraftV1;
  template: CvBuilderTemplate;
  importReview?: StructuredCvImportReviewInput;
}

export interface StructuredCvUpdateInput {
  name?: string;
  cvData?: CvBuilderDraftV1;
  template?: CvBuilderTemplate;
  importReview?: StructuredCvImportReviewInput | null;
}

export interface StructuredCvProfileWithEtag {
  profile: StructuredCvProfileV1;
  etag: string | null;
}

export interface StructuredCvProfileExport {
  schemaVersion: 1;
  exportedAt: string;
  source: string;
  profile: StructuredCvProfileV1;
}

export interface StructuredCvConsentState {
  consent: Record<string, unknown> | null;
  noticeVersion: string | null;
  noticeState: string | null;
  noticeApproved: boolean;
  acceptedForNewGrant: boolean;
  grantAllowed: boolean;
  noticeReason: string | null;
  textVersion: string | null;
  textHash: string | null;
  textState: string | null;
  textMapped: boolean;
  textApproved: boolean;
  textReason: string | null;
}

export type StructuredCvApiErrorCode =
  | "storage_disabled" | "unauthenticated" | "forbidden" | "not_found"
  | "version_conflict" | "idempotency_conflict" | "capacity_exceeded"
  | "payload_too_large" | "validation_error" | "precondition_required"
  | "import_review_incomplete" | "invalid_response" | "unavailable" | "aborted";

export class StructuredCvApiError extends Error {
  readonly code: StructuredCvApiErrorCode;
  readonly status?: number;

  constructor(message: string, code: StructuredCvApiErrorCode = "unavailable", status?: number) {
    super(message);
    this.name = "StructuredCvApiError";
    this.code = code;
    this.status = status;
  }
}

export function isRisStructuredCvStorageEnabled(
  env: Record<string, string | boolean | undefined> =
    import.meta.env as unknown as Record<string, string | boolean | undefined>
): boolean {
  return String(env.VITE_RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED ?? "").toLowerCase() === "true";
}

const REVIEW_FIELDS = new Set([
  "schemaVersion", "sourceName", "pageCount", "pendingAcknowledged",
  "selectedSections", "skills", "items", "total", "pending", "accepted", "ignored",
]);
const ITEM_FIELDS = new Set([
  "id", "index", "text", "original", "edited", "target", "status", "applied",
  "page", "sectionHeading", "reason", "suggestedTarget",
]);
const TARGETS = new Set<StructuredCvReviewTarget>([
  "ignore", "profile", "experience", "education", "skills", "projects",
  "certificates", "links",
]);
const STATUSES = new Set<StructuredCvReviewStatus>(["pending", "accepted", "ignored"]);
const REASONS = new Set<StructuredCvReviewReason>([
  "unknown-section", "training", "certification-goal", "target-roles",
  "document-notes", "incomplete-experience", "incomplete-education",
  "incomplete-language", "project-reference", "ambiguous",
]);
const FORBIDDEN_IDENTITY_FIELDS = new Set([
  "ownerKey", "userId", "tenantId", "partnerApplicationId", "issuer",
  "profileId", "version", "createdAt", "updatedAt",
]);

function invalid(message: string): StructuredCvApiError {
  return new StructuredCvApiError(message, "validation_error", 422);
}

function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw invalid(`${field} is invalid`);
  }
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 2000) {
    throw invalid(`${field} is invalid or too long`);
  }
  return value;
}

function assertNoIdentity(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("A request body is required");
  }
  if (Object.keys(value).some((key) => FORBIDDEN_IDENTITY_FIELDS.has(key))) {
    throw invalid("Client-supplied owner or server fields are not accepted");
  }
}

function normalizeReview(review: StructuredCvImportReviewInput | null | undefined): StructuredCvImportReviewV1 | undefined {
  if (review === null || review === undefined) return undefined;
  if (typeof review !== "object" || Array.isArray(review)) throw invalid("importReview is invalid");
  if (Object.keys(review).some((key) => !REVIEW_FIELDS.has(key))) {
    throw invalid("importReview contains unsupported fields");
  }
  if (review.schemaVersion !== undefined && review.schemaVersion !== 1) {
    throw invalid("importReview.schemaVersion is unsupported");
  }
  const rawItems = review.items;
  if (rawItems !== undefined && !Array.isArray(rawItems)) throw invalid("importReview.items is invalid");
  const items = rawItems ?? [];
  if (items.length > 500) throw invalid("importReview.items exceeds 500 entries");

  const normalized = items.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("review item is invalid");
    if (Object.keys(raw).some((key) => !ITEM_FIELDS.has(key))) {
      throw invalid("review item contains unsupported fields");
    }
    const target = raw.target;
    const status = raw.status;
    const reason = raw.reason;
    const suggestedTarget = raw.suggestedTarget ?? "ignore";
    if (!TARGETS.has(target as StructuredCvReviewTarget)) throw invalid("review target is invalid");
    if (!STATUSES.has(status as StructuredCvReviewStatus)) throw invalid("review status is invalid");
    if (!REASONS.has(reason as StructuredCvReviewReason)) throw invalid("review reason is invalid");
    if (!TARGETS.has(suggestedTarget as StructuredCvReviewTarget)) {
      throw invalid("review suggestedTarget is invalid");
    }
    if (raw.index !== undefined && (!Number.isInteger(raw.index) || raw.index < 0)) {
      throw invalid("review index is invalid");
    }
    if (raw.page !== undefined && (!Number.isInteger(raw.page) || raw.page < 1)) {
      throw invalid("review page is invalid");
    }
    const applied = raw.applied === true;
    if (applied && status !== "accepted") throw invalid("applied review items must be accepted");
    return {
      id: requireString(raw.id, "review id"),
      index: raw.index ?? index,
      text: requireText(raw.text, "review text"),
      original: requireText(raw.original, "review original"),
      edited: raw.edited === true,
      target: target as StructuredCvReviewTarget,
      status: status as StructuredCvReviewStatus,
      applied,
      ...(raw.page === undefined ? {} : { page: raw.page }),
      ...(raw.sectionHeading === undefined
        ? {}
        : { sectionHeading: requireString(raw.sectionHeading, "review sectionHeading") }),
      reason: reason as StructuredCvReviewReason,
      suggestedTarget: suggestedTarget as StructuredCvReviewTarget,
    } satisfies StructuredCvReviewItemV1;
  });

  const total = review.total ?? normalized.length;
  if (total > 0 && normalized.length === 0) {
    throw new StructuredCvApiError(
      "Counts-only import review cannot be stored as complete",
      "import_review_incomplete", 422,
    );
  }
  if (total !== normalized.length) throw invalid("importReview.total does not match items");
  const pending = normalized.filter((item) => item.status === "pending").length;
  const accepted = normalized.filter((item) => item.status === "accepted").length;
  const ignored = normalized.filter((item) => item.status === "ignored").length;
  if (review.pending !== undefined && review.pending !== pending) throw invalid("importReview.pending is inconsistent");
  if (review.accepted !== undefined && review.accepted !== accepted) throw invalid("importReview.accepted is inconsistent");
  if (review.ignored !== undefined && review.ignored !== ignored) throw invalid("importReview.ignored is inconsistent");
  return {
    schemaVersion: 1,
    ...(review.sourceName === undefined ? {} : { sourceName: String(review.sourceName).slice(0, 200) }),
    ...(review.pageCount === undefined ? {} : { pageCount: review.pageCount }),
    ...(review.pendingAcknowledged === undefined ? {} : { pendingAcknowledged: review.pendingAcknowledged }),
    ...(review.selectedSections === undefined ? {} : { selectedSections: review.selectedSections }),
    ...(review.skills === undefined ? {} : { skills: review.skills }),
    items: normalized,
    total,
    pending,
    accepted,
    ignored,
  };
}

function assertProfileId(value: unknown): string {
  if (typeof value !== "string" || !STRUCTURED_CV_PROFILE_ID_PATTERN.test(value)) {
    throw invalid("profileId is invalid");
  }
  return value;
}

function assertVersion(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw invalid("version is invalid");
  return value as number;
}

function idempotencyKey(value: string | undefined): string {
  if (value === undefined) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `structured-cv-${crypto.randomUUID()}`;
    }
    return `structured-cv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  if (!/^[A-Za-z0-9._~+/=-]{16,128}$/.test(value)) {
    throw invalid("Idempotency-Key is invalid");
  }
  return value;
}

function payloadWithinLimit(value: unknown): void {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > STRUCTURED_CV_MAX_PAYLOAD_BYTES) {
    throw new StructuredCvApiError("Profile payload is too large", "payload_too_large", 413);
  }
}

function mapError(status: number, payload: unknown): StructuredCvApiError {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const code = typeof body.code === "string" ? body.code.toLowerCase() : "";
  const message = typeof body.error === "string" ? body.error : "RIS structured CV request failed";
  if (status === 401) return new StructuredCvApiError(message, "unauthenticated", status);
  if (status === 403) return new StructuredCvApiError(message, "forbidden", status);
  if (status === 404) return new StructuredCvApiError(message, "not_found", status);
  if (status === 409) {
    if (code.includes("idempot")) return new StructuredCvApiError(message, "idempotency_conflict", status);
    if (code.includes("capacity")) return new StructuredCvApiError(message, "capacity_exceeded", status);
    return new StructuredCvApiError(message, "version_conflict", status);
  }
  if (status === 413) return new StructuredCvApiError(message, "payload_too_large", status);
  if (status === 428) return new StructuredCvApiError(message, "precondition_required", status);
  if (status === 422) return new StructuredCvApiError(message, "validation_error", status);
  if (status === 503) return new StructuredCvApiError(message, "storage_disabled", status);
  return new StructuredCvApiError(message, "unavailable", status);
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<{ data: T; etag: string | null }> {
  if (!isRisStructuredCvStorageEnabled()) {
    throw new StructuredCvApiError("Structured CV storage is disabled", "storage_disabled", 503);
  }
  if (!token) throw new StructuredCvApiError("Authentication is required", "unauthenticated", 401);
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if ((error instanceof Error && error.name === "AbortError")
        || (typeof error === "object" && error !== null
          && (error as { name?: unknown }).name === "AbortError")) {
      throw new StructuredCvApiError("Request was aborted", "aborted");
    }
    throw new StructuredCvApiError("RIS is unavailable", "unavailable");
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw mapError(response.status, payload);
  return { data: payload as T, etag: response.headers?.get("etag") ?? null };
}

function assertProfile(value: unknown): StructuredCvProfileV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StructuredCvApiError("RIS returned an invalid profile", "invalid_response");
  }
  const profile = value as Record<string, unknown>;
  if (profile.schemaVersion !== 1
      || typeof profile.profileId !== "string"
      || !STRUCTURED_CV_PROFILE_ID_PATTERN.test(profile.profileId)
      || typeof profile.version !== "number"
      || !Number.isInteger(profile.version)
      || profile.version < 1) {
    throw new StructuredCvApiError("RIS returned an incomplete profile", "invalid_response");
  }
  return value as StructuredCvProfileV1;
}

export async function listStructuredCvProfiles(
  token: string,
  options: { cursor?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<StructuredCvProfileList> {
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw invalid("limit is invalid");
  if (options.cursor !== undefined && (typeof options.cursor !== "string" || options.cursor.length > 2000)) {
    throw invalid("cursor is invalid");
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.cursor) params.set("cursor", options.cursor);
  const { data } = await request<StructuredCvProfileList>(
    `${STRUCTURED_CV_PROFILE_PATH}?${params.toString()}`, token, { method: "GET" }, options.signal,
  );
  if (!data || !Array.isArray(data.items)) {
    throw new StructuredCvApiError("RIS returned an invalid profile list", "invalid_response");
  }
  return {
    items: data.items,
    nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
  };
}

export async function getStructuredCvProfile(
  token: string,
  profileId: string,
  signal?: AbortSignal,
): Promise<StructuredCvProfileWithEtag> {
  const { data, etag } = await request<StructuredCvProfileV1>(
    `${STRUCTURED_CV_PROFILE_PATH}?id=${encodeURIComponent(assertProfileId(profileId))}`,
    token, { method: "GET" }, signal,
  );
  return { profile: assertProfile(data), etag };
}

export async function createStructuredCvProfile(
  token: string,
  input: StructuredCvCreateInput,
  options: { idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<StructuredCvProfileWithEtag> {
  assertNoIdentity(input);
  const name = validateCvBuilderProfileName(input.name);
  const template = validateCvBuilderTemplate(input.template);
  const body = {
    name,
    template,
    cvData: input.cvData,
    ...(input.importReview === undefined
      ? {}
      : { importReview: normalizeReview(input.importReview) }),
  };
  payloadWithinLimit(body);
  const key = idempotencyKey(options.idempotencyKey);
  const { data, etag } = await request<StructuredCvProfileV1>(
    STRUCTURED_CV_PROFILE_PATH, token,
    { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) },
    options.signal,
  );
  return { profile: assertProfile(data), etag };
}

export async function updateStructuredCvProfile(
  token: string,
  profileId: string,
  input: StructuredCvUpdateInput,
  options: { version: number; signal?: AbortSignal },
): Promise<StructuredCvProfileWithEtag> {
  assertNoIdentity(input);
  const version = assertVersion(options.version);
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = validateCvBuilderProfileName(input.name);
  if (input.template !== undefined) body.template = validateCvBuilderTemplate(input.template);
  if (input.cvData !== undefined) body.cvData = input.cvData;
  if (input.importReview !== undefined) {
    body.importReview = input.importReview === null
      ? null
      : normalizeReview(input.importReview);
  }
  payloadWithinLimit(body);
  const { data, etag } = await request<StructuredCvProfileV1>(
    `${STRUCTURED_CV_PROFILE_PATH}?id=${encodeURIComponent(assertProfileId(profileId))}`,
    token,
    { method: "PATCH", headers: { "If-Match": `"v${version}"` }, body: JSON.stringify(body) },
    options.signal,
  );
  return { profile: assertProfile(data), etag };
}

export async function deleteStructuredCvProfile(
  token: string,
  profileId: string,
  options: { version?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const version = options.version === undefined ? undefined : assertVersion(options.version);
  await request<null>(
    `${STRUCTURED_CV_PROFILE_PATH}?id=${encodeURIComponent(assertProfileId(profileId))}`,
    token,
    {
      method: "DELETE",
      ...(version === undefined ? {} : { headers: { "If-Match": `"v${version}"` } }),
    },
    options.signal,
  );
}

export async function exportStructuredCvProfile(
  token: string,
  profileId: string,
  signal?: AbortSignal,
): Promise<StructuredCvProfileExport> {
  const { data } = await request<StructuredCvProfileExport>(
    `${STRUCTURED_CV_PROFILE_PATH}?id=${encodeURIComponent(assertProfileId(profileId))}&action=export`,
    token, { method: "GET" }, signal,
  );
  if (!data || typeof data !== "object" || !("profile" in data)) {
    throw new StructuredCvApiError("RIS returned an invalid export", "invalid_response");
  }
  return data;
}

export async function getStructuredCvConsentStatus(
  token: string,
  signal?: AbortSignal,
): Promise<StructuredCvConsentState> {
  const { data } = await request<StructuredCvConsentState>(
    STRUCTURED_CV_CONSENT_PATH, token, { method: "GET" }, signal,
  );
  if (!data || typeof data !== "object") {
    throw new StructuredCvApiError("RIS returned an invalid consent status", "invalid_response");
  }
  return data;
}

export { normalizeReview as normalizeStructuredCvImportReview };
