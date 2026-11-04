import { describe, expect, it } from "vitest";
import {
  STORAGE_CONSENT_BACKEND_AVAILABLE,
  STORAGE_CONSENT_BACKEND_UNAVAILABLE,
  STORAGE_CONSENT_PURPOSES,
  deriveStorageConsentOwner,
  isStorageConsentPurpose,
  isStorageConsentStatus,
} from "./storageConsent";

describe("JM-PROFILE-STORAGE-CONSENT-01: versioned storage consent contract", () => {
  it("derives an owner only from verified iss + sub claims", () => {
    expect(
      deriveStorageConsentOwner(true, {
        iss: "https://issuer.example.invalid",
        sub: "subject-1",
        email: "ignored@example.invalid",
      })
    ).toEqual({
      issuer: "https://issuer.example.invalid",
      subject: "subject-1",
    });
  });

  it("does not use email or incomplete claims as identity", () => {
    expect(
      deriveStorageConsentOwner(true, { email: "only-email@example.invalid" })
    ).toBeNull();
    expect(deriveStorageConsentOwner(true, { iss: "issuer-only" })).toBeNull();
    expect(deriveStorageConsentOwner(true, { sub: "subject-only" })).toBeNull();
    expect(deriveStorageConsentOwner(false, { iss: "issuer", sub: "subject" })).toBeNull();
  });

  it("keeps purposes independent and validates status values", () => {
    expect(STORAGE_CONSENT_PURPOSES).toEqual([
      "cv_storage",
      "application_storage",
      "search_profile_storage",
    ]);
    expect(isStorageConsentPurpose("cv_storage")).toBe(true);
    expect(isStorageConsentPurpose("other")).toBe(false);
    expect(isStorageConsentStatus("not_requested")).toBe(true);
    expect(isStorageConsentStatus("granted")).toBe(true);
    expect(isStorageConsentStatus("declined")).toBe(true);
    expect(isStorageConsentStatus("withdrawn")).toBe(true);
    expect(isStorageConsentStatus("reconsent_required")).toBe(true);
    expect(isStorageConsentStatus("unknown")).toBe(false);
  });

  it("keeps the productive backend explicitly unavailable", () => {
    expect(STORAGE_CONSENT_BACKEND_AVAILABLE).toBe(false);
    expect(STORAGE_CONSENT_BACKEND_UNAVAILABLE).toMatchObject({
      available: false,
      reason: "backend_unavailable",
    });
  });
});
