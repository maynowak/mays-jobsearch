import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  STORAGE_CONSENT_BACKEND_AVAILABLE,
  STORAGE_CONSENT_BACKEND_UNAVAILABLE,
  STORAGE_CONSENT_PURPOSES,
  deriveStorageConsentOwner,
  isStorageConsentPurpose,
  isStorageConsentStatus,
} from "./storageConsent";
import {
  APPLICATION_STORAGE_CONSENT_PARAGRAPHS,
  APPLICATION_STORAGE_CONSENT_PRIVACY_POLICY_VERSION,
  APPLICATION_STORAGE_CONSENT_PURPOSE,
  APPLICATION_STORAGE_CONSENT_RIS_NOTICE_VERSION,
  APPLICATION_STORAGE_CONSENT_STATE,
  APPLICATION_STORAGE_CONSENT_TEXT,
  APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
  APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
} from "./applicationStorageConsent";

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

describe("APPLICATION-STORAGE consent text (candidate)", () => {
  it("binds the canonical text to its paragraph array", () => {
    expect(APPLICATION_STORAGE_CONSENT_TEXT).toBe(
      APPLICATION_STORAGE_CONSENT_PARAGRAPHS.join("\n\n")
    );
    expect(APPLICATION_STORAGE_CONSENT_TEXT_VERSION).toBe(
      "application-storage-consent-2026-11-07-v1"
    );
    expect(APPLICATION_STORAGE_CONSENT_PURPOSE).toBe("application-storage");
    expect(APPLICATION_STORAGE_CONSENT_RIS_NOTICE_VERSION).toBe("1.0");
    expect(APPLICATION_STORAGE_CONSENT_PRIVACY_POLICY_VERSION).toBe("1.1");
    expect(APPLICATION_STORAGE_CONSENT_STATE).toBe("DRAFT");
  });

  it("publishes the exact SHA-256 of the canonical UTF-8 text", () => {
    const digest = createHash("sha256")
      .update(APPLICATION_STORAGE_CONSENT_TEXT, "utf8")
      .digest("hex");
    expect(digest).toBe(APPLICATION_STORAGE_CONSENT_TEXT_SHA256);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("covers the required declaration topics without inventing approvals", () => {
    const text = APPLICATION_STORAGE_CONSENT_TEXT;
    expect(text).toContain("Bewerbungen mit Stellenbezug");
    expect(text).toContain("Anschreiben-Versionen");
    expect(text).toContain("Dokumentstatus");
    expect(text).toContain("CV- und Suchprofile");
    expect(text).toContain("Kontaktangaben");
    expect(text).toContain("Notizen");
    expect(text).toContain("Gehaltsvorstellung");
    expect(text).toContain("Wiedervorlagen");
    expect(text).toContain("PDF-Dateien");
    expect(text).toContain("RIS-/AWS-Infrastruktur");
    expect(text).toContain("keine KI-Analyse");
    expect(text).toContain("widerrufen");
    expect(text).toContain("neue abhängige Schreibzugriffe");
    expect(text).toContain("nicht automatisch eine sofortige physische Löschung");
    expect(text).toContain("keine pauschale Aufbewahrungsfrist");
    expect(text).toContain("Sicherungen");
    expect(text).toContain("gesetzliche Aufbewahrungspflichten");
    expect(text).toContain("/datenschutz");
    expect(text).toContain("Datenschutzrichtlinie Version 1.1");
    // No invented legal approval, retention period, transfer or Art. 6 claim.
    expect(text).not.toMatch(/Art\.\s*6/);
    expect(text).not.toMatch(/legalApprovalRef/);
    expect(text).not.toMatch(/freigegeben am/);
    expect(text).not.toMatch(/Drittland/);
  });
});
