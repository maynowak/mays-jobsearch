/**
 * Read-only consent readiness classification for structured CV storage.
 *
 * This module never grants, withdraws or invents a notice version. It only
 * projects the server-owned status into a UI-safe state for the later approved
 * consent flow.
 */

export type StructuredCvConsentReadiness =
  | "loading"
  | "error"
  | "missing"
  | "draft"
  | "granted"
  | "withdrawn"
  | "unknown";

export interface StructuredCvConsentStatusLike {
  loading?: boolean;
  error?: string | null;
  noticeState?: unknown;
  noticeApproved?: unknown;
  consent?: { status?: unknown } | null;
}

export function classifyStructuredCvConsent(
  state: StructuredCvConsentStatusLike | null | undefined,
): StructuredCvConsentReadiness {
  if (!state) return "missing";
  if (state.loading) return "loading";
  if (state.error) return "error";
  if (state.noticeState === "DRAFT" || state.noticeApproved !== true) return "draft";
  const status = state.consent?.status;
  if (status === "GRANTED") return "granted";
  if (status === "WITHDRAWN") return "withdrawn";
  if (status === "NOT_GRANTED") return "missing";
  return "unknown";
}

/** Writes require an existing granted consent under an approved notice. */
export function isStructuredCvConsentWritable(
  state: StructuredCvConsentStatusLike | null | undefined,
): boolean {
  return classifyStructuredCvConsent(state) === "granted";
}
