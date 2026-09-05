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

export default function RemainingCard({ job }: { job: Job }) {
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [detailOpen, setDetailOpen] = useState(false);

  const isAA = (job.source ?? []).includes("arbeitsagentur");

  const loadDetails = async () => {
    if (detailStatus === "loading") return;
    if (detailJob) {
      setDetailOpen(true);
      return;
    }
    setDetailStatus("loading");
    setDetailOpen(true);
    try {
      const res = await fetchJobDetails([job.slug]);
      const enriched = res?.jobs?.[job.slug];
      if (enriched && enriched.description) {
        setDetailJob(enriched);
        setDetailStatus("idle");
      } else {
        setDetailStatus("error");
      }
    } catch {
      setDetailStatus("error");
    }
  };

  const location =
    formatGermanLocation(job.location ?? []) ||
    (job.remote ? t("match.remote") : t("match.locationNotStated"));

  const date = formatJobDate(job.created_at, lang === "de" ? "de-DE" : "en-GB");

  const jobTypes = (job.jobTypes ?? []).map((code) => {
    const key = jobTypeLabelKey(code);
    return key ? t(key) : prettifyCode(code);
  });

  let contractLabel: string | null = null;
  if (job.contractType && !isContractTypeNoData(job.contractType)) {
    const key = contractTypeLabelKey(job.contractType);
    contractLabel = key ? t(key) : prettifyCode(job.contractType);
  }

  const description = (isAA ? detailJob?.description : job.description) ?? "";
  const descriptionPlain = (isAA ? detailJob?.descriptionPlain : job.descriptionPlain) ?? "";
  const descriptionLang = (isAA ? detailJob?.language : job.language) ?? job.language;
  const hasDescription = description.trim().length > 0;
  const showDescriptionToggle =
    descriptionPlain.replace(/\s+/g, " ").trim().length > DESCRIPTION_PREVIEW_LENGTH;

  const previewText =
    !expanded && showDescriptionToggle
      ? descriptionPlain.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd() + "…"
      : descriptionPlain;

  return (
    <li className="remaining-card">
      <h4>{job.title || t("match.unknownRole")}</h4>
      {job.company_name && <p className="remaining-company">{job.company_name}</p>}

      <div className="remaining-meta">
        <span>{location}</span>
        {job.remote && <span className="badge badge-remote">{t("match.remote")}</span>}
        {jobTypes.map((label) => (
          <span key={label} className="badge badge-jobtype">
            {label}
          </span>
        ))}
        {contractLabel && <span className="badge badge-contract">{contractLabel}</span>}
        <SourceBadge sources={job.source} />
      </div>

      {(job.salary || date) && (
        <div className="remaining-facts">
          {job.salary && <span className="remaining-salary">{job.salary}</span>}
          {date && <span className="remaining-date">{t("results.published", { date })}</span>}
        </div>
      )}

      {(job.tags ?? []).length > 0 && (
        <div className="tags">
          {(job.tags ?? []).slice(0, 8).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {isAA ? (
        <div className="remaining-description-wrap">
          {detailOpen && detailStatus === "loading" && (
            <span className="remaining-description remaining-detail-loading" role="status" aria-busy="true">
              <span className="spinner" aria-hidden="true" /> {t("results.detailLoading")}
            </span>
          )}
          {detailOpen && detailStatus === "error" && (
            <p className="remaining-description remaining-detail-error">{t("results.detailError")}</p>
          )}
          {detailOpen && detailStatus === "idle" && (hasDescription || !detailJob) && (
            hasDescription
              ? renderHtmlContent(description, descriptionLang)
              : <p className="remaining-description">{t("results.detailError")}</p>
          )}
          <button
            type="button"
            className="remaining-more"
            aria-expanded={detailOpen}
            onClick={() => (detailOpen ? setDetailOpen(false) : loadDetails())}
          >
            {detailOpen ? t("results.showLess") : t("results.showMore")}
          </button>
        </div>
      ) : (
        hasDescription && (
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
        )
      )}

      {job.url && (
        <a
          className="remaining-link"
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("match.viewPosting")}
        </a>
      )}
    </li>
  );
}