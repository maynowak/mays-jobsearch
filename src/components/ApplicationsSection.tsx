import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLang } from "../i18n";
import type {
  SessionApplicationUpdateChanges,
  SessionApplicationV1,
} from "../lib/applications/sessionApplications";
import type { ApplicationMigrationPortV1, ApplicationRepository } from "../lib/applications/repositoryTypes";
import type { CvDocument, Job, ModelOption } from "../types";
import type { PersistentCv } from "../lib/cvStorageApi";
import type { CvBuilderProfileV1 } from "../lib/cvBuilder/profileTypes";
import { hasCvBuilderTextContent } from "../lib/cvBuilder/toAnonymizedText";
import { ApplicationRepositoryError } from "../lib/applications/repositoryTypes";
import type {
  ApplicationFollowUpV1,
  ApplicationJobReferenceV1,
  ApplicationSalaryV1,
  ApplicationStatus,
  CoverLetterVersionV1,
} from "../lib/applications/contractTypes";
import { ApplicationValidationError } from "../lib/applications/applicationValidation";
import { canTransitionApplicationStatus } from "../lib/applications/applicationDomain";
import ApplicationEditForm from "./ApplicationEditForm";
import ApplicationCard from "./ApplicationCard";
import ApplicationMigrationDialog from "./ApplicationMigrationDialog";
import ApplicationLetterComparison from "./ApplicationLetterComparison";
import NewApplicationForm from "./NewApplicationForm";
import ManualJobDescriptionPrompt from "./ManualJobDescriptionPrompt";
import { getManualJobSession } from "../lib/applications/manualJobSession";
import { sourceLabels } from "./SourceBadge";
import {
  daysFromToday,
  followUpShortLabel,
  followUpSummaryLabel,
  isValidCalendarDate,
} from "../lib/applications/followUp";

interface Props {
  repository: ApplicationRepository;
  storageMode?: "session" | "remote";
  migration?: Pick<ApplicationMigrationPortV1, "preview" | "commit">;
  onChanged?: (applications: SessionApplicationV1[]) => void;
  models?: ModelOption[];
  defaultModel?: string | null;
  recommendedModel?: string | null;
  onOpenLetter?: (job: Job) => void;
  isAuthenticated?: boolean;
  refreshToken?: number;
  cvDocuments?: CvDocument[];
  cvBuilderProfiles?: CvBuilderProfileV1[];
  persistentCvs?: PersistentCv[];
  onOpenCvProfile?: (cvId: string) => void;
  navigationTarget?: {
    localId?: string | null;
    tab?: ApplicationTab;
  } | null;
}

type ApplicationTab = "overview" | "communication" | "documents" | "history";
type ApplicationFilter = "all" | ApplicationStatus | "followUpOpen" | "followUpOverdue";
type ApplicationSort = "newest" | "oldest" | "followUp";

const QUICK_FILTERS: readonly { id: ApplicationFilter; labelKey: string }[] = [
  { id: "all", labelKey: "applications.cockpit.all" },
  { id: "draft", labelKey: "applications.cockpit.draft" },
  { id: "submitted", labelKey: "applications.cockpit.submitted" },
  { id: "interview", labelKey: "applications.cockpit.interview" },
  { id: "followUpOpen", labelKey: "applications.cockpit.openFollowUps" },
  { id: "followUpOverdue", labelKey: "applications.cockpit.overdue" },
];

const APPLICATION_TABS: readonly ApplicationTab[] = [
  "overview",
  "communication",
  "documents",
  "history",
];

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

export default function ApplicationsSection({
  repository,
  storageMode = "session",
  migration,
  onChanged,
  models = [],
  defaultModel = null,
  recommendedModel = null,
  onOpenLetter,
  isAuthenticated = false,
  refreshToken = 0,
  cvDocuments = [],
  cvBuilderProfiles = [],
  persistentCvs = [],
  onOpenCvProfile,
  navigationTarget = null,
}: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const [applications, setApplications] = useState<SessionApplicationV1[]>([]);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [letterDirty, setLetterDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApplicationFilter>("all");
  const [sort, setSort] = useState<ApplicationSort>("newest");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNote, setInterviewNote] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [newApplicationError, setNewApplicationError] = useState("");
  const [newApplicationNotice, setNewApplicationNotice] = useState("");
  const [newApplicationOpen, setNewApplicationOpen] = useState(false);
  const [manualDescriptionTarget, setManualDescriptionTarget] =
    useState<SessionApplicationV1 | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [activeTab, setActiveTab] = useState<ApplicationTab>("overview");
  const [followUpDue, setFollowUpDue] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpError, setFollowUpError] = useState("");
  const tabBaseId = useId();
  const tabRefs = useRef<Record<ApplicationTab, HTMLButtonElement | null>>({
    overview: null,
    communication: null,
    documents: null,
    history: null,
  });
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const applicationsListRef = useRef<HTMLUListElement>(null);
  const draftDetailsRef = useRef<HTMLDetailsElement>(null);
  const mountedRef = useRef(true);
  const applicationsRef = useRef<SessionApplicationV1[]>([]);
  const repositoryRef = useRef(repository);
  const onChangedRef = useRef(onChanged);
  const operationsRef = useRef<Set<AbortController>>(new Set());
  const runningRef = useRef(false);
  const appliedNavigationRef = useRef<Props["navigationTarget"]>(null);

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
    applicationsRef.current = next;
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
        applicationsRef.current = page.items;
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
  }, [repository, t, refreshToken]);

  useEffect(() => {
    setEditing(false);
    setEditError("");
    setPendingSubmit(false);
    setDeleteConfirmId(null);
    setLetterDirty(false);
    setNewApplicationOpen(false);
    setNewApplicationError("");
    setNewApplicationNotice("");
    setManualDescriptionTarget(null);
  }, [repository]);

  useEffect(() => {
    setFollowUpDue(selected?.followUp?.dueOn ?? "");
    setFollowUpNote(selected?.followUp?.note ?? "");
    setFollowUpError("");
  }, [selectedId, repository]);

  useEffect(() => {
    setSelectedId((current) => {
      if (!current && applications[0]) return applications[0].localId;
      if (current && !applications.some((application) => application.localId === current)) {
        return applications[0]?.localId ?? null;
      }
      return current;
    });
  }, [applications]);

  useEffect(() => {
    setLetterDirty(false);
    setManualDescriptionTarget(null);
  }, [selectedId]);

  useEffect(() => {
    if (!navigationTarget || appliedNavigationRef.current === navigationTarget) return;
    const targetFound =
      !navigationTarget.localId ||
      applications.some((application) => application.localId === navigationTarget.localId);
    if (!targetFound) return;
    appliedNavigationRef.current = navigationTarget;
    if (navigationTarget.tab) setActiveTab(navigationTarget.tab);
    if (navigationTarget.localId) setSelectedId(navigationTarget.localId);
  }, [navigationTarget, applications]);

  const metrics = useMemo(() => ({
    total: applications.length,
    draft: applications.filter((application) => application.status === "draft").length,
    submitted: applications.filter((application) => application.status === "submitted").length,
    interview: applications.filter((application) => application.status === "interview").length,
    openFollowUps: applications.filter((application) => application.followUp?.status === "open").length,
  }), [applications]);

  const actionItems = useMemo(() => {
    const groups = { overdue: [] as SessionApplicationV1[], today: [] as SessionApplicationV1[], soon: [] as SessionApplicationV1[] };
    for (const application of applications) {
      if (application.followUp?.status !== "open") continue;
      const days = daysFromToday(application.followUp.dueOn);
      if (days < 0) groups.overdue.push(application);
      else if (days === 0) groups.today.push(application);
      else if (days <= 7) groups.soon.push(application);
    }
    const byDue = (a: SessionApplicationV1, b: SessionApplicationV1) =>
      (a.followUp?.dueOn ?? "").localeCompare(b.followUp?.dueOn ?? "") ||
      a.localId.localeCompare(b.localId);
    groups.overdue.sort(byDue);
    groups.today.sort(byDue);
    groups.soon.sort(byDue);
    return groups;
  }, [applications]);

  const visible = useMemo(() => {
    const filtered = applications.filter((application) => {
      if (filter === "all") return true;
      if (filter === "followUpOpen") return application.followUp?.status === "open";
      if (filter === "followUpOverdue") {
        return application.followUp?.status === "open" && daysFromToday(application.followUp.dueOn) < 0;
      }
      return application.status === filter;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "followUp") {
        const aFollowUp = a.followUp?.status === "open" ? a.followUp.dueOn : null;
        const bFollowUp = b.followUp?.status === "open" ? b.followUp.dueOn : null;
        if (aFollowUp !== bFollowUp) {
          if (aFollowUp === null) return 1;
          if (bFollowUp === null) return -1;
          return aFollowUp.localeCompare(bFollowUp);
        }
        return (b.updatedAt.localeCompare(a.updatedAt)) || a.localId.localeCompare(b.localId);
      }
      const aTime = Date.parse(a.applicationDate ?? a.createdAt);
      const bTime = Date.parse(b.applicationDate ?? b.createdAt);
      return sort === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [applications, filter, sort]);

  const selected = applications.find((application) => application.localId === selectedId) ?? null;

  const replace = (updated: SessionApplicationV1) => {
    const next = applicationsRef.current.map((application) =>
      application.localId === updated.localId ? updated : application
    );
    notify(next);
  };

  const runResult = async <T,>(
    action: (signal: AbortSignal, current: () => boolean) => Promise<T>
  ): Promise<T> => {
    if (runningRef.current) {
      throw new ApplicationRepositoryError(
        "Another application operation is already running",
        "conflict"
      );
    }
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
      return await action(controller.signal, current);
    } finally {
      operationsRef.current.delete(controller);
      runningRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
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
      if (err instanceof ApplicationRepositoryError && err.code === "version_conflict") {
        void repository
          .list()
          .then((page) => {
            if (!current()) return;
            applicationsRef.current = page.items;
            setApplications(page.items);
          })
          .catch(() => {});
      }
      const message = errorLabel(t, err);
      if (onError) onError(message, err);
      else setError(message);
    } finally {
      operationsRef.current.delete(controller);
      runningRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  const tabId = (tab: ApplicationTab) => `${tabBaseId}-tab-${tab}`;
  const panelId = (tab: ApplicationTab) => `${tabBaseId}-panel-${tab}`;

  const selectApplication = (id: string): boolean => {
    if (editing) {
      setError(t("applications.edit.finishFirst"));
      return false;
    }
    if (letterDirty) {
      setError(t("applications.letterComparison.finishFirst"));
      return false;
    }
    setSelectedId(id);
    setActiveTab("overview");
    setEditing(false);
    setEditError("");
    setPendingSubmit(false);
    setDeleteConfirmId(null);
    setError("");
    return true;
  };

  const selectTab = (tab: ApplicationTab): boolean => {
    if (tab === activeTab) return true;
    if (editing) {
      setError(t("applications.edit.finishFirst"));
      return false;
    }
    if (letterDirty) {
      setError(t("applications.letterComparison.finishFirst"));
      return false;
    }
    setActiveTab(tab);
    setError("");
    return true;
  };

  const scrollToTarget = (target: HTMLElement | null) => {
    if (!target) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const handleNavigateToOverview = () => {
    if (!selectTab("overview")) return;
    requestAnimationFrame(() => {
      scrollToTarget(overviewHeadingRef.current);
      overviewHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const handleShowApplicationList = () => {
    requestAnimationFrame(() => {
      const list = applicationsListRef.current;
      scrollToTarget(list);
      list?.querySelector<HTMLButtonElement>(".applications-list__item--active")?.focus({
        preventScroll: true,
      });
    });
  };

  const handleOpenDraft = () => {
    if (!selectTab("documents")) return;
    requestAnimationFrame(() => {
      const details = draftDetailsRef.current;
      if (!details) return;
      details.open = true;
      scrollToTarget(details);
      details.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: ApplicationTab) => {
    const index = APPLICATION_TABS.indexOf(tab);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % APPLICATION_TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + APPLICATION_TABS.length) % APPLICATION_TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = APPLICATION_TABS.length - 1;
    else return;
    event.preventDefault();
    const next = APPLICATION_TABS[nextIndex];
    if (selectTab(next)) tabRefs.current[next]?.focus();
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

  const handleCvReferenceChange = (value: string) => {
    if (!selected) return;
    let cvReference: SessionApplicationV1["documents"]["cvReference"] | null = null;
    if (value.startsWith("builder:")) {
      const cvId = value.slice("builder:".length);
      const profile = cvBuilderProfiles.find((entry) => entry.cvId === cvId);
      if (!profile) return;
      cvReference = { cvId: profile.cvId, label: profile.name, cvSource: "builder" };
    } else if (value.startsWith("uploaded:")) {
      const cvId = value.slice("uploaded:".length);
      const document = cvDocuments.find((entry) => entry.id === cvId);
      if (!document) return;
      cvReference = { cvId: document.id, label: document.name, cvSource: "uploaded" };
    } else if (value.startsWith("persistent:")) {
      const cvId = value.slice("persistent:".length);
      const document = persistentCvs.find((entry) => entry.cvId === cvId);
      if (!document || document.processingStatus !== "ready") return;
      cvReference = {
        cvId: document.cvId,
        ...(document.documentId ? { documentId: document.documentId } : {}),
        label: document.filename,
        cvSource: "uploaded",
      };
    } else if (value !== "none") {
      return;
    }
    void run(async (signal, current) => {
      const updated = await repository.update(selected.localId, {
        expectedVersion: selected.version,
        changes: { cvReference },
        signal,
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

  const saveFollowUp = (followUp: ApplicationFollowUpV1) => {
    if (!selected) return;
    setFollowUpError("");
    void run(
      async (signal, current) => {
        const updated = await repository.update(selected.localId, {
          expectedVersion: selected.version,
          changes: { followUp },
          signal,
        });
        if (!current()) return;
        replace(updated);
        setFollowUpDue(updated.followUp?.dueOn ?? "");
        setFollowUpNote(updated.followUp?.note ?? "");
      },
      (message) => setFollowUpError(message)
    );
  };

  const handleSaveFollowUp = () => {
    if (!selected || !isValidCalendarDate(followUpDue)) {
      setFollowUpError(t("applications.followUp.invalidDate"));
      return;
    }
    const existing = selected.followUp;
    saveFollowUp({
      dueOn: followUpDue,
      ...(followUpNote.trim() ? { note: followUpNote.trim() } : {}),
      status: existing?.status ?? "open",
      ...(existing?.status === "completed" && existing.completedAt
        ? { completedAt: existing.completedAt }
        : {}),
    });
  };

  const handleCompleteFollowUp = () => {
    if (!selected?.followUp) return;
    saveFollowUp({
      ...selected.followUp,
      status: "completed",
      completedAt: nowIso(),
    });
  };

  const handleReopenFollowUp = () => {
    if (!selected?.followUp) return;
    saveFollowUp({
      dueOn: selected.followUp.dueOn,
      ...(selected.followUp.note ? { note: selected.followUp.note } : {}),
      status: "open",
    });
  };

  const handleRemoveFollowUp = () => {
    if (!selected) return;
    void run(
      async (signal, current) => {
        const updated = await repository.update(selected.localId, {
          expectedVersion: selected.version,
          changes: { followUp: null },
          signal,
        });
        if (!current()) return;
        replace(updated);
        setFollowUpDue("");
        setFollowUpNote("");
      },
      (message) => setFollowUpError(message)
    );
  };

  const handleSaveLetterVersion = async (version: CoverLetterVersionV1): Promise<SessionApplicationV1> => {
    if (!selected) throw new Error("No application selected");
    return runResult(async (signal, current) => {
      const updated = await repository.addCoverLetterVersion(selected.localId, {
        expectedVersion: selected.version,
        version,
        signal,
      });
      if (!current()) {
        throw new ApplicationRepositoryError("Application operation was aborted", "aborted");
      }
      replace(updated);
      return updated;
    });
  };

  const handleAdoptLetterDraft = async (content: string): Promise<SessionApplicationV1> => {
    if (!selected) throw new Error("No application selected");
    return runResult(async (signal, current) => {
      const updated = await repository.update(selected.localId, {
        expectedVersion: selected.version,
        changes: {
          coverLetterDraft: content,
          documentStatus: content.trim() ? "draft" : "missing",
        },
        signal,
      });
      if (!current()) {
        throw new ApplicationRepositoryError("Application operation was aborted", "aborted");
      }
      replace(updated);
      return updated;
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

  const feedbackEntries = selected?.history.filter((entry) => entry.kind === "feedback") ?? [];
  const interviewEntries = selected?.history.filter((entry) => entry.kind === "interview") ?? [];

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

  const handleOpenManualLetter = (job: Job) => {
    if (!onOpenLetter) {
      setNewApplicationError(t("applications.new.unavailable"));
      return;
    }
    setNewApplicationError("");
    onOpenLetter(job);
  };

  const handleSaveManualDraft = async (
    job: Job,
    reference: ApplicationJobReferenceV1
  ) => {
    if (!isAuthenticated) {
      setNewApplicationError(t("applications.new.authRequired"));
      throw new Error("Authentication required");
    }
    try {
      const existing = await repository.findByJob(job.slug);
      if (existing) {
        setSelectedId(existing.localId);
        setActiveTab("overview");
        setNewApplicationNotice(t("applications.new.draftExisting"));
        setNewApplicationOpen(false);
        return;
      }
      const application = await repository.create({
        job: reference,
        coverLetter: "",
      });
      const page = await repository.list();
      notify(page.items);
      setSelectedId(application.localId);
      setActiveTab("overview");
      setNewApplicationNotice(t("applications.new.draftCreated"));
      setNewApplicationOpen(false);
    } catch (err) {
      setNewApplicationError(errorLabel(t, err));
      throw err;
    }
  };

  const handleOpenLetterForApplication = (application: SessionApplicationV1) => {
    if (!isAuthenticated) {
      setError(t("applications.new.authRequired"));
      return;
    }
    if (!onOpenLetter) {
      setError(t("applications.new.unavailable"));
      return;
    }
    const session = getManualJobSession(application.job.jobId);
    if (session) {
      setError("");
      onOpenLetter(session.job);
      return;
    }
    setManualDescriptionTarget(application);
    setActiveTab("documents");
  };

  const handleManualDescriptionReady = (job: Job) => {
    setManualDescriptionTarget(null);
    if (onOpenLetter) onOpenLetter(job);
  };

  const selectedCvReference = selected?.documents.cvReference ?? null;
  const selectedCvSource = selectedCvReference?.cvSource ?? "uploaded";
  const selectedBuilderCv =
    selectedCvReference && selectedCvSource === "builder"
      ? cvBuilderProfiles.find((profile) => profile.cvId === selectedCvReference.cvId) ?? null
      : null;
  const selectedUploadedCv =
    selectedCvReference && selectedCvSource === "uploaded"
      ? cvDocuments.find((document) => document.id === selectedCvReference.cvId) ?? null
      : null;
  const selectedPersistentCv =
    selectedCvReference && selectedCvSource === "uploaded"
      ? persistentCvs.find((document) => document.cvId === selectedCvReference.cvId) ?? null
      : null;
  const selectedCvAvailable = selectedCvReference
    ? selectedCvSource === "builder"
      ? Boolean(selectedBuilderCv && hasCvBuilderTextContent(selectedBuilderCv.cvData))
      : Boolean(selectedUploadedCv || (selectedPersistentCv && selectedPersistentCv.processingStatus === "ready"))
    : true;
  const selectedCvValue = selectedCvReference
    ? selectedCvSource === "builder"
      ? `builder:${selectedCvReference.cvId}`
      : selectedPersistentCv
        ? `persistent:${selectedCvReference.cvId}`
        : `uploaded:${selectedCvReference.cvId}`
    : "none";

  return (
    <section className="applications-section" aria-labelledby="applications-title">
      <div className="applications-section__head">
        <div>
          <h2 id="applications-title">{t("dashboard.nav.applications")}</h2>
          <p className="applications-session-note" role="note">
            {storageMode === "remote" ? t("applications.remoteNotice") : t("applications.sessionOnly")}
            {migration && storageMode !== "remote" && applications.length ? (
              <button
                type="button"
                className="btn-ghost applications-migration-open"
                onClick={() => setMigrationOpen(true)}
              >
                {t("applications.migration.action")}
              </button>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="letter-btn applications-new__open"
          aria-expanded={newApplicationOpen}
          aria-controls="applications-new-form"
          onClick={() => {
            setNewApplicationError("");
            setNewApplicationNotice("");
            setNewApplicationOpen((current) => !current);
          }}
        >
          + {t("applications.new.open")}
        </button>
      </div>

      {newApplicationOpen && (
        <div id="applications-new-form">
          <NewApplicationForm
            onGenerate={handleOpenManualLetter}
            onCancel={() => setNewApplicationOpen(false)}
            canSaveDraft={isAuthenticated}
            onSaveDraft={handleSaveManualDraft}
          />
        </div>
      )}

      {newApplicationError && (
        <p className="applications-new__error" role="alert">{newApplicationError}</p>
      )}
      {newApplicationNotice && (
        <p className="applications-new__ok" role="status">{newApplicationNotice}</p>
      )}

      {loading && <p role="status">{t("applications.loading")}</p>}

      {!loading && applications.length > 0 && (
        <div className="applications-cockpit">
          <section className="applications-metrics" aria-labelledby="applications-metrics-title">
            <h3 id="applications-metrics-title">{t("applications.cockpit.title")}</h3>
            <div className="applications-metrics__grid">
              {[
                ["total", metrics.total, "applications.cockpit.total"],
                ["draft", metrics.draft, "applications.cockpit.draft"],
                ["submitted", metrics.submitted, "applications.cockpit.submitted"],
                ["interview", metrics.interview, "applications.cockpit.interview"],
                ["followUpOpen", metrics.openFollowUps, "applications.cockpit.openFollowUps"],
              ].map(([key, count, labelKey]) => (
                <div className="applications-metric-card" key={String(key)}>
                  <strong>{String(count)}</strong>
                  <span>{t(String(labelKey))}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="applications-action-needed" aria-labelledby="applications-action-title">
            <h3 id="applications-action-title">{t("applications.cockpit.actionNeeded")}</h3>
            {actionItems.overdue.length + actionItems.today.length + actionItems.soon.length === 0 ? (
              <p className="applications-cockpit__empty">{t("applications.cockpit.noActions")}</p>
            ) : (
              <div className="applications-action-needed__groups">
                {[
                  ["overdue", actionItems.overdue, "applications.cockpit.overdue"],
                  ["today", actionItems.today, "applications.cockpit.dueToday"],
                  ["soon", actionItems.soon, "applications.cockpit.dueSoon"],
                ].map(([kind, items, labelKey]) =>
                  (items as SessionApplicationV1[]).length === 0 ? null : (
                    <div className="applications-action-group" key={String(kind)}>
                      <h4>{t(String(labelKey))} ({ (items as SessionApplicationV1[]).length })</h4>
                      <ul>
                        {(items as SessionApplicationV1[]).map((application) => (
                          <li key={application.localId}>
                            <button
                              type="button"
                              className="applications-action-item"
                              onClick={() => {
                                if (selectApplication(application.localId)) setActiveTab("communication");
                              }}
                            >
                              <strong>{application.job.title}</strong>
                              <span>{application.job.companyName}</span>
                              <span>{application.followUp ? followUpShortLabel(application.followUp, locale, t) : ""}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className="applications-quick-filters" role="group" aria-label={t("applications.cockpit.quickFilters")}>
          {QUICK_FILTERS.map(({ id, labelKey }) => (
            <button
              key={id}
              type="button"
              className={`applications-quick-filter${filter === id ? " applications-quick-filter--active" : ""}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}

      <div className="applications-controls">
        <label className="letter-field">
          <span>{t("applications.filter")}</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as ApplicationFilter)}>
            <option value="all">{t("applications.filterAll")}</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{statusLabel(t, status)}</option>
            ))}
            <option value="followUpOpen">{t("applications.cockpit.openFollowUps")}</option>
            <option value="followUpOverdue">{t("applications.cockpit.overdue")}</option>
          </select>
        </label>
        <label className="letter-field">
          <span>{t("applications.sort")}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as ApplicationSort)}>
            <option value="newest">{t("applications.sortNewest")}</option>
            <option value="oldest">{t("applications.sortOldest")}</option>
            <option value="followUp">{t("applications.cockpit.sortFollowUp")}</option>
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
          <ul ref={applicationsListRef} className="applications-list" aria-label={t("applications.listAria")}>
            {visible.length === 0 ? <li className="applications-empty">{t("applications.noFilterResults")}</li> : visible.map((application) => (
              <li key={application.localId}>
                <ApplicationCard
                  application={application}
                  selected={selected?.localId === application.localId}
                  onSelect={() => selectApplication(application.localId)}
                />
              </li>
            ))}
          </ul>

          {selected ? (
            <article className="applications-detail" aria-label={t("applications.detailAria")}>
              <div className="applications-detail__head">
                <div>
                  <h3 ref={overviewHeadingRef} tabIndex={-1}>{selected.job.title}</h3>
                  <p>{selected.job.companyName} · {selected.job.location.join(", ") || "-"}</p>
                </div>
                <div className="applications-detail__actions">
                  <span className={`applications-status-pill applications-status-pill--${selected.status}`}>
                    {statusLabel(t, selected.status)}
                  </span>
                  {!editing && (
                    <button
                      type="button"
                      className="letter-btn"
                      onClick={() => {
                        setEditError("");
                        setError("");
                        setActiveTab("overview");
                        setEditing(true);
                      }}
                      disabled={busy}
                    >
                      {t("applications.edit")}
                    </button>
                  )}
                </div>
              </div>

              <div className="applications-detail__meta">
                <span>{t("applications.created")}: {formatDate(selected.createdAt, locale)}</span>
                <span>{t("applications.updated")}: {formatDate(selected.updatedAt, locale)}</span>
                <span>{t("applications.applied")}: {formatApplicationDate(selected.applicationDate, locale)}</span>
              </div>

              <div
                className="applications-tabs"
                role="tablist"
                aria-label={t("applications.tabs.aria")}
              >
                {APPLICATION_TABS.map((tab) => (
                  <button
                    key={tab}
                    ref={(element) => {
                      tabRefs.current[tab] = element;
                    }}
                    id={tabId(tab)}
                    type="button"
                    role="tab"
                    className={`applications-tab${activeTab === tab ? " applications-tab--active" : ""}`}
                    aria-selected={activeTab === tab}
                    aria-controls={panelId(tab)}
                    tabIndex={activeTab === tab ? 0 : -1}
                    onClick={() => selectTab(tab)}
                    onKeyDown={(event) => handleTabKeyDown(event, tab)}
                  >
                    {t(`applications.tabs.${tab}`)}
                  </button>
                ))}
              </div>

              {error && <p className="letter-review-warning" role="alert">{error}</p>}

              {activeTab === "overview" && (
                <div
                  className="applications-tabpanel"
                  role="tabpanel"
                  id={panelId("overview")}
                  aria-labelledby={tabId("overview")}
                  tabIndex={0}
                >
                  {editing ? (
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
                  ) : (
                    <>
                      {selected.job.originalUrl && (
                        <a className="remaining-link" href={selected.job.originalUrl} target="_blank" rel="noopener noreferrer">
                          {t("applications.openOriginal")}
                        </a>
                      )}

                      <section className="applications-block">
                        <h4>{t("applications.section.job")}</h4>
                        <p><strong>{t("applications.sources")}:</strong> {sourceLabels(selected.job.source, t).join(" · ") || "-"}</p>
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
                    </>
                  )}

                  {selected.followUp && (
                    <div
                      className={`applications-followup-summary${
                        selected.followUp.status === "open" && daysFromToday(selected.followUp.dueOn) < 0
                          ? " applications-followup-summary--overdue"
                          : ""
                      }`}
                      role="status"
                    >
                      <strong>{t("applications.followUp.next")}</strong>{" "}
                      {followUpSummaryLabel(selected.followUp, locale, t)}
                      {selected.followUp.note ? <span>{selected.followUp.note}</span> : null}
                    </div>
                  )}

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
                  </section>
                </div>
              )}

              {activeTab === "communication" && (
                <div
                  className="applications-tabpanel"
                  role="tabpanel"
                  id={panelId("communication")}
                  aria-labelledby={tabId("communication")}
                  tabIndex={0}
                >
                  <section className="applications-block applications-followup-editor">
                    <h4>{t("applications.followUp.title")}</h4>
                    {selected.followUp && (
                      <p className="applications-followup-status">
                        <strong>{followUpShortLabel(selected.followUp, locale, t)}</strong>
                        {selected.followUp.status === "completed" && selected.followUp.completedAt
                          ? ` · ${t("applications.followUp.completedAt", {
                              date: formatDate(selected.followUp.completedAt, locale),
                            })}`
                          : ""}
                      </p>
                    )}
                    <label className="letter-field">
                      <span>{t("applications.followUp.date")}</span>
                      <input
                        type="date"
                        value={followUpDue}
                        onChange={(event) => setFollowUpDue(event.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <label className="letter-field">
                      <span>{t("applications.followUp.note")}</span>
                      <textarea
                        value={followUpNote}
                        onChange={(event) => setFollowUpNote(event.target.value)}
                        rows={2}
                        maxLength={2000}
                        disabled={busy}
                      />
                    </label>
                    <div className="applications-followup-actions">
                      <button type="button" className="letter-btn" onClick={handleSaveFollowUp} disabled={busy}>
                        {t("applications.followUp.save")}
                      </button>
                      {selected.followUp?.status === "open" && (
                        <button type="button" className="btn-ghost" onClick={handleCompleteFollowUp} disabled={busy}>
                          {t("applications.followUp.complete")}
                        </button>
                      )}
                      {selected.followUp?.status === "completed" && (
                        <button type="button" className="btn-ghost" onClick={handleReopenFollowUp} disabled={busy}>
                          {t("applications.followUp.reopen")}
                        </button>
                      )}
                      {selected.followUp && (
                        <button type="button" className="btn-ghost" onClick={handleRemoveFollowUp} disabled={busy}>
                          {t("applications.followUp.remove")}
                        </button>
                      )}
                    </div>
                    {followUpError && <p className="letter-review-warning" role="alert">{followUpError}</p>}
                  </section>

                  <section className="applications-block">
                    <h4>{t("applications.communication.feedback")}</h4>
                    <label className="letter-field">
                      <span>{t("applications.feedbackLabel")}</span>
                      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={2} maxLength={5000} />
                    </label>
                    <button type="button" className="btn-ghost" onClick={handleFeedback} disabled={busy || !feedback.trim()}>
                      {t("applications.addFeedback")}
                    </button>
                    {feedbackEntries.length === 0 ? (
                      <p>{t("applications.communication.noFeedback")}</p>
                    ) : (
                      <ul className="applications-communication">
                        {feedbackEntries.map((entry) => (
                          <li key={entry.id}>
                            <strong>{t("applications.timeline.feedback")}</strong> · {formatDate(entry.at, locale)}
                            <p>{entry.text}</p>
                          </li>
                        ))}
                      </ul>
                    )}
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
                    {interviewEntries.length === 0 ? (
                      <p>{t("applications.communication.noInterviews")}</p>
                    ) : (
                      <ul className="applications-communication">
                        {interviewEntries.map((entry) => (
                          <li key={entry.id}>
                            <strong>{t("applications.timeline.interview")}</strong> · {formatDate(entry.at, locale)}
                            <p>{t("applications.communication.interviewAt")}: {formatDate(entry.scheduledAt, locale)}{entry.note ? ` — ${entry.note}` : ""}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}

              {activeTab === "documents" && (
                <div
                  className="applications-tabpanel"
                  role="tabpanel"
                  id={panelId("documents")}
                  aria-labelledby={tabId("documents")}
                  tabIndex={0}
                >
                  {isAuthenticated &&
                    (selected.job.jobOrigin === "manual" ||
                      selected.job.source.includes("manual")) && (
                      <div className="applications-documents-actions">
                        <button
                          type="button"
                          className="letter-btn"
                          onClick={() => handleOpenLetterForApplication(selected)}
                        >
                          {t("applications.createLetter")}
                        </button>
                      </div>
                    )}

                  {manualDescriptionTarget?.localId === selected.localId && (
                    <ManualJobDescriptionPrompt
                      key={`${selected.localId}-description`}
                      application={selected}
                      onReady={handleManualDescriptionReady}
                      onCancel={() => setManualDescriptionTarget(null)}
                    />
                  )}

                  <section className="applications-block">
                    <h4>{t("applications.section.documents")}</h4>
                    <p><strong>{t("applications.documentStatus")}:</strong> {t(`applications.documentStatus.${selected.documents.documentStatus}`)}</p>
                    <p>
                      <strong>{t("applications.cvReference")}:</strong>{" "}
                      {selectedCvReference?.label || selectedCvReference?.cvId || "-"}
                    </p>
                    <p>
                      <strong>{t("applications.cvSource")}:</strong>{" "}
                      {selectedCvReference
                        ? t(
                            selectedCvSource === "builder"
                              ? "applications.cvSource.builder"
                              : "applications.cvSource.uploaded"
                          )
                        : "-"}
                    </p>
                    {selectedCvReference && !selectedCvAvailable && (
                      <p className="applications-session-note" role="alert">
                        {t("applications.cvReferenceUnavailable")}
                      </p>
                    )}
                    {selectedBuilderCv && onOpenCvProfile && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => onOpenCvProfile(selectedBuilderCv.cvId)}
                      >
                        {t("applications.openCvProfile")}
                      </button>
                    )}
                    <label className="applications-field">
                      <span>{t("applications.changeCvReference")}</span>
                      <select
                        value={selectedCvValue}
                        onChange={(event) => handleCvReferenceChange(event.target.value)}
                        disabled={busy}
                      >
                        <option value="none">{t("applications.cvNone")}</option>
                        {selectedCvReference && !selectedCvAvailable && (
                          <option value={selectedCvValue}>
                            {t("applications.cvReferenceUnavailable")}
                          </option>
                        )}
                        {cvDocuments.length > 0 && (
                          <optgroup label={t("applications.cvSource.uploaded")}>
                            {cvDocuments.map((document) => (
                              <option key={`uploaded:${document.id}`} value={`uploaded:${document.id}`}>
                                {document.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {persistentCvs.length > 0 && (
                          <optgroup label={t("applications.cvSource.persistent")}>
                            {persistentCvs.map((document) => (
                              <option
                                key={`persistent:${document.cvId}`}
                                value={`persistent:${document.cvId}`}
                                disabled={document.processingStatus !== "ready"}
                              >
                                {document.filename}
                                {document.processingStatus === "ready"
                                  ? ""
                                  : ` — ${t("applications.cvNotUsable")}`}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {cvBuilderProfiles.length > 0 && (
                          <optgroup label={t("applications.cvSource.builder")}>
                            {cvBuilderProfiles.map((profile) => (
                              <option
                                key={`builder:${profile.cvId}`}
                                value={`builder:${profile.cvId}`}
                                disabled={!hasCvBuilderTextContent(profile.cvData)}
                              >
                                {profile.name}
                                {hasCvBuilderTextContent(profile.cvData)
                                  ? ""
                                  : ` — ${t("applications.cvNotUsable")}`}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </label>
                    <details ref={draftDetailsRef}>
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

                  <ApplicationLetterComparison
                    application={selected}
                    models={models}
                    defaultModel={defaultModel}
                    recommendedModel={recommendedModel}
                    busy={busy}
                    onSaveVersion={handleSaveLetterVersion}
                    onAdoptDraft={handleAdoptLetterDraft}
                    onDirtyChange={setLetterDirty}
                    onNavigateToOverview={handleNavigateToOverview}
                    onShowApplicationList={handleShowApplicationList}
                    onOpenDraft={handleOpenDraft}
                  />

                  <section className="applications-block">
                    <h4>{t("applications.exportTitle")}</h4>
                    <button type="button" className="btn-ghost" onClick={() => handleExport(selected)} disabled={busy}>
                      {t("applications.export")}
                    </button>
                  </section>
                </div>
              )}

              {activeTab === "history" && (
                <div
                  className="applications-tabpanel"
                  role="tabpanel"
                  id={panelId("history")}
                  aria-labelledby={tabId("history")}
                  tabIndex={0}
                >
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
                    <h4>{t("applications.note")}</h4>
                    <label className="letter-field">
                      <span>{t("applications.noteLabel")}</span>
                      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={5000} />
                    </label>
                    <button type="button" className="btn-ghost" onClick={handleNote} disabled={busy || !note.trim()}>
                      {t("applications.addNote")}
                    </button>
                  </section>
                </div>
              )}

              <div className="applications-danger">
                {deleteConfirmId === selected.localId ? (
                  <div role="alert">
                    <p>{storageMode === "remote" ? t("applications.deleteConfirmRemote") : t("applications.deleteConfirm")}</p>
                    <button type="button" className="letter-btn" onClick={() => handleDelete(selected.localId)} disabled={busy}>
                      {t("applications.deleteYes")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(null)}>
                      {t("applications.cancel")}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost" onClick={() => setDeleteConfirmId(selected.localId)} disabled={busy}>
                    {storageMode === "remote" ? t("applications.deleteRemote") : t("applications.delete")}
                  </button>
                )}
              </div>
            </article>
          ) : null}
        </div>
      )}
      {migration ? (
        <ApplicationMigrationDialog
          open={migrationOpen}
          applications={applications}
          port={migration}
          onClose={() => setMigrationOpen(false)}
        />
      ) : null}
    </section>
  );
}
