import { useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "../types";
import { useLang } from "../i18n";
import { useCityAutocomplete } from "../hooks/useCityAutocomplete";
import CvUpload from "./CvUpload";

type Phase = "idle" | "searching" | "scoring";

interface Props {
  phase: Phase;
  onSubmit: (profile: Profile) => void;
  model: string | null;
}

type Mode = "manual" | "cv";

export default function SearchForm({ phase, onSubmit, model }: Props) {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("manual");
  const [skills, setSkills] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const {
    city,
    suggestions,
    open,
    loading,
    active,
    boxRef,
    handleChange: handleCityChange,
    handleKeyDown: handleCityKeyDown,
    select: selectCity,
  } = useCityAutocomplete();

  const busy = phase !== "idle";
  const label =
    phase === "searching"
      ? t("search.searching")
      : phase === "scoring"
        ? t("search.scoring")
        : t("search.button");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "cv") return;
    onSubmit({ skills: skills.trim(), targetRole: targetRole.trim(), city: city.trim() });
  };

  return (
    <form id="search-form" onSubmit={handleSubmit} noValidate>
      <h2 className="step-heading">{t("search.step")}</h2>

      <div className="cv-mode-switch" role="tablist" aria-label={t("cv.modeLabel")}>
        <button
          type="button"
          role="tab"
          id="mode-manual"
          aria-selected={mode === "manual"}
          aria-controls="manual-panel"
          className={`cv-mode-btn${mode === "manual" ? " active" : ""}`}
          onClick={() => setMode("manual")}
        >
          {t("cv.manual")}
        </button>
        <button
          type="button"
          role="tab"
          id="mode-cv"
          aria-selected={mode === "cv"}
          aria-controls="cv-panel"
          className={`cv-mode-btn${mode === "cv" ? " active" : ""}`}
          onClick={() => setMode("cv")}
        >
          {t("cv.tabCv")}
        </button>
      </div>

      {mode === "manual" ? (
        <div id="manual-panel">
        <div className="field">
          <label htmlFor="skills">{t("search.skills")}</label>
          <input
            id="skills"
            type="text"
            placeholder={t("search.skillsPh")}
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="targetRole">{t("search.targetRole")}</label>
            <input
              id="targetRole"
              type="text"
              placeholder={t("search.targetRolePh")}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field city-field" ref={boxRef}>
            <label htmlFor="city">{t("search.city")}</label>
            <input
              id="city"
              type="text"
              placeholder={t("search.cityPh")}
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              onKeyDown={handleCityKeyDown}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls="city-suggestions"
              aria-activedescendant={active >= 0 ? `city-option-${active}` : undefined}
            />
            {open && (
              <ul id="city-suggestions" className="city-suggestions" role="listbox">
                {loading && <li className="city-suggestion-status">{t("search.citySearching")}</li>}
                {suggestions.map((s, i) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      id={`city-option-${i}`}
                      role="option"
                      aria-selected={i === active}
                      className={`city-suggestion${i === active ? " active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectCity(s);
                      }}
                    >
                      <span className="city-plz">{s.postalCode}</span>
                      <span className="city-name">{s.name}</span>
                    </button>
                  </li>
                ))}
                {!loading && suggestions.length === 0 && (
                  <li className="city-suggestion-status" role="status">
                    {t("search.noLocations")}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <button id="find-btn" type="submit" disabled={busy}>
          <span className="btn-label">{label}</span>
          {busy && <span className="spinner" />}
        </button>
        </div>
      ) : (
        <CvUpload busy={busy} onSubmit={onSubmit} onManual={() => setMode("manual")} model={model} />
      )}
    </form>
  );
}