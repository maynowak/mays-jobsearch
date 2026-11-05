// Remote ApplicationRepository backed by the RIS ApplicationV1 BFF.
//
// Supported now: list, get, findByJob, create, update, export, delete.
// Not yet supported by the verified RIS surface: status transitions,
// feedback/interview/note history, cover-letter versions and adoption. Those
// operations fail explicitly with `unsupported`; the session repository remains
// the default when remote mode is disabled.

import type {
  ApplicationListQuery,
  ApplicationPage,
  ApplicationRepository,
  ApplicationDeletionResult,
  SessionAdoptCoverLetterInput,
  SessionCoverLetterVersionInput,
  SessionCreateInput,
  SessionDeleteInput,
  SessionHistoryInput,
  SessionStatusRepositoryInput,
  SessionUpdateInput,
} from "../repositoryTypes";
import { ApplicationRepositoryError } from "../repositoryTypes";
import type {
  SessionApplicationExportV1,
  SessionApplicationV1,
} from "../sessionApplications";
import { currentApplicationSessionGeneration } from "../sessionRepository";
import {
  applicationV1ToSession,
  toRisCreateFromSession,
  toRisUpdateFromSession,
} from "./risMapping";
import {
  createRisApplicationPersistencePort,
  type RisPersistenceOptions,
} from "./risClient";

export interface RisApplicationRepositoryOptions extends RisPersistenceOptions {
  port?: ReturnType<typeof createRisApplicationPersistencePort>;
}

export function createRisApplicationRepository(
  options: RisApplicationRepositoryOptions
): ApplicationRepository {
  const port = options.port ?? createRisApplicationPersistencePort(options);
  const generation = currentApplicationSessionGeneration();
  let invalidated = false;

  const assertActive = (): void => {
    if (invalidated || generation !== currentApplicationSessionGeneration()) {
      throw new ApplicationRepositoryError(
        "The application session has ended",
        "session_ended"
      );
    }
  };

  const unsupported = (operation: string): never => {
    throw new ApplicationRepositoryError(
      `${operation} is not supported by the current RIS integration.`,
      "unsupported"
    );
  };

  return {
    async list(query: ApplicationListQuery = {}): Promise<ApplicationPage> {
      assertActive();
      const page = await port.list({
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.signal ? { signal: query.signal } : {}),
      });
      return {
        items: page.items.map(applicationV1ToSession),
        nextCursor: page.nextCursor,
      };
    },

    async get(localId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null> {
      assertActive();
      try {
        const application = await port.get(localId, signal ? { signal } : {});
        return applicationV1ToSession(application);
      } catch (err) {
        if (err instanceof ApplicationRepositoryError && err.code === "not_found") {
          return null;
        }
        throw err;
      }
    },

    async findByJob(jobId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null> {
      assertActive();
      let cursor: string | null = null;
      for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
        const page = await port.list({
          limit: 100,
          ...(cursor ? { cursor } : {}),
          ...(signal ? { signal } : {}),
        });
        const match = page.items.find((application) => application.job.jobId === jobId);
        if (match) return applicationV1ToSession(match);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return null;
    },

    async create(input: SessionCreateInput): Promise<SessionApplicationV1> {
      assertActive();
      const application = await port.create(
        toRisCreateFromSession(input),
        {
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          ...(input.signal ? { signal: input.signal } : {}),
        }
      );
      return applicationV1ToSession(application);
    },

    async update(localId: string, input: SessionUpdateInput): Promise<SessionApplicationV1> {
      assertActive();
      const application = await port.update(
        localId,
        toRisUpdateFromSession(input.expectedVersion, input.changes),
        input.signal ? { signal: input.signal } : {}
      );
      return applicationV1ToSession(application);
    },

    async transitionStatus(
      _localId: string,
      _input: SessionStatusRepositoryInput
    ): Promise<SessionApplicationV1> {
      return unsupported("Status transitions");
    },

    async addHistory(
      _localId: string,
      _input: SessionHistoryInput
    ): Promise<SessionApplicationV1> {
      return unsupported("Application history");
    },

    async addCoverLetterVersion(
      _localId: string,
      _input: SessionCoverLetterVersionInput
    ): Promise<SessionApplicationV1> {
      return unsupported("Cover-letter versions");
    },

    async adoptCoverLetter(
      _localId: string,
      _input: SessionAdoptCoverLetterInput
    ): Promise<SessionApplicationV1> {
      return unsupported("Cover-letter adoption");
    },

    async export(localId: string, signal?: AbortSignal): Promise<SessionApplicationExportV1> {
      assertActive();
      const exported = await port.export(localId, signal ? { signal } : {});
      return {
        schemaVersion: 1,
        exportedAt: exported.exportedAt,
        localDraft: false,
        note: "RIS ApplicationV1 export",
        application: applicationV1ToSession(exported.application),
      };
    },

    async delete(localId: string, input: SessionDeleteInput): Promise<ApplicationDeletionResult> {
      assertActive();
      await port.delete(
        localId,
        input.expectedVersion,
        input.signal ? { signal: input.signal } : {}
      );
      return { deleted: true, localId, idempotent: false };
    },

    invalidate(): void {
      invalidated = true;
    },
  };
}
