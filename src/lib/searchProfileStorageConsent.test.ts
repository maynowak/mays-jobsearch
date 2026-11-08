import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SEARCH_PROFILE_STORAGE_CONSENT_PARAGRAPHS,
  SEARCH_PROFILE_STORAGE_CONSENT_TEXT,
  SEARCH_PROFILE_STORAGE_CONSENT_TEXT_SHA256,
  SEARCH_PROFILE_STORAGE_CONSENT_TEXT_VERSION,
} from "./searchProfileStorageConsent";

describe("search-profile storage consent text", () => {
  it("has a stable version and SHA-256", () => {
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT_VERSION).toBe(
      "search-profile-storage-consent-2026-11-08-v1"
    );
    const digest = createHash("sha256")
      .update(Buffer.from(SEARCH_PROFILE_STORAGE_CONSENT_TEXT, "utf8"))
      .digest("hex");
    expect(digest).toBe(SEARCH_PROFILE_STORAGE_CONSENT_TEXT_SHA256);
    expect(digest).toBe("926d1b9bbeefac4b97a5c51e3b6e6c1ed33a3affc3698e07456132be39b0f0f8");
  });

  it("covers all three profile types and excludes CV files and AI", () => {
    expect(SEARCH_PROFILE_STORAGE_CONSENT_PARAGRAPHS.join(" ")).toContain(
      "manuellen Suchprofile"
    );
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("CV-Suchprofile");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("ATS-Suchprofile");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("PDF-Dateien");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("keine KI-Anfrage");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("Widerruf");
  });
});
