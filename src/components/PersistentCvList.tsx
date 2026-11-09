import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import { fileSizeLocale, formatFileSize } from "../lib/fileSize";
import { validateCvFile } from "../lib/cvFileValidation";
import { MAX_PERSISTENT_CVS, type CvConsentState, type PersistentCv } from "../lib/cvStorageApi";

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
  onManageProfiles?: (cvId: string) => void;
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
  onManageProfiles,
}: Props) {
  const { t, lang } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [art9, setArt9] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const status = consent?.consent?.status ?? "NOT_GRANTED";
  const consentGranted = status === "GRANTED";
  const atCapacity = documents.length >= MAX_PERSISTENT_CVS;

  useEffect(() => {
    if (status !== "GRANTED") setArt9(false);
  }, [status]);

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
            <li key={cv.cvId} className="cv-document-list__item" role="listitem">
              <div className="cv-document-list__item-main">
                <div className="cv-document-list__info">
                  <span className="cv-document-list__name" title={cv.filename}>{cv.filename}</span>
                  {typeof cv.sizeBytes === "number" && (
                    <span className="cv-document-list__size">
                      {formatFileSize(cv.sizeBytes, fileSizeLocale(lang))}
                    </span>
                  )}
                  <span className="cv-document-list__status">{statusLabel(cv)}</span>
                </div>
              </div>
              <div className="cv-document-list__actions">
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
                  <>
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
                  </>
                ) : (
                  <button
                    type="button"
                    className="cv-document-list__remove"
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
