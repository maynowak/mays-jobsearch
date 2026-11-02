import type {
  ApplicationStatus,
  CoverLetterVersionV1,
  ISODateTime,
} from "./contractTypes";
import type {
  SessionApplicationExportV1,
  SessionApplicationV1,
  SessionStatusInput,
} from "./sessionApplications";

export type ApplicationRepositoryErrorCode =
  | "validation_error"
  | "not_found"
  | "version_conflict"
  | "invalid_transition"
  | "confirmation_required"
  | "aborted"
  | "unavailable"
  | "owner_mismatch"
  | "idempotency_conflict";

export class ApplicationRepositoryError extends Error {
  readonly code: ApplicationRepositoryErrorCode;

  constructor(message: string, code: ApplicationRepositoryErrorCode = "validation_error") {
    super(message);
    this.name = "ApplicationRepositoryError";
    this.code = code;
  }
}

export interface ApplicationListQuery {
  status?: ApplicationStatus;
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
}

export interface ApplicationPage {
  items: SessionApplicationV1[];
  nextCursor: string | null;
}

export interface SessionCreateInput {
  job: SessionApplicationV1["job"];
  coverLetter: string;
  cvReference?: SessionApplicationV1["documents"]["cvReference"];
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface SessionUpdateInput {
  expectedVersion: number;
  changes: {
    applicationDate?: ISODateTime;
    applicationChannel?: SessionApplicationV1["applicationChannel"];
    contact?: SessionApplicationV1["contact"];
    notes?: string;
    salary?: SessionApplicationV1["salary"];
    coverLetterDraft?: string;
    documentStatus?: SessionApplicationV1["documents"]["documentStatus"];
  };
  signal?: AbortSignal;
}

export type SessionHistoryInput =
  | {
      kind: "feedback";
      expectedVersion: number;
      id: string;
      at: ISODateTime;
      text: string;
      signal?: AbortSignal;
    }
  | {
      kind: "interview";
      expectedVersion: number;
      id: string;
      at: ISODateTime;
      scheduledAt: ISODateTime;
      note?: string;
      signal?: AbortSignal;
    }
  | {
      kind: "note";
      expectedVersion: number;
      id: string;
      at: ISODateTime;
      text: string;
      signal?: AbortSignal;
    };

export interface SessionCoverLetterVersionInput {
  expectedVersion: number;
  version: CoverLetterVersionV1;
  signal?: AbortSignal;
}

export interface SessionStatusRepositoryInput extends SessionStatusInput {
  signal?: AbortSignal;
}

export interface SessionDeleteInput {
  expectedVersion: number;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface ApplicationDeletionResult {
  deleted: boolean;
  localId: string;
  idempotent: boolean;
}

/**
 * APP-03 persistence-neutral application repository.
 *
 * The session adapter is the current implementation. A later RIS adapter must
 * satisfy the server-backed ApplicationV1 contract documented in
 * MAYS-RIS-APPLICATION-PERSISTENCE-HANDOFF-V1 and must not reuse localId as a
 * server applicationId.
 */
export interface ApplicationRepository {
  list(query?: ApplicationListQuery): Promise<ApplicationPage>;
  get(localId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null>;
  findByJob(jobId: string, signal?: AbortSignal): Promise<SessionApplicationV1 | null>;
  create(input: SessionCreateInput): Promise<SessionApplicationV1>;
  update(localId: string, input: SessionUpdateInput): Promise<SessionApplicationV1>;
  transitionStatus(localId: string, input: SessionStatusRepositoryInput): Promise<SessionApplicationV1>;
  addHistory(localId: string, input: SessionHistoryInput): Promise<SessionApplicationV1>;
  addCoverLetterVersion(
    localId: string,
    input: SessionCoverLetterVersionInput
  ): Promise<SessionApplicationV1>;
  export(localId: string, signal?: AbortSignal): Promise<SessionApplicationExportV1>;
  delete(localId: string, input: SessionDeleteInput): Promise<ApplicationDeletionResult>;
}
