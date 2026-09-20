import { useLang } from "../i18n";


interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export default function CvAnonymizationChoice({ value, onChange, disabled }: Props) {
  const { t } = useLang();

  const options = [
    {
      value: "anonymized",
      label: t("cv.anonymizationOption1"),
      description: t("cv.anonymizationDesc1"),
    },
    {
      value: "not-anonymized",
      label: t("cv.anonymizationOption2"),
      description: t("cv.anonymizationDesc2"),
    },
  ] as const;

  return (
    <fieldset className="cv-anonymization-choice" aria-labelledby="cv-anonymization-title">
      <legend id="cv-anonymization-title" className="cv-anonymization-choice__title">
        {t("cv.anonymizationTitle")}
      </legend>

      <div className="cv-anonymization-choice__options">
        {options.map((option) => (
          <label key={option.value} className={`cv-anonymization-choice__option${value === option.value ? " selected" : ""}`}>
            <input
              type="radio"
              name="anonymization"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="cv-anonymization-choice__input"
            />
            <div className="cv-anonymization-choice__content">
              <span className="cv-anonymization-choice__label">{option.label}</span>
              <span className="cv-anonymization-choice__description">{option.description}</span>
            </div>
          </label>
        ))}
      </div>

      <p className="cv-anonymization-choice__hint" aria-live="polite">
        {value === "anonymized" ? t("cv.anonymized") : t("cv.notAnonymized")}
      </p>
    </fieldset>
  );
}

