import { describe, expect, it } from "vitest";
import {
  risConfig, risConsentConfig, risCvConfig, risCvBuilderProfilesConfig,
  risCvBuilderConsentConfig,
} from "../../api/_lib/ris/config.mjs";

const SHARED = {
  RIS_API_BASE_URL: "https://ris.example.invalid",
  RIS_PARTNER_CREDENTIAL: "test-credential",
  RIS_COGNITO_ISSUER: "https://issuer.example.invalid",
  RIS_COGNITO_CLIENT_ID: "test-client",
  RIS_TEST_USER_ALLOWLIST: "https://issuer.example.invalid|user-1",
  RIS_API_TIMEOUT_MS: "1234",
};

function env(overrides = {}) {
  return { ...SHARED, ...overrides };
}

describe("RIS consent/application activation separation", () => {
  it("beide deaktiviert", () => {
    const config = env({
      RIS_APPLICATION_STORAGE_ENABLED: "false",
      RIS_CONSENT_SERVICE_ENABLED: "false",
    });
    expect(risConfig(config)).toMatchObject({ enabled: false, error: "ris_disabled" });
    expect(risConsentConfig(config)).toMatchObject({ enabled: false, error: "consent_disabled" });
  });

  it("Consent ON, Applications OFF", () => {
    const config = env({
      RIS_APPLICATION_STORAGE_ENABLED: "false",
      RIS_CONSENT_SERVICE_ENABLED: "true",
    });
    expect(risConfig(config).enabled).toBe(false);
    const consent = risConsentConfig(config);
    expect(consent).toMatchObject({
      enabled: true,
      baseUrl: "https://ris.example.invalid",
      issuer: "https://issuer.example.invalid",
      clientId: "test-client",
      credential: "test-credential",
      path: "/v1/partner/me/consents",
      purpose: "application-storage",
      timeoutMs: 1234,
    });
    expect(consent.testUserAllowlist.has("https://issuer.example.invalid|user-1")).toBe(true);
  });

  it("Applications ON, Consent OFF", () => {
    const config = env({
      RIS_APPLICATION_STORAGE_ENABLED: "true",
      RIS_CONSENT_SERVICE_ENABLED: "false",
    });
    expect(risConfig(config)).toMatchObject({
      enabled: true,
      path: "/v1/partner/me/applications",
    });
    expect(risConsentConfig(config)).toMatchObject({
      enabled: false,
      error: "consent_disabled",
    });
  });

  it("beide aktiviert", () => {
    const config = env({
      RIS_APPLICATION_STORAGE_ENABLED: "true",
      RIS_CONSENT_SERVICE_ENABLED: "true",
    });
    expect(risConfig(config).enabled).toBe(true);
    expect(risConsentConfig(config).enabled).toBe(true);
  });

  it("Consent ON mit fehlenden gemeinsamen Verbindungsdaten", () => {
    const config = env({
      RIS_CONSENT_SERVICE_ENABLED: "true",
      RIS_API_BASE_URL: "",
    });
    expect(risConsentConfig(config)).toMatchObject({
      enabled: true,
      error: "missing_config",
    });
  });

  it("Applications ON mit fehlenden gemeinsamen Verbindungsdaten bleibt unverändert", () => {
    const config = env({
      RIS_APPLICATION_STORAGE_ENABLED: "true",
      RIS_COGNITO_CLIENT_ID: "",
    });
    expect(risConfig(config)).toMatchObject({
      enabled: true,
      error: "missing_config",
    });
  });

  it("CV uses a cold-start tolerant default when no timeout is configured", () => {
    const config = env({ RIS_CV_STORAGE_ENABLED: "true" });
    delete config.RIS_API_TIMEOUT_MS;
    expect(risCvConfig(config)).toMatchObject({
      enabled: true,
      path: "/v1/partner/me/cvs",
      timeoutMs: 25000,
    });
  });
});


describe("structured CV builder profile flags", () => {
  it("is off by default and uses the fixed RIS namespace when enabled", () => {
    expect(risCvBuilderProfilesConfig(env({}))).toMatchObject({
      enabled: false, error: "cv_builder_profile_storage_disabled",
    });
    expect(risCvBuilderProfilesConfig(env({
      RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED: "true",
    }))).toMatchObject({
      enabled: true, path: "/v1/partner/me/cv-builder-profiles",
    });
  });

  it("keeps consent configuration read-only and unmapped", () => {
    const config = env({
      RIS_CONSENT_SERVICE_ENABLED: "true",
      RIS_CV_BUILDER_CONSENT_NOTICE_VERSION: "structured-cv-profile-storage-2026-11-12-draft-1",
    });
    expect(risCvBuilderConsentConfig(config)).toMatchObject({
      enabled: true,
      purpose: "cv-builder-profile-storage",
      textApproved: false,
      syntheticTextAllowed: false,
      textMapped: false,
    });
  });
});
