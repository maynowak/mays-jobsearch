import { useLang } from "../i18n";

type StepId = 
  | "document" 
  | "consent" 
  | "model"
  | "profile" 
  | "anonymization" 
  | "goal" 
  | "skill"
  | "target" 
  | "processing" 
  | "complete"
  | "improvement"
  | "reanalysis"
  | "match-impact";

const STEPS: readonly { id: StepId; labelKey: string }[] = [
  { id: "document", labelKey: "cv.processingStep1" },
  { id: "consent", labelKey: "cv.processingStep2" },
  // Reihenfolge = tatsaechliche Verarbeitung: Anonymisierung erfolgt immer
  // VOR dem externen Modell-Aufruf (Privacy Boundary, siehe AI_AUDITLOG).
  { id: "model", labelKey: "cv.processingStep3" },
  { id: "anonymization", labelKey: "cv.processingStep5" },
  { id: "profile", labelKey: "cv.processingStep4" },
  { id: "goal", labelKey: "cv.processingStep6" },
  { id: "skill", labelKey: "cv.processingStepSkill" },
  { id: "target", labelKey: "cv.processingStep7" },
  { id: "processing", labelKey: "cv.processingStep8" },
  { id: "complete", labelKey: "cv.processingStep9" },
  { id: "improvement", labelKey: "cv.processingStepImprovement" },
  { id: "reanalysis", labelKey: "cv.processingStepReanalysis" },
  { id: "match-impact", labelKey: "cv.processingStepMatchImpact" },
] as const;

interface Props {
  currentStep: StepId;
}

export default function CvProcessingSteps({ currentStep }: Props) {
  const { t } = useLang();

  const getStepStatus = (stepId: StepId): "pending" | "current" | "completed" => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    const stepIndex = STEPS.findIndex((s) => s.id === stepId);
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  return (
    <nav className="cv-processing-steps" aria-label={t("cv.statusTitle")}>
      <ol className="cv-processing-steps__list">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          return (
            <li key={step.id} className={`cv-processing-steps__item ${status}`}>
              <span className="cv-processing-steps__marker" aria-hidden="true">
                {status === "completed" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {status === "current" && (
                  <span className="cv-processing-steps__pulse" aria-hidden="true" />
                )}
              </span>
              <span className="cv-processing-steps__label">{t(step.labelKey)}</span>
              {index < STEPS.length - 1 && (
                <span className={`cv-processing-steps__connector ${status === "completed" ? "completed" : ""}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

