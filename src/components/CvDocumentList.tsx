import { useRef } from "react";
import { useLang } from "../i18n";
import type { CvDocument } from "../types";

interface Props {
  documents: CvDocument[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddFiles: (files: FileList) => void;
  onProcess: () => void;
  disabled: boolean;
  processing: boolean;
}

export default function CvDocumentList({
  documents,
  onSelect,
  onRemove,
  onAddFiles,
  onProcess,
  disabled,
  processing,
}: Props): React.ReactElement {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onAddFiles(files);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="cv-document-list">
      <h3 className="cv-document-list__title">{t("cv.documentListTitle")}</h3>

      {documents.length === 0 ? (
        <div className="cv-document-list__empty">
          <p>{t("cv.noDocuments")}</p>
          <label className="cv-file-input-label" htmlFor="cv-file-input">
            <span className="cv-file-input-label__text">{t("cv.documentSelect")}</span>
            <input
              ref={inputRef}
              id="cv-file-input"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={(e) => handleFileSelect(e as React.ChangeEvent<HTMLInputElement>)}
              disabled={disabled}
              className="visually-hidden"
            />
          </label>
        </div>
      ) : (
        <>
          <ul className="cv-document-list__list" role="list">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className={`cv-document-list__item${doc.selected ? " selected" : ""}`}
                role="listitem"
              >
                <div className="cv-document-list__item-main">
                  <input
                    type="checkbox"
                    checked={doc.selected}
                    onChange={() => onSelect(doc.id)}
                    disabled={disabled}
                    className="cv-document-list__checkbox"
                    aria-label={t("cv.documentSelect")}
                  />
                  <div className="cv-document-list__info">
                    <span className="cv-document-list__name">{doc.name}</span>
                    <span className="cv-document-list__size">
                      {(doc.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                </div>
                <div className="cv-document-list__actions">
                  {doc.selected && (
                    <span className="cv-document-list__badge">{t("cv.documentSelected")}</span>
                  )}
                  <button
                    type="button"
                    className="cv-document-list__remove"
                    onClick={() => onRemove(doc.id)}
                    disabled={disabled}
                    aria-label={t("cv.removeFile")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cv-document-list__actions">
            <button
              type="button"
              className="cv-file-input-label"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              <span className="cv-file-input-label__text">{t("cv.documentSelect")}</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => handleFileSelect(e as React.ChangeEvent<HTMLInputElement>)}
                disabled={disabled}
                className="visually-hidden"
              />
            </button>
            <button
              type="button"
              className="cv-process-btn"
              onClick={onProcess}
              disabled={disabled || processing || !documents.some((d) => d.selected)}
            >
              {t("cv.processFiles")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

