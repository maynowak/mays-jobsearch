import { useState } from "react";
import type { Job } from "../types";
import SourceBadge from "./SourceBadge";
import { useLang } from "../i18n";
import { fetchJobDetails } from "../api";
import {
  formatJobDate,
  jobTypeLabelKey,
  contractTypeLabelKey,
  isContractTypeNoData,
  prettifyCode,
} from "../lib/jobMeta";
import { formatGermanLocation } from "../lib/location";
import { renderSanitizedHtml } from "../lib/safeHtml";

const DESCRIPTION_PREVIEW_LENGTH = 260;

function renderHtmlContent(html: string, lang?: string) {
  return renderSanitizedHtml(html, lang);
}

interface Props {
  job: Job;
  onGenerateLetter?: (job: Job, prepare: string) => void;
  onAtsEvaluate?: (job: Job) => void;
  analyzing?: boolean;
}

export default function RemainingCard({ job, onGenerateLetter, onAtsEvaluate, analyzing }: Props) {
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("idle");

  const isAA = (job.source ?? []).includes("arbeitsagentur");

  const loadDetails = async () => {
    if (detailStatus === "loading") return;
    if (detailJob) {
      setExpanded(true);
      return;
    }
    setDetailStatus("loading");
    setExpanded(true);
    try {
      const res = await fetchJobDetails([job.slug]);
      const enriched = res?.jobs?.[job.slug];
      if (enriched && enriched.description) {
        setDetailJob(enriched);
        setDetailStatus("idle");
        setExpanded(true);
      } else {
        setDetailStatus("error");
      }
    } catch {
      setDetailStatus("error");
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
  const hasDescription = description.trim().length > 0;
  const showDescriptionToggle =
    descriptionPlain.replace(/\s+/g, " ").trim().length > DESCRIPTION_PREVIEW_LENGTH;

  const previewText =
    !expanded && showDescriptionToggle
      ? descriptionPlain.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd() + "…"
      : descriptionPlain;

  // Reuse already-loaded detail data for the letter, but never trigger a new
  // detail request here. Preserve the original job's stable fields.
  const letterJob: Job = detailJob ? displayJob : job;

  return (
    <li className="remaining-card">
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
            <p className="remaining-description remaining-detail-error">{t("results.detailError")}</p>
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

      {(!isAA || detailJob) && hasDescription && (
        <div className="remaining-description-wrap">
          {expanded || !showDescriptionToggle ? (
            renderHtmlContent(description, descriptionLang)
          ) : (
            <p
              className="remaining-description"
              lang={descriptionLang}
              translate={descriptionLang === "en" ? "yes" : undefined}
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
            onClick={() => onAtsEvaluate(displayJob)}
            aria-label={t("match.atsEvaluate")}
          >
            {t("match.atsEvaluate")}
          </button>
        )}
      </div>
    </li>
  );
}