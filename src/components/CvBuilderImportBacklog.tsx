import { useState } from "react";
import { useLang } from "../i18n";
import type { CvBuilderDraftV1 } from "../lib/cvBuilder/contractTypes";
import {
  applyImportReviewItem,
  updateCvBuilderImportReviewItem,
  type CvBuilderImportReviewItem,
  type CvBuilderImportReviewSummary,
  type ManualReviewStatus,
} from "../lib/cvBuilder/importQuality";
import { manualTargetLabel } from "./CvBuilderImportReview";

interface Props {
  report: CvBuilderImportReviewSummary;
  draft: CvBuilderDraftV1;
  onDraftChange: (draft: CvBuilderDraftV1) => void;
  onReportChange: (report: CvBuilderImportReviewSummary) => void;
}

export default function CvBuilderImportBacklog({ report, draft, onDraftChange, onReportChange }: Props) {
  const { t } = useLang();
  const [filter, setFilter] = useState<"all" | ManualReviewStatus>("all");
  const items = report.items ?? [];
  const visibleItems = filter === "all" ? items : items.filter((item) => item.status === filter);
  if (!items.length) return null;

  const update = (item: CvBuilderImportReviewItem, patch: Partial<Pick<CvBuilderImportReviewItem, "text" | "target" | "status">>) => {
    onReportChange(updateCvBuilderImportReviewItem(report, item.id, patch));
  };

  const apply = (item: CvBuilderImportReviewItem) => {
    if (item.target === "ignore") {
      update(item, { status: "ignored" });
      return;
    }
    onDraftChange(applyImportReviewItem(draft, item));
    update(item, { status: "accepted" });
  };

  return (
    <details className="cv-builder-backlog">
      <summary>
        <strong>{t("cvBuilder.import.continueReview")}</strong>
        <span>{t("cvBuilder.import.backlogCount", { pending: report.pending, total: report.total })}</span>
      </summary>
      <p className="cv-builder-backlog__hint">{t("cvBuilder.import.backlogHint")}</p>
      <label className="cv-builder-backlog__filter">
        <span>{t("cvBuilder.import.reviewStatusFilter")}</span>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">{t("cvBuilder.import.reviewStatus.all")}</option>
          <option value="pending">{t("cvBuilder.import.reviewStatus.pending")}</option>
          <option value="accepted">{t("cvBuilder.import.reviewStatus.accepted")}</option>
          <option value="ignored">{t("cvBuilder.import.reviewStatus.ignored")}</option>
        </select>
      </label>
      {visibleItems.length === 0 && <p className="field-hint">{t("cvBuilder.import.backlogEmpty")}</p>}
      <ul>
        {visibleItems.map((item) => (
          <li key={item.id} className={`cv-builder-backlog__item is-${item.status}`}>
            <div className="cv-builder-backlog__text">
              <input
                aria-label={t("cvBuilder.import.backlogEdit")}
                value={item.text}
                onChange={(event) => update(item, { text: event.target.value })}
              />
              <small>
                {item.page ? `${t("cvBuilder.import.backlogPage", { page: item.page })} · ` : ""}
                {item.sectionHeading ?? item.reason}
              </small>
            </div>
            <label>
              <span>{t("cvBuilder.import.backlogTarget")}</span>
              <select
                value={item.target}
                onChange={(event) => update(item, { target: event.target.value as CvBuilderImportReviewItem["target"] })}
              >
                {(["ignore", "experience", "education", "skills", "projects", "certificates", "profile", "links"] as const).map((target) => (
                  <option key={target} value={target}>{manualTargetLabel(target, t)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("cvBuilder.import.backlogStatus")}</span>
              <select
                value={item.status}
                onChange={(event) => update(item, { status: event.target.value as ManualReviewStatus })}
              >
                {(["pending", "accepted", "ignored"] as const).map((status) => (
                  <option key={status} value={status}>{t(`cvBuilder.import.reviewStatus.${status}`)}</option>
                ))}
              </select>
            </label>
            <button type="button" className="letter-btn" onClick={() => apply(item)}>
              {t("cvBuilder.import.backlogApply")}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
