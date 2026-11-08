import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CV_STORAGE_CONSENT_PARAGRAPHS,
  CV_STORAGE_CONSENT_TEXT,
  CV_STORAGE_CONSENT_TEXT_SHA256,
  CV_STORAGE_CONSENT_TEXT_VERSION,
  CV_STORAGE_SPECIAL_CATEGORIES,
} from "./cvStorageConsent";

describe("CV storage consent text", () => {
  it("has a stable canonical version and SHA-256", () => {
    expect(CV_STORAGE_CONSENT_TEXT_VERSION).toBe("cv-storage-consent-2026-11-08-v1");
    const digest = createHash("sha256")
      .update(Buffer.from(CV_STORAGE_CONSENT_TEXT, "utf8"))
      .digest("hex");
    expect(digest).toBe(CV_STORAGE_CONSENT_TEXT_SHA256);
    expect(digest).toBe("2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036");
  });

  it("is separate from ApplicationV1 and includes the Art. 9 categories", () => {
    expect(CV_STORAGE_CONSENT_PARAGRAPHS.length).toBeGreaterThan(3);
    expect(CV_STORAGE_SPECIAL_CATEGORIES).toContain("health");
    expect(CV_STORAGE_SPECIAL_CATEGORIES).toContain("sex_life");
    expect(CV_STORAGE_SPECIAL_CATEGORIES).toContain("sexual_orientation");
    expect(CV_STORAGE_CONSENT_TEXT).toContain("keine KI-Anfrage");
    expect(CV_STORAGE_CONSENT_TEXT).toContain("Widerruf");
  });
});
