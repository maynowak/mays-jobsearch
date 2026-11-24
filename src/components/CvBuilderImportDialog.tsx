import { useEffect, useMemo, useRef, useState } from "react";
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
  type CvBuilderImportReviewHandle,
  type CvBuilderImportReviewSummary,
  type ManualReviewDecision,
} from "./CvBuilderImportReview";
import RadarNavigator, { type RadarNavigatorLabels } from "./RadarNavigator";
import type { NavigatorTarget } from "../lib/navigation/radarNavigator";
import type { CvBuilderImportSession } from "../lib/cvBuilder/workspaceHandoff";

interface Props {
  open: boolean;
  layoutMode?: "modal" | "fullpage";
  initialSession?: CvBuilderImportSession | null;
  onSessionChange?: (session: CvBuilderImportSession) => void;
  onOpenWorkspace?: (session: CvBuilderImportSession) => void;
  onClose: () => void;
  onCreateEmpty: () => void;
  risAvailable: boolean;
  risLoading?: boolean;
  persistentCvs: PersistentCv[];
  onDownloadRis: (cv: PersistentCv) => Promise<File>;
  onImported: (draft: CvBuilderDraftV1, sourceName: string, reviewSummary?: CvBuilderImportReviewSummary) => void;
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
  layoutMode = "modal",
  initialSession = null,
  onSessionChange,
  onOpenWorkspace,
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
  const decisionPanelRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const reviewRef = useRef<CvBuilderImportReviewHandle | null>(null);
  const hydratedHandoffRef = useRef(false);
  const screenshotDetailsRef = useRef<boolean[]>([]);
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  const fullpage = layoutMode === "fullpage";
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
  const [screenshotMode, setScreenshotMode] = useState(false);

  useEffect(() => {
    if (!open) {
      hydratedHandoffRef.current = false;
      return;
    }
    if (initialSession && !hydratedHandoffRef.current) {
      hydratedHandoffRef.current = true;
      setStep(initialSession.step);
      setError(null);
      setResult(initialSession.result);
      setSourceName(initialSession.sourceName);
      setSelected(new Set(initialSession.selected));
      setManualDecisions({ ...initialSession.manualDecisions });
      setSelectedSkills(new Set(initialSession.selectedSkills));
      setSummaryDraft(initialSession.summaryDraft);
      setPendingAcknowledged(initialSession.pendingAcknowledged);
      setBusy(false);
      setBusyRisId(null);
      setScreenshotMode(false);
      screenshotDetailsRef.current = [];
      setSelectedRisId(persistentCvs[0]?.cvId ?? "");
      window.setTimeout(() => headingRef.current?.focus(), 0);
      return;
    }
    hydratedHandoffRef.current = false;
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
    setScreenshotMode(false);
    screenshotDetailsRef.current = [];
    setSelectedRisId(persistentCvs[0]?.cvId ?? "");
    window.setTimeout(() => headingRef.current?.focus(), 0);
    // Reset only when the dialog opens; document updates must not discard a
    // preview that is already being reviewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSession]);

  useEffect(() => {
    if (!open) return;
    if (step === "summary") {
      window.setTimeout(() => document.getElementById("cv-import-summary-title")?.focus(), 0);
    }
  }, [open, step]);

  useEffect(() => {
    if (step === "preview" || !screenshotMode) return;
    setScreenshotMode(false);
  }, [step, screenshotMode]);

  useEffect(() => {
    if (!open) return;
    setSelectedRisId((current) => {
      if (persistentCvs.some((cv) => cv.cvId === current)) return current;
      return persistentCvs[0]?.cvId ?? "";
    });
  }, [open, persistentCvs]);

  useEffect(() => {
    if (!open) return;
    onSessionChangeRef.current?.({
      step: step === "loading" ? "source" : step,
      result,
      sourceName,
      selected: [...selected],
      manualDecisions,
      selectedSkills: [...selectedSkills],
      summaryDraft,
      pendingAcknowledged,
    });
  }, [open, step, result, sourceName, selected, manualDecisions, selectedSkills, summaryDraft, pendingAcknowledged]);

  const currentSession = (): CvBuilderImportSession => ({
    step: step === "loading" ? "source" : step,
    result,
    sourceName,
    selected: [...selected],
    manualDecisions,
    selectedSkills: [...selectedSkills],
    summaryDraft,
    pendingAcknowledged,
  });

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

  const pendingReviewCount = Object.values(manualDecisions)
    .filter((decision) => decision.status === "pending").length;
  const uncertainReviewCount = result
    ? result.unrecognizedDetails.filter((detail) =>
        detail.reason === "ambiguous" || detail.reason.startsWith("incomplete-")
      ).length
    : 0;

  const navigatorTargets = useMemo<NavigatorTarget[]>(() => {
    if (!fullpage || step !== "preview" || !result) return [];
    const targets: NavigatorTarget[] = [{
      id: "cv-import-overview",
      title: t("cvBuilder.import.navigator.overviewTarget"),
      kind: "section",
      getElement: () => document.getElementById("cv-import-overview"),
      activate: () => document.getElementById("cv-import-overview-title")?.focus({ preventScroll: true }),
    }];
    CV_BUILDER_IMPORT_SECTIONS
      .filter((section) => hasCvBuilderImportContent(result, section))
      .forEach((section) => {
        const uncertain = result.uncertain[section];
        targets.push({
          id: `cv-import-section-${section}`,
          title: t(`cvBuilder.import.section.${section}`),
          kind: "section",
          status: uncertain ? "warning" : "normal",
          statusLabel: uncertain
            ? t("cvBuilder.import.navigator.status.review")
            : t("cvBuilder.import.navigator.status.detected"),
          getElement: () => document.getElementById(`cv-import-section-${section}`),
          activate: () => {
            const details = document.querySelector<HTMLDetailsElement>(
              `#cv-import-section-${section} details`
            );
            if (details) details.open = true;
          },
        });
      });
    const reviewStatus = pendingReviewCount > 0 || uncertainReviewCount > 0 ? "warning" : "completed";
    targets.push({
      id: "cv-import-review",
      title: pendingReviewCount > 0
        ? t("cvBuilder.import.navigator.reviewPending", { count: pendingReviewCount })
        : uncertainReviewCount > 0
          ? t("cvBuilder.import.navigator.reviewUncertain", { count: uncertainReviewCount })
          : t("cvBuilder.import.navigator.review"),
      kind: "review",
      status: reviewStatus,
      statusLabel: reviewStatus === "warning"
        ? t("cvBuilder.import.navigator.status.review")
        : t("cvBuilder.import.navigator.status.completed"),
      getElement: () => document.getElementById("cv-import-review-title"),
      activate: () => document.getElementById("cv-import-review-title")?.focus({ preventScroll: true }),
    });
    result.unrecognized.forEach((_line, index) => {
      const decision = manualDecisions[index];
      const detail = result.unrecognizedDetails[index];
      const decided = decision?.status ?? "pending";
      const uncertain = detail?.reason === "ambiguous" || detail?.reason?.startsWith("incomplete-") === true;
      const status = decided === "pending" ? "pending" : "completed";
      const statusLabel = decided === "accepted"
        ? t("cvBuilder.import.navigator.status.accepted")
        : decided === "ignored"
          ? t("cvBuilder.import.navigator.status.ignored")
          : uncertain
            ? t("cvBuilder.import.navigator.status.review")
            : t("cvBuilder.import.navigator.status.open");
      targets.push({
        id: `cv-import-candidate-${index}`,
        title: t("cvBuilder.import.navigator.candidate", { index: index + 1 }),
        kind: "review",
        status,
        statusLabel,
        activate: () => reviewRef.current?.revealCandidate(index),
        getElement: () => document.getElementById(`cv-import-review-item-${index}`),
      });
    });
    targets.push({
      id: "cv-import-decision",
      title: t("cvBuilder.import.navigator.decision"),
      kind: "action",
      getElement: () => document.getElementById("cv-import-decision-panel"),
      activate: () => document.getElementById("cv-import-decision-panel")?.focus({ preventScroll: true }),
    });
    return targets;
  }, [fullpage, step, result, pendingReviewCount, uncertainReviewCount, manualDecisions, t]);

  const navigatorLabels: RadarNavigatorLabels = {
    aria: t("cvBuilder.import.navigator.aria"),
    open: t("cvBuilder.import.navigator.open"),
    close: t("cvBuilder.import.navigator.close"),
    overview: t("cvBuilder.import.navigator.overview"),
    goTo: (title) => t("cvBuilder.import.navigator.goTo", { title }),
    status: (status) => t(`cvBuilder.import.navigator.status.${status}`),
  };

  const scrollTo = (target: HTMLElement | null) => {
    if (!target) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const top = window.scrollY + target.getBoundingClientRect().top - 16;
    window.scrollTo?.({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
    target.focus?.({ preventScroll: true });
  };

  const scrollToDecisionPanel = () => {
    scrollTo(decisionPanelRef.current);
  };

  const scrollToReview = () => {
    scrollTo(document.getElementById("cv-import-review-title"));
  };

  const toggleScreenshotMode = () => {
    const details = Array.from(
      workspaceRef.current?.querySelectorAll<HTMLDetailsElement>(".cv-import-section__details") ?? []
    );
    if (!screenshotMode) {
      screenshotDetailsRef.current = details.map((detail) => detail.open);
      details.forEach((detail) => { detail.open = true; });
      setScreenshotMode(true);
      return;
    }
    details.forEach((detail, index) => {
      detail.open = screenshotDetailsRef.current[index] ?? detail.open;
    });
    setScreenshotMode(false);
  };

  if (!open) return null;

  return (
    <div
      className={`${fullpage ? "cv-import-workspace" : "modal cv-import-modal"}${fullpage && step === "preview" && screenshotMode ? " cv-import-workspace--screenshot" : ""}`}
      onClick={fullpage ? undefined : (event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {fullpage && step === "preview" && !screenshotMode && (
        <RadarNavigator
          targets={navigatorTargets}
          labels={navigatorLabels}
          navigationKey={`cv-import-${sourceName}`}
          regionSelector="#cv-import-workspace"
          offset={() => 24}
          classNamePrefix="match-radar"
          className="cv-import-radar"
          panelId="cv-import-radar-panel"
          restoreFocusAfterPanelNavigation={false}
        />
      )}
      <div
        ref={workspaceRef}
        id={fullpage ? "cv-import-workspace" : undefined}
        className={fullpage ? "cv-import-workspace__box" : "modal-box cv-import-modal__box"}
        role={fullpage ? "region" : "dialog"}
        aria-modal={fullpage ? undefined : true}
        aria-labelledby="cv-import-title"
      >
        <div className={fullpage ? "modal-head cv-import-workspace__head" : "modal-head"}>
          <div>
            <h3 ref={headingRef} id="cv-import-title" tabIndex={-1}>
              {t("cvBuilder.import.title")}
            </h3>
            <p className="modal-sub">{t("cvBuilder.import.subtitle")}</p>
          </div>
          <div className="cv-import-workspace__head-actions">
            {onOpenWorkspace && (
              <button
                type="button"
                className="btn-ghost cv-import-workspace__open"
                disabled={busy || step === "loading"}
                onClick={() => onOpenWorkspace(currentSession())}
              >
                {t("cvBuilder.workspace.openImport")}
              </button>
            )}
            {fullpage && step === "preview" && (
              <button
                type="button"
                className="btn-ghost cv-import-header-jump"
                onClick={scrollToDecisionPanel}
              >
                {t("cvBuilder.import.decisionJumpTop")}
              </button>
            )}
            {fullpage && step === "preview" && (
              <button
                type="button"
                className="btn-ghost cv-import-screenshot-toggle"
                aria-pressed={screenshotMode}
                title={screenshotMode ? t("cvBuilder.workspace.screenshotExit") : t("cvBuilder.workspace.screenshot")}
                onClick={toggleScreenshotMode}
              >
                {screenshotMode ? t("cvBuilder.workspace.screenshotExit") : t("cvBuilder.workspace.screenshot")}
              </button>
            )}
            <button type="button" className="modal-close" aria-label={t("cvBuilder.cancel")} onClick={onClose}>
              ×
            </button>
          </div>
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
              ref={reviewRef}
              result={result}
              selected={selected}
              onToggleSection={toggleSection}
              decisions={manualDecisions}
              onUpdateDecision={updateDecision}
              selectedSkills={selectedSkills}
              onToggleSkill={toggleSkill}
              onSelectAllSkills={() => setSelectedSkills(new Set(result.draft.skills))}
              onClearSkills={() => setSelectedSkills(new Set())}
              onGoToActions={fullpage ? scrollToDecisionPanel : undefined}
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
              onApply={() => {
                const reviewSummary: CvBuilderImportReviewSummary = {
                  total: Object.keys(manualDecisions).length,
                  pending: Object.values(manualDecisions).filter((decision) => decision.status === "pending").length,
                  accepted: Object.values(manualDecisions).filter((decision) => decision.status === "accepted").length,
                  ignored: Object.values(manualDecisions).filter((decision) => decision.status === "ignored").length,
                };
                onImported(summaryDraft, sourceName, reviewSummary);
              }}
              onCancel={onClose}
            />
          )}
        </div>

        {fullpage && step === "preview" ? (
          <section
            ref={decisionPanelRef}
            id="cv-import-decision-panel"
            className="cv-import-decision-panel"
            aria-labelledby="cv-import-decision-title"
            tabIndex={-1}
          >
            <p className="cv-import-decision-panel__eyebrow" id="cv-import-decision-title">
              {t("cvBuilder.import.decisionTitle")}
            </p>
            <p className="cv-import-decision-panel__count">
              {t("cvBuilder.import.decisionPending", { count: pendingReviewCount })}
            </p>
            <p className="cv-import-decision-panel__note">{t("cvBuilder.import.decisionNote")}</p>
            <button
              type="button"
              className="btn-ghost cv-import-decision-panel__review-back"
              onClick={scrollToReview}
            >
              {t("cvBuilder.import.decisionReviewBack")}
            </button>
            <div className="cv-import-decision-panel__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setError(null);
                  setStep("source");
                }}
              >
                {t("cvBuilder.import.decisionBack")}
              </button>
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t("cvBuilder.import.cancel")}
              </button>
              <button
                type="button"
                className="letter-btn cv-import-decision-panel__primary"
                onClick={openSummary}
              >
                {t("cvBuilder.import.decisionApply")}
              </button>
            </div>
          </section>
        ) : step !== "summary" && (
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
