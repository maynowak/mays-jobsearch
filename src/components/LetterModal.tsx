import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Job, Profile } from "../types";
import { generateCoverLetter, isFreeQuotaExceeded, isModelUnavailable, withModelFallback } from "../api";
import { useLang } from "../i18n";
import { formatGermanLocation } from "../lib/location";
import {
  MAX_DESCRIPTION_INPUT_LENGTH,
  buildDescriptionReview,
  type DescriptionReviewState,
  type ReviewReason,
} from "../lib/jobDescriptionReview";
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
  const [descriptionInput, setDescriptionInput] = useState("");
  const [review, setReview] = useState<DescriptionReviewState | null>(null);
  const originalReview = useMemo(
    () => buildDescriptionReview({ job, enrichedInput: "" }),
    [job]
  );
  const visibleReview = review ?? originalReview;

  // A new job must never inherit the previous job's letter or in-flight result.
  useEffect(() => {
    requestSeqRef.current += 1;
    inFlightRef.current = false;
    setPhase("intro");
    setLetter("");
    setError("");
    setCopied(false);
    setFallbackNote(false);
    setDescriptionInput("");
    setReview(null);
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

  const handleDescriptionChange = (value: string) => {
    setDescriptionInput(value.slice(0, MAX_DESCRIPTION_INPUT_LENGTH));
    setReview(null);
  };

  const handleReviewDescription = () => {
    setReview(buildDescriptionReview({ job, enrichedInput: descriptionInput, confirmed: false }));
  };

  const handleConfirmReview = () => {
    if (!review || review.confirmation !== "required") return;
    setReview(buildDescriptionReview({ job, enrichedInput: descriptionInput, confirmed: true }));
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
  const completenessLabel = (state: string) => t(`letter.completeness.${state}`);
  const selected = visibleReview.selected;
  const selectedPreview = selected
    ? selected.text.length > 900
      ? `${selected.text.slice(0, 900).trimEnd()}…`
      : selected.text
    : "";
  const originalPreview = visibleReview.originalText.length > 900
    ? `${visibleReview.originalText.slice(0, 900).trimEnd()}…`
    : visibleReview.originalText;
  const reasonKey = (reason: ReviewReason) => `letter.reason.${reason}`;
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

            <div className="letter-review">
              <div className="letter-review-head">
                <h5 id={`${helpId}-description`}>{t("letter.existingDescription")}</h5>
                <span className={`letter-status letter-status--${visibleReview.original.completeness}`}>
                  {completenessLabel(visibleReview.original.completeness)}
                </span>
              </div>
              {originalPreview ? (
                <p className="letter-description-preview">{originalPreview}</p>
              ) : (
                <p className="letter-description-preview letter-description-preview--empty">
                  {t("letter.noDescription")}
                </p>
              )}

              <label className="letter-label" htmlFor={`${helpId}-enrich`}>
                {t("letter.enrichLabel")}
              </label>
              <textarea
                id={`${helpId}-enrich`}
                className="letter-textarea"
                value={descriptionInput}
                onChange={(event) => handleDescriptionChange(event.target.value)}
                maxLength={MAX_DESCRIPTION_INPUT_LENGTH}
                rows={5}
                placeholder={t("letter.enrichPlaceholder")}
                aria-describedby={`${helpId}-enrich-hint`}
              />
              <p id={`${helpId}-enrich-hint`} className="letter-hint">
                {t("letter.enrichHint")}
              </p>

              <div className="letter-review-actions">
                <button
                  type="button"
                  className="ats-evaluate-btn"
                  onClick={handleReviewDescription}
                  disabled={!descriptionInput.trim()}
                >
                  {t("letter.reviewButton")}
                </button>
                {review?.confirmation === "required" && (
                  <button type="button" className="letter-btn" onClick={handleConfirmReview}>
                    {t("letter.confirmUse")}
                  </button>
                )}
              </div>

              {review && (
                <div
                  className={`letter-review-result letter-review-result--${review.plausibility?.status ?? "original"}`}
                  aria-live="polite"
                >
                  <div className="letter-review-head">
                    <strong>{t("letter.reviewResult")}</strong>
                    {review.plausibility && (
                      <span className={`letter-status letter-status--${review.plausibility.status}`}>
                        {t(`letter.plausibility.${review.plausibility.status}`)}
                      </span>
                    )}
                  </div>

                  {review.plausibility && review.plausibility.reasons.length > 0 && (
                    <ul className="letter-reasons">
                      {review.plausibility.reasons.map((reason) => (
                        <li key={reason}>{t(reasonKey(reason))}</li>
                      ))}
                    </ul>
                  )}

                  {review.insufficient && (
                    <p className="letter-review-warning">{t("letter.reviewInsufficient")}</p>
                  )}
                  {review.plausibility?.status === "mismatch" && (
                    <p className="letter-review-warning">{t("letter.reviewMismatch")}</p>
                  )}
                  {review.plausibility?.status === "uncertain" && review.confirmation === "required" && (
                    <p className="letter-review-warning">{t("letter.reviewUncertain")}</p>
                  )}
                  {review.confirmation === "confirmed" && (
                    <p className="letter-review-ok">{t("letter.reviewConfirmed")}</p>
                  )}
                </div>
              )}

              <div className="letter-selected">
                <div className="letter-review-head">
                  <strong>{t("letter.selectedDescription")}</strong>
                  {selected && (
                    <span className="letter-origin">{t(`letter.origin.${selected.origin}`)}</span>
                  )}
                </div>
                {selected ? (
                  <p className="letter-description-preview">{selectedPreview}</p>
                ) : (
                  <p className="letter-review-warning">{t("letter.reviewInsufficient")}</p>
                )}
                <p className="letter-hint">{t("letter.reviewOnlyNote")}</p>
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
