import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n";
import {
  addSessionCoverLetterVersion,
  addSessionFeedback,
  addSessionInterview,
  addSessionNote,
  deleteSessionApplication,
  exportSessionApplication,
  transitionSessionStatus,
  type SessionApplicationV1,
} from "../lib/applications/sessionApplications";
import type { ApplicationSalaryV1, ApplicationStatus } from "../lib/applications/contractTypes";
import { ApplicationValidationError } from "../lib/applications/applicationValidation";
import { canTransitionApplicationStatus } from "../lib/applications/applicationDomain";

interface Props {
  applications: SessionApplicationV1[];
  onChange: (applications: SessionApplicationV1[]) => void;
}

const STATUS_ORDER: readonly ApplicationStatus[] = [
  "draft",
  "submitted",
  "feedback",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

function nowIso(): string {
  return new Date().toISOString();
}

function localId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatSalary(
  salary: ApplicationSalaryV1 | undefined,
  t: (key: string) => string
): string {
  if (!salary) return "-";
  return `${salary.amount.toLocaleString()} ${salary.currency} / ${t(`applications.period.${salary.period}`)}`;
}

function statusLabel(t: (key: string) => string, status: ApplicationStatus): string {
  return t(`applications.status.${status}`);
}

export default function ApplicationsSection({ applications, onChange }: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const [selectedId, setSelectedId] = useState<string | null>(applications[0]?.localId ?? null);
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNote, setInterviewNote] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && applications[0]) setSelectedId(applications[0].localId);
    if (selectedId && !applications.some((application) => application.localId === selectedId)) {
      setSelectedId(applications[0]?.localId ?? null);
    }
  }, [applications, selectedId]);

  const visible = useMemo(() => {
    const filtered = filter === "all" ? applications : applications.filter((application) => application.status === filter);
    return [...filtered].sort((a, b) => {
      const aTime = Date.parse(a.applicationDate ?? a.createdAt);
      const bTime = Date.parse(b.applicationDate ?? b.createdAt);
      return sort === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [applications, filter, sort]);

  const selected = applications.find((application) => application.localId === selectedId) ?? null;

  const replace = (updated: SessionApplicationV1) => {
    onChange(applications.map((application) => (application.localId === updated.localId ? updated : application)));
  };

  const run = (action: () => void) => {
    setError("");
    try {
      action();
    } catch (err) {
      setError(err instanceof ApplicationValidationError ? err.message : t("applications.actionError"));
    }
  };

  const handleTransition = (to: ApplicationStatus, confirmed = false) => {
    if (!selected) return;
    if (to === "submitted" && !confirmed) {
      setPendingSubmit(true);
      return;
    }
    run(() => {
      replace(
        transitionSessionStatus(selected, {
          expectedVersion: selected.version,
          to,
          at: nowIso(),
          ...(to === "submitted" ? { confirmed: true } : {}),
        })
      );
      setPendingSubmit(false);
    });
  };

  const handleSaveVersion = () => {
    if (!selected || !selected.documents.coverLetterDraft.trim()) return;
    run(() => {
      replace(
        addSessionCoverLetterVersion(selected, {
          expectedVersion: selected.version,
          version: {
            versionId: localId(),
            jobId: selected.job.jobId,
            createdAt: nowIso(),
            content: selected.documents.coverLetterDraft,
            source: "manual",
          },
        })
      );
    });
  };

  const handleFeedback = () => {
    if (!selected || !feedback.trim()) return;
    run(() => {
      replace(
        addSessionFeedback(selected, {
          expectedVersion: selected.version,
          id: localId(),
          at: nowIso(),
          text: feedback.trim(),
        })
      );
      setFeedback("");
    });
  };

  const handleInterview = () => {
    if (!selected || !interviewAt) return;
    run(() => {
      replace(
        addSessionInterview(selected, {
          expectedVersion: selected.version,
          id: localId(),
          at: nowIso(),
          scheduledAt: new Date(interviewAt).toISOString(),
          ...(interviewNote.trim() ? { note: interviewNote.trim() } : {}),
        })
      );
      setInterviewAt("");
      setInterviewNote("");
    });
  };

  const handleNote = () => {
    if (!selected || !note.trim()) return;
    run(() => {
      replace(
        addSessionNote(selected, {
          expectedVersion: selected.version,
          id: localId(),
          at: nowIso(),
          text: note.trim(),
        })
      );
      setNote("");
    });
  };

  const handleExport = (application: SessionApplicationV1) => {
    const exported = exportSessionApplication(application, nowIso());
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bewerbung-${application.localId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (localIdToDelete: string) => {
    onChange(deleteSessionApplication(applications, localIdToDelete));
    setDeleteConfirmId(null);
    setSelectedId(null);
  };

  const timeline = selected
    ? [
        ...selected.statusHistory.map((entry, index) => ({
          key: `status-${index}`,
          at: entry.at,
          label: `${statusLabel(t, entry.to)}`,
          detail: entry.note ?? "",
        })),
        ...selected.history.map((entry) => ({
          key: entry.id,
          at: entry.at,
          label:
            entry.kind === "feedback"
              ? t("applications.timeline.feedback")
              : entry.kind === "interview"
                ? t("applications.timeline.interview")
                : t("applications.timeline.note"),
          detail: entry.kind === "interview" ? `${entry.scheduledAt}${entry.note ? ` — ${entry.note}` : ""}` : entry.text,
        })),
      ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    : [];

  return (
    <section className="applications-section" aria-labelledby="applications-title">
      <div className="applications-section__head">
        <div>
          <h2 id="applications-title">{t("dashboard.nav.applications")}</h2>
          <p className="applications-session-note" role="note">
            {t("applications.sessionOnly")}
          </p>
        </div>
      </div>

      <div className="applications-controls">
        <label className="letter-field">
          <span>{t("applications.filter")}</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | ApplicationStatus)}>
            <option value="all">{t("applications.filterAll")}</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{statusLabel(t, status)}</option>
            ))}
          </select>
        </label>
        <label className="letter-field">
          <span>{t("applications.sort")}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")}>
            <option value="newest">{t("applications.sortNewest")}</option>
            <option value="oldest">{t("applications.sortOldest")}</option>
          </select>
        </label>
      </div>

      {applications.length === 0 ? (
        <div className="applications-empty">
          <h3>{t("applications.emptyTitle")}</h3>
          <p>{t("applications.emptyText")}</p>
        </div>
      ) : (
        <div className="applications-layout">
          <ul className="applications-list" aria-label={t("applications.listAria")}>
            {visible.length === 0 ? <li className="applications-empty">{t("applications.noFilterResults")}</li> : visible.map((application) => (
              <li key={application.localId}>
                <button
                  type="button"
                  className={`applications-list__item${selected?.localId === application.localId ? " applications-list__item--active" : ""}`}
                  onClick={() => {
                    setSelectedId(application.localId);
                    setPendingSubmit(false);
                    setError("");
                  }}
                >
                  <strong>{application.job.title}</strong>
                  <span>{application.job.companyName}</span>
                  <span>{statusLabel(t, application.status)}</span>
                  <span>{formatDate(application.createdAt, locale)}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <article className="applications-detail" aria-label={t("applications.detailAria")}>
              <div className="applications-detail__head">
                <div>
                  <h3>{selected.job.title}</h3>
                  <p>{selected.job.companyName} · {selected.job.location.join(", ") || "-"}</p>
                </div>
                <button type="button" className="btn-ghost" onClick={() => handleExport(selected)}>
                  {t("applications.export")}
                </button>
              </div>

              <div className="applications-detail__meta">
                <span>{t("applications.statusLabel")}: <strong>{statusLabel(t, selected.status)}</strong></span>
                <span>{t("applications.created")}: {formatDate(selected.createdAt, locale)}</span>
                <span>{t("applications.updated")}: {formatDate(selected.updatedAt, locale)}</span>
                <span>{t("applications.applied")}: {formatDate(selected.applicationDate, locale)}</span>
              </div>

              {selected.job.originalUrl && (
                <a className="remaining-link" href={selected.job.originalUrl} target="_blank" rel="noopener noreferrer">
                  {t("applications.openOriginal")}
                </a>
              )}

              <section className="applications-block">
                <h4>{t("applications.section.job")}</h4>
                <p><strong>{t("applications.sources")}:</strong> {selected.job.source.join(", ") || "-"}</p>
                <p><strong>{t("applications.jobId")}:</strong> {selected.job.jobId}</p>
              </section>

              <section className="applications-block">
                <h4>{t("applications.section.application")}</h4>
                <p><strong>{t("applications.channel")}:</strong> {selected.applicationChannel ? t(`applications.channel.${selected.applicationChannel}`) : "-"}</p>
                <p><strong>{t("applications.contact")}:</strong> {[selected.contact?.name, selected.contact?.email, selected.contact?.phone].filter(Boolean).join(" · ") || "-"}</p>
                <p><strong>{t("applications.notes")}:</strong> {selected.notes || "-"}</p>
              </section>

              <section className="applications-block">
                <h4>{t("applications.section.salary")}</h4>
                <p><strong>{t("applications.expectation")}:</strong> {formatSalary(selected.salary?.expectation, t)}</p>
                <p><strong>{t("applications.offer")}:</strong> {formatSalary(selected.salary?.offer, t)}</p>
              </section>

              <section className="applications-block">
                <h4>{t("applications.section.documents")}</h4>
                <p><strong>{t("applications.documentStatus")}:</strong> {t(`applications.documentStatus.${selected.documents.documentStatus}`)}</p>
                <p><strong>{t("applications.cvReference")}:</strong> {selected.documents.cvReference?.label || selected.documents.cvReference?.cvId || "-"}</p>
                <details>
                  <summary>{t("applications.coverLetterDraft")}</summary>
                  <pre className="applications-cover-letter">{selected.documents.coverLetterDraft || "-"}</pre>
                </details>
                <p><strong>{t("applications.versions")}:</strong> {selected.documents.coverLetterVersions.length}</p>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleSaveVersion}
                  disabled={!selected.documents.coverLetterDraft.trim()}
                >
                  {t("applications.saveVersion")}
                </button>
                {selected.documents.coverLetterVersions.map((version) => (
                  <details key={version.versionId}>
                    <summary>{version.versionId} · {formatDate(version.createdAt, locale)}</summary>
                    <pre className="applications-cover-letter">{version.content}</pre>
                  </details>
                ))}
              </section>

              <section className="applications-block">
                <h4>{t("applications.section.status")}</h4>
                <div className="applications-status-actions">
                  {STATUS_ORDER.filter((status) => canTransitionApplicationStatus(selected.status, status)).map((status) => (
                    <button key={status} type="button" className="btn-ghost" onClick={() => handleTransition(status)}>
                      {statusLabel(t, status)}
                    </button>
                  ))}
                </div>
                {pendingSubmit && (
                  <div className="applications-confirm" role="alert">
                    <p>{t("applications.confirmSubmitQuestion")}</p>
                    <button type="button" className="letter-btn" onClick={() => handleTransition("submitted", true)}>
                      {t("applications.confirmSubmitYes")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setPendingSubmit(false)}>
                      {t("applications.cancel")}
                    </button>
                  </div>
                )}
                {error && <p className="letter-review-warning" role="alert">{error}</p>}
              </section>

              <section className="applications-block">
                <h4>{t("applications.timeline.title")}</h4>
                {timeline.length === 0 ? <p>{t("applications.timeline.empty")}</p> : (
                  <ol className="applications-timeline">
                    {timeline.map((entry) => (
                      <li key={entry.key}>
                        <strong>{entry.label}</strong> · {formatDate(entry.at, locale)}
                        {entry.detail && <p>{entry.detail}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="applications-block">
                <h4>{t("applications.feedback")}</h4>
                <label className="letter-field">
                  <span>{t("applications.feedbackLabel")}</span>
                  <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={2} maxLength={5000} />
                </label>
                <button type="button" className="btn-ghost" onClick={handleFeedback} disabled={!feedback.trim()}>
                  {t("applications.addFeedback")}
                </button>
              </section>

              <section className="applications-block">
                <h4>{t("applications.interview")}</h4>
                <label className="letter-field">
                  <span>{t("applications.interviewAt")}</span>
                  <input type="datetime-local" value={interviewAt} onChange={(event) => setInterviewAt(event.target.value)} />
                </label>
                <label className="letter-field">
                  <span>{t("applications.interviewNote")}</span>
                  <input value={interviewNote} onChange={(event) => setInterviewNote(event.target.value)} maxLength={2000} />
                </label>
                <button type="button" className="btn-ghost" onClick={handleInterview} disabled={!interviewAt}>
                  {t("applications.addInterview")}
                </button>
              </section>

              <section className="applications-block">
                <h4>{t("applications.note")}</h4>
                <label className="letter-field">
                  <span>{t("applications.noteLabel")}</span>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={5000} />
                </label>
                <button type="button" className="btn-ghost" onClick={handleNote} disabled={!note.trim()}>
                  {t("applications.addNote")}
                </button>
              </section>

              <div className="applications-danger">
                {deleteConfirmId === selected.localId ? (
                  <div role="alert">
                    <p>{t("applications.deleteConfirm")}</p>
                    <button type="button" className="letter-btn" onClick={() => handleDelete(selected.localId)}>
                      {t("applications.deleteYes")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(null)}>
                      {t("applications.cancel")}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(selected.localId)}>
                    {t("applications.delete")}
                  </button>
                )}
              </div>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
