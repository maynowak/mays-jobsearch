import { useLang } from "../i18n";

import type { CvProcessingStep } from "../types";

interface Props {
  step: CvProcessingStep;
  error?: string | null;
  documentName?: string | null;
}

const STEP_MESSAGES: Record<string, string> = {
  "document-selected": "cv.statusDocumentSelected",
  "consent-required": "cv.statusConsentRequired",
  "consent-given": "cv.statusConsentGiven",
  "model-selection": "cv.statusModelSelection",
  "creating-profile": "cv.statusProfileCreating",
  "anonymizing": "cv.statusAnonymizing",
  "goal-selection": "cv.statusGoalSelection",
  "ats-processing": "cv.statusATSProcessing",
  "ai-searching": "cv.statusAISearching",
  "success": "cv.statusSuccess",
  "error": "cv.statusError",
};

export default function CvProcessingStatus({ step, error, documentName }: Props) {
  const { t } = useLang();

  if (step === "idle" || step === "document-selected") {
    return null;
  }

  const messageKey = STEP_MESSAGES[step] || "cv.statusProcessing";
  const message = t(messageKey, { document: documentName || "" });

  const isError = step === "error";
  const isProcessing = ["model-selection", "creating-profile", "anonymizing", "ats-processing", "ai-searching"].includes(step);

  return (
    <div className={`cv-processing-status ${isError ? "error" : ""} ${isProcessing ? "processing" : ""}`} role="status" aria-live="polite">
      <div className="cv-processing-status__icon" aria-hidden="true">
        {isError ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : isProcessing ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11" />
          </svg>
        )}
      </div>
      <div className="cv-processing-status__content">
        <p className="cv-processing-status__message">{message}</p>
        {error && <p className="cv-processing-status__error">{error}</p>}
      </div>
    </div>
  );
}

