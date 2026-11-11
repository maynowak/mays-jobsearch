import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import type { PersistentCv } from "../lib/cvStorageApi";
import { validateCvFile } from "../lib/cvFileValidation";
import { extractPdfText } from "../lib/pdf";
import type { PdfDocumentStructure } from "../lib/cvBuilder/documentStructure";
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
import CvBuilderImportReview, {
  CvBuilderImportSummary,
  type ManualReviewDecision,
} from "./CvBuilderImportReview";

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

type ImportStep = "source" | "loading" | "preview" | "summary";

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
  const [manualDecisions, setManualDecisions] = useState<Record<number, ManualReviewDecision>>({});
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [summaryDraft, setSummaryDraft] = useState<CvBuilderDraftV1 | null>(null);
  const [pendingAcknowledged, setPendingAcknowledged] = useState(false);
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
    setManualDecisions({});
    setSelectedSkills(new Set());
    setSummaryDraft(null);
    setPendingAcknowledged(false);
    setBusyRisId(null);
    setSelectedRisId(persistentCvs[0]?.cvId ?? "");
    window.setTimeout(() => headingRef.current?.focus(), 0);
    // Reset only when the dialog opens; document updates must not discard a
    // preview that is already being reviewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (step === "summary") {
      window.setTimeout(() => document.getElementById("cv-import-summary-title")?.focus(), 0);
    }
  }, [open, step]);

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
      let document: PdfDocumentStructure | null = null;
      try {
        const pdfModule = await import("../lib/pdf");
        if (typeof pdfModule.extractPdfDocument === "function") {
          document = await pdfModule.extractPdfDocument(file);
        }
      } catch {
        document = null;
      }
      const text = document?.text ?? await extractPdfText(file);
      if (!text.trim()) {
        const noText = new Error("no_text") as Error & { code: string };
        noText.code = "no_text";
        throw noText;
      }
      const parsed = parseCvBuilderImportText(text, document ?? undefined);
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
      setManualDecisions(Object.fromEntries(parsed.unrecognized.map((line, index) => {
        const detail = parsed.unrecognizedDetails[index];
        return [index, {
          target: detail?.suggestedTarget ?? "ignore",
          status: "pending" as const,
          text: line,
          original: line,
          edited: false,
        }];
      })));
      setSelectedSkills(new Set(
        parsed.uncertain.skills || parsed.draft.skills.length > 25 ? [] : parsed.draft.skills
      ));
      setSummaryDraft(null);
      setPendingAcknowledged(false);
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

  const buildDraft = (): CvBuilderDraftV1 => {
    if (!result) return summaryDraft ?? {
      schemaVersion: 1,
      personal: {}, profile: {}, experience: [], education: [], skills: [], projects: [], certificates: [], languages: [], links: [],
    };
    const assignments = Object.fromEntries(Object.entries(manualDecisions).map(([index, decision]) => [index, {
      target: decision.target,
      status: decision.status,
      text: decision.text,
    }]));
    return selectCvBuilderImportDraft(result, selected, assignments, {
      selectedSkills: selected.has("skills") ? selectedSkills : [],
    });
  };

  const openSummary = () => {
    if (!result) return;
    const hasAcceptedManual = Object.values(manualDecisions).some((decision) => decision.status === "accepted");
    if (selected.size === 0 && !hasAcceptedManual) {
      setError(t("cvBuilder.import.noSections"));
      return;
    }
    setError(null);
    setSummaryDraft(buildDraft());
    setPendingAcknowledged(false);
    setStep("summary");
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((current) => {
      const next = new Set(current);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const updateDecision = (index: number, patch: Partial<ManualReviewDecision>) => {
    setManualDecisions((current) => ({
      ...current,
      [index]: { ...current[index], ...patch },
    }));
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
            <summary>{t("dashboard.help.button")}</summary>
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
            <CvBuilderImportReview
              result={result}
              selected={selected}
              onToggleSection={toggleSection}
              decisions={manualDecisions}
              onUpdateDecision={updateDecision}
              selectedSkills={selectedSkills}
              onToggleSkill={toggleSkill}
              onSelectAllSkills={() => setSelectedSkills(new Set(result.draft.skills))}
              onClearSkills={() => setSelectedSkills(new Set())}
            />
          )}

          {step === "summary" && result && summaryDraft && (
            <CvBuilderImportSummary
              draft={summaryDraft}
              decisions={manualDecisions}
              selected={selected}
              pendingAcknowledged={pendingAcknowledged}
              onToggleAcknowledged={setPendingAcknowledged}
              onBack={() => {
                setPendingAcknowledged(false);
                setStep("preview");
              }}
              onApply={() => onImported(summaryDraft, sourceName)}
              onCancel={onClose}
            />
          )}
        </div>

        {step !== "summary" && (
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
              <button type="button" className="letter-btn" onClick={openSummary}>
                {t("cvBuilder.import.take")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
