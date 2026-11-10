import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import { fileSizeLocale, formatFileSize } from "../lib/fileSize";
import { validateCvFile } from "../lib/cvFileValidation";
import { MAX_PERSISTENT_CVS, type CvConsentState, type PersistentCv } from "../lib/cvStorageApi";

export interface PersistentCvProfileCounts {
  searchProfiles: number;
  atsProfiles: number;
}

interface Props {
  documents: PersistentCv[];
  consent: CvConsentState | null;
  loading: boolean;
  consentLoading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onUpload: (file: File) => Promise<boolean>;
  onDownload: (cvId: string) => Promise<void>;
  onDelete: (cvId: string) => Promise<boolean>;
  onGrantConsent: () => Promise<boolean>;
  onWithdrawConsent: () => Promise<boolean>;
  onProcess?: (cv: PersistentCv) => Promise<void>;
  onManageProfiles?: (cvId: string) => void;
  onLoadProfileCounts?: (cvId: string) => Promise<PersistentCvProfileCounts | null>;
  profileCountsRefreshToken?: number;
}

export default function PersistentCvList({
  documents,
  consent,
  loading,
  consentLoading,
  busy,
  error,
  notice,
  onUpload,
  onDownload,
  onDelete,
  onGrantConsent,
  onWithdrawConsent,
  onProcess,
  onManageProfiles,
  onLoadProfileCounts,
  profileCountsRefreshToken = 0,
}: Props) {
  const { t, lang } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [art9, setArt9] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processedId, setProcessedId] = useState<string | null>(null);
  const [processError, setProcessError] = useState<{ cvId: string; message: string } | null>(null);
  const [profileCounts, setProfileCounts] = useState<Record<string, PersistentCvProfileCounts | null>>({});
  const [profileCountsLoading, setProfileCountsLoading] = useState<Record<string, boolean>>({});
  const [profileCountsError, setProfileCountsError] = useState<Record<string, boolean>>({});
  const profileCountsGenerationRef = useRef(0);
  const profileCountsRequestIdsRef = useRef<Record<string, number>>({});
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  const status = consent?.consent?.status ?? "NOT_GRANTED";
  const consentGranted = status === "GRANTED";
  const atCapacity = documents.length >= MAX_PERSISTENT_CVS;

  useEffect(() => {
    if (status !== "GRANTED") setArt9(false);
  }, [status]);

  const fetchProfileCounts = useCallback(async (cvId: string, generation: number) => {
    if (!onLoadProfileCounts) return;
    const requestId = (profileCountsRequestIdsRef.current[cvId] ?? 0) + 1;
    profileCountsRequestIdsRef.current[cvId] = requestId;
    setProfileCountsLoading((current) => ({ ...current, [cvId]: true }));
    setProfileCountsError((current) => ({ ...current, [cvId]: false }));
    try {
      const counts = await onLoadProfileCounts(cvId);
      if (generation !== profileCountsGenerationRef.current) return;
      if (profileCountsRequestIdsRef.current[cvId] !== requestId) return;
      if (!documentsRef.current.some((document) => document.cvId === cvId)) return;
      setProfileCounts((current) => ({ ...current, [cvId]: counts }));
    } catch {
      if (generation !== profileCountsGenerationRef.current) return;
      if (profileCountsRequestIdsRef.current[cvId] !== requestId) return;
      if (!documentsRef.current.some((document) => document.cvId === cvId)) return;
      setProfileCounts((current) => ({ ...current, [cvId]: null }));
      setProfileCountsError((current) => ({ ...current, [cvId]: true }));
    } finally {
      if (generation !== profileCountsGenerationRef.current) return;
      if (profileCountsRequestIdsRef.current[cvId] !== requestId) return;
      setProfileCountsLoading((current) => ({ ...current, [cvId]: false }));
    }
  }, [onLoadProfileCounts]);

  useEffect(() => {
    if (!onLoadProfileCounts || !consentGranted) {
      profileCountsGenerationRef.current += 1;
      setProfileCounts({});
      setProfileCountsLoading({});
      setProfileCountsError({});
      return;
    }
    const generation = profileCountsGenerationRef.current + 1;
    profileCountsGenerationRef.current = generation;
    const ids = documents.map((document) => document.cvId);
    setProfileCounts((current) => Object.fromEntries(ids.map((id) => [id, current[id] ?? null])));
    setProfileCountsLoading(Object.fromEntries(ids.map((id) => [id, true])));
    setProfileCountsError({});
    for (const id of ids) {
      void fetchProfileCounts(id, generation);
    }
    return () => {
      profileCountsGenerationRef.current += 1;
    };
  }, [consentGranted, documents, fetchProfileCounts, onLoadProfileCounts, profileCountsRefreshToken]);

  useEffect(() => {
    if (processingId && !documents.some((document) => document.cvId === processingId)) {
      setProcessingId(null);
    }
    if (processedId && !documents.some((document) => document.cvId === processedId)) {
      setProcessedId(null);
    }
    if (processError && !documents.some((document) => document.cvId === processError.cvId)) {
      setProcessError(null);
    }
  }, [documents, processedId, processError, processingId]);

  const processDocument = async (cv: PersistentCv) => {
    if (!onProcess || processingId || cv.processingStatus !== "ready") return;
    setProcessedId(null);
    setProcessError(null);
    setProcessingId(cv.cvId);
    try {
      await onProcess(cv);
      setProcessedId(cv.cvId);
    } catch (err) {
      setProcessError({
        cvId: cv.cvId,
        message: err instanceof Error && err.message ? err.message : t("cvStorage.processError"),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLocalError(null);
    const rejection = validateCvFile(file);
    if (rejection === "not-pdf") {
      setLocalError(t("cv.notPdf"));
      return;
    }
    if (rejection === "too-large") {
      setLocalError(t("cv.tooLarge"));
      return;
    }
    if (rejection === "empty") {
      setLocalError(t("cv.emptyFile"));
      return;
    }
    if (!consentGranted) {
      setLocalError(t("cvStorage.consentRequired"));
      return;
    }
    if (atCapacity) {
      setLocalError(t("cvStorage.capacityReached", { max: MAX_PERSISTENT_CVS }));
      return;
    }
    await onUpload(file);
  };

  const statusLabel = (cv: PersistentCv): string => {
    switch (cv.processingStatus) {
      case "ready": return t("cvStorage.ready");
      case "pending": return t("cvStorage.pending");
      case "failed": return t("cvStorage.failed");
      case "deleted": return t("cvStorage.deleted");
      default: return cv.processingStatus;
    }
  };

  return (
    <div className="cv-document-list cv-storage-persistent">
      <div className="cv-document-list__header">
        <h3 className="cv-document-list__title">{t("cvStorage.title")}</h3>
        <span className="ui-badge ui-badge-active">{statusLabelFromStatus(status, t)}</span>
      </div>
      <p className="field-hint">{t("cvStorage.persistentHint")}</p>

      <section className="cv-storage-consent" aria-labelledby="cv-storage-consent-title">
        <h4 id="cv-storage-consent-title">{t("cvStorage.consentTitle")}</h4>
        <p className="field-hint">{t("cvStorage.consentHint")}</p>
        <p role="status">
          {t("cvStorage.status")}: <strong>{statusLabelFromStatus(status, t)}</strong>
        </p>
        {!consentGranted && (
          <>
            <label className="cv-storage-consent__checkbox">
              <input
                type="checkbox"
                checked={art9}
                disabled={busy || consentLoading || consent?.grantAllowed !== true}
                onChange={(event) => setArt9(event.target.checked)}
              />
              <span>{t("cvStorage.consentCheckbox")}</span>
            </label>
            {consent && consent.grantAllowed !== true && (
              <p className="field-hint" role="note">{t("cvStorage.unavailable")}</p>
            )}
            <button
              type="button"
              className="btn-ghost"
              disabled={!art9 || busy || consentLoading || consent?.grantAllowed !== true}
              onClick={() => { void onGrantConsent(); }}
            >
              {t("cvStorage.grant")}
            </button>
          </>
        )}
        {consentGranted && (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || consentLoading}
            onClick={() => { void onWithdrawConsent(); }}
          >
            {t("cvStorage.withdraw")}
          </button>
        )}
      </section>

      {(error || localError) && (
        <p className="alert alert-error" role="alert">{localError ?? error}</p>
      )}
      {notice && <p className="field-hint" role="status">{notice}</p>}

      <div className="cv-document-list__input-host" aria-hidden="true">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileSelect}
          disabled={busy || !consentGranted || atCapacity}
          className="visually-hidden"
        />
      </div>

      {consentGranted && (
        <div className="cv-document-list__actions">
          <button
            type="button"
            className="cv-file-input-label"
            onClick={() => inputRef.current?.click()}
            disabled={busy || atCapacity}
          >
            <span className="cv-file-input-label__text">{t("cvStorage.upload")}</span>
          </button>
          <p className="field-hint">
            {atCapacity
              ? t("cvStorage.capacityReached", { max: MAX_PERSISTENT_CVS })
              : t("cvStorage.uploadHint")}
          </p>
        </div>
      )}

      {loading ? (
        <p className="field-hint" role="status">{t("cvStorage.loading")}</p>
      ) : documents.length === 0 ? (
        <p className="cv-document-list__empty">{t("cvStorage.empty")}</p>
      ) : (
        <ul className="cv-document-list__list" role="list">
          {documents.map((cv) => (
            <li key={cv.cvId} className="cv-storage-card" role="listitem">
              <div className="cv-storage-card__head">
                <div className="cv-storage-card__identity">
                  <span className="cv-storage-card__name" title={cv.filename}>{cv.filename}</span>
                  <span className="cv-storage-card__meta">
                    {typeof cv.sizeBytes === "number" && (
                      <span>{formatFileSize(cv.sizeBytes, fileSizeLocale(lang))}</span>
                    )}
                    <span>{t("cvStorage.locationRis")}</span>
                  </span>
                </div>
                <span className="ui-badge ui-badge-active">{t("cvStorage.persistentBadge")}</span>
              </div>
              <dl className="cv-storage-card__facts">
                <div>
                  <dt>{t("cvStorage.pdfStatus")}</dt>
                  <dd>{statusLabel(cv)}</dd>
                </div>
                {onLoadProfileCounts && consentGranted && (
                  <div className="cv-storage-card__profiles-fact">
                    <dt>{t("cvStorage.profileSummaryLabel")}</dt>
                    <dd role="status" aria-live="polite">
                      {profileCountsLoading[cv.cvId] ? (
                        t("cvStorage.profileCountsLoading")
                      ) : profileCountsError[cv.cvId] ? (
                        <>
                          <span>{t("cvStorage.profileCountsError")} </span>
                          <button
                            type="button"
                            className="cv-storage-card__retry"
                            onClick={() => {
                              void fetchProfileCounts(cv.cvId, profileCountsGenerationRef.current);
                            }}
                          >
                            {t("cvStorage.retry")}
                          </button>
                        </>
                      ) : profileCounts[cv.cvId] ? (
                        profileCounts[cv.cvId]!.searchProfiles === 0 &&
                        profileCounts[cv.cvId]!.atsProfiles === 0
                          ? t("cvStorage.profileCountsEmpty")
                          : [
                              profileCounts[cv.cvId]!.searchProfiles === 1
                                ? t("cvStorage.searchProfileOne")
                                : t("cvStorage.searchProfileMany", {
                                    count: profileCounts[cv.cvId]!.searchProfiles,
                                  }),
                              profileCounts[cv.cvId]!.atsProfiles === 1
                                ? t("cvStorage.atsProfileOne")
                                : t("cvStorage.atsProfileMany", {
                                    count: profileCounts[cv.cvId]!.atsProfiles,
                                  }),
                            ].join(" · ")
                      ) : (
                        t("cvStorage.profileCountsUnavailable")
                      )}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="cv-storage-card__note">{t("cvStorage.verificationNote")}</p>
              <div className="cv-storage-card__actions">
                {onProcess && (
                  <button
                    type="button"
                    className="cv-process-btn"
                    disabled={busy || processingId !== null || !consentGranted || cv.processingStatus !== "ready"}
                    aria-label={`${t("cvStorage.process")} ${cv.filename}`}
                    aria-busy={processingId === cv.cvId || undefined}
                    onClick={() => { void processDocument(cv); }}
                  >
                    {processingId === cv.cvId ? t("cvStorage.processing") : t("cvStorage.process")}
                  </button>
                )}
                {onManageProfiles && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy || cv.processingStatus !== "ready"}
                    onClick={() => onManageProfiles(cv.cvId)}
                  >
                    {t("searchProfiles.manage")}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy || cv.processingStatus !== "ready"}
                  onClick={() => { void onDownload(cv.cvId); }}
                >
                  {t("cvStorage.download")}
                </button>
                {removeId === cv.cvId ? (
                  <span className="cv-storage-card__secondary">
                    <button
                      type="button"
                      className="cv-document-list__remove-data-confirm-btn"
                      disabled={busy}
                      onClick={async () => {
                        if (await onDelete(cv.cvId)) setRemoveId(null);
                      }}
                    >
                      {t("cvStorage.deleteYes")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setRemoveId(null)}>
                      {t("cvStorage.cancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="cv-document-list__remove cv-storage-card__secondary"
                    aria-label={t("cvStorage.delete")}
                    title={t("cvStorage.delete")}
                    disabled={busy}
                    onClick={() => setRemoveId(cv.cvId)}
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {processedId && (
        <p className="field-hint cv-storage-process-status" role="status">
          {t("cvStorage.processSuccess")}
        </p>
      )}
      {processError && (
        <div className="cv-storage-process-status" role="alert">
          <p className="alert alert-error">{processError.message}</p>
          <button
            type="button"
            className="btn-ghost"
            disabled={processingId !== null}
            onClick={() => {
              const cv = documents.find((document) => document.cvId === processError.cvId);
              if (cv) void processDocument(cv);
            }}
          >
            {t("cvStorage.processRetry")}
          </button>
        </div>
      )}
      {!consentGranted && documents.some((cv) => cv.processingStatus === "ready") && (
        <p className="field-hint">{t("cvStorage.processConsentRequired")}</p>
      )}
      {removeId && (
        <p className="field-hint" role="alertdialog" aria-label={t("cvStorage.delete")}>
          {t("cvStorage.deleteConfirm")}
        </p>
      )}
    </div>
  );
}

function statusLabelFromStatus(status: string, t: (key: string) => string): string {
  if (status === "GRANTED") return t("cvStorage.status.granted");
  if (status === "WITHDRAWN") return t("cvStorage.status.withdrawn");
  return t("cvStorage.status.notGranted");
}
