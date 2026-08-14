import { useState } from "react";
import type { ChangeEvent } from "react";
import type { Profile, SuggestedProfile } from "../types";
import { createProfile } from "../api";
import { useLang } from "../i18n";
import { useCityAutocomplete } from "../hooks/useCityAutocomplete";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MIN_READABLE_CHARS = 20;

interface Props {
  busy: boolean;
  onSubmit: (profile: Profile) => void;
  onManual: () => void;
}

type Phase = "idle" | "reading" | "creating" | "ready";

export default function CvUpload({ busy, onSubmit, onManual }: Props) {
  const { t } = useLang();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedProfile | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    const mimeOk = file.type === "application/pdf" || file.type === "";
    const extOk = file.name.toLowerCase().endsWith(".pdf");
    if (!mimeOk || !extOk) {
      setError(t("cv.notPdf"));
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError(t("cv.tooLarge"));
      return;
    }

    setPhase("reading");
    try {
      const { extractPdfText } = await import("../lib/pdf");
      const text = await extractPdfText(file);
      if (text.replace(/\s/g, "").length < MIN_READABLE_CHARS) {
        setPhase("idle");
        setError(t("cv.scannedError"));
        return;
      }
      setPhase("creating");
      const profile = await createProfile(text);
      setSuggested(profile);
      setPhase("ready");
    } catch {
      setPhase("idle");
      setError(t("cv.processError"));
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  };

  if (phase === "ready" && suggested) {
    return (
      <EditableProfile suggested={suggested} busy={busy} onSubmit={onSubmit} onManual={onManual} />
    );
  }

  return (
    <div id="cv-panel" className="cv-panel">
      <p className="cv-privacy">{t("cv.privacyNote")}</p>

      <label className="cv-upload">
        <span>{t("cv.uploadAction")}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleChange}
          className="visually-hidden"
        />
      </label>

      {phase === "reading" && (
        <p className="cv-status" role="status">
          <span className="spinner" aria-hidden="true" />
          {t("cv.reading")}
        </p>
      )}

      {phase === "creating" && (
        <p className="cv-status" role="status">
          <span className="spinner" aria-hidden="true" />
          {t("cv.creating")}
        </p>
      )}

      {error && (
        <p className="alert alert-error cv-error" role="alert">
          {error}
        </p>
      )}

      {phase === "idle" && (
        <button type="button" className="btn-ghost cv-manual" onClick={onManual}>
          {t("cv.manual")}
        </button>
      )}
    </div>
  );
}

function EditableProfile({
  suggested,
  busy,
  onSubmit,
  onManual,
}: {
  suggested: SuggestedProfile;
  busy: boolean;
  onSubmit: (profile: Profile) => void;
  onManual: () => void;
}) {
  const { t } = useLang();
  const [skills, setSkills] = useState(suggested.skills.join(", "));
  const [experienceLevel, setExperienceLevel] = useState(suggested.experienceLevel);
  const [targetRoles, setTargetRoles] = useState(suggested.targetRoles.join(", "));
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
  } = useCityAutocomplete(suggested.location);

  const confirm = () => {
    onSubmit({
      skills: skills.trim(),
      targetRole: targetRoles.trim(),
      city: city.trim(),
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
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
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

      <button type="button" className="cv-confirm" onClick={confirm} disabled={busy}>
        {t("cv.confirm")}
      </button>

      <button type="button" className="btn-ghost cv-manual" onClick={onManual}>
        {t("cv.manual")}
      </button>
    </div>
  );
}