import { useEffect, useState } from "react";
import { useLang } from "../i18n";
import { fetchModels } from "../api";

interface Props {
  value: string | null;
  onChange: (value: string) => void;
  disabled: boolean;
  recommendedModel: string | null;
}

export default function CvModelSelector({ value, onChange, disabled, recommendedModel }: Props) {
  const { t } = useLang();
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      try {
        const data = await fetchModels();
        if (mounted) {
          setModels(data.models || []);
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadModels();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="cv-model-selector__loading">
        <span className="spinner" aria-hidden="true" />
        <span>{t("model.loading")}</span>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="cv-model-selector__error">
        {t("model.empty")}
      </div>
    );
  }

  return (
    <fieldset className="cv-model-selector" aria-labelledby="cv-model-title">
      <legend id="cv-model-title" className="cv-model-selector__title">
        {t("cv.modelSelect")}
      </legend>

      <div className="cv-model-selector__options" role="radiogroup" aria-label={t("model.label")}>
        {models.map((model) => (
          <label key={model.id} className={`cv-model-selector__option${value === model.id ? " selected" : ""}${disabled ? " disabled" : ""}`}>
            <input
              type="radio"
              name="cv-model"
              value={model.id}
              checked={value === model.id}
              onChange={() => onChange(model.id)}
              disabled={disabled}
              className="cv-model-selector__input"
            />
            <div className="cv-model-selector__content">
              <span className="cv-model-selector__name">{model.name}</span>
              {model.id === recommendedModel && (
                <span className="cv-model-selector__recommended">{t("model.recommended")}</span>
              )}
            </div>
          </label>
        ))}
      </div>

      {disabled && value && !models.some(m => m.id === value) && (
        <p className="cv-model-selector__unavailable">
          {t("cv.modelUnavailable")}
        </p>
      )}
    </fieldset>
  );
}

