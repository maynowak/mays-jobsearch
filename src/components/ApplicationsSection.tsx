import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../i18n";
import type {
  SessionApplicationUpdateChanges,
  SessionApplicationV1,
} from "../lib/applications/sessionApplications";
import type { ApplicationRepository } from "../lib/applications/repositoryTypes";
import { ApplicationRepositoryError } from "../lib/applications/repositoryTypes";
import type { ApplicationSalaryV1, ApplicationStatus } from "../lib/applications/contractTypes";
import { ApplicationValidationError } from "../lib/applications/applicationValidation";
import { canTransitionApplicationStatus } from "../lib/applications/applicationDomain";
import ApplicationEditForm from "./ApplicationEditForm";

interface Props {
  repository: ApplicationRepository;
  onChanged?: (applications: SessionApplicationV1[]) => void;
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

function formatApplicationDate(value: string | undefined, locale: string): string {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
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

function errorLabel(t: (key: string) => string, err: unknown): string {
  if (err instanceof ApplicationValidationError || err instanceof ApplicationRepositoryError) {
    return t(`applications.error.${err.code}`);
  }
  return t("applications.actionError");
}

export default function ApplicationsSection({ repository, onChanged }: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const [applications, setApplications] = useState<SessionApplicationV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNote, setInterviewNote] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const mountedRef = useRef(true);
  const repositoryRef = useRef(repository);
  const onChangedRef = useRef(onChanged);
  const operationsRef = useRef<Set<AbortController>>(new Set());
  const runningRef = useRef(false);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationsRef.current.forEach((controller) => controller.abort());
    };
  }, []);

  useEffect(() => {
    repositoryRef.current = repository;
    operationsRef.current.forEach((controller) => controller.abort());
  }, [repository]);

  const notify = (next: SessionApplicationV1[]) => {
    if (!mountedRef.current || repositoryRef.current !== repository) return;
    setApplications(next);
    onChangedRef.current?.(next);
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    repository
      .list({ signal: controller.signal })
      .then((page) => {
        if (!active) return;
        setApplications(page.items);
        onChangedRef.current?.(page.items);
      })
      .catch((err) => {
        if (!active || (err instanceof ApplicationRepositoryError && err.code === "aborted")) return;
        setError(errorLabel(t, err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [repository, t]);

  useEffect(() => {
    setEditing(false);
    setEditError("");
    setPendingSubmit(false);
    setDeleteConfirmId(null);
  }, [repository]);

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
    notify(applications.map((application) => (application.localId === updated.localId ? updated : application)));
  };

  const run = async (
    action: (signal: AbortSignal, current: () => boolean) => Promise<void>,
    onError?: (message: string, err: unknown) => void
  ) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    const repositoryAtStart = repository;
    const current = () =>
      mountedRef.current &&
      repositoryRef.current === repositoryAtStart &&
      !controller.signal.aborted;
    operationsRef.current.add(controller);
    setError("");
    try {
      await action(controller.signal, current);
    } catch (err) {
      if (!current()) return;
      const message = errorLabel(t, err);
      if (onError) onError(message, err);
      else setError(message);
    } finally {
      operationsRef.current.delete(controller);
      runningRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleTransition = (to: ApplicationStatus, confirmed = false) => {
    if (!selected) return;
    if (to === "submitted" && !confirmed) {
      setPendingSubmit(true);
      return;
    }
    void run(async (signal, current) => {
      const updated = await repository.transitionStatus(selected.localId, {
        expectedVersion: selected.version,
        to,
        at: nowIso(),
        signal,
        ...(to === "submitted" ? { confirmed: true } : {}),
      });
      if (!current()) return;
      replace(updated);
      setPendingSubmit(false);
    });
  };

  const handleSaveVersion = () => {
    if (!selected || !selected.documents.coverLetterDraft.trim()) return;
    void run(async (signal, current) => {
      const updated = await repository.addCoverLetterVersion(selected.localId, {
        expectedVersion: selected.version,
        signal,
        version: {
          versionId: localId(),
          jobId: selected.job.jobId,
          createdAt: nowIso(),
          content: selected.documents.coverLetterDraft,
          source: "manual",
        },
      });
      if (!current()) return;
      replace(updated);
    });
  };

  const handleFeedback = () => {
    if (!selected || !feedback.trim()) return;
    void run(async (signal, current) => {
      const updated = await repository.addHistory(selected.localId, {
        kind: "feedback",
        signal,
        expectedVersion: selected.version,
        id: localId(),
        at: nowIso(),
        text: feedback.trim(),
      });
      if (!current()) return;
      replace(updated);
      setFeedback("");
    });
  };

  const handleInterview = () => {
    if (!selected || !interviewAt) return;
    void run(async (signal, current) => {
      const updated = await repository.addHistory(selected.localId, {
        kind: "interview",
        signal,
        expectedVersion: selected.version,
        id: localId(),
        at: nowIso(),
        scheduledAt: new Date(interviewAt).toISOString(),
        ...(interviewNote.trim() ? { note: interviewNote.trim() } : {}),
      });
      if (!current()) return;
      replace(updated);
      setInterviewAt("");
      setInterviewNote("");
    });
  };

  const handleNote = () => {
    if (!selected || !note.trim()) return;
    void run(async (signal, current) => {
      const updated = await repository.addHistory(selected.localId, {
        kind: "note",
        signal,
        expectedVersion: selected.version,
        id: localId(),
        at: nowIso(),
        text: note.trim(),
      });
      if (!current()) return;
      replace(updated);
      setNote("");
    });
  };

  const handleSaveEdits = (changes: SessionApplicationUpdateChanges) => {
    if (!selected) return;
    setEditError("");
    void run(
      async (signal, current) => {
        const updated = await repository.update(selected.localId, {
          expectedVersion: selected.version,
          changes,
          signal,
        });
        if (!current()) return;
        replace(updated);
        setEditing(false);
      },
      (message, err) => {
        setEditError(message);
        if (err instanceof ApplicationRepositoryError && err.code === "session_ended") {
          setEditing(false);
        }
      }
    );
  };

  const handleExport = (application: SessionApplicationV1) => {
    void run(async (signal, current) => {
      const exported = await repository.export(application.localId, signal);
      if (!current()) return;
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bewerbung-${application.localId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleDelete = (localIdToDelete: string) => {
    const current = applications.find((application) => application.localId === localIdToDelete);
    if (!current) return;
    void run(async (signal, isCurrent) => {
      await repository.delete(localIdToDelete, { expectedVersion: current.version, signal });
      if (!isCurrent()) return;
      notify(applications.filter((application) => application.localId !== localIdToDelete));
      setDeleteConfirmId(null);
      setEditing(false);
      setEditError("");
      setSelectedId(null);
    });
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

      {loading && <p role="status">{t("applications.loading")}</p>}

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

      {!loading && applications.length === 0 ? (
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
                    setEditing(false);
                    setEditError("");
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
                <div className="applications-detail__actions">
                  {!editing && (
                    <button
                      type="button"
                      className="letter-btn"
                      onClick={() => {
                        setEditError("");
                        setError("");
                        setEditing(true);
                      }}
                      disabled={busy}
                    >
                      {t("applications.edit")}
                    </button>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => handleExport(selected)} disabled={busy}>
                    {t("applications.export")}
                  </button>
                </div>
              </div>

              <div className="applications-detail__meta">
                <span>{t("applications.statusLabel")}: <strong>{statusLabel(t, selected.status)}</strong></span>
                <span>{t("applications.created")}: {formatDate(selected.createdAt, locale)}</span>
                <span>{t("applications.updated")}: {formatDate(selected.updatedAt, locale)}</span>
                <span>{t("applications.applied")}: {formatApplicationDate(selected.applicationDate, locale)}</span>
              </div>

              {selected.job.originalUrl && (
                <a className="remaining-link" href={selected.job.originalUrl} target="_blank" rel="noopener noreferrer">
                  {t("applications.openOriginal")}
                </a>
              )}

              {editing && (
                <ApplicationEditForm
                  key={`${selected.localId}-${selected.version}`}
                  application={selected}
                  busy={busy}
                  error={editError}
                  onSave={handleSaveEdits}
                  onCancel={() => {
                    setEditing(false);
                    setEditError("");
                  }}
                />
              )}

              <section className="applications-block">
                <h4>{t("applications.section.job")}</h4>
                <p><strong>{t("applications.sources")}:</strong> {selected.job.source.join(", ") || "-"}</p>
                <p><strong>{t("applications.jobId")}:</strong> {selected.job.jobId}</p>
              </section>

              {!editing && (
                <>
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
                </>
              )}

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
                  disabled={busy || !selected.documents.coverLetterDraft.trim()}
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
                    <button key={status} type="button" className="btn-ghost" onClick={() => handleTransition(status)} disabled={busy}>
                      {statusLabel(t, status)}
                    </button>
                  ))}
                </div>
                {pendingSubmit && (
                  <div className="applications-confirm" role="alert">
                    <p>{t("applications.confirmSubmitQuestion")}</p>
                    <button type="button" className="letter-btn" onClick={() => handleTransition("submitted", true)} disabled={busy}>
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
                <button type="button" className="btn-ghost" onClick={handleFeedback} disabled={busy || !feedback.trim()}>
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
                <button type="button" className="btn-ghost" onClick={handleInterview} disabled={busy || !interviewAt}>
                  {t("applications.addInterview")}
                </button>
              </section>

              <section className="applications-block">
                <h4>{t("applications.note")}</h4>
                <label className="letter-field">
                  <span>{t("applications.noteLabel")}</span>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={5000} />
                </label>
                <button type="button" className="btn-ghost" onClick={handleNote} disabled={busy || !note.trim()}>
                  {t("applications.addNote")}
                </button>
              </section>

              <div className="applications-danger">
                {deleteConfirmId === selected.localId ? (
                  <div role="alert">
                    <p>{t("applications.deleteConfirm")}</p>
                    <button type="button" className="letter-btn" onClick={() => handleDelete(selected.localId)} disabled={busy}>
                      {t("applications.deleteYes")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(null)}>
                      {t("applications.cancel")}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(selected.localId)} disabled={busy}>
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
