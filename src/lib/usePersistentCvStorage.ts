import { useCallback, useEffect, useRef, useState } from "react";
import {
  CvStorageApiError,
  MAX_PERSISTENT_CVS,
  completeCvUpload,
  createCvDocument,
  deleteCvDocument,
  fetchCvConsent,
  getCvDownloadUrl,
  grantCvConsent as grantCvConsentApi,
  listCvDocuments,
  requestCvUpload,
  uploadCvBytes,
  withdrawCvConsent as withdrawCvConsentApi,
  type CvConsentState,
  type PersistentCv,
} from "./cvStorageApi";

export interface PersistentCvStorageState {
  enabled: boolean;
  loading: boolean;
  consentLoading: boolean;
  busy: boolean;
  documents: PersistentCv[];
  consent: CvConsentState | null;
  error: string | null;
  notice: string | null;
  refresh: () => Promise<void>;
  upload: (file: File) => Promise<boolean>;
  download: (cvId: string) => Promise<void>;
  remove: (cvId: string) => Promise<boolean>;
  grantConsent: () => Promise<boolean>;
  withdrawConsent: () => Promise<boolean>;
}

function messageOf(error: unknown): string {
  if (error instanceof CvStorageApiError) {
    if (error.code === "CV_STORAGE_CONSENT_REQUIRED") {
      return "Für die dauerhafte Speicherung ist die CV-Speicherfreigabe erforderlich.";
    }
    if (error.code === "upload_failed") {
      return "Der Lebenslauf konnte nicht zu RIS hochgeladen werden.";
    }
    if (error.status === 404) return "Der Lebenslauf wurde nicht gefunden.";
    if (error.status === 409) return "Der Lebenslauf wurde zwischenzeitlich geändert.";
    if (error.status === 422) return "Die Lebenslauf-Daten sind ungültig.";
    if (error.code === "test_user_not_allowed") {
      return "Dieser Account ist für die dauerhafte CV-Speicherung nicht freigeschaltet.";
    }
    if (error.code === "cv_storage_disabled") {
      return "Die dauerhafte CV-Speicherung ist derzeit deaktiviert.";
    }
    if (error.code === "missing_config") {
      return "Die dauerhafte CV-Speicherung ist serverseitig nicht konfiguriert.";
    }
    if (error.code === "unavailable" || error.status === 503) {
      return "Der CV-Dienst antwortet derzeit nicht rechtzeitig. Bitte erneut versuchen.";
    }
  }
  return "Die CV-Speicherfunktion ist derzeit nicht verfügbar.";
}

/**
 * Loads and mutates the durable CV documents through the existing RIS BFF.
 * Session-only uploads are never touched; this hook only manages the separate
 * persistent list.
 */
export function usePersistentCvStorage(
  token: string,
  enabled: boolean
): PersistentCvStorageState {
  const [documents, setDocuments] = useState<PersistentCv[]>([]);
  const [consent, setConsent] = useState<CvConsentState | null>(null);
  const [loading, setLoading] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generationRef = useRef(0);
  const uploadInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || !token) {
      setDocuments([]);
      setConsent(null);
      return;
    }
    const generation = generationRef.current;
    setLoading(true);
    setConsentLoading(true);
    setError(null);
    try {
      const [listResult, consentResult] = await Promise.allSettled([
        listCvDocuments(token),
        fetchCvConsent(token),
      ]);
      if (generation !== generationRef.current) return;
      if (listResult.status === "fulfilled") {
        setDocuments(listResult.value.items);
      } else {
        setError(messageOf(listResult.reason));
      }
      if (consentResult.status === "fulfilled") {
        setConsent(consentResult.value);
      } else {
        setError(messageOf(consentResult.reason));
      }
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
        setConsentLoading(false);
      }
    }
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !token) {
      setDocuments([]);
      setConsent(null);
      setLoading(false);
      setConsentLoading(false);
      setError(null);
      return;
    }
    generationRef.current += 1;
    void refresh();
    return () => {
      generationRef.current += 1;
    };
  }, [enabled, token, refresh]);

  const upload = useCallback(async (file: File): Promise<boolean> => {
    if (!enabled || !token) return false;
    if (consent?.consent?.status !== "GRANTED") {
      setError("Bitte erteile zuerst die CV-Speicherfreigabe.");
      return false;
    }
    if (documents.length >= MAX_PERSISTENT_CVS) {
      setError(`Maximal ${MAX_PERSISTENT_CVS} dauerhaft gespeicherte Lebensläufe sind erlaubt.`);
      return false;
    }
    if (uploadInFlightRef.current) return false;
    uploadInFlightRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(`„${file.name}“ wird dauerhaft gespeichert …`);
    try {
      const created = await createCvDocument(token, {
        filename: file.name,
        contentType: "application/pdf",
      });
      const ticket = await requestCvUpload(token, created.cvId);
      await uploadCvBytes(ticket, file);
      await completeCvUpload(token, created.cvId, ticket.documentId);
      setNotice(`„${file.name}“ wurde dauerhaft gespeichert.`);
      await refresh();
      return true;
    } catch (err) {
      const message = messageOf(err);
      setNotice(null);
      await refresh();
      // Keep the failed-upload reason visible; refresh() intentionally clears
      // stale list errors at its start.
      setError(message);
      return false;
    } finally {
      uploadInFlightRef.current = false;
      setBusy(false);
    }
  }, [consent?.consent?.status, documents.length, enabled, refresh, token]);

  const download = useCallback(async (cvId: string): Promise<void> => {
    if (!enabled || !token) return;
    setBusy(true);
    setError(null);
    try {
      const url = await getCvDownloadUrl(token, cvId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, [enabled, token]);

  const remove = useCallback(async (cvId: string): Promise<boolean> => {
    if (!enabled || !token) return false;
    setBusy(true);
    setError(null);
    try {
      await deleteCvDocument(token, cvId);
      await refresh();
      setNotice("Der gespeicherte Lebenslauf wurde gelöscht.");
      return true;
    } catch (err) {
      setError(messageOf(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [enabled, refresh, token]);

  const grantConsent = useCallback(async (): Promise<boolean> => {
    if (!enabled || !token) return false;
    setConsentLoading(true);
    setError(null);
    try {
      await grantCvConsentApi(token);
      await refresh();
      setNotice("Die CV-Speicherfreigabe wurde erteilt.");
      return true;
    } catch (err) {
      setError(messageOf(err));
      return false;
    } finally {
      setConsentLoading(false);
    }
  }, [enabled, refresh, token]);

  const withdrawConsent = useCallback(async (): Promise<boolean> => {
    if (!enabled || !token) return false;
    setConsentLoading(true);
    setError(null);
    try {
      await withdrawCvConsentApi(token);
      await refresh();
      setNotice("Die CV-Speicherfreigabe wurde widerrufen. Neue Uploads sind gesperrt.");
      return true;
    } catch (err) {
      setError(messageOf(err));
      return false;
    } finally {
      setConsentLoading(false);
    }
  }, [enabled, refresh, token]);

  return {
    enabled,
    loading,
    consentLoading,
    busy,
    documents,
    consent,
    error,
    notice,
    refresh,
    upload,
    download,
    remove,
    grantConsent,
    withdrawConsent,
  };
}
