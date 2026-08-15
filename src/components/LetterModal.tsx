import { useEffect, useState } from "react";
import type { Job, Profile } from "../types";
import { generateCoverLetter, isModelUnavailable, withModelFallback } from "../api";
import { useLang } from "../i18n";

interface Props {
  job: Job;
  prepare: string;
  profile: Profile;
  model: string | null;
  availableModels: string[];
  recommendedModel: string | null;
  onClose: () => void;
}

export default function LetterModal({
  job,
  prepare,
  profile,
  model,
  availableModels,
  recommendedModel,
  onClose,
}: Props) {
  const { t, lang } = useLang();
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fallbackNote, setFallbackNote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setLetter("");
    setFallbackNote(false);
    withModelFallback({
      initialModel: model,
      availableModels,
      recommendedModel,
      request: (m) => generateCoverLetter(profile, job, prepare, lang === "de" ? "German" : "English", m),
    })
      .then(({ data: text, usedFallback }) => {
        if (cancelled) return;
        setLetter(text);
        setFallbackNote(usedFallback);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(isModelUnavailable(err) ? t("model.unavailable") : err.message || t("letter.error"));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job, prepare, profile, lang, t, model, availableModels, recommendedModel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(letter).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  };

  const handleDownload = () => {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName =
      `${job.title} ${job.company_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      t("letter.fileName");
    a.download = `${t("letter.fileName")}-${fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const jobName = [job.title, job.company_name].filter(Boolean).join(" @ ");

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={t("letter.heading")}>
        <div className="modal-head">
          <div>
            <h3>{t("letter.heading")}</h3>
            <p className="modal-sub">{jobName}</p>
          </div>
          <button type="button" className="modal-close" aria-label={t("letter.closeAria")} onClick={onClose}>
            &times;
          </button>
        </div>

        {loading && (
          <div className="letter-loading">
            <span className="spinner" />
            {t("letter.loading")}
          </div>
        )}

        {!loading && error && (
          <div className="letter-output">
            {t("letter.errorPrefix")}
            {error}
          </div>
        )}

        {!loading && !error && fallbackNote && (
          <p className="fallback-note letter-fallback-note">{t("model.fallbackNote")}</p>
        )}

        {!loading && !error && (
          <div className="letter-output">{letter}</div>
        )}

        {!loading && !error && (
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={handleCopy}>
              {copied ? t("letter.copied") : t("letter.copy")}
            </button>
            <button type="button" className="btn-ghost" onClick={handleDownload}>
              {t("letter.download")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}