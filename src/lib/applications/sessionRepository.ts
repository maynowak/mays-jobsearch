import type {
  ApplicationDeletionResult,
  ApplicationListQuery,
  ApplicationPage,
  ApplicationRepository,
  SessionCoverLetterVersionInput,
  SessionCreateInput,
  SessionDeleteInput,
  SessionHistoryInput,
  SessionStatusRepositoryInput,
  SessionUpdateInput,
} from "./repositoryTypes";
import { ApplicationRepositoryError } from "./repositoryTypes";
import {
  addSessionCoverLetterVersion,
  addSessionFeedback,
  addSessionInterview,
  addSessionNote,
  createSessionApplication,
  deleteSessionApplication,
  exportSessionApplication,
  transitionSessionStatus,
  updateSessionApplication,
  type SessionApplicationV1,
} from "./sessionApplications";
import { ApplicationValidationError } from "./applicationValidation";

export interface SessionApplicationRepositoryOptions {
  initial?: SessionApplicationV1[];
  idFactory?: () => string;
  now?: () => string;
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function mapError(err: unknown): ApplicationRepositoryError {
  if (err instanceof ApplicationRepositoryError) return err;
  if (err instanceof ApplicationValidationError) {
    return new ApplicationRepositoryError(err.message, err.code);
  }
  return new ApplicationRepositoryError(
    err instanceof Error ? err.message : "Application repository operation failed",
    "unavailable"
  );
}

function assertAbort(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new ApplicationRepositoryError("Application repository operation was aborted", "aborted");
  }
}

export function createSessionApplicationRepository(
  options: SessionApplicationRepositoryOptions = {}
): ApplicationRepository {
  let applications = (options.initial ?? []).map((application) => JSON.parse(JSON.stringify(application)) as SessionApplicationV1);
  const idFactory = options.idFactory ?? defaultId;
  const now = options.now ?? defaultNow;
  const idempotency = new Map<string, string>();

  const find = (localId: string): SessionApplicationV1 => {
    const application = applications.find((candidate) => candidate.localId === localId);
    if (!application) throw new ApplicationRepositoryError("Application was not found", "not_found");
    return application;
  };

  const replace = (updated: SessionApplicationV1): SessionApplicationV1 => {
    applications = applications.map((application) =>
      application.localId === updated.localId ? updated : application
    );
    return updated;
  };

  return {
    async list(query: ApplicationListQuery = {}): Promise<ApplicationPage> {
      assertAbort(query.signal);
      const statusFiltered = query.status
        ? applications.filter((application) => application.status === query.status)
        : applications;
      const sorted = [...statusFiltered].sort(
        (a, b) =>
          Date.parse(b.applicationDate ?? b.createdAt) -
          Date.parse(a.applicationDate ?? a.createdAt)
      );
      const cursor = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
      const start = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
      const limit = Math.max(1, Math.min(100, query.limit ?? 50));
      const items = sorted.slice(start, start + limit);
      const next = start + limit < sorted.length ? String(start + limit) : null;
      return { items: items.map((item) => JSON.parse(JSON.stringify(item)) as SessionApplicationV1), nextCursor: next };
    },

    async get(localId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null> {
      assertAbort(signal);
      const application = applications.find((candidate) => candidate.localId === localId);
      return application ? (JSON.parse(JSON.stringify(application)) as SessionApplicationV1) : null;
    },

    async findByJob(jobId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null> {
      assertAbort(signal);
      const application = applications.find((candidate) => candidate.job.jobId === jobId);
      return application ? (JSON.parse(JSON.stringify(application)) as SessionApplicationV1) : null;
    },

    async create(input: SessionCreateInput): Promise<SessionApplicationV1> {
      assertAbort(input.signal);
      try {
        if (input.idempotencyKey) {
          const idempotentLocalId = idempotency.get(input.idempotencyKey);
          const existing = idempotentLocalId
            ? applications.find((application) => application.localId === idempotentLocalId)
            : undefined;
          if (existing) return JSON.parse(JSON.stringify(existing)) as SessionApplicationV1;
          if (idempotentLocalId) idempotency.delete(input.idempotencyKey);
        }
        if (applications.some((application) => application.job.jobId === input.job.jobId)) {
          throw new ApplicationRepositoryError(
            "An application draft already exists for this job",
            "idempotency_conflict"
          );
        }
        const created = createSessionApplication({
          localId: idFactory(),
          now: now(),
          job: input.job,
          coverLetter: input.coverLetter,
          cvReference: input.cvReference,
        });
        applications = [...applications, created];
        if (input.idempotencyKey) idempotency.set(input.idempotencyKey, created.localId);
        return JSON.parse(JSON.stringify(created)) as SessionApplicationV1;
      } catch (err) {
        throw mapError(err);
      }
    },

    async update(localId: string, input: SessionUpdateInput): Promise<SessionApplicationV1> {
      assertAbort(input.signal);
      try {
        const current = find(localId);
        return replace(updateSessionApplication(current, input.expectedVersion, input.changes, now()));
      } catch (err) {
        throw mapError(err);
      }
    },

    async transitionStatus(localId: string, input: SessionStatusRepositoryInput): Promise<SessionApplicationV1> {
      assertAbort(input.signal);
      try {
        const current = find(localId);
        return replace(transitionSessionStatus(current, input));
      } catch (err) {
        throw mapError(err);
      }
    },

    async addHistory(localId: string, input: SessionHistoryInput): Promise<SessionApplicationV1> {
      assertAbort(input.signal);
      try {
        const current = find(localId);
        if (input.kind === "feedback") {
          return replace(
            addSessionFeedback(current, {
              expectedVersion: input.expectedVersion,
              id: input.id,
              at: input.at,
              text: input.text,
            })
          );
        }
        if (input.kind === "interview") {
          return replace(
            addSessionInterview(current, {
              expectedVersion: input.expectedVersion,
              id: input.id,
              at: input.at,
              scheduledAt: input.scheduledAt,
              ...(input.note === undefined ? {} : { note: input.note }),
            })
          );
        }
        return replace(
          addSessionNote(current, {
            expectedVersion: input.expectedVersion,
            id: input.id,
            at: input.at,
            text: input.text,
          })
        );
      } catch (err) {
        throw mapError(err);
      }
    },

    async addCoverLetterVersion(localId: string, input: SessionCoverLetterVersionInput): Promise<SessionApplicationV1> {
      assertAbort(input.signal);
      try {
        return replace(
          addSessionCoverLetterVersion(find(localId), {
            expectedVersion: input.expectedVersion,
            version: input.version,
          })
        );
      } catch (err) {
        throw mapError(err);
      }
    },

    async export(localId: string, signal?: AbortSignal): Promise<ReturnType<typeof exportSessionApplication>> {
      assertAbort(signal);
      try {
        return exportSessionApplication(find(localId), now());
      } catch (err) {
        throw mapError(err);
      }
    },

    async delete(localId: string, input: SessionDeleteInput): Promise<ApplicationDeletionResult> {
      assertAbort(input.signal);
      try {
        const current = applications.find((application) => application.localId === localId);
        if (!current) return { deleted: false, localId, idempotent: true };
        if (current.version !== input.expectedVersion) {
          throw new ApplicationRepositoryError("Local application version conflict", "version_conflict");
        }
        applications = deleteSessionApplication(applications, localId);
        return { deleted: true, localId, idempotent: false };
      } catch (err) {
        throw mapError(err);
      }
    },
  };
}
