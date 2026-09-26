import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { useLang } from "../i18n";

const MAX_PDF_SIZE = 10 * 1024 * 1024;

interface Props {
  onManual: () => void;
  // CV-UPLOAD-UX-01: Nach der lokalen Validierung startet die App direkt den
  // CV-Workflow (Pfad B) im Overlay — Einwilligung, Modellwahl, Anonymisierung
  // und Profil-Erstellung laufen dort einheitlich. Kein Inline-Consent und
  // keine Inline-Profil-Vorschau mehr in der Suchmaske (Overlap-Hotfix: die
  // Dateinamen-Anzeige ueberlappte den Consent-Rahmen).
  onWorkflowStart: (file: File) => void;
}

export default function CvUpload({ onManual, onWorkflowStart }: Props) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    const mimeOk = file.type === "application/pdf" || file.type === "";
    const extOk = file.name.toLowerCase().endsWith(".pdf");
    if (!mimeOk || !extOk) {
      setError(t("cv.notPdf"));
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError(t("cv.tooLarge"));
      return;
    }
    // Uebergabe an Pfad B: App legt das Dokument an, waehlt es aus und
    // oeffnet das Workflow-Overlay (Consent-Step zuerst). Text-Extraktion,
    // lokale Anonymisierung und Profil-Erstellung erfolgen dort.
    onWorkflowStart(file);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handleFile(file);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div id="cv-panel" className="cv-panel">
      <p className="cv-privacy">{t("cv.privacyNote")}</p>

      <label
        className={`cv-dropzone${dragOver ? " cv-dropzone-over" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={t("cv.uploadAction")}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="cv-dropzone-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 12v6" />
            <path d="M9 15l3-3 3 3" />
          </svg>
        </span>
        <span className="cv-dropzone-main">
          {dragOver ? t("cv.dropZoneOver") : t("cv.dropZone")}
        </span>
        <span className="cv-dropzone-status">{t("cv.dropZoneAlt")}</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleChange}
          className="visually-hidden"
        />
      </label>

      {error && (
        <p className="alert alert-error cv-error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="btn-ghost cv-manual" onClick={onManual}>
        {t("cv.manual")}
      </button>
    </div>
  );
}
