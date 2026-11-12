import { useMemo, useState } from "react";
import { useLang } from "../i18n";
import {
  CV_BUILDER_IMPORT_SECTIONS,
  hasCvBuilderImportContent,
  type CvBuilderImportManualTarget,
  type CvBuilderImportResult,
  type CvBuilderImportSectionId,
} from "../lib/cvBuilder/pdfImport";

export type { ManualReviewStatus, ManualReviewDecision, CvBuilderImportReviewSummary, CvBuilderImportReviewItem } from "../lib/cvBuilder/importQuality";
import type { ManualReviewStatus, ManualReviewDecision } from "../lib/cvBuilder/importQuality";

export interface CvBuilderImportReviewProps {
  result: CvBuilderImportResult;
  selected: Set<CvBuilderImportSectionId>;
  onToggleSection: (section: CvBuilderImportSectionId) => void;
  decisions: Record<number, ManualReviewDecision>;
  onUpdateDecision: (index: number, patch: Partial<ManualReviewDecision>) => void;
  selectedSkills: Set<string>;
  onToggleSkill: (skill: string) => void;
  onSelectAllSkills: () => void;
  onClearSkills: () => void;
}

function sectionSummary(
  result: CvBuilderImportResult,
  section: CvBuilderImportSectionId,
  t: (key: string, vars?: Record<string, string | number>) => string
): string[] {
  const draft = result.draft;
  switch (section) {
    case "personal":
      return [draft.personal.fullName, draft.personal.email, draft.personal.phone, draft.personal.location]
        .filter((value): value is string => Boolean(value));
    case "profile":
      return [draft.profile.headline, draft.profile.summary].filter((value): value is string => Boolean(value));
    case "experience":
      return draft.experience.map((entry) => {
        const period = [entry.startMonth, entry.current ? t("cvBuilder.preview.present") : entry.endMonth]
          .filter(Boolean)
          .join(" – ");
        return [entry.position, entry.employer, period].filter(Boolean).join(" · ");
      });
    case "education":
      return draft.education.map((entry) => {
        const period = [entry.startMonth, entry.current ? t("cvBuilder.preview.present") : entry.endMonth]
          .filter(Boolean)
          .join(" – ");
        return [entry.degree || entry.institution, entry.degree ? entry.institution : "", period]
          .filter(Boolean)
          .join(" · ");
      });
    case "skills":
      return draft.skills;
    case "projects":
      return draft.projects.map((entry) =>
        [entry.name, entry.technologies.length ? entry.technologies.join(", ") : ""].filter(Boolean).join(" · ")
      );
    case "certificates":
      return draft.certificates.map((entry) => [entry.name, entry.issuer, entry.date].filter(Boolean).join(" · "));
    case "languages":
      return draft.languages.map((entry) => `${entry.language} · ${t(`cvBuilder.level.${entry.level}`)}`);
    case "links":
      return draft.links.map((entry) => `${entry.label}: ${entry.url}`);
    default:
      return [];
  }
}

function sectionCount(
  result: CvBuilderImportResult,
  section: CvBuilderImportSectionId,
  t: (key: string, vars?: Record<string, string | number>) => string,
  selectedSkills: Set<string>
): string {
  const count = sectionSummary(result, section, t).length;
  if (section === "personal" || section === "profile") {
    return count === 1 ? t("cvBuilder.import.fieldCountOne") : t("cvBuilder.import.fieldCount", { count });
  }
  if (section === "skills") {
    return t("cvBuilder.import.skillSelectedCount", {
      selected: selectedSkills.size,
      total: count,
    });
  }
  return count === 1 ? t("cvBuilder.import.itemCountOne") : t("cvBuilder.import.itemCount", { count });
}

export function manualTargetLabel(
  target: CvBuilderImportManualTarget,
  t: (key: string) => string
): string {
  const key: Record<CvBuilderImportManualTarget, string> = {
    ignore: "manualIgnore",
    profile: "manualProfile",
    experience: "manualExperience",
    education: "manualEducation",
    skills: "manualSkills",
    projects: "manualProjects",
    certificates: "manualCertificates",
    links: "manualLinks",
  };
  return t(`cvBuilder.import.${key[target]}`);
}

export function statusLabel(status: ManualReviewStatus, t: (key: string) => string): string {
  return t(`cvBuilder.import.reviewStatus.${status}`);
}

function fallbackDecision(
  result: CvBuilderImportResult,
  index: number
): ManualReviewDecision {
  const detail = result.unrecognizedDetails[index];
  const original = detail?.line ?? result.unrecognized[index] ?? "";
  return {
    target: detail?.suggestedTarget ?? "ignore",
    status: "pending",
    text: original,
    original,
    edited: false,
  };
}

export default function CvBuilderImportReview({
  result,
  selected,
  onToggleSection,
  decisions,
  onUpdateDecision,
  selectedSkills,
  onToggleSkill,
  onSelectAllSkills,
  onClearSkills,
}: CvBuilderImportReviewProps) {
  const { t } = useLang();
  const [statusFilter, setStatusFilter] = useState<"all" | ManualReviewStatus>("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [skillQuery, setSkillQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");
  const pageSize = 10;

  const decisionsFor = (index: number) => decisions[index] ?? fallbackDecision(result, index);
  const manualCount = result.unrecognized.length;
  const pendingCount = result.unrecognized.reduce(
    (sum, _line, index) => sum + (decisionsFor(index).status === "pending" ? 1 : 0),
    0
  );
  const acceptedCount = result.unrecognized.reduce(
    (sum, _line, index) => sum + (decisionsFor(index).status === "accepted" ? 1 : 0),
    0
  );
  const ignoredCount = result.unrecognized.reduce(
    (sum, _line, index) => sum + (decisionsFor(index).status === "ignored" ? 1 : 0),
    0
  );

  const targets = useMemo(
    () => [...new Set(result.unrecognizedDetails.map((detail) => detail.suggestedTarget))],
    [result.unrecognizedDetails]
  );
  const reasons = useMemo(
    () => [...new Set(result.unrecognizedDetails.map((detail) => detail.reason))],
    [result.unrecognizedDetails]
  );
  const filtered = useMemo(() => result.unrecognized
    .map((line, index) => ({ line, index, detail: result.unrecognizedDetails[index], decision: decisionsFor(index) }))
    .filter((entry) => statusFilter === "all" || entry.decision.status === statusFilter)
    .filter((entry) => targetFilter === "all" || entry.detail?.suggestedTarget === targetFilter)
    .filter((entry) => reasonFilter === "all" || entry.detail?.reason === reasonFilter), [result, decisions, statusFilter, targetFilter, reasonFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const skillQueryNormalized = skillQuery.trim().toLocaleLowerCase("de");
  const visibleSkills = result.draft.skills.filter((skill) =>
    !skillQueryNormalized || skill.toLocaleLowerCase("de").includes(skillQueryNormalized)
  );

  const scrollToSection = (section: CvBuilderImportSectionId) => {
    const element = document.getElementById(`cv-import-section-${section}`);
    const details = element?.querySelector("details");
    if (details) details.open = true;
    element?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const startEditing = (index: number) => {
    setEditing(index);
    setEditText(decisionsFor(index).text);
    setEditError("");
  };

  const saveEditing = (index: number) => {
    if (!editText.trim()) {
      setEditError(t("cvBuilder.import.reviewCorrectionRequired"));
      return;
    }
    onUpdateDecision(index, { text: editText, edited: true, status: "pending" });
    setEditing(null);
    setEditError("");
  };

  return (
    <div className="cv-import-preview">
      <section className="cv-import-overview" aria-labelledby="cv-import-overview-title">
        <h4 id="cv-import-overview-title">{t("cvBuilder.import.overviewTitle")}</h4>
        <p>{t("cvBuilder.import.previewTitle")}</p>
        <p>{t("cvBuilder.import.overviewHint")}</p>
        <div className="cv-import-overview__grid">
          <div><strong>{result.structure.pageCount}</strong><span>{t("cvBuilder.import.overviewPages")}</span></div>
          <div><strong>{result.draft.experience.length}</strong><span>{t("cvBuilder.import.section.experience")}</span></div>
          <div><strong>{result.draft.projects.length}</strong><span>{t("cvBuilder.import.section.projects")}</span></div>
          <div><strong>{result.draft.education.length}</strong><span>{t("cvBuilder.import.section.education")}</span></div>
          <div><strong>{result.draft.skills.length}</strong><span>{t("cvBuilder.import.section.skills")}</span></div>
          <div><strong>{manualCount}</strong><span>{t("cvBuilder.import.overviewManual")}</span></div>
        </div>
        <nav className="cv-import-overview__nav" aria-label={t("cvBuilder.import.overviewNav")}>
          {CV_BUILDER_IMPORT_SECTIONS.filter((section) => hasCvBuilderImportContent(result, section)).map((section) => (
            <button
              key={section}
              type="button"
              className="cv-import-overview__link"
              onClick={() => scrollToSection(section)}
            >
              {t(`cvBuilder.import.section.${section}`)}
            </button>
          ))}
        </nav>
      </section>

      <div className="cv-import-preview__sections">
        {CV_BUILDER_IMPORT_SECTIONS.map((section) => {
          const items = sectionSummary(result, section, t);
          const hasContent = hasCvBuilderImportContent(result, section);
          if (!hasContent) return null;
          const isSkills = section === "skills";
          return (
            <section key={section} id={`cv-import-section-${section}`} className="cv-import-section">
              <div className="cv-import-section__head">
                <label className="cv-import-section__select">
                  <input
                    type="checkbox"
                    checked={selected.has(section)}
                    onChange={() => onToggleSection(section)}
                  />
                  <strong>{t(`cvBuilder.import.section.${section}`)}</strong>
                </label>
                <span className={`cv-import-section__status${result.uncertain[section] ? " is-uncertain" : ""}`}>
                  {result.uncertain[section] ? t("cvBuilder.import.statusReview") : t("cvBuilder.import.statusDetected")}
                  {" · "}
                  {sectionCount(result, section, t, selectedSkills)}
                </span>
              </div>
              {isSkills ? (
                <div className="cv-import-skills">
                  <div className="cv-import-skills__toolbar">
                    <label className="cv-import-skills__search">
                      <span>{t("cvBuilder.import.skillSearch")}</span>
                      <input
                        type="search"
                        value={skillQuery}
                        onChange={(event) => setSkillQuery(event.target.value)}
                        placeholder={t("cvBuilder.import.skillSearchPlaceholder")}
                      />
                    </label>
                    <div className="cv-import-skills__actions">
                      <button type="button" className="btn-ghost" onClick={onSelectAllSkills}>
                        {t("cvBuilder.import.skillSelectAll")}
                      </button>
                      <button type="button" className="btn-ghost" onClick={onClearSkills}>
                        {t("cvBuilder.import.skillClear")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => visibleSkills.forEach((skill) => {
                          if (!selectedSkills.has(skill)) onToggleSkill(skill);
                        })}
                      >
                        {t("cvBuilder.import.skillSelectFiltered")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => visibleSkills.forEach((skill) => {
                          if (selectedSkills.has(skill)) onToggleSkill(skill);
                        })}
                      >
                        {t("cvBuilder.import.skillClearFiltered")}
                      </button>
                    </div>
                  </div>
                  <p className="cv-import-skills__count" aria-live="polite">
                    {t("cvBuilder.import.skillSelectedCount", { selected: selectedSkills.size, total: result.draft.skills.length })}
                  </p>
                  {selectedSkills.size === 0 && result.draft.skills.length > 0 && (
                    <p className="alert alert-error" role="alert">
                      {t("cvBuilder.import.skillZeroWarning", { count: result.draft.skills.length })}
                    </p>
                  )}
                  <ul className="cv-import-skills__list">
                    {visibleSkills.map((skill) => (
                      <li key={skill}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedSkills.has(skill)}
                            onChange={() => onToggleSkill(skill)}
                          />
                          <span>{skill}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {visibleSkills.length === 0 && <p className="field-hint">{t("cvBuilder.import.skillNoMatch")}</p>}
                </div>
              ) : (
                <details className="cv-import-section__details">
                  <summary>{t("cvBuilder.import.details")}</summary>
                  <ul>
                    {items.map((item, index) => <li key={`${section}-${index}`}>{item}</li>)}
                  </ul>
                </details>
              )}
              {result.uncertain[section] && (
                <p className="cv-import-section__uncertain" role="note">{t("cvBuilder.import.uncertain")}</p>
              )}
            </section>
          );
        })}
      </div>

      {CV_BUILDER_IMPORT_SECTIONS.some((section) => !hasCvBuilderImportContent(result, section)) && (
        <section className="cv-import-missing">
          <h5>{t("cvBuilder.import.notDetected")}</h5>
          <p>
            {CV_BUILDER_IMPORT_SECTIONS
              .filter((section) => !hasCvBuilderImportContent(result, section))
              .map((section) => t(`cvBuilder.import.section.${section}`))
              .join(" · ")}
          </p>
        </section>
      )}

      <section className="cv-import-review" aria-labelledby="cv-import-review-title">
        <h5 id="cv-import-review-title">{t("cvBuilder.import.reviewTitle")}</h5>
        <p>{t("cvBuilder.import.reviewHint")}</p>
        <div className="cv-import-review__summary" aria-live="polite">
          <span>{t("cvBuilder.import.reviewPending", { count: pendingCount })}</span>
          <span>{t("cvBuilder.import.reviewAccepted", { count: acceptedCount })}</span>
          <span>{t("cvBuilder.import.reviewIgnored", { count: ignoredCount })}</span>
        </div>
        <div className="cv-import-review__filters" role="group" aria-label={t("cvBuilder.import.reviewFilters")}>
          <label>
            <span>{t("cvBuilder.import.reviewStatusFilter")}</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(0); }}>
              <option value="all">{t("cvBuilder.import.reviewStatus.all")}</option>
              <option value="pending">{t("cvBuilder.import.reviewStatus.pending")}</option>
              <option value="accepted">{t("cvBuilder.import.reviewStatus.accepted")}</option>
              <option value="ignored">{t("cvBuilder.import.reviewStatus.ignored")}</option>
            </select>
          </label>
          <label>
            <span>{t("cvBuilder.import.reviewTargetFilter")}</span>
            <select value={targetFilter} onChange={(event) => { setTargetFilter(event.target.value); setPage(0); }}>
              <option value="all">{t("cvBuilder.import.reviewAll")}</option>
              {targets.map((target) => <option key={target} value={target}>{manualTargetLabel(target, t)}</option>)}
            </select>
          </label>
          <label>
            <span>{t("cvBuilder.import.reviewReasonFilter")}</span>
            <select value={reasonFilter} onChange={(event) => { setReasonFilter(event.target.value); setPage(0); }}>
              <option value="all">{t("cvBuilder.import.reviewAll")}</option>
              {reasons.map((reason) => <option key={reason} value={reason}>{t(`cvBuilder.import.reason.${reason}`)}</option>)}
            </select>
          </label>
        </div>
        {visible.length === 0 ? (
          <p className="field-hint">{t("cvBuilder.import.reviewEmpty")}</p>
        ) : (
          <ul className="cv-import-review__list">
            {visible.map(({ index, detail, decision }) => (
              <li key={`review-${index}`} className={`cv-import-review__item is-${decision.status}`}>
                <div className="cv-import-review__item-head">
                  <strong>{t("cvBuilder.import.reviewSourcePage", { page: detail?.page ?? 0 })}</strong>
                  <span className={`cv-import-review__status is-${decision.status}`}>{statusLabel(decision.status, t)}</span>
                </div>
                {editing === index ? (
                  <p className="cv-import-review__original">{decision.original}</p>
                ) : decision.edited ? (
                  <p className="cv-import-review__original">{decision.original}</p>
                ) : null}
                {editing === index ? (
                  <div className="cv-import-review__edit">
                    <label>
                      <span>{t("cvBuilder.import.reviewCorrectedText")}</span>
                      <textarea
                        autoFocus
                        value={editText}
                        aria-invalid={Boolean(editError)}
                        aria-describedby={editError ? `cv-import-edit-error-${index}` : undefined}
                        onChange={(event) => {
                          setEditText(event.target.value);
                          if (editError) setEditError("");
                        }}
                        rows={2}
                      />
                    </label>
                    {editError && (
                      <p id={`cv-import-edit-error-${index}`} className="cv-import-review__edit-error" role="alert">
                        {editError}
                      </p>
                    )}
                    <div className="cv-import-review__actions">
                      <button type="button" className="letter-btn" onClick={() => saveEditing(index)}>
                        {t("cvBuilder.import.reviewSaveCorrection")}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setEditError(""); }}>
                        {t("cvBuilder.import.reviewCancelCorrection")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="cv-import-review__text">{decision.text}</p>
                )}
                <p className="cv-import-review__meta">
                  {t("cvBuilder.import.sourceLabel")}: {detail?.page ? t("cvBuilder.import.sourcePage", { page: detail.page }) : t("cvBuilder.import.sourceUnknown")}
                  {detail?.sectionHeading ? ` · ${detail.sectionHeading}` : ""}
                  {" · "}
                  {t("cvBuilder.import.reasonLabel")}: {t(`cvBuilder.import.reason.${detail?.reason ?? "ambiguous"}`)}
                  {" · "}
                  {t("cvBuilder.import.suggestionLabel")}: {manualTargetLabel(detail?.suggestedTarget ?? "ignore", t)}
                </p>
                <div className="cv-import-review__controls">
                  <label>
                    <span>{t("cvBuilder.import.manualAssign")}</span>
                    <select
                      aria-label={`${t("cvBuilder.import.manualAssign")}: ${decision.text.slice(0, 60)}`}
                      value={decision.target}
                      onChange={(event) => onUpdateDecision(index, { target: event.target.value as CvBuilderImportManualTarget, status: "pending" })}
                    >
                      {(["profile", "experience", "education", "skills", "projects", "certificates", "links"] as CvBuilderImportManualTarget[]).map((target) => (
                        <option key={target} value={target}>{manualTargetLabel(target, t)}</option>
                      ))}
                      <option value="ignore">{t("cvBuilder.import.manualIgnore")}</option>
                    </select>
                  </label>
                  <div className="cv-import-review__actions">
                    <button
                      type="button"
                      className="letter-btn"
                      disabled={decision.target === "ignore"}
                      onClick={() => onUpdateDecision(index, { status: "accepted" })}
                    >
                      {t("cvBuilder.import.reviewAccept")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => startEditing(index)}>
                      {t("cvBuilder.import.reviewEdit")}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onUpdateDecision(index, { status: "ignored", target: "ignore" })}
                    >
                      {t("cvBuilder.import.reviewIgnore")}
                    </button>
                    {decision.status !== "pending" && (
                      <button type="button" className="btn-ghost" onClick={() => onUpdateDecision(index, { ...fallbackDecision(result, index) })}>
                        {t("cvBuilder.import.reviewUndo")}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pageCount > 1 && (
          <nav className="cv-import-review__pagination" aria-label={t("cvBuilder.import.reviewPagination")}>
            <button type="button" className="btn-ghost" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              {t("cvBuilder.import.reviewPrevious")}
            </button>
            <span>{t("cvBuilder.import.reviewPage", { page: safePage + 1, total: pageCount })}</span>
            <button type="button" className="btn-ghost" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>
              {t("cvBuilder.import.reviewNext")}
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}

export interface CvBuilderImportSummaryProps {
  draft: import("../lib/cvBuilder/contractTypes").CvBuilderDraftV1;
  decisions: Record<number, ManualReviewDecision>;
  selected: Set<CvBuilderImportSectionId>;
  pendingAcknowledged: boolean;
  onToggleAcknowledged: (value: boolean) => void;
  onBack: () => void;
  onApply: () => void;
  onCancel: () => void;
}

export function CvBuilderImportSummary({
  draft,
  decisions,
  selected,
  pendingAcknowledged,
  onToggleAcknowledged,
  onBack,
  onApply,
  onCancel,
}: CvBuilderImportSummaryProps) {
  const { t } = useLang();
  const decisionValues = Object.values(decisions);
  const pending = decisionValues.filter((decision) => decision.status === "pending").length;
  const accepted = decisionValues.filter((decision) => decision.status === "accepted").length;
  const ignored = decisionValues.filter((decision) => decision.status === "ignored").length;
  return (
    <section className="cv-import-summary" aria-labelledby="cv-import-summary-title">
      <h4 id="cv-import-summary-title" tabIndex={-1}>{t("cvBuilder.import.summaryTitle")}</h4>
      <p>{t("cvBuilder.import.summaryHint")}</p>
      <div className="cv-import-summary__grid">
        <div><strong>{draft.experience.length}</strong><span>{t("cvBuilder.import.section.experience")}</span></div>
        <div><strong>{draft.projects.length}</strong><span>{t("cvBuilder.import.section.projects")}</span></div>
        <div><strong>{draft.education.length}</strong><span>{t("cvBuilder.import.section.education")}</span></div>
        <div><strong>{draft.skills.length}</strong><span>{t("cvBuilder.import.section.skills")}</span></div>
        <div><strong>{accepted}</strong><span>{t("cvBuilder.import.summaryManualAccepted")}</span></div>
        <div><strong>{ignored}</strong><span>{t("cvBuilder.import.summaryIgnored")}</span></div>
        <div><strong>{pending}</strong><span>{t("cvBuilder.import.summaryPending")}</span></div>
      </div>
      {draft.experience.length === 0 && (
        <p className="alert alert-error" role="alert">{t("cvBuilder.import.qualityNoExperience")}</p>
      )}
      {draft.skills.length === 0 && (
        <p className="alert alert-error" role="alert">{t("cvBuilder.import.qualityNoSkills")}</p>
      )}
      <p className="cv-import-summary__sections">
        {t("cvBuilder.import.summarySections")}: {[...selected].map((section) => t(`cvBuilder.import.section.${section}`)).join(" · ") || t("cvBuilder.import.summaryNone")}
      </p>
      {pending > 0 && (
        <label className="cv-import-summary__acknowledge">
          <input
            type="checkbox"
            checked={pendingAcknowledged}
            onChange={(event) => onToggleAcknowledged(event.target.checked)}
          />
          <span>{t("cvBuilder.import.summaryAcknowledge", { count: pending })}</span>
        </label>
      )}
      <div className="cv-import-summary__actions">
        <button type="button" className="btn-ghost" onClick={onBack}>{t("cvBuilder.import.summaryBack")}</button>
        <button
          type="button"
          className="letter-btn"
          disabled={pending > 0 && !pendingAcknowledged}
          onClick={onApply}
        >
          {t("cvBuilder.import.summaryApply")}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>{t("cvBuilder.import.cancel")}</button>
      </div>
    </section>
  );
}
