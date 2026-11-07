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
  APPLICATION_STORAGE_CONSENT_TEXT_HISTORY,
  APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
  APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
  APPLICATION_STORAGE_SPECIAL_CATEGORIES,
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
  it("publishes the stable Art. 9 category codes", () => {
    expect(APPLICATION_STORAGE_SPECIAL_CATEGORIES).toEqual([
      "health",
      "religious_or_philosophical_beliefs",
      "trade_union_membership",
      "political_opinions",
      "sexual_orientation",
      "sex_life",
      "biometric_data",
      "genetic_data",
      "racial_or_ethnic_origin",
    ]);
  });

  it("binds the canonical text to its paragraph array", () => {
    expect(APPLICATION_STORAGE_CONSENT_TEXT).toBe(
      APPLICATION_STORAGE_CONSENT_PARAGRAPHS.join("\n\n")
    );
    expect(APPLICATION_STORAGE_CONSENT_TEXT_VERSION).toBe(
      "application-storage-consent-2026-11-07-v4"
    );
    expect(APPLICATION_STORAGE_CONSENT_PURPOSE).toBe("application-storage");
    expect(APPLICATION_STORAGE_CONSENT_RIS_NOTICE_VERSION).toBe("1.0");
    expect(APPLICATION_STORAGE_CONSENT_PRIVACY_POLICY_VERSION).toBe("1.1");
    expect(APPLICATION_STORAGE_CONSENT_STATE).toBe("DRAFT");
  });

  it("keeps the superseded candidates as history with their own hashes", () => {
    expect(APPLICATION_STORAGE_CONSENT_TEXT_HISTORY).toEqual([
      {
        version: "application-storage-consent-2026-11-07-v3",
        sha256: "696f9e66d8098b2dce56a93418ba598145b669934662e2b52d9a332731517668",
        state: "DRAFT",
      },
      {
        version: "application-storage-consent-2026-11-07-v2",
        sha256: "232cc8206261b5d14f7a269f63a58320f76eea435a65f7e039b25c62d26da0ca",
        state: "DRAFT",
      },
      {
        version: "application-storage-consent-2026-11-07-v1",
        sha256: "2615314738ca991f232314529d0bd473585758b4d1dd4b780f29bcc4c5289953",
        state: "DRAFT",
      },
    ]);
    expect(APPLICATION_STORAGE_CONSENT_TEXT_HISTORY.map((entry) => entry.version)).not.toContain(
      APPLICATION_STORAGE_CONSENT_TEXT_VERSION
    );
    expect(APPLICATION_STORAGE_CONSENT_TEXT_HISTORY.map((entry) => entry.sha256)).not.toContain(
      APPLICATION_STORAGE_CONSENT_TEXT_SHA256
    );
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
    expect(text).toContain("Bewerbungsstatus");
    expect(text).toContain("Statusänderungen");
    expect(text).toContain("Statusverlauf");
    expect(text).toContain("Art. 9 Abs. 2 lit. a DSGVO");
    expect(text).toContain("besondere Kategorien personenbezogener Daten");
    expect(text).toContain("ausdrücklich");
    expect(text).toContain("freiwillig");
    expect(text).toContain("widerrufen");
    expect(text).toContain("Gesundheitsdaten");
    expect(text).toContain("religiösen oder weltanschaulichen Überzeugungen");
    expect(text).toContain("Gewerkschaftszugehörigkeit");
    expect(text).toContain("politische Meinungen");
    expect(text).toContain("sexuelle Orientierung");
    expect(text).toContain("Sexualleben");
    expect(text).toContain("keine Zuordnung zu einer bestimmten Kategorie");
    expect(text).toContain("keine Offenlegung, ob solche Daten überhaupt vorliegen");
    expect(text).toContain("automatische Kategorisierung oder Ableitung von Geschlecht");
    expect(text).toContain("Geschlechtsidentität");
    expect(text).toContain("biometrische Daten");
    expect(text).toContain("genetische Daten");
    expect(text).toContain("rassischen oder ethnischen Herkunft");
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
