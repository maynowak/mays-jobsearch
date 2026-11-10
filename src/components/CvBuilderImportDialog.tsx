import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import type { PersistentCv } from "../lib/cvStorageApi";
import { validateCvFile } from "../lib/cvFileValidation";
import { extractPdfText } from "../lib/pdf";
import type { CvBuilderDraftV1 } from "../lib/cvBuilder/contractTypes";
import {
  CV_BUILDER_IMPORT_SECTIONS,
  hasCvBuilderImportContent,
  parseCvBuilderImportText,
  selectCvBuilderImportDraft,
  type CvBuilderImportResult,
  type CvBuilderImportSectionId,
} from "../lib/cvBuilder/pdfImport";
import MayHelp from "./MayHelp";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreateEmpty: () => void;
  risAvailable: boolean;
  risLoading?: boolean;
  persistentCvs: PersistentCv[];
  onDownloadRis: (cv: PersistentCv) => Promise<File>;
  onImported: (draft: CvBuilderDraftV1, sourceName: string) => void;
}

type ImportStep = "source" | "loading" | "preview";

function importErrorKey(error: unknown): string {
  if (error && typeof error === "object") {
    const name = String((error as { name?: string }).name ?? "");
    const code = String((error as { code?: string }).code ?? "");
    if (name === "PasswordException" || code === "password") return "cvBuilder.import.errorPassword";
    if (name === "InvalidPDFException" || code === "invalid_pdf") return "cvBuilder.import.errorInvalid";
    if (code === "no_text") return "cvBuilder.import.errorNoText";
    if (code === "no_structure") return "cvBuilder.import.errorNoStructure";
    if (code === "download_failed") return "cvBuilder.import.errorDownload";
    if (code === "session_ended") return "cvBuilder.import.errorSession";
  }
  return "cvBuilder.import.errorGeneric";
}

function sectionSummary(
  result: CvBuilderImportResult,
  section: CvBuilderImportSectionId,
  t: (key: string, vars?: Record<string, string | number>) => string
): string[] {
  const draft = result.draft;
  switch (section) {
    case "personal":
      return [
        draft.personal.fullName,
        draft.personal.email,
        draft.personal.phone,
        draft.personal.location,
      ].filter((value): value is string => Boolean(value));
    case "profile":
      return [draft.profile.headline, draft.profile.summary].filter((value): value is string => Boolean(value));
    case "experience":
      return draft.experience.map((entry) => {
        const period = [entry.startMonth, entry.current ? t("cvBuilder.preview.present") : entry.endMonth]
          .filter(Boolean)
          .join(" – ");
        return [entry.position, entry.employer, period].filter(Boolean).join(" · ");
      });
    case "education":
      return draft.education.map((entry) => {
        const period = [entry.startMonth, entry.current ? t("cvBuilder.preview.present") : entry.endMonth]
          .filter(Boolean)
          .join(" – ");
        return [entry.degree, entry.institution, period].filter(Boolean).join(" · ");
      });
    case "skills":
      return draft.skills;
    case "projects":
      return draft.projects.map((entry) => [
        entry.name,
        entry.technologies.length ? entry.technologies.join(", ") : "",
      ].filter(Boolean).join(" · "));
    case "certificates":
      return draft.certificates.map((entry) =>
        [entry.name, entry.issuer, entry.date].filter(Boolean).join(" · ")
      );
    case "languages":
      return draft.languages.map((entry) =>
        `${entry.language} · ${t(`cvBuilder.level.${entry.level}`)}`
      );
    case "links":
      return draft.links.map((entry) => `${entry.label}: ${entry.url}`);
    default:
      return [];
  }
}

export default function CvBuilderImportDialog({
  open,
  onClose,
  onCreateEmpty,
  risAvailable,
  risLoading = false,
  persistentCvs,
  onDownloadRis,
  onImported,
}: Props) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [step, setStep] = useState<ImportStep>("source");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvBuilderImportResult | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [selected, setSelected] = useState<Set<CvBuilderImportSectionId>>(new Set());
  const [includeUnrecognized, setIncludeUnrecognized] = useState(false);
  const [selectedRisId, setSelectedRisId] = useState("");
  const [busyRisId, setBusyRisId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("source");
    setError(null);
    setResult(null);
    setSourceName("");
    setSelected(new Set());
    setIncludeUnrecognized(false);
    setBusyRisId(null);
    setSelectedRisId(persistentCvs[0]?.cvId ?? "");
    window.setTimeout(() => headingRef.current?.focus(), 0);
    // Reset only when the dialog opens; document updates must not discard a
    // preview that is already being reviewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedRisId((current) => {
      if (persistentCvs.some((cv) => cv.cvId === current)) return current;
      return persistentCvs[0]?.cvId ?? "";
    });
  }, [open, persistentCvs]);

  const parseFile = async (file: File, name: string) => {
    const rejection = validateCvFile(file);
    if (rejection) {
      setError(t(
        rejection === "not-pdf"
          ? "cvBuilder.import.errorNotPdf"
          : rejection === "too-large"
            ? "cvBuilder.import.errorTooLarge"
            : "cvBuilder.import.errorEmpty"
      ));
      return;
    }
    setBusy(true);
    setError(null);
    setStep("loading");
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        const noText = new Error("no_text") as Error & { code: string };
        noText.code = "no_text";
        throw noText;
      }
      const parsed = parseCvBuilderImportText(text);
      if (!CV_BUILDER_IMPORT_SECTIONS.some((section) => hasCvBuilderImportContent(parsed, section))) {
        const noStructure = new Error("no_structure") as Error & { code: string };
        noStructure.code = "no_structure";
        throw noStructure;
      }
      setResult(parsed);
      setSourceName(name);
      setSelected(new Set(
        CV_BUILDER_IMPORT_SECTIONS.filter((section) => hasCvBuilderImportContent(parsed, section))
      ));
      setIncludeUnrecognized(false);
      setStep("preview");
    } catch (err) {
      setError(t(importErrorKey(err)));
      setStep("source");
    } finally {
      setBusy(false);
    }
  };

  const handleLocalFile = async (file: File | undefined) => {
    if (!file) return;
    await parseFile(file, file.name.replace(/\.pdf$/i, ""));
  };

  const handleRisImport = async () => {
    const cv = persistentCvs.find((entry) => entry.cvId === selectedRisId);
    if (!cv) return;
    setBusyRisId(cv.cvId);
    setError(null);
    setStep("loading");
    try {
      const file = await onDownloadRis(cv);
      await parseFile(file, cv.filename.replace(/\.pdf$/i, ""));
    } catch (err) {
      setError(t(importErrorKey(err)));
      setStep("source");
    } finally {
      setBusyRisId(null);
    }
  };

  const toggleSection = (section: CvBuilderImportSectionId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const confirm = () => {
    if (!result) return;
    if (selected.size === 0 && !includeUnrecognized) {
      setError(t("cvBuilder.import.noSections"));
      return;
    }
    const draft = selectCvBuilderImportDraft(result, selected, includeUnrecognized);
    onImported(draft, sourceName);
  };

  if (!open) return null;

  return (
    <div
      className="modal cv-import-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-box cv-import-modal__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-import-title"
      >
        <div className="modal-head">
          <div>
            <h3 ref={headingRef} id="cv-import-title" tabIndex={-1}>
              {t("cvBuilder.import.title")}
            </h3>
            <p className="modal-sub">{t("cvBuilder.import.subtitle")}</p>
          </div>
          <button type="button" className="modal-close" aria-label={t("cvBuilder.cancel")} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cv-import-modal__body">
          <details className="cv-import-modal__may">
            <summary>{t("dashboard.may.button")}</summary>
            <MayHelp context="import" compact />
          </details>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          {step === "source" && (
            <div className="cv-import-source">
              <section className="cv-import-option">
                <div>
                  <h4>{t("cvBuilder.import.emptyTitle")}</h4>
                  <p>{t("cvBuilder.import.emptyText")}</p>
                </div>
                <button type="button" className="btn-ghost" onClick={onCreateEmpty}>
                  {t("cvBuilder.import.emptyTitle")}
                </button>
              </section>

              <section className="cv-import-option">
                <div>
                  <h4>{t("cvBuilder.import.deviceTitle")}</h4>
                  <p>{t("cvBuilder.import.deviceText")}</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="visually-hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleLocalFile(file);
                  }}
                />
                <button
                  type="button"
                  className="letter-btn"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                >
                  {t("cvBuilder.import.chooseFile")}
                </button>
              </section>

              <section className="cv-import-option">
                <div>
                  <h4>{t("cvBuilder.import.risTitle")}</h4>
                  <p>{t("cvBuilder.import.risText")}</p>
                  {!risAvailable && <p className="field-hint">{t("cvBuilder.import.risUnavailable")}</p>}
                  {risAvailable && risLoading && <p className="field-hint">{t("cvBuilder.import.reading")}</p>}
                  {risAvailable && !risLoading && persistentCvs.length === 0 && (
                    <p className="field-hint">{t("cvBuilder.import.noRisCvs")}</p>
                  )}
                </div>
                {risAvailable && persistentCvs.length > 0 && (
                  <div className="cv-import-ris">
                    <label>
                      <span>{t("cvBuilder.import.risListLabel")}</span>
                      <select
                        value={selectedRisId}
                        onChange={(event) => setSelectedRisId(event.target.value)}
                        disabled={busy}
                      >
                        {persistentCvs.map((cv) => (
                          <option key={cv.cvId} value={cv.cvId}>{cv.filename}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="letter-btn"
                      disabled={busy || !selectedRisId}
                      aria-busy={busyRisId === selectedRisId}
                      onClick={() => void handleRisImport()}
                    >
                      {busyRisId === selectedRisId ? t("cvBuilder.import.reading") : t("cvBuilder.import.importRis")}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {step === "loading" && (
            <div className="cv-import-loading" role="status">
              <span className="spinner" aria-hidden="true" />
              <p>{t("cvBuilder.import.reading")}</p>
            </div>
          )}

          {step === "preview" && result && (
            <div className="cv-import-preview">
              <h4>{t("cvBuilder.import.previewTitle")}</h4>
              <p>{t("cvBuilder.import.previewHint")}</p>

              <div className="cv-import-preview__sections">
                {CV_BUILDER_IMPORT_SECTIONS.map((section) => {
                  const items = sectionSummary(result, section, t);
                  const hasContent = hasCvBuilderImportContent(result, section);
                  if (!hasContent) return null;
                  return (
                    <section key={section} className="cv-import-section">
                      <label className="cv-import-section__select">
                        <input
                          type="checkbox"
                          checked={selected.has(section)}
                          onChange={() => toggleSection(section)}
                        />
                        <strong>{t(`cvBuilder.import.section.${section}`)}</strong>
                      </label>
                      <ul>
                        {items.map((item, index) => <li key={`${section}-${index}`}>{item}</li>)}
                      </ul>
                      {result.uncertain[section] && (
                        <p className="cv-import-section__uncertain" role="note">
                          {t("cvBuilder.import.uncertain")}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>

              {CV_BUILDER_IMPORT_SECTIONS.some((section) => !hasCvBuilderImportContent(result, section)) && (
                <section className="cv-import-missing">
                  <h5>{t("cvBuilder.import.notDetected")}</h5>
                  <p>
                    {CV_BUILDER_IMPORT_SECTIONS
                      .filter((section) => !hasCvBuilderImportContent(result, section))
                      .map((section) => t(`cvBuilder.import.section.${section}`))
                      .join(" · ")}
                  </p>
                </section>
              )}

              {result.unrecognized.length > 0 && (
                <section className="cv-import-unrecognized">
                  <h5>{t("cvBuilder.import.unrecognizedTitle")}</h5>
                  <p>{t("cvBuilder.import.unrecognizedHint")}</p>
                  <label className="cv-import-section__select">
                    <input
                      type="checkbox"
                      checked={includeUnrecognized}
                      onChange={(event) => setIncludeUnrecognized(event.target.checked)}
                    />
                    <span>{t("cvBuilder.import.includeUnrecognized")}</span>
                  </label>
                  <ul>
                    {result.unrecognized.map((line, index) => <li key={`unassigned-${index}`}>{line}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions cv-import-modal__actions">
          {step === "preview" && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setError(null);
                setStep("source");
              }}
            >
              {t("cvBuilder.import.back")}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t("cvBuilder.import.cancel")}
          </button>
          {step === "preview" && (
            <button type="button" className="letter-btn" onClick={confirm}>
              {t("cvBuilder.import.take")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
