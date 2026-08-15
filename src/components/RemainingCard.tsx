import { useState } from "react";
import type { Job } from "../types";
import SourceBadge from "./SourceBadge";
import { useLang } from "../i18n";
import {
  formatJobDate,
  jobTypeLabelKey,
  contractTypeLabelKey,
  isContractTypeNoData,
  prettifyCode,
  descriptionPreview,
} from "../lib/jobMeta";

const DESCRIPTION_PREVIEW_LENGTH = 260;

export default function RemainingCard({ job }: { job: Job }) {
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState(false);

  const location =
    (job.location ?? []).join(", ") ||
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

  const description = descriptionPreview(job.description, DESCRIPTION_PREVIEW_LENGTH, expanded);
  const showDescriptionToggle =
    (job.description ?? "").replace(/\s+/g, " ").trim().length > DESCRIPTION_PREVIEW_LENGTH;

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

      {description && (
        <div className="remaining-description-wrap">
          <p className="remaining-description">{description}</p>
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
