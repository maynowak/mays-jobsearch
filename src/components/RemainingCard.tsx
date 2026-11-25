import { useEffect, useRef, useState } from "react";
import type { Job } from "../types";
import SourceBadge from "./SourceBadge";
import { useLang } from "../i18n";
import { fetchJobDetails, translateJobDescription } from "../api";
import TranslationModelPicker from "./TranslationModelPicker";
import { hasSufficientJobDescription } from "../lib/atsJobHandoff";
import {
  formatJobDate,
  jobTypeLabelKey,
  contractTypeLabelKey,
  isContractTypeNoData,
  prettifyCode,
} from "../lib/jobMeta";
import { formatGermanLocation } from "../lib/location";
import { renderSanitizedHtml } from "../lib/safeHtml";
import { normalizeTranslationForDisplay } from "../lib/translationText";

const DESCRIPTION_PREVIEW_LENGTH = 260;

function safeExternalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderHtmlContent(html: string, lang?: string) {
  return renderSanitizedHtml(html, lang);
}

type TranslationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string; model: string | null }
  | { status: "error"; code?: string };

interface Props {
  job: Job;
  onGenerateLetter?: (job: Job, prepare: string) => void;
  onAtsEvaluate?: (job: Job, descriptionOrigin?: "original" | "reloaded") => void;
  analyzing?: boolean;
}

export default function RemainingCard({ job, onGenerateLetter, onAtsEvaluate, analyzing }: Props) {
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [atsLoading, setAtsLoading] = useState(false);
  const detailPromiseRef = useRef<Promise<Job | null> | null>(null);
  const [translation, setTranslation] = useState<TranslationState>({ status: "idle" });
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationModel, setTranslationModel] = useState<string | null>(null);

  const isAA = (job.source ?? []).includes("arbeitsagentur");

  const loadDetails = async (): Promise<Job | null> => {
    if (detailJob) {
      setExpanded(true);
      return detailJob;
    }
    if (detailPromiseRef.current) return detailPromiseRef.current;

    setDetailStatus("loading");
    setExpanded(true);
    const promise = (async () => {
      try {
        const res = await fetchJobDetails([job.slug]);
        const enriched = res?.jobs?.[job.slug];
        if (enriched && enriched.description) {
          setDetailJob(enriched);
          setDetailStatus("idle");
          setExpanded(true);
          return enriched;
        }
        setDetailStatus("error");
        return null;
      } catch {
        setDetailStatus("error");
        return null;
      }
    })();

    detailPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      detailPromiseRef.current = null;
    }
  };

  // Once BA details are loaded, use the enriched job for the same card
  // scope as normal search results. The original job remains the fallback
  // while loading and the stable identity/error path.
  const displayJob: Job = isAA && detailJob
    ? {
        ...job,
        ...detailJob,
        slug: job.slug,
        title: job.title || detailJob.title,
        company_name: job.company_name || detailJob.company_name,
        location: job.location?.length ? job.location : detailJob.location,
        source: job.source?.length ? job.source : detailJob.source,
        url: job.url || detailJob.url,
      }
    : job;

  const location =
    formatGermanLocation(displayJob.location ?? []) ||
    (displayJob.remote ? t("match.remote") : t("match.locationNotStated"));

  const date = formatJobDate(displayJob.created_at, lang === "de" ? "de-DE" : "en-GB");

  const jobTypes = (displayJob.jobTypes ?? []).map((code) => {
    const key = jobTypeLabelKey(code);
    return key ? t(key) : prettifyCode(code);
  });

  let contractLabel: string | null = null;
  if (displayJob.contractType && !isContractTypeNoData(displayJob.contractType)) {
    const key = contractTypeLabelKey(displayJob.contractType);
    contractLabel = key ? t(key) : prettifyCode(displayJob.contractType);
  }

  const description = displayJob.description ?? "";
  const descriptionPlain = displayJob.descriptionPlain ?? "";
  const descriptionLang = displayJob.language ?? job.language;
  const translatedReady = translation.status === "ready";
  const visibleDescription =
    showTranslation && translatedReady ? translation.text : description;
  const visibleDescriptionPlain =
    showTranslation && translatedReady ? translation.text : descriptionPlain;
  const visibleDescriptionLang = showTranslation ? "de" : descriptionLang;
  const hasDescription = visibleDescription.trim().length > 0;
  const showDescriptionToggle =
    visibleDescriptionPlain.replace(/\s+/g, " ").trim().length > DESCRIPTION_PREVIEW_LENGTH;

  const previewText =
    !expanded && showDescriptionToggle
      ? visibleDescriptionPlain.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd() + "…"
      : visibleDescriptionPlain;

  const canTranslate =
    (!isAA || Boolean(detailJob)) &&
    descriptionLang === "en" &&
    (descriptionPlain.trim() || description.trim()).length > 0;

  useEffect(() => {
    setTranslation({ status: "idle" });
    setShowTranslation(false);
  }, [displayJob.slug, descriptionLang, descriptionPlain, description]);

  const requestTranslation = async () => {
    if (translation.status === "loading") return;
    if (translation.status === "ready" && translation.model === translationModel) {
      setShowTranslation(true);
      return;
    }
    setTranslation({ status: "loading" });
    try {
      const result = await translateJobDescription(
        descriptionPlain || description,
        descriptionLang || "auto",
        translationModel
      );
      const translationText = normalizeTranslationForDisplay(result.translation);
      if (!translationText) throw new Error("unusable translation");
      setTranslation({ status: "ready", text: translationText, model: translationModel });
      setShowTranslation(true);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : undefined;
      setTranslation({ status: "error", code: code || undefined });
      setShowTranslation(false);
    }
  };

  const descriptionIsSufficient = hasSufficientJobDescription(displayJob);

  const handleAtsEvaluate = async () => {
    if (!onAtsEvaluate || atsLoading) return;

    // Full descriptions go straight to ATS. A short/incomplete description
    // reuses the existing job-details path where that source path exists.
    if (descriptionIsSufficient || !isAA) {
      onAtsEvaluate(displayJob);
      return;
    }

    setAtsLoading(true);
    const loaded = await loadDetails();
    setAtsLoading(false);

    if (loaded) {
      onAtsEvaluate(loaded, "reloaded");
    } else {
      onAtsEvaluate(displayJob);
    }
  };

  // Reuse already-loaded detail data for the letter, but never trigger a new
  // detail request here. Preserve the original job's stable fields.
  const letterJob: Job = detailJob ? displayJob : job;
  const originalUrl = safeExternalUrl(job.url);

  return (
    <li
      className="remaining-card"
      data-radar-job-id={job.slug}
      data-radar-job-title={displayJob.title || t("match.unknownRole")}
    >
      <h4>{displayJob.title || t("match.unknownRole")}</h4>
      {displayJob.company_name && <p className="remaining-company">{displayJob.company_name}</p>}

      <div className="remaining-meta">
        <span>{location}</span>
        {displayJob.remote && <span className="badge badge-remote">{t("match.remote")}</span>}
        {jobTypes.map((label) => (
          <span key={label} className="badge badge-jobtype">
            {label}
          </span>
        ))}
        {contractLabel && <span className="badge badge-contract">{contractLabel}</span>}
        {analyzing && <span className="badge badge-analyzing" title={t("match.analyzing")}>🔍</span>}
        <SourceBadge sources={displayJob.source} />
      </div>

      {(displayJob.salary || date) && (
        <div className="remaining-facts">
          {displayJob.salary && <span className="remaining-salary">{displayJob.salary}</span>}
          {date && <span className="remaining-date">{t("results.published", { date })}</span>}
        </div>
      )}

      {(displayJob.tags ?? []).length > 0 && (
        <div className="tags">
          {(displayJob.tags ?? []).slice(0, 8).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {isAA && !detailJob && (
        <div className="remaining-description-wrap">
          {detailStatus === "loading" && (
            <span className="remaining-description remaining-detail-loading" role="status" aria-busy="true">
              <span className="spinner" aria-hidden="true" /> {t("results.detailLoading")}
            </span>
          )}
          {detailStatus === "error" && (
            <>
              <p className="remaining-description remaining-detail-error">{t("results.detailError")}</p>
              {originalUrl && (
                <a
                  className="remaining-detail-fallback"
                  href={originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("results.openOriginalBA")}
                </a>
              )}
            </>
          )}
          {detailStatus !== "loading" && (
            <button
              type="button"
              className="remaining-more"
              aria-expanded={false}
              onClick={loadDetails}
            >
              {t("results.showMore")}
            </button>
          )}
        </div>
      )}

      {canTranslate && (
        <div className="job-translation">
          <div
            className="job-translation__switch"
            role="group"
            aria-label={t("results.translation.label")}
          >
            <button
              type="button"
              className={`job-translation__button${showTranslation ? "" : " is-active"}`}
              aria-pressed={!showTranslation}
              onClick={() => setShowTranslation(false)}
            >
              {showTranslation
                ? t("results.translation.showOriginal")
                : t("results.translation.original")}
            </button>
            <button
              type="button"
              className={`job-translation__button${showTranslation ? " is-active" : ""}`}
              aria-pressed={showTranslation}
              disabled={translation.status === "loading"}
              onClick={() => void requestTranslation()}
            >
              {translation.status === "error"
                ? t("results.translation.retry")
                : t("results.translation.readGerman")}
            </button>
          </div>
          <p className="job-translation__consent">{t("results.translation.consent")}</p>
          {translation.status === "loading" && (
            <p className="job-translation__status" role="status">
              {t("results.translation.loading")}
            </p>
          )}
          {translation.status === "error" && (
            <>
              <p className="job-translation__error" role="alert">
                {translation.code === "model_unavailable" ||
                translation.code === "model_not_free" ||
                translation.code === "model_invalid"
                  ? t("results.translation.modelUnavailable")
                  : t("results.translation.error")}
              </p>
              <TranslationModelPicker
                value={translationModel}
                onChange={setTranslationModel}
              />
            </>
          )}
          {showTranslation && translatedReady && (
            <p className="job-translation__notice">{t("results.translation.notice")}</p>
          )}
        </div>
      )}

      {(!isAA || detailJob) && hasDescription && (
        <div className="remaining-description-wrap">
          {expanded || !showDescriptionToggle ? (
            renderHtmlContent(visibleDescription, visibleDescriptionLang)
          ) : (
            <p
              className="remaining-description"
              lang={visibleDescriptionLang}
              translate={visibleDescriptionLang === "en" ? "yes" : undefined}
            >
              {previewText}
            </p>
          )}
          {showDescriptionToggle && (
            <button
              type="button"
              className="remaining-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? t("results.showLess") : t("results.showMore")}
            </button>
          )}
        </div>
      )}

      <div className="job-actions">
        {displayJob.url && (
          <a
            className="remaining-link"
            href={displayJob.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("match.viewPosting")}
          </a>
        )}

        {onGenerateLetter && (
          <button
            type="button"
            className="letter-btn"
            onClick={() => onGenerateLetter(letterJob, "")}
          >
            {t("match.generateLetter")}
          </button>
        )}

        {onAtsEvaluate && (
          <button
            type="button"
            className="ats-evaluate-btn"
            onClick={() => void handleAtsEvaluate()}
            aria-label={atsLoading ? t("match.atsLoadingDescription") : t("match.atsEvaluate")}
            aria-busy={atsLoading}
            disabled={atsLoading}
          >
            {atsLoading ? t("match.atsLoadingDescription") : t("match.atsEvaluate")}
          </button>
        )}
      </div>
    </li>
  );
}