import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CvDocument, Job, ModelOption, Profile } from "../types";
import { generateCoverLetter, isFreeQuotaExceeded, isModelUnavailable, withModelFallback } from "../api";
import { useLang } from "../i18n";
import type { ModelsState } from "../hooks/useAvailableModels";
import { formatGermanLocation } from "../lib/location";
import {
  MAX_DESCRIPTION_INPUT_LENGTH,
  buildDescriptionReview,
  type DescriptionReviewState,
  type ReviewReason,
} from "../lib/jobDescriptionReview";
import { readCvProfileLists } from "../lib/cvProfileStore";
import { validateCvFile } from "../lib/cvFileValidation";
import { extractPdfText } from "../lib/pdf";
import { anonymizeText } from "../lib/anonymize";
import {
  buildJobContext,
  buildTargetRoles,
  cvIsUsable,
  MAX_CV_TEXT_LENGTH,
  MAX_REVISION_DRAFT_LENGTH,
  MAX_REVISION_FEEDBACK_LENGTH,
  type CoverLetterLength,
  type CoverLetterOperation,
  type CoverLetterStyle,
} from "../lib/coverLetterRequest";
import { type DescriptionOrigin } from "../lib/jobDescriptionReview";
import SourceBadge from "./SourceBadge";
import ModelSelector from "./ModelSelector";

export type LetterCvChoice = "none" | "existing";

export interface LetterCandidateDraft {
  skills: string;
  experience: string;
  qualifications: string;
  motivation: string;
  startDate: string;
  salaryExpectation: string;
  style: CoverLetterStyle;
  length: CoverLetterLength;
}

export interface LetterPreparationContext {
  jobSlug: string;
  descriptionInput: string;
  review: DescriptionReviewState | null;
  cvChoice: LetterCvChoice;
  selectedCvId: string | null;
  model?: string | null;
  candidateDraft?: LetterCandidateDraft;
}

export type LetterApplicationAdoptionResult = "created" | "updated";

interface Props {
  job: Job;
  prepare: string;
  profile: Profile;
  model: string | null;
  modelsState: ModelsState;
  models: ModelOption[];
  defaultModel: string | null;
  availableModels: string[];
  recommendedModel: string | null;
  cvDocuments?: CvDocument[];
  initialContext?: LetterPreparationContext | null;
  onAddCv?: (file: File, context: LetterPreparationContext) => void;
  onProcessCv?: (id: string, context: LetterPreparationContext) => void;
  isAuthenticated?: boolean;
  hasSessionApplications?: boolean;
  onSignIn?: () => void;
  onOpenApplications?: () => void;
  onAdoptAsApplication?: (payload: {
    job: Job;
    letter: string;
    cvReference?: { cvId: string; label?: string };
  }) => Promise<LetterApplicationAdoptionResult>;
  hasApplicationDraft?: boolean;
  onClose: () => void;
}

type LetterPhase = "intro" | "loading" | "done" | "error";
type LetterTextStatus = "created" | "revised" | "edited";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function LetterModal({
  job,
  prepare,
  profile,
  model,
  modelsState,
  models,
  defaultModel,
  availableModels,
  recommendedModel,
  cvDocuments = [],
  initialContext,
  onAddCv,
  onProcessCv,
  isAuthenticated,
  hasSessionApplications = false,
  onSignIn,
  onOpenApplications,
  onAdoptAsApplication,
  hasApplicationDraft = false,
  onClose,
}: Props) {
  const { t, lang } = useLang();
  void prepare; // CL-01 compatibility; interview prompts are no longer part of the letter.
  const authenticated = isAuthenticated ?? Boolean(onAdoptAsApplication);
  const headingId = useId();
  const helpId = useId();
  const cvGroupId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const initialContextForJob =
    initialContext && initialContext.jobSlug === job.slug ? initialContext : null;
  const [phase, setPhase] = useState<LetterPhase>("intro");
  const [selectedModel, setSelectedModel] = useState<string | null>(
    initialContextForJob?.model ?? model
  );
  const [letter, setLetter] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fallbackNote, setFallbackNote] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState(
    initialContextForJob?.descriptionInput ?? ""
  );
  const [review, setReview] = useState<DescriptionReviewState | null>(
    initialContextForJob?.review ?? null
  );
  const [cvChoice, setCvChoice] = useState<LetterCvChoice>(
    initialContextForJob?.cvChoice ?? "none"
  );
  const [selectedCvId, setSelectedCvId] = useState<string | null>(
    initialContextForJob?.selectedCvId ?? null
  );
  const [cvError, setCvError] = useState<string | null>(null);
  const [manualSkills, setManualSkills] = useState(
    initialContextForJob?.candidateDraft?.skills ?? ""
  );
  const [manualExperience, setManualExperience] = useState(
    initialContextForJob?.candidateDraft?.experience ?? ""
  );
  const [manualQualifications, setManualQualifications] = useState(
    initialContextForJob?.candidateDraft?.qualifications ?? ""
  );
  const [manualMotivation, setManualMotivation] = useState(
    initialContextForJob?.candidateDraft?.motivation ?? ""
  );
  const [startDate, setStartDate] = useState(
    initialContextForJob?.candidateDraft?.startDate ?? ""
  );
  const [salaryExpectation, setSalaryExpectation] = useState(
    initialContextForJob?.candidateDraft?.salaryExpectation ?? ""
  );
  const [style, setStyle] = useState<CoverLetterStyle>(
    initialContextForJob?.candidateDraft?.style ?? "professional"
  );
  const [length, setLength] = useState<CoverLetterLength>(
    initialContextForJob?.candidateDraft?.length ?? "one_page"
  );
  const [generationError, setGenerationError] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [edited, setEdited] = useState(false);
  const [letterTextStatus, setLetterTextStatus] = useState<LetterTextStatus | null>(null);
  const [adoptionResult, setAdoptionResult] = useState<LetterApplicationAdoptionResult | null>(null);
  const [adoptionError, setAdoptionError] = useState("");
  const [adopting, setAdopting] = useState(false);
  const [loginConfirm, setLoginConfirm] = useState(false);
  const adoptingRef = useRef(false);
  const adoptionStatusRef = useRef<HTMLHeadingElement>(null);
  const adoptionErrorRef = useRef<HTMLParagraphElement>(null);
  const loginTriggerRef = useRef<HTMLButtonElement>(null);
  const loginConfirmRef = useRef<HTMLButtonElement>(null);
  const restoreLoginFocusRef = useRef(false);
  const [regenerateWarning, setRegenerateWarning] = useState(false);
  const [reviseWarning, setReviseWarning] = useState(false);
  const [modelFailure, setModelFailure] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"cv" | "model">("model");
  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const previousJobSlugRef = useRef(job.slug);
  const originalReview = useMemo(
    () => buildDescriptionReview({ job, enrichedInput: "" }),
    [job]
  );
  const visibleReview = review ?? originalReview;
  const activeModel = selectedModel ?? model;
  const selectedCv =
    cvChoice === "existing" && selectedCvId
      ? cvDocuments.find((document) => document.id === selectedCvId) ?? null
      : null;
  const selectedCvReady = cvIsUsable(selectedCv);
  const selectedDescription = visibleReview.selected;
  const selectedOrigin = (selectedDescription?.origin ?? "original") as DescriptionOrigin;

  // A new job must never inherit the previous job's letter, review or CV
  // selection. The initial mount is excluded so a preserved context survives.
  useEffect(() => {
    if (previousJobSlugRef.current === job.slug) return;
    previousJobSlugRef.current = job.slug;
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    setPhase("intro");
    setLetter("");
    setError("");
    setCopied(false);
    setFallbackNote(false);
    setDescriptionInput("");
    setReview(null);
    setCvChoice("none");
    setSelectedCvId(null);
    setCvError(null);
    setManualSkills("");
    setManualExperience("");
    setManualQualifications("");
    setManualMotivation("");
    setStartDate("");
    setSalaryExpectation("");
    setStyle("professional");
    setLength("one_page");
    setGenerationError("");
    setGeneratedText("");
    setEdited(false);
    setLetterTextStatus(null);
    setAdoptionResult(null);
    setAdoptionError("");
    setAdopting(false);
    adoptingRef.current = false;
    setLoginConfirm(false);
    setRegenerateWarning(false);
    setReviseWarning(false);
    setModelFailure(false);
    setFeedback("");
    setSelectedModel(model);
  }, [job.slug]);

  // Editing the job description, candidate basis or options invalidates a
  // completed draft. A late model response must not repopulate it.
  useEffect(() => {
    if (phase === "intro") return;
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    setPhase("intro");
    setLetter("");
    setGeneratedText("");
    setEdited(false);
    setLetterTextStatus(null);
    setAdoptionResult(null);
    setAdoptionError("");
    setAdopting(false);
    adoptingRef.current = false;
    setLoginConfirm(false);
    setRegenerateWarning(false);
    setGenerationError("");
  }, [
    cvChoice,
    selectedCvId,
    descriptionInput,
    review,
    manualSkills,
    manualExperience,
    manualQualifications,
    manualMotivation,
    startDate,
    salaryExpectation,
    style,
    length,
  ]);

  useEffect(() => {
    if (!selectedModel && model) setSelectedModel(model);
  }, [model, selectedModel]);

  useEffect(() => {
    if (!selectedCvId) return;
    if (!cvDocuments.some((document) => document.id === selectedCvId)) {
      setSelectedCvId(null);
      setCvChoice("none");
    }
  }, [cvDocuments, selectedCvId]);

  useEffect(() => {
    if (adoptionResult) adoptionStatusRef.current?.focus();
  }, [adoptionResult]);

  useEffect(() => {
    if (adoptionError) adoptionErrorRef.current?.focus();
  }, [adoptionError]);

  useEffect(() => {
    if (loginConfirm) {
      loginConfirmRef.current?.focus();
      return;
    }
    if (restoreLoginFocusRef.current) {
      restoreLoginFocusRef.current = false;
      loginTriggerRef.current?.focus();
    }
  }, [loginConfirm]);

  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      inFlightRef.current = false;
    };
  }, []);

  // Keep the generated letter fully visible. A fixed-height textarea hides the
  // lower part of long letters behind its internal scrollbar.
  useEffect(() => {
    if (phase !== "done") return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  }, [letter, phase]);

  // Dialog focus, background scroll lock and focus restoration.
  // The heading is focused with preventScroll; focusing the generate button
  // would move the scroll container to the bottom of the modal.
  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const heading = headingRef.current;
    const resetScroll = () => {
      if (dialogRef.current) dialogRef.current.scrollTop = 0;
    };

    resetScroll();
    heading?.focus({ preventScroll: true });
    resetScroll();

    const frame =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame(resetScroll)
        : window.setTimeout(resetScroll, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frame);
      } else {
        window.clearTimeout(frame);
      }
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, []);

  const handleClose = () => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const atHeading = document.activeElement === headingRef.current;
      if (event.shiftKey && (document.activeElement === first || atHeading)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const splitManualList = (value: string): string[] =>
    value
      .split(/[,;\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 50);

  const handleModelChange = (nextModel: string) => {
    setSelectedModel(nextModel);
    setModelFailure(false);
    setGenerationError("");
    setRegenerateWarning(false);
    setReviseWarning(false);
    if (phase === "error") setPhase("intro");
  };

  const runRequest = async (operation: CoverLetterOperation, revisionFeedback = "") => {
    if (inFlightRef.current || phase === "loading") return;

    if (visibleReview.confirmation === "required") {
      setGenerationError(t("letter.reviewUncertain"));
      return;
    }
    if (cvChoice === "existing" && !selectedCv) {
      setGenerationError(t("letter.cvNeedsProcessing"));
      return;
    }
    if (selectedCv && !selectedCvReady) {
      setGenerationError(t("letter.cvNeedsProcessing"));
      return;
    }
    if (operation === "revise" && !letter.trim()) {
      setGenerationError(t("letter.reviseNeedsDraft"));
      return;
    }
    if (operation === "revise" && letter.length > MAX_REVISION_DRAFT_LENGTH) {
      setGenerationError(t("letter.reviseDraftTooLong"));
      return;
    }

    inFlightRef.current = true;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setGenerationError("");
    setPhase("loading");
    setLoadingStage(selectedCv ? "cv" : "model");
    setError("");
    setCopied(false);
    setFallbackNote(false);
    setRegenerateWarning(false);
    setReviseWarning(false);
    setModelFailure(false);

    try {
      let cvText: string | undefined;
      if (selectedCv) {
        // A processed CV already carries its anonymized text for this session.
        // Reusing it avoids a second PDF read and keeps the privacy boundary:
        // only anonymized text is sent to the cover-letter endpoint.
        let normalized: string;
        if (selectedCv.letterText) {
          normalized = selectedCv.letterText;
        } else {
          const raw = await extractPdfText(selectedCv.file);
          if (requestSeq !== requestSeqRef.current) return;
          normalized = anonymizeText(String(raw ?? "").replace(/\u0000/g, "").trim());
        }
        normalized = normalized.trim();
        if (!normalized) throw new Error(t("letter.cvTextEmpty"));
        if (normalized.length > MAX_CV_TEXT_LENGTH) throw new Error(t("letter.cvTextTooLong"));
        cvText = normalized;
      }
      if (requestSeq !== requestSeqRef.current) return;

      const candidate = {
        mode: selectedCv ? ("cv" as const) : ("manual" as const),
        skills: splitManualList(manualSkills),
        experience: manualExperience.trim(),
        qualifications: manualQualifications.trim(),
        motivation: manualMotivation.trim(),
        ...(cvText ? { cv_text: cvText, cv_anonymized: true } : {}),
        ...(startDate.trim() ? { start_date: startDate.trim() } : {}),
        ...(salaryExpectation.trim() ? { salary_expectation: salaryExpectation.trim() } : {}),
      };
      const descriptionText = selectedDescription?.text ?? visibleReview.originalText ?? "";
      const requestBase = {
        job: buildJobContext(job, descriptionText, selectedOrigin),
        candidate,
        options: {
          language: (lang === "de" ? "German" : "English") as "German" | "English",
          style,
          length,
          target_roles: buildTargetRoles(profile),
        },
        operation,
      };
      const revision =
        operation === "revise"
          ? {
              draft_text: anonymizeText(letter),
              draft_anonymized: true,
              ...(revisionFeedback.trim()
                ? { feedback: anonymizeText(revisionFeedback.trim()) }
                : {}),
            }
          : undefined;
      const request = revision ? { ...requestBase, revision } : requestBase;

      setLoadingStage("model");
      const { data: result, usedFallback, attempts } = await withModelFallback({
        initialModel: activeModel,
        availableModels,
        recommendedModel,
        request: (m, attempt) =>
          generateCoverLetter(
            { ...request, options: { ...request.options, model: m } },
            attempt
          ),
      });
      if (requestSeq !== requestSeqRef.current) return;
      const nextLetter = String(result.letter ?? "").trim();
      if (!nextLetter) throw new Error(t("letter.emptyResponse"));
      setLetter(nextLetter);
      setGeneratedText(nextLetter);
      setEdited(false);
      setLetterTextStatus(operation === "revise" ? "revised" : "created");
      setAdoptionResult(null);
      setAdoptionError("");
      setFallbackNote(usedFallback);
      if (usedFallback) {
        const successfulModel = attempts.find((attempt) => attempt.ok)?.model;
        if (successfulModel) setSelectedModel(successfulModel);
      }
      setPhase("done");
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return;
      const message = isFreeQuotaExceeded(err)
        ? t("model.quotaExceeded")
        : isModelUnavailable(err)
          ? t("model.unavailable")
          : err instanceof Error
            ? err.message || t("letter.error")
            : t("letter.error");
      setError(message);
      setModelFailure(isModelUnavailable(err));
      if (letter) {
        // Keep the existing draft visible. A failed regeneration/revision must
        // never wipe the user's text.
        setGenerationError(message);
        setPhase("done");
      } else {
        setPhase("error");
      }
    } finally {
      if (requestSeq === requestSeqRef.current) inFlightRef.current = false;
    }
  };

  const handleStart = () => {
    void runRequest("generate");
  };

  const handleDescriptionChange = (value: string) => {
    setDescriptionInput(value.slice(0, MAX_DESCRIPTION_INPUT_LENGTH));
    setReview(null);
  };

  const handleReviewDescription = () => {
    setReview(buildDescriptionReview({ job, enrichedInput: descriptionInput, confirmed: false }));
  };

  const handleConfirmReview = () => {
    if (!review || review.confirmation !== "required") return;
    setReview(buildDescriptionReview({ job, enrichedInput: descriptionInput, confirmed: true }));
  };

  const buildPreparationContext = (): LetterPreparationContext => ({
    jobSlug: job.slug,
    descriptionInput,
    review,
    cvChoice,
    selectedCvId,
    model: selectedModel,
    candidateDraft: {
      skills: manualSkills,
      experience: manualExperience,
      qualifications: manualQualifications,
      motivation: manualMotivation,
      startDate,
      salaryExpectation,
      style,
      length,
    },
  });

  const handleNoCv = () => {
    setCvChoice("none");
    setSelectedCvId(null);
    setCvError(null);
  };

  const handleSelectCv = (id: string) => {
    setCvChoice("existing");
    setSelectedCvId(id);
    setCvError(null);
  };

  const handleCvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const rejection = validateCvFile(file);
    if (rejection) {
      setCvError(
        t(
          rejection === "not-pdf"
            ? "cv.notPdf"
            : rejection === "too-large"
              ? "cv.tooLarge"
              : "cv.emptyFile"
        )
      );
      return;
    }
    setCvError(null);
    onAddCv?.(file, buildPreparationContext());
  };

  const handleLetterChange = (value: string) => {
    setLetter(value);
    setEdited(value !== generatedText);
    setLetterTextStatus("edited");
    setAdoptionResult(null);
    setAdoptionError("");
    setRegenerateWarning(false);
    setReviseWarning(false);
  };

  const handleRegenerate = () => {
    if (inFlightRef.current || phase === "loading") return;
    if (edited && !regenerateWarning) {
      setRegenerateWarning(true);
      setReviseWarning(false);
      return;
    }
    void runRequest("generate");
  };

  const handleImprove = () => {
    if (inFlightRef.current || phase === "loading") return;
    if (!letter.trim()) return;
    if (edited && !reviseWarning) {
      setReviseWarning(true);
      setRegenerateWarning(false);
      return;
    }
    void runRequest("revise", feedback);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(letter).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  };

  const handleDownload = () => {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName =
      `${job.title} ${job.company_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      t("letter.fileName");
    a.download = `${t("letter.fileName")}-${fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdoptAsApplication = async () => {
    if (!onAdoptAsApplication || adoptingRef.current || !letter.trim() || !job.url) return;
    adoptingRef.current = true;
    setAdopting(true);
    setAdoptionError("");
    setAdoptionResult(null);
    try {
      const result = await onAdoptAsApplication({
        job,
        letter,
        ...(selectedCv && selectedCvReady
          ? { cvReference: { cvId: selectedCv.id, label: selectedCv.name } }
          : {}),
      });
      setAdoptionResult(result === "updated" ? "updated" : "created");
    } catch {
      setAdoptionError(t("letter.handoff.failed"));
    } finally {
      adoptingRef.current = false;
      setAdopting(false);
    }
  };

  const handleGuestSignIn = () => {
    if (hasSessionApplications && !loginConfirm) {
      setLoginConfirm(true);
      return;
    }
    onSignIn?.();
  };

  const jobName = [job.title, job.company_name].filter(Boolean).join(" @ ");
  const completenessLabel = (state: string) => t(`letter.completeness.${state}`);
  const selected = visibleReview.selected;
  const selectedPreview = selected
    ? selected.text.length > 900
      ? `${selected.text.slice(0, 900).trimEnd()}…`
      : selected.text
    : "";
  const originalPreview = visibleReview.originalText.length > 900
    ? `${visibleReview.originalText.slice(0, 900).trimEnd()}…`
    : visibleReview.originalText;
  const reasonKey = (reason: ReviewReason) => `letter.reason.${reason}`;
  const completedDescriptionIsLimited =
    !selectedDescription || selectedDescription.completeness !== "sufficient";
  const manualSummary =
    [
      manualSkills.trim() ? t("letter.manualSkills") : "",
      manualExperience.trim() ? t("letter.manualExperience") : "",
      manualQualifications.trim() ? t("letter.manualQualifications") : "",
      manualMotivation.trim() ? t("letter.manualMotivation") : "",
      startDate.trim() ? t("letter.startDate") : "",
      salaryExpectation.trim() ? t("letter.salaryExpectation") : "",
    ]
      .filter(Boolean)
      .join(" · ") || t("letter.noManualData");
  const location =
    formatGermanLocation(job.location ?? []) ||
    (job.remote ? t("match.remote") : t("match.locationNotStated"));

  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && handleClose()}>
      <div
        ref={dialogRef}
        className="modal-box letter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={phase === "intro" ? helpId : undefined}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            <h3 ref={headingRef} id={headingId} tabIndex={-1}>
              {t("letter.heading")}
            </h3>
            <p className="modal-sub">{jobName}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label={t("letter.closeAria")}
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        <div className="letter-model">
          <ModelSelector
            state={modelsState}
            models={models}
            defaultModel={defaultModel}
            recommendedModel={recommendedModel}
            value={activeModel}
            onChange={handleModelChange}
            disabled={phase === "loading"}
            attention={modelFailure}
          />
          <p className="letter-hint">{t("letter.modelHint")}</p>
        </div>

        {phase === "intro" && (
          <div className="letter-prep">
            <div className="letter-job-summary">
              <div className="letter-job-kicker">{t("letter.preliminary")}</div>
              <h4>{job.title || t("match.unknownRole")}</h4>
              <p className="letter-company">
                {job.company_name || t("letter.companyUnknown")}
              </p>
              <div className="letter-job-meta">
                <span>{location}</span>
                {job.remote && <span className="badge badge-remote">{t("match.remote")}</span>}
                <SourceBadge sources={job.source} />
              </div>
            </div>

            <fieldset className="letter-cv">
              <legend>{t("letter.cvHeading")}</legend>
              <p className="letter-hint">{t("letter.cvHint")}</p>

              <label className={`letter-cv-option${cvChoice === "none" ? " letter-cv-option--selected" : ""}`}>
                <input
                  type="radio"
                  name={cvGroupId}
                  checked={cvChoice === "none"}
                  onChange={handleNoCv}
                />
                <span className="letter-cv-name">{t("letter.cvNone")}</span>
              </label>

              {cvDocuments.length === 0 ? (
                <p className="letter-hint">{t("letter.cvNoDocuments")}</p>
              ) : (
                cvDocuments.map((document) => {
                  const processed = Boolean(document.processedAt && document.hash);
                  const lists = document.hash ? readCvProfileLists(document.hash) : null;
                  const searchCount = lists?.searchProfiles.length ?? 0;
                  const atsCount = lists?.atsProfiles.length ?? 0;
                  return (
                    <label
                      key={document.id}
                      className={`letter-cv-option${selectedCvId === document.id ? " letter-cv-option--selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name={cvGroupId}
                        checked={selectedCvId === document.id}
                        onChange={() => handleSelectCv(document.id)}
                      />
                      <span className="letter-cv-name">{document.name}</span>
                      <span className={`letter-cv-status${processed ? " letter-cv-status--processed" : ""}`}>
                        {processed
                          ? searchCount > 0 || atsCount > 0
                            ? t("letter.cvProcessed")
                            : t("letter.cvProcessedNoProfile")
                          : t("letter.cvNotProcessed")}
                      </span>
                      {processed && searchCount + atsCount > 0 && (
                        <span className="letter-cv-profiles">
                          {t("letter.cvProfileCounts", { search: searchCount, ats: atsCount })}
                        </span>
                      )}
                    </label>
                  );
                })
              )}

              <div className="letter-cv-actions">
                <button
                  type="button"
                  className="ats-evaluate-btn"
                  onClick={() => cvFileInputRef.current?.click()}
                  disabled={!onAddCv}
                >
                  {t("letter.cvAdd")}
                </button>
                <input
                  ref={cvFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="visually-hidden"
                  onChange={handleCvFileChange}
                />
              </div>
              {selectedCv && !selectedCvReady && (
                <div className="letter-cv-privacy">
                  <p className="letter-review-warning">{t("letter.cvNeedsProcessing")}</p>
                  <button
                    type="button"
                    className="ats-evaluate-btn"
                    onClick={() => onProcessCv?.(selectedCv.id, buildPreparationContext())}
                    disabled={!onProcessCv}
                  >
                    {t("letter.cvProcessNow")}
                  </button>
                </div>
              )}
              {selectedCv && selectedCvReady && (
                <div className="letter-cv-privacy">
                  <p className="letter-hint">
                    <strong>{t("letter.cvAnonymize")}</strong>
                  </p>
                  <p className="letter-hint">{t("letter.cvAnonymizeHint")}</p>
                  <p className="letter-hint">{t("letter.cvRawUnavailable")}</p>
                </div>
              )}
              {cvError && (
                <p className="letter-review-warning" role="alert">
                  {cvError}
                </p>
              )}
              <p className="letter-hint">{t("letter.cvNotUsedYet")}</p>
            </fieldset>

            <div className="letter-review">
              <div className="letter-review-head">
                <h5 id={`${helpId}-description`}>{t("letter.existingDescription")}</h5>
                <span className={`letter-status letter-status--${visibleReview.original.completeness}`}>
                  {completenessLabel(visibleReview.original.completeness)}
                </span>
              </div>
              {originalPreview ? (
                <p className="letter-description-preview">{originalPreview}</p>
              ) : (
                <p className="letter-description-preview letter-description-preview--empty">
                  {t("letter.noDescription")}
                </p>
              )}

              <label className="letter-label" htmlFor={`${helpId}-enrich`}>
                {t("letter.enrichLabel")}
              </label>
              <textarea
                id={`${helpId}-enrich`}
                className="letter-textarea"
                value={descriptionInput}
                onChange={(event) => handleDescriptionChange(event.target.value)}
                maxLength={MAX_DESCRIPTION_INPUT_LENGTH}
                rows={5}
                placeholder={t("letter.enrichPlaceholder")}
                aria-describedby={`${helpId}-enrich-hint`}
              />
              <p id={`${helpId}-enrich-hint`} className="letter-hint">
                {t("letter.enrichHint")}
              </p>

              <div className="letter-review-actions">
                <button
                  type="button"
                  className="ats-evaluate-btn"
                  onClick={handleReviewDescription}
                  disabled={!descriptionInput.trim()}
                >
                  {t("letter.reviewButton")}
                </button>
                {review?.confirmation === "required" && (
                  <button type="button" className="letter-btn" onClick={handleConfirmReview}>
                    {t("letter.confirmUse")}
                  </button>
                )}
              </div>

              {review && (
                <div
                  className={`letter-review-result letter-review-result--${review.plausibility?.status ?? "original"}`}
                  aria-live="polite"
                >
                  <div className="letter-review-head">
                    <strong>{t("letter.reviewResult")}</strong>
                    {review.plausibility && (
                      <span className={`letter-status letter-status--${review.plausibility.status}`}>
                        {t(`letter.plausibility.${review.plausibility.status}`)}
                      </span>
                    )}
                  </div>

                  {review.plausibility && review.plausibility.reasons.length > 0 && (
                    <ul className="letter-reasons">
                      {review.plausibility.reasons.map((reason) => (
                        <li key={reason}>{t(reasonKey(reason))}</li>
                      ))}
                    </ul>
                  )}

                  {review.insufficient && (
                    <p className="letter-review-warning">{t("letter.reviewInsufficient")}</p>
                  )}
                  {review.plausibility?.status === "mismatch" && (
                    <p className="letter-review-warning">{t("letter.reviewMismatch")}</p>
                  )}
                  {review.plausibility?.status === "uncertain" && review.confirmation === "required" && (
                    <p className="letter-review-warning">{t("letter.reviewUncertain")}</p>
                  )}
                  {review.confirmation === "confirmed" && (
                    <p className="letter-review-ok">{t("letter.reviewConfirmed")}</p>
                  )}
                </div>
              )}

              <div className="letter-selected">
                <div className="letter-review-head">
                  <strong>{t("letter.selectedDescription")}</strong>
                  {selected && (
                    <span className="letter-origin">{t(`letter.origin.${selected.origin}`)}</span>
                  )}
                </div>
                {selected ? (
                  <p className="letter-description-preview">{selectedPreview}</p>
                ) : (
                  <p className="letter-review-warning">{t("letter.reviewInsufficient")}</p>
                )}
                <p className="letter-hint">{t("letter.reviewOnlyNote")}</p>
              </div>
            </div>

            <div className="letter-candidate">
              <h5>{t("letter.candidateDetails")}</h5>
              <p className="letter-hint">{t("letter.candidateHint")}</p>
              <div className="letter-candidate-grid">
                <label className="letter-field">
                  <span>{t("letter.manualSkills")}</span>
                  <input
                    value={manualSkills}
                    onChange={(event) => setManualSkills(event.target.value)}
                    placeholder={t("letter.manualSkillsPh")}
                  />
                </label>
                <label className="letter-field">
                  <span>{t("letter.startDate")}</span>
                  <input
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    placeholder={t("letter.startDatePh")}
                  />
                </label>
                <label className="letter-field">
                  <span>{t("letter.manualExperience")}</span>
                  <textarea
                    rows={2}
                    value={manualExperience}
                    onChange={(event) => setManualExperience(event.target.value)}
                    placeholder={t("letter.manualExperiencePh")}
                  />
                </label>
                <label className="letter-field">
                  <span>{t("letter.manualQualifications")}</span>
                  <textarea
                    rows={2}
                    value={manualQualifications}
                    onChange={(event) => setManualQualifications(event.target.value)}
                    placeholder={t("letter.manualQualificationsPh")}
                  />
                </label>
                <label className="letter-field">
                  <span>{t("letter.manualMotivation")}</span>
                  <textarea
                    rows={2}
                    value={manualMotivation}
                    onChange={(event) => setManualMotivation(event.target.value)}
                    placeholder={t("letter.manualMotivationPh")}
                  />
                </label>
                <label className="letter-field">
                  <span>{t("letter.salaryExpectation")}</span>
                  <input
                    value={salaryExpectation}
                    onChange={(event) => setSalaryExpectation(event.target.value)}
                    placeholder={t("letter.salaryExpectationPh")}
                  />
                </label>
              </div>

              <div className="letter-candidate-options">
                <label className="letter-field">
                  <span>{t("letter.style")}</span>
                  <select value={style} onChange={(event) => setStyle(event.target.value as CoverLetterStyle)}>
                    <option value="professional">{t("letter.style.professional")}</option>
                    <option value="warm">{t("letter.style.warm")}</option>
                    <option value="concise">{t("letter.style.concise")}</option>
                    <option value="formal">{t("letter.style.formal")}</option>
                  </select>
                </label>
                <label className="letter-field">
                  <span>{t("letter.length")}</span>
                  <select value={length} onChange={(event) => setLength(event.target.value as CoverLetterLength)}>
                    <option value="short">{t("letter.length.short")}</option>
                    <option value="one_page">{t("letter.length.one_page")}</option>
                    <option value="detailed">{t("letter.length.detailed")}</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="letter-generation-summary">
              <h5>{t("letter.generationSummary")}</h5>
              <dl>
                <dt>{t("letter.dataJob")}</dt>
                <dd>{job.company_name || t("letter.companyUnknown")} · {job.title || t("match.unknownRole")}</dd>
                <dt>{t("letter.dataDescription")}</dt>
                <dd>
                  {t(`letter.origin.${selectedOrigin}`)} ·{" "}
                  {completenessLabel(selectedDescription?.completeness ?? "missing")}
                </dd>
                <dt>{t("letter.dataCv")}</dt>
                <dd>
                  {selectedCv
                    ? `${selectedCv.name} · ${t("letter.cvAnonymized")}`
                    : t("letter.cvNone")}
                </dd>
                <dt>{t("letter.dataManual")}</dt>
                <dd>{manualSummary}</dd>
                <dt>{t("letter.dataModel")}</dt>
                <dd>{activeModel || t("letter.modelDefault")}</dd>
              </dl>
              {completedDescriptionIsLimited && (
                <p className="letter-review-warning">{t("letter.limitedDescription")}</p>
              )}
              <p className="letter-hint">{t("letter.externalProcessing")}</p>
            </div>

            {generationError && (
              <p className="letter-review-warning" role="alert">
                {generationError}
              </p>
            )}

            <p id={helpId} className="letter-notice" role="note">
              {t("letter.preparationNotice")}
            </p>
            <p className="letter-hint">{t("letter.noAiUntilStart")}</p>

            <div className="letter-intro-actions">
              <button
                type="button"
                className="letter-btn"
                onClick={handleStart}
              >
                {t("letter.generate")}
              </button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="letter-loading" role="status" aria-live="polite">
            <span className="spinner" />
            {loadingStage === "cv" ? t("letter.processingCv") : t("letter.loading")}
          </div>
        )}

        {phase === "error" && (
          <div className="letter-output letter-error" role="alert">
            {t("letter.errorPrefix")}
            {error}
            <div className="letter-intro-actions">
              <button type="button" className="letter-btn" onClick={() => void handleStart()}>
                {t("letter.retry")}
              </button>
            </div>
          </div>
        )}

        {phase === "done" && fallbackNote && (
          <p className="fallback-note letter-fallback-note">{t("model.fallbackNote")}</p>
        )}

        {phase === "done" && generationError && (
          <p className="letter-review-warning letter-draft-error" role="alert">
            {generationError}
          </p>
        )}

        {phase === "done" && (
          <div className="letter-editor-wrap">
            {letterTextStatus && (
              <p className="letter-review-success letter-text-status" role="status">
                {t(`letter.status.${letterTextStatus}`)}
              </p>
            )}
            <textarea
              ref={editorRef}
              className="letter-editor"
              value={letter}
              onChange={(event) => handleLetterChange(event.target.value)}
              maxLength={MAX_REVISION_DRAFT_LENGTH}
              aria-label={t("letter.editorAria")}
              disabled={adopting}
            />
            <p className="letter-hint">{t("letter.editHint")}</p>
            <label className="letter-field letter-feedback">
              <span>{t("letter.feedbackLabel")}</span>
              <textarea
                rows={3}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                maxLength={MAX_REVISION_FEEDBACK_LENGTH}
                placeholder={t("letter.feedbackPlaceholder")}
              />
            </label>
            <p className="letter-hint">{t("letter.revisionPrivacy")}</p>
            {regenerateWarning && (
              <p className="letter-review-warning" role="alert">
                {t("letter.regenerateWarning")}
              </p>
            )}
            {reviseWarning && (
              <p className="letter-review-warning" role="alert">
                {t("letter.reviseWarning")}
              </p>
            )}
          </div>
        )}

        {phase === "done" && (authenticated ? Boolean(adoptionResult || adoptionError) : true) && (
          <section className="letter-handoff" aria-labelledby={`${headingId}-handoff`}>
            {authenticated ? (
              <>
                {adoptionResult && (
                  <div className="letter-handoff__success" role="status">
                    <h5
                      ref={adoptionStatusRef}
                      id={`${headingId}-handoff`}
                      tabIndex={-1}
                    >
                      {t("letter.handoff.ready")}
                    </h5>                    <p>
                      {adoptionResult === "updated"
                        ? t("letter.handoff.updated")
                        : t("letter.handoff.created")}
                    </p>
                    {onOpenApplications && (
                      <button type="button" className="letter-btn" onClick={onOpenApplications}>
                        {t("letter.handoff.openApplications")}
                      </button>
                    )}
                  </div>
                )}
                {adoptionError && (
                  <p ref={adoptionErrorRef} className="letter-review-warning" role="alert" tabIndex={-1}>
                    {adoptionError}
                  </p>
                )}
              </>
            ) : (
              <div className="letter-handoff__guest">
                <h5 id={`${headingId}-handoff`}>{t("letter.handoff.guestTitle")}</h5>
                <p>{t("letter.handoff.guestText")}</p>
                <p className="letter-hint">{t("letter.handoff.guestSession")}</p>
                {loginConfirm ? (
                  <div className="letter-handoff__confirm" role="alert">
                    <p>{t("letter.handoff.loginWarning")}</p>
                    <div className="letter-handoff__actions">
                      <button
                        ref={loginConfirmRef}
                        type="button"
                        className="letter-btn"
                        onClick={() => onSignIn?.()}
                      >
                        {t("letter.handoff.loginContinue")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          restoreLoginFocusRef.current = true;
                          setLoginConfirm(false);
                        }}
                      >
                        {t("applications.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="letter-btn" onClick={handleGuestSignIn} ref={loginTriggerRef}>
                    {t("letter.handoff.loginAction")}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {phase === "done" && (
          <div className="modal-actions">
            {onAdoptAsApplication && (
              <div
                className={`letter-application-adopt${hasApplicationDraft ? " letter-application-adopt--existing" : ""}`}
              >
                {hasApplicationDraft && (
                  <p className="letter-application-existing" role="status">
                    <span className="letter-application-check" aria-hidden="true">✓</span>
                    {t("letter.applicationDraftExists")}
                  </p>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!letter.trim() || !job.url || adopting}
                  onClick={() => void handleAdoptAsApplication()}
                >
                  {adopting
                    ? t("letter.handoff.adopting")
                    : hasApplicationDraft
                      ? t("letter.updateApplicationDraft")
                      : t("letter.adoptApplication")}
                </button>
              </div>
            )}
            <button type="button" className="btn-ghost" onClick={handleCopy}>
              {copied ? t("letter.copied") : t("letter.copy")}
            </button>
            <button type="button" className="btn-ghost" onClick={handleDownload}>
              {t("letter.download")}
            </button>
            <button type="button" className="btn-ghost" onClick={handleImprove}>
              {reviseWarning ? t("letter.confirmImprove") : t("letter.improve")}
            </button>
            <button type="button" className="btn-ghost" onClick={handleRegenerate}>
              {regenerateWarning ? t("letter.confirmRegenerate") : t("letter.regenerate")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
