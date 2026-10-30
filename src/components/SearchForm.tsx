import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { EmploymentType, Profile, WorkMode } from "../types";
import { EMPLOYMENT_TYPES, RADIUS_KM_OPTIONS, WORK_MODES } from "../types";
import { useLang } from "../i18n";
import { useCityAutocomplete } from "../hooks/useCityAutocomplete";
import CvUpload from "./CvUpload";
import FieldClear from "./FieldClear";
import { parseSkills, formatSkills } from "../lib/skills";
import { parseTargetRoles, formatTargetRoles } from "../lib/skills";
import type { ManualSearchProfile } from "../lib/manualSearchProfiles";

type Phase = "idle" | "searching" | "scoring" | "matching";

interface Props {
  phase: Phase;
  value: Profile;
  onChange: (profile: Profile) => void;
  onSubmit: (profile: Profile) => void;
  onMatch?: () => void;
  matching?: boolean;
  hasJobs?: boolean;
  rematch?: boolean;
  // CV-UPLOAD-UX-01: Quick-Upload gibt die validierte Datei nur noch an den
  // CV-Workflow (Pfad B, Overlay) weiter — Modellwahl/Consent/Profil-Erstellung
  // laufen dort; die Suchmaske braucht keine Modell- und CV-Listen-Props mehr.
  onWorkflowStart: (file: File) => void;
  openCvUpload?: boolean;
  manualProfiles?: ManualSearchProfile[];
  authenticated?: boolean;
}

type Mode = "manual" | "cv";

export default function SearchForm({
  phase,
  value,
  onChange,
  onSubmit,
  onMatch,
  matching = false,
  hasJobs = false,
  rematch,
  onWorkflowStart,
  openCvUpload = false,
  manualProfiles = [],
  authenticated = false,
}: Props) {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("manual");
  useEffect(() => {
    if (openCvUpload) setMode("cv");
  }, [openCvUpload]);
  const { skills: rawSkills, targetRoles } = value;
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Rohtext-State: Der angezeigte Text wird nicht bei jedem Tastenschlag
  // normalisiert, damit Leerzeichen in Multi-Word-Skills (z. B. "Spring Boot")
  // normal eingegeben werden können. Tokenisierung passiert erst beim Lesen /
  // Absenden über parseSkills.
  const [skillsText, setSkillsText] = useState<string>(() => formatSkills(parseSkills(rawSkills)));
  const parsedSkills = parseSkills(skillsText);
  const [targetRolesText, setTargetRolesText] = useState<string>(() => formatTargetRoles(targetRoles ?? []));
  const parsedTargetRoles = parseTargetRoles(targetRolesText);
  const [selectedManualProfileId, setSelectedManualProfileId] = useState("");
  useEffect(() => {
    if (!authenticated || !manualProfiles.some((profile) => profile.id === selectedManualProfileId)) {
      setSelectedManualProfileId("");
    }
  }, [authenticated, manualProfiles, selectedManualProfileId]);
  const {
    city: cityValue,
    suggestions,
    open,
    loading,
    active,
    boxRef,
    handleChange: handleCityChange,
    handleKeyDown: handleCityKeyDown,
    select: selectCity,
  } = useCityAutocomplete(value.city, (city) => {
    setSelectedManualProfileId("");
    onChange({ ...value, city });
  });

  const busy = phase !== "idle" || matching;
  const isMatching = matching;
  const label =
    phase === "searching"
      ? t("search.searching")
      : phase === "scoring"
        ? t("search.scoring")
        : isMatching
          ? t("search.matching")
          : rematch
            ? t("search.buttonRematch")
            : t("search.button");

  const toggleIn = (list: WorkMode[], mode: WorkMode): WorkMode[] =>
    list.includes(mode) ? list.filter((m) => m !== mode) : [...list, mode];

  const toggleEmployment = (list: EmploymentType[], type: EmploymentType): EmploymentType[] => {
    if (list.includes(type)) {
      const next = list.filter((t) => t !== type);
      return next.length > 0 ? next : list;
    }
    return [...list, type];
  };

  // Externe Profil-Änderungen (z. B. aus dem CV-Flow) in das Textfeld
  // übernehmen. Eigene Eingaben sind daran erkennbar, dass der Parent-Wert
  // dem lokalen Text entspricht — dann darf nichts zurückgeschrieben werden,
  // sonst würden getipfte Leerzeichen wieder entfernt.
  const [prevRawSkills, setPrevRawSkills] = useState(rawSkills);
  const [prevTargetRoles, setPrevTargetRoles] = useState(targetRoles ?? []);
  if (rawSkills !== prevRawSkills) {
    setPrevRawSkills(rawSkills);
    if (rawSkills !== skillsText) {
      setSkillsText(rawSkills);
    }
  }
  if (targetRoles !== prevTargetRoles) {
    setPrevTargetRoles(targetRoles ?? []);
    if (formatTargetRoles(targetRoles ?? []) !== targetRolesText) {
      setTargetRolesText(formatTargetRoles(targetRoles ?? []));
    }
  }

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSkillsText(e.target.value);
    setSelectedManualProfileId("");
    onChange({ ...value, skills: e.target.value });
  };

  const clearSkills = () => {
    setSkillsText("");
    setSelectedManualProfileId("");
    onChange({ ...value, skills: "" });
  };

  const clearTargetRoles = () => {
    setTargetRolesText("");
    setSelectedManualProfileId("");
    onChange({ ...value, targetRoles: [] });
  };

  const clearCity = () => {
    setSelectedManualProfileId("");
    handleCityChange("");
  };

  const handleProfileSelect = (profile: ManualSearchProfile) => {
    const searchConfig = profile.searchConfig;
    setSelectedManualProfileId(profile.id);
    setSkillsText(searchConfig.skills ?? "");
    setTargetRolesText(formatTargetRoles(searchConfig.targetRoles ?? []));
    setShowAdvanced(Boolean(searchConfig.targetRoles?.length || searchConfig.city?.trim() || searchConfig.radiusKm !== null));
    onChange({
      ...value,
      skills: searchConfig.skills ?? "",
      targetRoles: [...searchConfig.targetRoles],
      city: searchConfig.city ?? "",
      radiusKm: searchConfig.radiusKm,
      workModes: searchConfig.workModes ?? [],
      employmentTypes: searchConfig.employmentTypes ?? ["full_time"],
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "cv") return;
    onSubmit({
      skills: formatSkills(parsedSkills),
      targetRoles: parsedTargetRoles,
      city: cityValue.trim(),
      radiusKm: value.radiusKm,
      workModes: value.workModes,
      employmentTypes: value.employmentTypes,
    });
  };

  return (
    <form id="search-form" onSubmit={handleSubmit} noValidate>
      <h2 className="step-heading">{t("search.step")}</h2>

      {/* MAYS-SEARCH-UX-02: Profile dropdown */}
      {authenticated && manualProfiles.length > 0 && (
        <div className="field">
          <label htmlFor="manual-profile">{t("search.profileLabel")}</label>
          <div className="field-input-wrap">
            <select
              id="manual-profile"
              value={selectedManualProfileId}
              onChange={(e) => {
                if (e.target.value) {
                  const profile = manualProfiles.find(p => p.id === e.target.value);
                  if (profile) handleProfileSelect(profile);
                }
              }}
              disabled={busy}
            >
              <option value="">{t("search.profilePlaceholder")}</option>
              {manualProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
          <div className="field-input-wrap">
            <input
              id="skills"
              type="text"
              placeholder={t("search.skillsPh")}
              value={skillsText}
              onChange={handleSkillsChange}
              disabled={busy}
              autoComplete="off"
            />
            <FieldClear
              visible={skillsText.trim().length > 0}
              disabled={busy}
              label={t("field.clear")}
              onClear={clearSkills}
            />
          </div>
        </div>

        {/* MAYS-SEARCH-UX-02: Collapsible target role and city fields */}
        <div className="field-collapsible">
          <h3 className="field-collapsible-title">
            <span>{t("search.moreOptions")}</span>
            <button
              type="button"
              className={`field-collapsible-toggle${showAdvanced ? " open" : ""}`}
              aria-expanded={showAdvanced}
              aria-controls="search-optional-fields"
              aria-label={showAdvanced ? t("search.collapsible.collapse") : t("search.collapsible.expand")}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className="field-collapsible-icon">{showAdvanced ? "−" : "+"}</span>
              <span className="field-collapsible-text">{showAdvanced ? t("search.collapsible.collapse") : t("search.collapsible.expand")}</span>
            </button>
          </h3>
          {!showAdvanced && (targetRolesText.trim() || cityValue.trim() || value.radiusKm !== null) && (
            <span className="field-hint search-options-active">{t("search.optionsActive")}</span>
          )}
          <div id="search-optional-fields" className={`field-collapsible-content${showAdvanced ? " open" : ""}`} hidden={!showAdvanced}>
            <div className="field">
              <label htmlFor="targetRole">{t("search.targetRole")}</label>
              <div className="field-input-wrap">
                <input
                  id="targetRole"
                  type="text"
                  placeholder={t("search.targetRolePh")}
                  value={targetRolesText}
                  onChange={(e) => {
                  setTargetRolesText(e.target.value);
                  setSelectedManualProfileId("");
                    onChange({ ...value, targetRoles: parseTargetRoles(e.target.value) });
                  }}
                  disabled={busy}
                  autoComplete="off"
                />
                <FieldClear
                  visible={targetRolesText.trim().length > 0}
                  disabled={busy}
                  label={t("field.clear")}
                  onClear={clearTargetRoles}
                />
              </div>
            </div>

            <div className="field city-field" ref={boxRef}>
              <label htmlFor="city">{t("search.city")}</label>
              <div className="field-input-wrap">
                <input
                  id="city"
                  type="text"
                  placeholder={t("search.cityPh")}
                  value={cityValue}
                  onChange={(e) => {
                    setShowAdvanced(true);
                    setSelectedManualProfileId("");
                    handleCityChange(e.target.value);
                  }}
                  onKeyDown={handleCityKeyDown}
                  disabled={busy}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="city-suggestions"
                  aria-activedescendant={active >= 0 ? `city-option-${active}` : undefined}
                />
                <FieldClear
                  visible={cityValue.trim().length > 0}
                  disabled={busy}
                  label={t("field.clear")}
                  onClear={clearCity}
                />
              </div>
              <p className="field-hint">{t("search.cityHelp")}</p>
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
                          setSelectedManualProfileId("");
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
              <label htmlFor="radius">{t("search.radius")}</label>
              <select
                id="radius"
                value={value.radiusKm ?? ""}
                onChange={(e) => {
                  setShowAdvanced(true);
                  setSelectedManualProfileId("");
                  onChange({ ...value, radiusKm: e.target.value === "" ? null : Number(e.target.value) });
                }}
                disabled={busy}
              >
                <option value="">{t("search.radiusNone")}</option>
                {RADIUS_KM_OPTIONS.map((km) => <option key={km} value={km}>{t("search.radiusOption", { km })}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-label">{t("search.workMode")}</span>
          <div className="check-group" role="group" aria-label={t("search.workMode")}>
            {WORK_MODES.map((mode) => (
              <label key={mode} className="check-item">
                <input
                  type="checkbox"
                  checked={value.workModes.includes(mode)}
                  onChange={() => {
                    setSelectedManualProfileId("");
                    onChange({ ...value, workModes: toggleIn(value.workModes, mode) });
                  }}
                  disabled={busy}
                />
                <span>{t(`workMode.${mode}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">{t("search.employmentType")}</span>
          <div className="check-group" role="group" aria-label={t("search.employmentType")}>
            {EMPLOYMENT_TYPES.map((type) => (
              <label key={type} className="check-item">
                <input
                  type="checkbox"
                  checked={value.employmentTypes.includes(type)}
                  onChange={() => {
                    setSelectedManualProfileId("");
                    onChange({
                      ...value,
                      employmentTypes: toggleEmployment(value.employmentTypes, type),
                    });
                  }}
                  disabled={busy}
                />
                <span>{t(`employmentType.${type}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <button id="find-btn" type="submit" disabled={busy}>
          <span className="btn-label">{label}</span>
          {busy && <span className="spinner" />}
        </button>
        {hasJobs && !isMatching && onMatch && (
          <button
            id="match-btn"
            type="button"
            className="match-btn"
            onClick={onMatch}
            disabled={busy}
          >
            <span className="btn-label">{t("search.matchButton")}</span>
            {matching && <span className="spinner" />}
          </button>
        )}
        {hasJobs && isMatching && onMatch && (
          <button
            id="match-btn"
            type="button"
            className="match-btn"
            onClick={onMatch}
            disabled
          >
            <span className="btn-label">{t("search.matching")}</span>
            <span className="spinner" />
          </button>
        )}
        </div>
      ) : (
        <CvUpload
          onManual={() => setMode("manual")}
          onWorkflowStart={onWorkflowStart}
        />
      )}
    </form>
  );
}
