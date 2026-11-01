import { useEffect, useId, useRef, useState } from "react";
import type { Job, Profile } from "../types";
import { generateCoverLetter, isFreeQuotaExceeded, isModelUnavailable, withModelFallback } from "../api";
import { useLang } from "../i18n";
import { formatGermanLocation } from "../lib/location";
import SourceBadge from "./SourceBadge";

interface Props {
  job: Job;
  prepare: string;
  profile: Profile;
  model: string | null;
  availableModels: string[];
  recommendedModel: string | null;
  onClose: () => void;
}

type LetterPhase = "intro" | "loading" | "done" | "error";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const headingId = useId();
  const helpId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);

  const [phase, setPhase] = useState<LetterPhase>("intro");
  const [letter, setLetter] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fallbackNote, setFallbackNote] = useState(false);

  // A new job must never inherit the previous job's letter or in-flight result.
  useEffect(() => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    setPhase("intro");
    setLetter("");
    setError("");
    setCopied(false);
    setFallbackNote(false);
  }, [job.slug]);

  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      inFlightRef.current = false;
    };
  }, []);

  // Dialog focus, background scroll lock and focus restoration.
  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const initial =
      dialog?.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    initial?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, []);

  const handleClose = () => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleStart = async () => {
    if (inFlightRef.current || phase === "loading") return;
    inFlightRef.current = true;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setPhase("loading");
    setError("");
    setLetter("");
    setCopied(false);
    setFallbackNote(false);

    try {
      const { data: text, usedFallback } = await withModelFallback({
        initialModel: model,
        availableModels,
        recommendedModel,
        request: (m, attempt) =>
          generateCoverLetter(
            profile,
            job,
            prepare,
            lang === "de" ? "German" : "English",
            m,
            attempt
          ),
      });
      if (requestSeq !== requestSeqRef.current) return;
      setLetter(text);
      setFallbackNote(usedFallback);
      setPhase("done");
    } catch (err) {
      if (requestSeq !== requestSeqRef.current) return;
      setError(
        isFreeQuotaExceeded(err)
          ? t("model.quotaExceeded")
          : isModelUnavailable(err)
            ? t("model.unavailable")
            : err instanceof Error
              ? err.message || t("letter.error")
              : t("letter.error")
      );
      setPhase("error");
    } finally {
      if (requestSeq === requestSeqRef.current) inFlightRef.current = false;
    }
  };

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
  const location =
    formatGermanLocation(job.location ?? []) ||
    (job.remote ? t("match.remote") : t("match.locationNotStated"));

  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && handleClose()}>
      <div
        ref={dialogRef}
        className="modal-box letter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={phase === "intro" ? helpId : undefined}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            <h3 id={headingId}>{t("letter.heading")}</h3>
            <p className="modal-sub">{jobName}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label={t("letter.closeAria")}
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        {phase === "intro" && (
          <div className="letter-prep">
            <div className="letter-job-summary">
              <div className="letter-job-kicker">{t("letter.preliminary")}</div>
              <h4>{job.title || t("match.unknownRole")}</h4>
              <p className="letter-company">
                {job.company_name || t("letter.companyUnknown")}
              </p>
              <div className="letter-job-meta">
                <span>{location}</span>
                {job.remote && <span className="badge badge-remote">{t("match.remote")}</span>}
                <SourceBadge sources={job.source} />
              </div>
            </div>

            <p id={helpId} className="letter-notice" role="note">
              {t("letter.preparationNotice")}
            </p>
            <p className="letter-hint">{t("letter.noAiUntilStart")}</p>

            <div className="letter-intro-actions">
              <button
                type="button"
                className="letter-btn"
                onClick={() => void handleStart()}
                data-autofocus
              >
                {t("letter.start")}
              </button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="letter-loading" role="status" aria-live="polite">
            <span className="spinner" />
            {t("letter.loading")}
          </div>
        )}

        {phase === "error" && (
          <div className="letter-output letter-error" role="alert">
            {t("letter.errorPrefix")}
            {error}
            <div className="letter-intro-actions">
              <button type="button" className="letter-btn" onClick={() => void handleStart()}>
                {t("letter.retry")}
              </button>
            </div>
          </div>
        )}

        {phase === "done" && fallbackNote && (
          <p className="fallback-note letter-fallback-note">{t("model.fallbackNote")}</p>
        )}

        {phase === "done" && <div className="letter-output">{letter}</div>}

        {phase === "done" && (
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
