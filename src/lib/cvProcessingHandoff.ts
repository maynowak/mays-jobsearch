import type { PersistentCv } from "./cvStorageApi";
import { MAX_PERSISTENT_CVS } from "./cvStorageApi";

export type PersistentCvProcessBlocker = "identity" | "consent" | "not-ready" | "capacity";

export interface PersistentCvProcessGuard {
  identityVerified: boolean;
  accessToken: string;
  storageEnabled: boolean;
  consentStatus: string | null | undefined;
}

/** Pure gate for the durable-CV handoff; keeps the App handler small and testable. */
export function persistentCvProcessBlocker(
  cv: Pick<PersistentCv, "processingStatus">,
  guard: PersistentCvProcessGuard,
  sessionDocumentCount: number
): PersistentCvProcessBlocker | null {
  if (!guard.identityVerified || !guard.accessToken) return "identity";
  if (!guard.storageEnabled || guard.consentStatus !== "GRANTED") return "consent";
  if (cv.processingStatus !== "ready") return "not-ready";
  if (sessionDocumentCount >= MAX_PERSISTENT_CVS) return "capacity";
  return null;
}
