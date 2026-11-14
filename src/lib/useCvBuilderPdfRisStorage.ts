import { useCallback, useEffect, useRef } from "react";
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
  const identityEpochRef = useRef(0);
  const previousIdentityRef = useRef(identityKey);

  useEffect(() => {
    if (previousIdentityRef.current === identityKey) return;
    previousIdentityRef.current = identityKey;
    identityEpochRef.current += 1;
  }, [identityKey]);

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
    if (status !== "available") return false;
    const identityEpoch = identityEpochRef.current;
    try {
      const saved = await storage.upload(file);
      // A user switch while the upload was in flight must never be reported as
      // a successful save for the newly active identity.
      if (identityEpoch !== identityEpochRef.current) return false;
      return saved;
    } catch {
      return false;
    }
  }, [status, storage.upload]);

  return { status, save };
}
