import { useCallback, useRef } from "react";
import { MAX_PERSISTENT_CVS } from "./cvStorageApi";
import type { PersistentCvStorageState } from "./usePersistentCvStorage";

export type CvBuilderPdfRisStatus =
  | "available"
  | "unauthenticated"
  | "unavailable"
  | "loading"
  | "consent-required"
  | "capacity";

export interface CvBuilderPdfRisStorage {
  status: CvBuilderPdfRisStatus;
  save: (file: File) => Promise<boolean>;
}

/**
 * Reuses the existing persistent CV storage state and upload path for a
 * builder-generated PDF. The builder never talks to RIS directly.
 */
export function useCvBuilderPdfRisStorage(
  storage: PersistentCvStorageState,
  identityVerified: boolean,
  identityKey: string | null
): CvBuilderPdfRisStorage {
  const identityKeyRef = useRef(identityKey);
  const saveInFlightRef = useRef(false);
  // Update during render so an old callback cannot start an upload after the
  // authenticated identity has changed while PDF generation was in flight.
  identityKeyRef.current = identityKey;

  const status: CvBuilderPdfRisStatus = !identityVerified
    ? "unauthenticated"
    : !storage.enabled
      ? "unavailable"
      : storage.loading || storage.consentLoading
        ? "loading"
        : storage.consent?.consent?.status !== "GRANTED"
          ? "consent-required"
          : storage.documents.length >= MAX_PERSISTENT_CVS
            ? "capacity"
            : "available";

  const save = useCallback(async (file: File): Promise<boolean> => {
    // The expected identity is captured when this callback is created. A
    // callback from a previous render must not start an upload for a newer or
    // logged-out identity, even if PDF generation finished later.
    const expectedIdentity = identityKey;
    if (saveInFlightRef.current) return false;
    if (identityKeyRef.current !== expectedIdentity) return false;
    if (status !== "available") return false;
    saveInFlightRef.current = true;
    try {
      const saved = await storage.upload(file);
      // A user switch while the upload was in flight must never be reported as
      // a successful save for the newly active identity.
      if (identityKeyRef.current !== expectedIdentity) return false;
      return saved;
    } catch {
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  }, [identityKey, status, storage.upload]);

  return { status, save };
}
