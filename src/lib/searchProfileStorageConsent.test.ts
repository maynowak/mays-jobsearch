import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SEARCH_PROFILE_STORAGE_CONSENT_PARAGRAPHS,
  SEARCH_PROFILE_STORAGE_CONSENT_TEXT,
  SEARCH_PROFILE_STORAGE_CONSENT_TEXT_SHA256,
  SEARCH_PROFILE_STORAGE_CONSENT_TEXT_VERSION,
} from "./searchProfileStorageConsent";

describe("search-profile storage consent text", () => {
  it("has a stable v2 version and SHA-256", () => {
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT_VERSION).toBe(
      "search-profile-storage-consent-2026-11-08-v2"
    );
    const digest = createHash("sha256")
      .update(Buffer.from(SEARCH_PROFILE_STORAGE_CONSENT_TEXT, "utf8"))
      .digest("hex");
    expect(digest).toBe(SEARCH_PROFILE_STORAGE_CONSENT_TEXT_SHA256);
    expect(digest).toBe("75919c8bc219c938bdd2452a8bf02955997d1336ba2ca716bc691dd54eaa7ef6");
  });

  it("covers all three profile types, AWS storage and the AI boundary", () => {
    expect(SEARCH_PROFILE_STORAGE_CONSENT_PARAGRAPHS.join(" ")).toContain(
      "manuellen Suchprofile"
    );
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("CV-Suchprofile");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("ATS-Suchprofile");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("einschließlich AWS");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("keine KI-Anfrage");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("gesonderten Verarbeitungsbedingungen");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("Widerruf");
    expect(SEARCH_PROFILE_STORAGE_CONSENT_TEXT).toContain("Version 1.2");
  });
});
