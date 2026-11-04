import { deriveAuthProfileKey, isVerifiedAuthProfileKey, type AuthIdentityClaims } from "./authIdentity";

/**
 * JM-PROFILE-STORAGE-CONSENT-01
 *
 * Versioned contract for optional, purpose-specific durable storage consent.
 *
 * This module is intentionally client-safe and does NOT persist anything. The
 * productive consent service is a future server/RIS responsibility. Until that
 * service is verified, the UI must remain in preparation mode and must never
 * present a local checkbox or timestamp as a durable consent proof.
 */
export const STORAGE_CONSENT_SCHEMA_VERSION = 1 as const;
export const STORAGE_CONSENT_TEXT_VERSION = "2026-11-04-draft-1" as const;
export const STORAGE_CONSENT_PRIVACY_NOTICE_VERSION = "2026-11-04-draft-1" as const;

export const STORAGE_CONSENT_PURPOSES = [
  "cv_storage",
  "application_storage",
  "search_profile_storage",
] as const;

export type StorageConsentPurpose = (typeof STORAGE_CONSENT_PURPOSES)[number];

export type StorageConsentStatus =
  | "not_requested"
  | "granted"
  | "declined"
  | "withdrawn"
  | "reconsent_required";

export interface StorageConsentOwnerV1 {
  /** Verified OIDC issuer. Never inferred from configuration or email. */
  issuer: string;
  /** Verified OIDC subject. Never replaced by email. */
  subject: string;
}

export interface StorageConsentDecisionV1 {
  purpose: StorageConsentPurpose;
  status: StorageConsentStatus;
  /** Server-issued decision timestamp; never trusted from the browser. */
  decidedAt?: string;
  consentTextVersion: string;
  privacyNoticeVersion: string;
  /** Server-issued withdrawal timestamp, if withdrawn. */
  withdrawnAt?: string;
}

export interface StorageConsentRecordV1 {
  schemaVersion: typeof STORAGE_CONSENT_SCHEMA_VERSION;
  owner: StorageConsentOwnerV1;
  decisions: StorageConsentDecisionV1[];
}

/**
 * Audit evidence must not contain CV text, cover-letter text or other document
 * contents. It only records the purpose, status, versions and server timestamps.
 */
export interface StorageConsentAuditEventV1 {
  eventId: string;
  owner: StorageConsentOwnerV1;
  purpose: StorageConsentPurpose;
  status: StorageConsentStatus;
  occurredAt: string;
  consentTextVersion: string;
  privacyNoticeVersion: string;
}

/** The productive service is not available in this repository yet. */
export const STORAGE_CONSENT_BACKEND_AVAILABLE = false;

export interface StorageConsentBackendUnavailableV1 {
  available: false;
  reason: "backend_unavailable";
  consentTextVersion: typeof STORAGE_CONSENT_TEXT_VERSION;
  privacyNoticeVersion: typeof STORAGE_CONSENT_PRIVACY_NOTICE_VERSION;
}

export const STORAGE_CONSENT_BACKEND_UNAVAILABLE: StorageConsentBackendUnavailableV1 = {
  available: false,
  reason: "backend_unavailable",
  consentTextVersion: STORAGE_CONSENT_TEXT_VERSION,
  privacyNoticeVersion: STORAGE_CONSENT_PRIVACY_NOTICE_VERSION,
};

/**
 * Derives an owner only from a verified `iss + sub` identity. Email is never
 * used as a substitute. Missing or unverified claims return null.
 */
export function deriveStorageConsentOwner(
  isAuthenticated: boolean,
  claims: AuthIdentityClaims | null | undefined
): StorageConsentOwnerV1 | null {
  const key = deriveAuthProfileKey(isAuthenticated, claims);
  if (!isVerifiedAuthProfileKey(key)) return null;
  const issuer = typeof claims?.iss === "string" ? claims.iss.trim() : "";
  const subject = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  if (!issuer || !subject) return null;
  return { issuer, subject };
}

export function isStorageConsentPurpose(value: unknown): value is StorageConsentPurpose {
  return typeof value === "string" && STORAGE_CONSENT_PURPOSES.includes(value as StorageConsentPurpose);
}

export function isStorageConsentStatus(value: unknown): value is StorageConsentStatus {
  return (
    value === "not_requested" ||
    value === "granted" ||
    value === "declined" ||
    value === "withdrawn" ||
    value === "reconsent_required"
  );
}
