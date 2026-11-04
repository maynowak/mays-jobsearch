import { useEffect, useId, useRef, useState } from "react";
import type { Job } from "../types";
import { useLang } from "../i18n";
import type { SessionApplicationV1 } from "../lib/applications/sessionApplications";
import { buildManualJob } from "../lib/applications/manualJob";
import { saveManualJobSession } from "../lib/applications/manualJobSession";

interface Props {
  application: SessionApplicationV1;
  onReady: (job: Job) => void;
  onCancel: () => void;
}

export default function ManualJobDescriptionPrompt({
  application,
  onReady,
  onCancel,
}: Props) {
  const { t } = useLang();
  const ids = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = buildManualJob(
      {
        description,
        title: application.job.title,
        company: application.job.companyName,
        location: application.job.location.join(", "),
        url: application.job.originalUrl,
      },
      application.job.jobId
    );
    if (!result.job || !result.reference) {
      setError(t("applications.descriptionPrompt.error"));
      return;
    }
    saveManualJobSession({
      id: application.job.jobId,
      job: result.job,
      reference: result.reference,
      updatedAt: new Date().toISOString(),
    });
    setError("");
    onReady(result.job);
  };

  return (
    <form
      className="applications-new applications-description-prompt"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${ids}-title`}
    >
      <div>
        <h4 id={`${ids}-title`}>{t("applications.descriptionPrompt.title")}</h4>
        <p className="applications-new__hint">{t("applications.descriptionPrompt.text")}</p>
      </div>
      <label className="letter-field">
        <span>{t("applications.new.description")} *</span>
        <textarea
          ref={textareaRef}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setError("");
          }}
          rows={8}
          maxLength={20000}
          placeholder={t("applications.descriptionPrompt.placeholder")}
          aria-invalid={Boolean(error)}
        />
      </label>
      {error && <p className="applications-new__error" role="alert">{error}</p>}
      <div className="applications-new__actions">
        <button type="submit" className="letter-btn">
          {t("applications.descriptionPrompt.open")}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {t("applications.descriptionPrompt.cancel")}
        </button>
      </div>
    </form>
  );
}
