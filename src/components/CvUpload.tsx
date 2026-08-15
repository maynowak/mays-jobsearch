import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import type { Profile, SuggestedProfile } from "../types";
import { createProfile, isModelUnavailable, withModelFallback } from "../api";
import { useLang } from "../i18n";
import { useCityAutocomplete } from "../hooks/useCityAutocomplete";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MIN_READABLE_CHARS = 20;
const CV_PROFILE_LOCAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CV_PROFILE_STORE_PREFIX = "mj-cv-profile:";

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function sha256Hex(text: string): Promise<string | null> {
  try {
    if (!crypto?.subtle) return null;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function readLocalProfile(hash: string): SuggestedProfile | null {
  try {
    const raw = localStorage.getItem(`${CV_PROFILE_STORE_PREFIX}${hash}`);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { profile?: SuggestedProfile; savedAt?: number };
    if (!stored?.profile || typeof stored.savedAt !== "number") return null;
    if (Date.now() - stored.savedAt > CV_PROFILE_LOCAL_TTL_MS) {
      localStorage.removeItem(`${CV_PROFILE_STORE_PREFIX}${hash}`);
      return null;
    }
    return stored.profile;
  } catch {
    return null;
  }
}

function writeLocalProfile(hash: string, profile: SuggestedProfile): void {
  try {
    localStorage.setItem(
      `${CV_PROFILE_STORE_PREFIX}${hash}`,
      JSON.stringify({ profile, savedAt: Date.now() })
    );
  } catch {
    /* noop */
  }
}

interface Props {
  busy: boolean;
  loadingLabel: string;
  onSubmit: (profile: Profile) => void;
  onManual: () => void;
  model: string | null;
  availableModels: string[];
  recommendedModel: string | null;
}

type Phase = "idle" | "reading" | "creating" | "ready";

export default function CvUpload({
  busy,
  loadingLabel,
  onSubmit,
  onManual,
  model,
  availableModels,
  recommendedModel,
}: Props) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedProfile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fallbackNote, setFallbackNote] = useState(false);

  const processing = phase === "reading" || phase === "creating";

  const handleFile = async (file: File) => {
    if (processing) return;
    setError(null);
    setFallbackNote(false);
    setFileName(file.name);

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
      const normalized = normalizeText(text);
      const hash = await sha256Hex(normalized);
      if (hash) {
        const cachedProfile = readLocalProfile(hash);
        if (cachedProfile) {
          setSuggested(cachedProfile);
          setPhase("ready");
          return;
        }
      }
      const { data: profile, usedFallback } = await withModelFallback({
        initialModel: model,
        availableModels,
        recommendedModel,
        request: (m) => createProfile(text, m, hash ?? undefined),
      });
      if (hash) writeLocalProfile(hash, profile);
      setSuggested(profile);
      setFallbackNote(usedFallback);
      setPhase("ready");
    } catch (err) {
      setPhase("idle");
      setError(isModelUnavailable(err) ? t("model.unavailable") : t("cv.processError"));
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  if (phase === "ready" && suggested) {
    return (
      <>
        {fallbackNote && <p className="fallback-note">{t("model.fallbackNote")}</p>}
        <EditableProfile
          suggested={suggested}
          busy={busy}
          loadingLabel={loadingLabel}
          onSubmit={onSubmit}
          onManual={onManual}
        />
      </>
    );
  }

  const mainText = processing
    ? fileName ?? ""
    : dragOver
      ? t("cv.dropZoneOver")
      : t("cv.dropZone");
  const altText = processing
    ? phase === "reading"
      ? t("cv.reading")
      : t("cv.creating")
    : t("cv.dropZoneAlt");

  return (
    <div id="cv-panel" className="cv-panel">
      <p className="cv-privacy">{t("cv.privacyNote")}</p>

      <label
        className={`cv-dropzone${dragOver ? " cv-dropzone-over" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={t("cv.uploadAction")}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="cv-dropzone-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 12v6" />
            <path d="M9 15l3-3 3 3" />
          </svg>
        </span>
        <span className="cv-dropzone-main">{mainText}</span>
        <span className="cv-dropzone-status" role={processing ? "status" : undefined}>
          {processing && <span className="spinner" aria-hidden="true" />}
          <span>{altText}</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleChange}
          className="visually-hidden"
        />
      </label>

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
  loadingLabel,
  onSubmit,
  onManual,
}: {
  suggested: SuggestedProfile;
  busy: boolean;
  loadingLabel: string;
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
        <span className="btn-label">{busy ? loadingLabel : t("cv.confirm")}</span>
        {busy && <span className="spinner" />}
      </button>

      <button type="button" className="btn-ghost cv-manual" onClick={onManual}>
        {t("cv.manual")}
      </button>
    </div>
  );
}