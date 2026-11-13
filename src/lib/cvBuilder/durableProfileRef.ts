/**
 * Session-only mapping between a local CV-builder profile id and a durable RIS
 * `profileId`. It deliberately contains no CV content and is never persisted.
 */

export type DurableProfileStatus =
  | "session-only"
  | "saving"
  | "durable"
  | "unsaved-changes"
  | "save-error"
  | "conflict";

export interface DurableProfileRef {
  localCvId: string;
  profileId: string;
  version: number;
  etag: string | null;
  status: DurableProfileStatus;
  idempotencyKey: string;
}

export const DURABLE_CV_PREFIX = "durable-";

export function durableCvId(profileId: string): string {
  return `${DURABLE_CV_PREFIX}${profileId}`;
}

export function isDurableCvId(cvId: string | null | undefined): boolean {
  return typeof cvId === "string" && cvId.startsWith(DURABLE_CV_PREFIX);
}

export function durableServerProfileId(cvId: string | null | undefined): string | null {
  return isDurableCvId(cvId)
    ? String(cvId).slice(DURABLE_CV_PREFIX.length)
    : null;
}
