import { useLang } from "../i18n";
import { useAvailableModels } from "../hooks/useAvailableModels";
import ModelSelector from "./ModelSelector";

interface Props {
  value: string | null;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export default function TranslationModelPicker({ value, onChange, disabled = false }: Props) {
  const { t } = useLang();
  const { state, models, defaultModel, recommendedModel } = useAvailableModels();

  if (state === "loading") {
    return <p className="job-translation__model-status" role="status">{t("model.loading")}</p>;
  }
  if (state === "empty") {
    return <p className="job-translation__model-status" role="status">{t("results.translation.noModels")}</p>;
  }
  if (state === "error") {
    return <p className="job-translation__model-status" role="alert">{t("model.loadFailed")}</p>;
  }

  return (
    <div className="job-translation__model">
      <span className="job-translation__model-label">{t("results.translation.modelLabel")}</span>
      <ModelSelector
        state={state}
        models={models}
        defaultModel={defaultModel}
        recommendedModel={recommendedModel}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
