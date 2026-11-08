import type { RisConsentStatus } from "./risConsentApi";
import type { StorageConsentPurpose } from "./storageConsent";

/**
 * Server-backed display state for the storage consent area.
 *
 * Preparation copy is only correct while no live consent backend is available.
 * Once the live UI is enabled, the server response is the single source of
 * truth for the application-storage purpose; CV/search purposes remain
 * session-only until their own integrations exist.
 */
export interface StorageConsentDisplayState {
  liveEnabled: boolean;
  loaded: boolean;
  error: boolean;
  status: RisConsentStatus;
}

export function isApplicationStorageAvailable(state: StorageConsentDisplayState): boolean {
  return state.liveEnabled && state.loaded && !state.error;
}

export function isApplicationStorageGranted(state: StorageConsentDisplayState): boolean {
  return isApplicationStorageAvailable(state) && state.status === "GRANTED";
}

export function storageConsentBadgeKey(state: StorageConsentDisplayState): string {
  if (!state.liveEnabled) return "privacyStorage.badge.preparing";
  if (!state.loaded) return "privacyStorage.badge.checking";
  if (state.error) return "privacyStorage.badge.unavailable";
  if (state.status === "GRANTED") return "privacyStorage.badge.active";
  return "privacyStorage.badge.actionRequired";
}

export function storageConsentBadgeClassName(state: StorageConsentDisplayState): string {
  return isApplicationStorageGranted(state)
    ? "ui-badge ui-badge-active"
    : "ui-badge ui-badge-soon";
}

export function storageConsentNoticeKey(state: StorageConsentDisplayState): string {
  if (!state.liveEnabled) return "privacyStorage.notice";
  if (!state.loaded) return "privacyStorage.notice.checking";
  if (state.error) return "privacyStorage.notice.unavailable";
  if (state.status === "GRANTED") return "privacyStorage.notice.active";
  if (state.status === "WITHDRAWN") return "privacyStorage.notice.withdrawn";
  return "privacyStorage.notice.actionRequired";
}

export function storageConsentPurposeStatusKey(
  state: StorageConsentDisplayState,
  purpose: StorageConsentPurpose
): string {
  if (purpose !== "application_storage") return "privacyStorage.purpose.notGranted";
  if (!state.liveEnabled) return "privacyStorage.purpose.notGranted";
  if (!state.loaded) return "privacyStorage.purpose.checking";
  if (state.error) return "privacyStorage.purpose.unavailable";
  if (state.status === "GRANTED") return "privacyStorage.purpose.granted";
  if (state.status === "WITHDRAWN") return "privacyStorage.purpose.withdrawn";
  return "privacyStorage.purpose.pending";
}

export function storageConsentRisTitleKey(state: StorageConsentDisplayState): string {
  if (isApplicationStorageGranted(state)) return "privacyStorage.risTitle.active";
  if (isApplicationStorageAvailable(state)) return "privacyStorage.risTitle.available";
  return "privacyStorage.risTitle";
}

export function storageConsentRisTextKey(state: StorageConsentDisplayState): string {
  if (isApplicationStorageGranted(state)) return "privacyStorage.risText.active";
  if (isApplicationStorageAvailable(state)) return "privacyStorage.risText.available";
  return "privacyStorage.risText";
}

export function storageConsentSessionTextKey(state: StorageConsentDisplayState): string {
  return isApplicationStorageAvailable(state)
    ? "privacyStorage.sessionText.active"
    : "privacyStorage.sessionText";
}
