import type {
  ApplicationMigrationItemStatus,
  ApplicationMigrationPortV1,
  ApplicationMigrationPreviewItemV1,
  ApplicationMigrationPreviewV1,
  ApplicationMigrationResultV1,
  ApplicationMigrationSelectionV1,
  ApplicationPersistencePort,
  ApplicationRepository,
} from "./repositoryTypes";
import { ApplicationRepositoryError } from "./repositoryTypes";
import type { CreateApplicationDraftInputV1 } from "./contractTypes";
import type { SessionApplicationV1 } from "./sessionApplications";
import { currentApplicationSessionGeneration } from "./sessionRepository";

export interface ApplicationMigrationOptions {
  sessionRepository: Pick<ApplicationRepository, "get">;
  remotePort: Pick<ApplicationPersistencePort, "create" | "get" | "list"> & {
    invalidate?: () => void;
  };
  /** Server-side storage permission. No server consent service exists yet. */
  storageConsent: () => Promise<boolean>;
  consentSource: "simulated" | "server";
  sessionGeneration?: number;
  duplicateCheckMaxPages?: number;
}

export interface ApplicationMigration extends ApplicationMigrationPortV1 {
  invalidate(): void;
  transferredId(localId: string): string | null;
}

function toCreateInput(application: SessionApplicationV1): CreateApplicationDraftInputV1 {
  return {
    job: application.job,
    documents: application.documents,
    ...(application.applicationDate ? { applicationDate: application.applicationDate } : {}),
    ...(application.applicationChannel ? { applicationChannel: application.applicationChannel } : {}),
    ...(application.contact ? { contact: application.contact } : {}),
    ...(application.notes ? { notes: application.notes } : {}),
    ...(application.salary ? { salary: application.salary } : {}),
    ...(application.followUp ? { followUp: application.followUp } : {}),
  };
}

function incompatibilityReasons(application: SessionApplicationV1): string[] {
  const reasons: string[] = [];
  if (application.job.location.length !== 1) reasons.push("location_not_single");
  if (application.job.source.length !== 1) reasons.push("source_not_single");
  if (application.job.jobOrigin === "manual" || application.job.source.includes("manual")) {
    reasons.push("manual_job_unsupported");
  }
  if (application.documents.cvReference?.cvSource === "builder") {
    reasons.push("builder_cv_unsupported");
  }
  if (application.statusHistory.length > 1) reasons.push("status_history_not_transferable");
  if (application.history.length > 0) reasons.push("history_not_transferable");
  if (application.notes && application.notes.length > 10000) reasons.push("notes_too_long");
  if (
    application.job.jobOrigin !== "manual" &&
    !application.job.source.includes("manual") &&
    !application.job.originalUrl
  ) {
    reasons.push("missing_original_url");
  }
  return reasons;
}

export function createApplicationMigration(options: ApplicationMigrationOptions): ApplicationMigration {
  const generation = options.sessionGeneration ?? currentApplicationSessionGeneration();
  const maxPages = options.duplicateCheckMaxPages ?? 5;
  const transferred = new Map<string, string>();
  let invalidated = false;

  const assertActive = (): void => {
    if (invalidated || generation !== currentApplicationSessionGeneration()) {
      throw new ApplicationRepositoryError("The application session has ended", "session_ended");
    }
  };

  async function remoteApplications(signal?: AbortSignal): Promise<{
    byJobId: Map<string, string>;
    complete: boolean;
  }> {
    const byJobId = new Map<string, string>();
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const page = await options.remotePort.list({ limit: 100, cursor, signal });
      for (const application of page.items) {
        if (!byJobId.has(application.job.jobId)) {
          byJobId.set(application.job.jobId, application.applicationId);
        }
      }
      if (!page.nextCursor) return { byJobId, complete: true };
      cursor = page.nextCursor;
    }
    return { byJobId, complete: false };
  }

  async function classify(
    applications: SessionApplicationV1[],
    remote: { byJobId: Map<string, string>; complete: boolean }
  ): Promise<ApplicationMigrationPreviewItemV1[]> {
    return applications.map((application) => {
      const reasons = incompatibilityReasons(application);
      const duplicate = remote.byJobId.has(application.job.jobId);
      let status: ApplicationMigrationItemStatus = "READY";
      if (transferred.has(application.localId)) status = "TRANSFERRED";
      else if (reasons.length) status = "INCOMPATIBLE";
      else if (duplicate) status = "CONFLICT";
      return { localId: application.localId, status, reasons, duplicate };
    });
  }

  async function loadSelected(
    selection: ApplicationMigrationSelectionV1,
    signal?: AbortSignal
  ): Promise<{ applications: SessionApplicationV1[]; missing: string[] }> {
    const applications: SessionApplicationV1[] = [];
    const missing: string[] = [];
    for (const localId of selection.localIds) {
      const application = await options.sessionRepository.get(localId, signal);
      if (application) applications.push(application);
      else missing.push(localId);
    }
    return { applications, missing };
  }

  async function preview(
    selection: ApplicationMigrationSelectionV1,
    signal?: AbortSignal
  ): Promise<ApplicationMigrationPreviewV1> {
    assertActive();
    const { applications, missing } = await loadSelected(selection, signal);
    assertActive();
    const remote = await remoteApplications(signal);
    assertActive();
    const items = await classify(applications, remote);
    const duplicateJobIds = applications
      .filter((application) => remote.byJobId.has(application.job.jobId))
      .map((application) => application.job.jobId);
    const warnings = [
      ...missing.map((localId) => `missing_local_application:${localId}`),
      ...items.flatMap((item) => item.reasons.map((reason) => `${reason}:${item.localId}`)),
      ...(!remote.complete ? ["duplicate_check_incomplete"] : []),
    ];
    return { drafts: applications, duplicateJobIds, warnings, items };
  }

  async function findRemoteByJob(jobId: string, signal?: AbortSignal): Promise<string | null> {
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const page = await options.remotePort.list({ limit: 100, cursor, signal });
      const match = page.items.find((application) => application.job.jobId === jobId);
      if (match) return match.applicationId;
      if (!page.nextCursor) return null;
      cursor = page.nextCursor;
    }
    return null;
  }

  async function commit(
    selection: ApplicationMigrationSelectionV1,
    idempotencyKey: string,
    signal?: AbortSignal
  ): Promise<ApplicationMigrationResultV1> {
    assertActive();
    if (selection.confirmed !== true) {
      throw new ApplicationRepositoryError(
        "Explicit confirmation is required",
        "confirmation_required"
      );
    }
    if (options.consentSource !== "simulated") {
      throw new ApplicationRepositoryError(
        "Storage consent is not available",
        "storage_consent_required"
      );
    }
    const consent = await options.storageConsent();
    if (!consent) {
      throw new ApplicationRepositoryError(
        "Storage consent was not granted",
        "storage_consent_required"
      );
    }

    const snapshot = await preview(selection, signal);
    const succeeded: ApplicationMigrationResultV1["succeeded"] = [];
    const failed: ApplicationMigrationResultV1["failed"] = [];
    const statuses: ApplicationMigrationPreviewItemV1[] = [];
    const selectedById = new Map(snapshot.drafts.map((draft) => [draft.localId, draft]));

    for (const item of snapshot.items) {
      assertActive();
      if (item.status === "TRANSFERRED") {
        const existing = transferred.get(item.localId);
        if (existing) succeeded.push({ localId: item.localId, applicationId: existing, version: 0 });
        statuses.push(item);
        continue;
      }
      if (item.status === "INCOMPATIBLE") {
        failed.push({ localId: item.localId, reason: item.reasons.join(",") || "incompatible" });
        statuses.push({ ...item, status: "FAILED" });
        continue;
      }
      if (item.status === "CONFLICT") {
        failed.push({ localId: item.localId, reason: "duplicate" });
        statuses.push({ ...item, status: "CONFLICT" });
        continue;
      }

      const application = selectedById.get(item.localId);
      if (!application) {
        failed.push({ localId: item.localId, reason: "missing_local_application" });
        statuses.push({ ...item, status: "FAILED" });
        continue;
      }

      try {
        const created = await options.remotePort.create(toCreateInput(application), {
          signal,
          idempotencyKey: `${idempotencyKey}:${application.localId}`,
        });
        assertActive();
        const verified = await options.remotePort.get(created.applicationId, { signal });
        assertActive();
        transferred.set(application.localId, verified.applicationId);
        succeeded.push({
          localId: application.localId,
          applicationId: verified.applicationId,
          version: verified.version,
        });
        statuses.push({ ...item, status: "TRANSFERRED" });
      } catch (error) {
        if (error instanceof ApplicationRepositoryError && error.code === "session_ended") throw error;
        const code = error instanceof ApplicationRepositoryError ? error.code : "unavailable";
        if (code === "unavailable" || code === "conflict" || code === "idempotency_conflict") {
          const reconciled = await findRemoteByJob(application.job.jobId, signal).catch(() => null);
          assertActive();
          if (reconciled) {
            transferred.set(application.localId, reconciled);
            succeeded.push({ localId: application.localId, applicationId: reconciled, version: 0 });
            statuses.push({ ...item, status: "TRANSFERRED" });
            continue;
          }
          failed.push({ localId: application.localId, reason: "confirmation_pending" });
          statuses.push({ ...item, status: "CONFIRMATION_PENDING" });
          continue;
        }
        failed.push({ localId: application.localId, reason: code });
        statuses.push({ ...item, status: "FAILED" });
      }
    }

    return { succeeded, failed, statuses };
  }

  return {
    preview,
    commit,
    invalidate(): void {
      invalidated = true;
      options.remotePort.invalidate?.();
    },
    transferredId(localId: string): string | null {
      return transferred.get(localId) ?? null;
    },
  };
}
