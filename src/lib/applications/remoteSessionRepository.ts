import type {
  ApplicationDeletionResult,
  ApplicationListQuery,
  ApplicationPage,
  ApplicationPersistencePort,
  ApplicationRepository,
  SessionAdoptCoverLetterInput,
  SessionCoverLetterVersionInput,
  SessionCreateInput,
  SessionDeleteInput,
  SessionHistoryInput,
  SessionStatusRepositoryInput,
  SessionUpdateInput,
} from "./repositoryTypes";
import { ApplicationRepositoryError } from "./repositoryTypes";
import type {
  ApplicationV1,
  CreateApplicationDraftInputV1,
  UpdateApplicationDraftInputV1,
} from "./contractTypes";
import type {
  SessionApplicationExportV1,
  SessionApplicationV1,
} from "./sessionApplications";

export interface RemoteSessionRepositoryOptions {
  now?: () => string;
  /** Upper bound for findByJob pagination; prevents silent false negatives. */
  findByJobMaxPages?: number;
}

function toSessionApplication(application: ApplicationV1): SessionApplicationV1 {
  return {
    schemaVersion: 1,
    localId: application.applicationId,
    job: application.job,
    documents: application.documents,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    ...(application.applicationDate ? { applicationDate: application.applicationDate } : {}),
    ...(application.applicationChannel ? { applicationChannel: application.applicationChannel } : {}),
    ...(application.contact ? { contact: application.contact } : {}),
    ...(application.notes ? { notes: application.notes } : {}),
    ...(application.salary ? { salary: application.salary } : {}),
    ...(application.followUp ? { followUp: application.followUp } : {}),
    status: application.status,
    statusHistory: application.statusHistory,
    history: application.history,
    version: application.version,
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApplicationRepositoryError && error.code === "not_found";
}

function notSupported(): ApplicationRepositoryError {
  return new ApplicationRepositoryError(
    "This function is not available in remote mode yet",
    "not_supported"
  );
}

function toCreateInput(input: SessionCreateInput): CreateApplicationDraftInputV1 {
  const versions = input.coverLetterVersion ? [input.coverLetterVersion] : [];
  return {
    job: input.job,
    documents: {
      coverLetterDraft: input.coverLetter,
      ...(versions.length ? { coverLetterVersions: versions } : {}),
      ...(input.cvReference ? { cvReference: input.cvReference } : {}),
      documentStatus: input.coverLetterVersion ? "ready" : "draft",
    },
  };
}

function toUpdateInput(input: SessionUpdateInput): UpdateApplicationDraftInputV1 {
  const changes = input.changes;
  const documents =
    changes.coverLetterDraft !== undefined ||
    changes.documentStatus !== undefined ||
    changes.cvReference !== undefined
      ? {
          ...(changes.coverLetterDraft !== undefined
            ? { coverLetterDraft: changes.coverLetterDraft }
            : {}),
          ...(changes.documentStatus !== undefined
            ? { documentStatus: changes.documentStatus }
            : {}),
          ...(changes.cvReference ? { cvReference: changes.cvReference } : {}),
        }
      : undefined;

  return {
    expectedVersion: input.expectedVersion,
    ...(documents ? { documents } : {}),
    ...(changes.applicationDate !== undefined ? { applicationDate: changes.applicationDate ?? undefined } : {}),
    ...(changes.applicationChannel !== undefined
      ? { applicationChannel: changes.applicationChannel ?? undefined }
      : {}),
    ...(changes.contact !== undefined ? { contact: changes.contact ?? undefined } : {}),
    ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
    ...(changes.salary !== undefined ? { salary: changes.salary ?? undefined } : {}),
    ...(changes.followUp !== undefined ? { followUp: changes.followUp ?? undefined } : {}),
  } as UpdateApplicationDraftInputV1;
}

/**
 * Bridges the UI's existing ApplicationRepository contract to the RIS
 * ApplicationPersistencePort. It is only constructed in local preview mode.
 */
export function createRemoteApplicationRepository(
  port: ApplicationPersistencePort & { invalidate?: () => void },
  options: RemoteSessionRepositoryOptions = {}
): ApplicationRepository {
  const now = options.now ?? (() => new Date().toISOString());
  const maxPages = options.findByJobMaxPages ?? 5;

  return {
    async list(query: ApplicationListQuery = {}): Promise<ApplicationPage> {
      const page = await port.list({
        limit: query.limit,
        cursor: query.cursor ?? undefined,
        signal: query.signal,
        ...(query.status ? { status: query.status } : {}),
      });
      return {
        items: page.items.map(toSessionApplication),
        nextCursor: page.nextCursor,
      };
    },

    async get(localId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null> {
      try {
        return toSessionApplication(await port.get(localId, { signal }));
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async findByJob(jobId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null> {
      let cursor: string | undefined;
      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const page = await port.list({ limit: 100, cursor, signal });
        const match = page.items.find((item) => item.job.jobId === jobId);
        if (match) return toSessionApplication(match);
        if (!page.nextCursor) return null;
        cursor = page.nextCursor;
      }
      throw new ApplicationRepositoryError(
        "Could not verify all remote applications for this job",
        "unavailable"
      );
    },

    async create(input: SessionCreateInput): Promise<SessionApplicationV1> {
      const created = await port.create(toCreateInput(input), {
        signal: input.signal,
        idempotencyKey: input.idempotencyKey,
      });
      return toSessionApplication(created);
    },

    async update(localId: string, input: SessionUpdateInput): Promise<SessionApplicationV1> {
      const updated = await port.update(localId, toUpdateInput(input), { signal: input.signal });
      return toSessionApplication(updated);
    },

    async transitionStatus(
      localId: string,
      input: SessionStatusRepositoryInput
    ): Promise<SessionApplicationV1> {
      const updated = await port.transitionStatus(
        localId,
        {
          expectedVersion: input.expectedVersion,
          to: input.to,
          at: input.at,
          ...(input.note ? { note: input.note } : {}),
          ...(input.confirmed ? { confirmed: true } : {}),
        },
        { signal: input.signal }
      );
      return toSessionApplication(updated);
    },

    async addHistory(_localId: string, _input: SessionHistoryInput): Promise<SessionApplicationV1> {
      throw notSupported();
    },

    async addCoverLetterVersion(
      _localId: string,
      _input: SessionCoverLetterVersionInput
    ): Promise<SessionApplicationV1> {
      throw notSupported();
    },

    async adoptCoverLetter(
      _localId: string,
      _input: SessionAdoptCoverLetterInput
    ): Promise<SessionApplicationV1> {
      throw notSupported();
    },

    async export(localId: string, signal?: AbortSignal): Promise<SessionApplicationExportV1> {
      const exported = await port.export(localId, { signal });
      return {
        schemaVersion: 1,
        exportedAt: now(),
        localDraft: false,
        note: "Server-backed application",
        application: toSessionApplication(exported.application),
      };
    },

    async delete(localId: string, input: SessionDeleteInput): Promise<ApplicationDeletionResult> {
      const receipt = await port.delete(localId, input.expectedVersion, { signal: input.signal });
      return {
        deleted: true,
        localId: receipt.applicationId,
        idempotent: false,
      };
    },

    invalidate(): void {
      port.invalidate?.();
    },
  };
}
