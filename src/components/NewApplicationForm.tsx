import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Job } from "../types";
import { useLang } from "../i18n";
import {
  MAX_MANUAL_DESCRIPTION_LENGTH,
  MANUAL_COMPANY_FALLBACK,
  MANUAL_COMPANY_FALLBACK_EN,
  MANUAL_TITLE_FALLBACK,
  MANUAL_TITLE_FALLBACK_EN,
  buildManualJob,
  createManualJobId,
  type ManualJobErrors,
} from "../lib/applications/manualJob";
import { saveManualJobSession } from "../lib/applications/manualJobSession";
import {
  evaluateDescription,
  normalizeDescriptionText,
  type DescriptionCompleteness,
} from "../lib/jobDescriptionReview";

interface Props {
  onGenerate: (job: Job) => void;
  onCancel: () => void;
}

function completenessKey(completeness: DescriptionCompleteness): string {
  return `applications.new.completeness.${completeness}`;
}

export default function NewApplicationForm({ onGenerate, onCancel }: Props) {
  const { t, lang } = useLang();
  const ids = useId();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [jobId] = useState(createManualJobId);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<ManualJobErrors>({});
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [generated, setGenerated] = useState(false);

  const normalized = useMemo(
    () => normalizeDescriptionText(description),
    [description]
  );
  const evaluation = useMemo(
    () => evaluateDescription(normalized),
    [normalized]
  );
  const dirty = Boolean(
    description.trim() || title.trim() || company.trim() || location.trim() || url.trim()
  );

  useEffect(() => {
    descriptionRef.current?.focus();
  }, []);

  const resetErrors = () => {
    setErrors({});
    setGenerated(false);
    setCancelConfirm(false);
  };

  const handleCancel = () => {
    if (dirty && !cancelConfirm) {
      setCancelConfirm(true);
      return;
    }
    onCancel();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = buildManualJob(
      { description, title, company, location, url },
      jobId,
      {
        title: lang === "de" ? MANUAL_TITLE_FALLBACK : MANUAL_TITLE_FALLBACK_EN,
        company: lang === "de" ? MANUAL_COMPANY_FALLBACK : MANUAL_COMPANY_FALLBACK_EN,
      }
    );
    setErrors(result.errors);
    setGenerated(false);
    if (!result.job || !result.reference) return;
    saveManualJobSession({
      id: jobId,
      job: result.job,
      reference: result.reference,
      updatedAt: new Date().toISOString(),
    });
    setGenerated(true);
    onGenerate(result.job);
  };

  const errorText = (field: keyof ManualJobErrors): string => {
    const code = errors[field];
    if (!code) return "";
    return t(`applications.new.error.${field}.${code}`);
  };

  const descriptionError = errorText("description");
  const urlError = errorText("url");
  const descriptionHelpId = `${ids}-description-help`;
  const descriptionErrorId = `${ids}-description-error`;
  const urlErrorId = `${ids}-url-error`;

  return (
    <form
      className="applications-new"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${ids}-title`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          handleCancel();
        }
      }}
    >
      <div className="applications-new__head">
        <div>
          <h3 id={`${ids}-title`}>{t("applications.new.title")}</h3>
          <p className="applications-new__intro">{t("applications.new.intro")}</p>
        </div>
        <span className="applications-new__badge">{t("applications.new.sessionBadge")}</span>
      </div>

      <label className="letter-field applications-new__description">
        <span>{t("applications.new.description")} *</span>
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            resetErrors();
          }}
          rows={10}
          maxLength={MAX_MANUAL_DESCRIPTION_LENGTH}
          placeholder={t("applications.new.descriptionPlaceholder")}
          aria-describedby={`${descriptionHelpId}${descriptionError ? ` ${descriptionErrorId}` : ""}`}
          aria-invalid={Boolean(descriptionError)}
        />
      </label>
      <p id={descriptionHelpId} className="applications-new__hint">
        {t("applications.new.descriptionHelp", {
          count: evaluation.wordCount,
        })}
      </p>
      {descriptionError && (
        <p id={descriptionErrorId} className="applications-new__error" role="alert">
          {descriptionError}
        </p>
      )}

      <div className="applications-new__grid">
        <label className="letter-field">
          <span>{t("applications.new.jobTitle")}</span>
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              resetErrors();
            }}
            maxLength={300}
            placeholder={t("applications.new.jobTitlePlaceholder")}
          />
        </label>
        <label className="letter-field">
          <span>{t("applications.new.company")}</span>
          <input
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              resetErrors();
            }}
            maxLength={300}
            placeholder={t("applications.new.companyPlaceholder")}
          />
        </label>
        <label className="letter-field">
          <span>{t("applications.new.location")}</span>
          <input
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              resetErrors();
            }}
            maxLength={200}
            placeholder={t("applications.new.locationPlaceholder")}
          />
        </label>
        <label className="letter-field">
          <span>{t("applications.new.url")}</span>
          <input
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              resetErrors();
            }}
            maxLength={2000}
            placeholder={t("applications.new.urlPlaceholder")}
            aria-describedby={urlError ? urlErrorId : undefined}
            aria-invalid={Boolean(urlError)}
          />
        </label>
      </div>
      {urlError && (
        <p id={urlErrorId} className="applications-new__error" role="alert">
          {urlError}
        </p>
      )}

      <div className="applications-new__review" aria-live="polite">
        <span>{t("applications.new.localReview")}</span>
        <strong>{t(completenessKey(evaluation.completeness))}</strong>
        {evaluation.completeness === "limited" && (
          <span className="applications-new__warning">{t("applications.new.limitedWarning")}</span>
        )}
        {generated && (
          <span className="applications-new__ok">{t("applications.new.ready")}</span>
        )}
      </div>
      <p className="applications-new__hint">{t("applications.new.noAiHint")}</p>
      <p className="applications-new__hint">{t("applications.new.phaseCNote")}</p>

      {cancelConfirm && (
        <div className="applications-confirm" role="alert">
          <p>{t("applications.new.discardConfirm")}</p>
          <button type="button" className="letter-btn" onClick={onCancel}>
            {t("applications.new.discard")}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCancelConfirm(false)}>
            {t("applications.new.continueEditing")}
          </button>
        </div>
      )}

      <div className="applications-new__actions">
        <button type="submit" className="letter-btn">
          {t("applications.new.generate")}
        </button>
        <button type="button" className="btn-ghost" onClick={handleCancel}>
          {t("applications.cancel")}
        </button>
      </div>
    </form>
  );
}
