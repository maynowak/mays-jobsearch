import { useLang } from "../i18n";

type ProcessingGoal = "ats" | "ai-search";

interface Props {
  value: ProcessingGoal;
  onChange: (value: ProcessingGoal) => void;
  disabled: boolean;
}

export default function CvGoalSelection({ value, onChange, disabled }: Props) {
  const { t } = useLang();

  const options = [
    {
      value: "ats",
      label: t("cv.goalATSLabel"),
      description: t("cv.goalATSDescription"),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h16M12 17v-8M8 17v-4M16 17v-10" />
        </svg>
      ),
    },
    {
      value: "ai-search",
      label: t("cv.goalAISearchLabel"),
      description: t("cv.goalAISearchDescription"),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      ),
    },
  ] as const;

  return (
    <fieldset className="cv-goal-selection" aria-labelledby="cv-goal-title">
      <legend id="cv-goal-title" className="cv-goal-selection__title">
        {t("cv.goalTitle")}
      </legend>

      <div className="cv-goal-selection__options" role="radiogroup" aria-label={t("cv.goalTitle")}>
        {options.map((option) => (
          <label key={option.value} className={`cv-goal-selection__option${value === option.value ? " selected" : ""}`}>
            <input
              type="radio"
              name="processing-goal"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="cv-goal-selection__input"
            />
            <div className="cv-goal-selection__content">
              <span className="cv-goal-selection__icon" aria-hidden="true">{option.icon}</span>
              <div className="cv-goal-selection__text">
                <span className="cv-goal-selection__label">{option.label}</span>
                <span className="cv-goal-selection__description">{option.description}</span>
              </div>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

