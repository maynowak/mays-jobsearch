import type { ModelOption } from "../types";
import type { ModelsState } from "../hooks/useAvailableModels";
import { useLang } from "../i18n";

interface Props {
  state: ModelsState;
  models: ModelOption[];
  defaultModel: string | null;
  value: string | null;
  onChange: (model: string) => void;
}

export default function ModelSelector({ state, models, defaultModel, value, onChange }: Props) {
  const { t } = useLang();

  let control;
  if (state === "ready") {
    const sorted = [...models].sort((a, b) => {
      if (a.id === value) return -1;
      if (b.id === value) return 1;
      return a.name.localeCompare(b.name);
    });
    control = (
      <select
        id="model-select"
        className="model-select"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {sorted.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    );
  } else if (state === "loading") {
    control = (
      <select id="model-select" className="model-select" disabled aria-busy="true">
        <option>{t("model.loading")}</option>
      </select>
    );
  } else {
    const fallback = defaultModel || "";
    control = (
      <>
        <select id="model-select" className="model-select" disabled value={fallback}>
          <option value={fallback}>{fallback || t("model.none")}</option>
        </select>
        <span className="model-hint">
          {state === "error" ? t("model.loadFailed") : t("model.empty")}
        </span>
      </>
    );
  }

  return (
    <div className="model-field">
      <label className="model-label" htmlFor="model-select">
        {t("model.label")}
      </label>
      {control}
      {state === "ready" && value && <span className="model-id">{value}</span>}
    </div>
  );
}