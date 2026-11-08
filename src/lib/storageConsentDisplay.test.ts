import { describe, expect, it } from "vitest";
import type { RisConsentStatus } from "./risConsentApi";
import {
  isApplicationStorageAvailable,
  isApplicationStorageGranted,
  storageConsentBadgeClassName,
  storageConsentBadgeKey,
  storageConsentNoticeKey,
  storageConsentPurposeStatusKey,
  storageConsentRisTextKey,
  storageConsentRisTitleKey,
  storageConsentSessionTextKey,
  type StorageConsentDisplayState,
} from "./storageConsentDisplay";

function state(
  overrides: Partial<StorageConsentDisplayState> = {}
): StorageConsentDisplayState {
  return {
    liveEnabled: true,
    loaded: true,
    error: false,
    status: "GRANTED" as RisConsentStatus,
    ...overrides,
  };
}

describe("storageConsentDisplay", () => {
  it("keeps preparation copy only while no live backend is enabled", () => {
    const display = state({ liveEnabled: false, loaded: false, error: false, status: "NOT_GRANTED" });
    expect(storageConsentBadgeKey(display)).toBe("privacyStorage.badge.preparing");
    expect(storageConsentNoticeKey(display)).toBe("privacyStorage.notice");
    expect(storageConsentPurposeStatusKey(display, "application_storage")).toBe(
      "privacyStorage.purpose.notGranted"
    );
    expect(storageConsentRisTitleKey(display)).toBe("privacyStorage.risTitle");
    expect(storageConsentSessionTextKey(display)).toBe("privacyStorage.sessionText");
    expect(isApplicationStorageAvailable(display)).toBe(false);
  });

  it("shows a checking state before the server response arrives", () => {
    const display = state({ loaded: false });
    expect(storageConsentBadgeKey(display)).toBe("privacyStorage.badge.checking");
    expect(storageConsentNoticeKey(display)).toBe("privacyStorage.notice.checking");
    expect(storageConsentPurposeStatusKey(display, "application_storage")).toBe(
      "privacyStorage.purpose.checking"
    );
    expect(storageConsentRisTitleKey(display)).toBe("privacyStorage.risTitle");
  });

  it("uses the granted server status for application storage", () => {
    const display = state();
    expect(isApplicationStorageAvailable(display)).toBe(true);
    expect(isApplicationStorageGranted(display)).toBe(true);
    expect(storageConsentBadgeKey(display)).toBe("privacyStorage.badge.active");
    expect(storageConsentBadgeClassName(display)).toBe("ui-badge ui-badge-active");
    expect(storageConsentNoticeKey(display)).toBe("privacyStorage.notice.active");
    expect(storageConsentPurposeStatusKey(display, "application_storage")).toBe(
      "privacyStorage.purpose.granted"
    );
    expect(storageConsentRisTitleKey(display)).toBe("privacyStorage.risTitle.active");
    expect(storageConsentRisTextKey(display)).toBe("privacyStorage.risText.active");
    expect(storageConsentSessionTextKey(display)).toBe("privacyStorage.sessionText.active");
  });

  it("keeps CV and search purposes session-only even when applications are active", () => {
    const display = state();
    expect(storageConsentPurposeStatusKey(display, "cv_storage")).toBe(
      "privacyStorage.purpose.notGranted"
    );
    expect(storageConsentPurposeStatusKey(display, "search_profile_storage")).toBe(
      "privacyStorage.purpose.notGranted"
    );
  });

  it("reports a withdrawal without falling back to preparation copy", () => {
    const display = state({ status: "WITHDRAWN" });
    expect(storageConsentBadgeKey(display)).toBe("privacyStorage.badge.actionRequired");
    expect(storageConsentNoticeKey(display)).toBe("privacyStorage.notice.withdrawn");
    expect(storageConsentPurposeStatusKey(display, "application_storage")).toBe(
      "privacyStorage.purpose.withdrawn"
    );
    expect(storageConsentRisTitleKey(display)).toBe("privacyStorage.risTitle.available");
    expect(storageConsentRisTextKey(display)).toBe("privacyStorage.risText.available");
  });

  it("reports an unavailable server status explicitly", () => {
    const display = state({ error: true, status: "NOT_GRANTED" });
    expect(storageConsentBadgeKey(display)).toBe("privacyStorage.badge.unavailable");
    expect(storageConsentNoticeKey(display)).toBe("privacyStorage.notice.unavailable");
    expect(storageConsentPurposeStatusKey(display, "application_storage")).toBe(
      "privacyStorage.purpose.unavailable"
    );
  });
});
