import { useRef } from "react";
import { useLang } from "../i18n";
import type { CvDocument } from "../types";

interface Props {
  documents: CvDocument[];
  onSelect: (id: string, selected: boolean) => void;
  onRemove: (id: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onProcess: () => void;
  onSearch: () => void;
  disabled: boolean;
  processing: boolean;
}

export default function CvDocumentList({
  documents,
  onSelect,
  onRemove,
  onAddFiles,
  onProcess,
  onSearch,
  disabled,
  processing,
}: Props): React.ReactElement {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasSelection = documents.some((d) => d.selected);
  const allSelected = documents.length > 0 && documents.every((d) => d.selected);
  const selectedCount = documents.filter((d) => d.selected).length;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onAddFiles(files);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSelectAll = () => {
    if (allSelected) {
      documents.forEach((doc) => onSelect(doc.id, false));
    } else {
      documents.forEach((doc) => onSelect(doc.id, true));
    }
  };

  return (
    <div className="cv-document-list">
      <div className="cv-document-list__header">
        <h3 className="cv-document-list__title">{t("cv.documentListTitle")}</h3>
        {documents.length > 0 && (
          <button
            type="button"
            className="cv-document-list__select-all"
            onClick={handleSelectAll}
            disabled={disabled}
            aria-label={allSelected ? t("cv.deselectAll") : t("cv.selectAll")}
          >
            {allSelected ? t("cv.deselectAll") : t("cv.selectAll")}
          </button>
        )}
      </div>

      {documents.length > 0 && (
        <div className="cv-document-list__selection-info">
          {selectedCount > 0 ? t("cv.selectedCount", { count: selectedCount }) : t("cv.noneSelected")}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="cv-document-list__empty">
          <p>{t("cv.noDocuments")}</p>
          <label className="cv-file-input-label" htmlFor="cv-file-input">
            <span className="cv-file-input-label__text">{t("cv.documentSelect")}</span>
            <input
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
                    onChange={(e) => onSelect(doc.id, e.target.checked)}
                    disabled={disabled}
                    className="cv-document-list__checkbox"
                    aria-label={t("cv.documentSelect")}
                  />
                  <div className="cv-document-list__info">
                    {/* BUG-09: vollständiger Dateiname bei Hover über den Namen */}
                    <span className="cv-document-list__name" title={doc.name}>{doc.name}</span>
                    <span className="cv-document-list__size">
                      {(doc.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {/* BROWSER-BUG-21A: Readiness-Status je Dokument */}
                    <span className="cv-document-list__status">{t("cv.readyForProcessing")}</span>
                  </div>
                </div>
                <div className="cv-document-list__actions">
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
            {/* BUG-08: "Weitere CVs hochladen" nur solange das Limit (10) nicht erreicht ist */}
            {documents.length < 10 && (
              <button
                type="button"
                className="cv-file-input-label"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                <span className="cv-file-input-label__text">{t("cv.addMore")}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => handleFileSelect(e as React.ChangeEvent<HTMLInputElement>)}
                  disabled={disabled}
                  className="visually-hidden"
                />
              </button>
            )}
            <button
              type="button"
              className="cv-process-btn"
              onClick={onProcess}
              disabled={disabled || processing || !hasSelection}
            >
              {t("cv.processFiles")}
            </button>
            <button
              type="button"
              className="cv-search-btn"
              onClick={onSearch}
              disabled={disabled || processing || !hasSelection}
            >
              {t("cv.searchWithSelected")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}