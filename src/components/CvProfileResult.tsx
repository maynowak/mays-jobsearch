import { useState } from "react";
import type { Profile, SuggestedProfile } from "../types";
import { parseSkills, formatSkills } from "../lib/skills";
import { useLang } from "../i18n";
import { useCityAutocomplete } from "../hooks/useCityAutocomplete";
import { RADIUS_KM_OPTIONS } from "../types";

interface Props {
  suggested: SuggestedProfile;
  busy: boolean;
  loadingLabel: string;
  onConfirm: (profile: Profile) => void;
  onBack: () => void;
}

export default function CvProfileResult({
  suggested,
  busy,
  loadingLabel,
  onConfirm,
  onBack,
}: Props) {
  const { t } = useLang();
  const [parsedSkills, setParsedSkills] = useState<string[]>(() => suggested.skills);
  const [experienceLevel, setExperienceLevel] = useState(suggested.experienceLevel);
  const [targetRoles, setTargetRoles] = useState(suggested.targetRoles.join(", "));
  const [cityValue, setCityValue] = useState(suggested.location);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
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
  } = useCityAutocomplete(cityValue, setCityValue);

  const confirm = () => {
    onConfirm({
      skills: formatSkills(parsedSkills),
      targetRole: suggested.targetRoles[0] || "",
      city: city.trim(),
      radiusKm,
      workModes: [],
      employmentTypes: ["full_time"],
    });
  };

  return (
    <div id="cv-panel" className="cv-result">
      <h3 className="cv-result-heading">{t("cv.resultHeading")}</h3>

      <div className="field">
        <label htmlFor="cv-skills">{t("cv.skills")}</label>
        <input
          id="cv-skills"
          type="text"
          value={formatSkills(parsedSkills)}
          onChange={(e) => {
            const parsed = parseSkills(e.target.value);
            setParsedSkills(parsed);
          }}
          disabled={busy}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="cv-level">{t("cv.experienceLevel")}</label>
        <input
          id="cv-level"
          type="text"
          value={experienceLevel}
          onChange={(e) => setExperienceLevel(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="cv-targetRole">{t("cv.targetRoles")}</label>
        <input
          id="cv-targetRole"
          type="text"
          value={targetRoles}
          onChange={(e) => setTargetRoles(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
      </div>

      <div className="field city-field" ref={boxRef}>
        <label htmlFor="cv-city">{t("cv.location")}</label>
        <input
          id="cv-city"
          type="text"
          value={city}
          onChange={(e) => handleCityChange(e.target.value)}
          onKeyDown={handleCityKeyDown}
          disabled={busy}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="cv-city-suggestions"
          aria-activedescendant={active >= 0 ? `cv-city-option-${active}` : undefined}
        />
        {open && (
          <ul id="cv-city-suggestions" className="city-suggestions" role="listbox">
            {loading && <li className="city-suggestion-status">{t("search.citySearching")}</li>}
            {suggestions.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  id={`cv-city-option-${i}`}
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

      <div className="field">
        <label htmlFor="cv-radius">{t("search.radius")}</label>
        <select
          id="cv-radius"
          value={radiusKm ?? ""}
          onChange={(e) =>
            setRadiusKm(e.target.value === "" ? null : Number(e.target.value))
          }
          disabled={busy}
        >
          <option value="">{t("search.radiusNone")}</option>
          {RADIUS_KM_OPTIONS.map((km) => (
            <option key={km} value={km}>
              {t("search.radiusOption", { km })}
            </option>
          ))}
        </select>
      </div>

      <div className="cv-result-actions">
        <button type="button" className="cv-confirm" onClick={confirm} disabled={busy}>
          <span className="btn-label">{busy ? loadingLabel : t("cv.confirm")}</span>
          {busy && <span className="spinner" />}
        </button>

        <button type="button" className="btn-ghost cv-manual" onClick={onBack}>
          {t("cv.backToEdit")}
        </button>
      </div>
    </div>
  );
}