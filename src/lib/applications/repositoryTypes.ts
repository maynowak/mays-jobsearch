import type {
  AddApplicationCoverLetterVersionInputV1,
  AddApplicationFeedbackInputV1,
  AddApplicationInterviewInputV1,
  AddApplicationNoteInputV1,
  ApplicationDeletionReceiptV1,
  ApplicationExportV1,
  ApplicationStatus,
  ApplicationV1,
  CoverLetterVersionV1,
  CreateApplicationDraftInputV1,
  ISODateTime,
  TransitionApplicationStatusInputV1,
  UpdateApplicationDraftInputV1,
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
  | "idempotency_conflict"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "capacity_exceeded"
  | "session_ended";

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

/** Read options for the future RIS-owned port. No implementation is implied. */
export interface ApplicationReadOptions {
  signal?: AbortSignal;
}

export interface ApplicationListOptions extends ApplicationReadOptions {
  cursor?: string;
  limit?: number;
}

export interface ApplicationPageV1 {
  items: ApplicationV1[];
  nextCursor: string | null;
}

/**
 * Future RIS-owned asynchronous port for the server-backed ApplicationV1.
 * This is a contract only: there is no HTTP client, route assumption or
 * credential storage in APP-03. `applicationId` and `ownerId` are always
 * server-generated and server-derived.
 */
export interface ApplicationPersistencePort {
  list(options?: ApplicationListOptions): Promise<ApplicationPageV1>;
  get(applicationId: string, options?: ApplicationReadOptions): Promise<ApplicationV1>;
  create(
    input: CreateApplicationDraftInputV1,
    options?: ApplicationReadOptions & { idempotencyKey?: string }
  ): Promise<ApplicationV1>;
  update(
    applicationId: string,
    input: UpdateApplicationDraftInputV1,
    options?: ApplicationReadOptions
  ): Promise<ApplicationV1>;
  transitionStatus(
    applicationId: string,
    input: TransitionApplicationStatusInputV1,
    options?: ApplicationReadOptions
  ): Promise<ApplicationV1>;
  addFeedback(
    applicationId: string,
    input: AddApplicationFeedbackInputV1,
    options?: ApplicationReadOptions
  ): Promise<ApplicationV1>;
  addInterview(
    applicationId: string,
    input: AddApplicationInterviewInputV1,
    options?: ApplicationReadOptions
  ): Promise<ApplicationV1>;
  addNote(
    applicationId: string,
    input: AddApplicationNoteInputV1,
    options?: ApplicationReadOptions
  ): Promise<ApplicationV1>;
  addCoverLetterVersion(
    applicationId: string,
    input: AddApplicationCoverLetterVersionInputV1,
    options?: ApplicationReadOptions
  ): Promise<ApplicationV1>;
  export(applicationId: string, options?: ApplicationReadOptions): Promise<ApplicationExportV1>;
  delete(
    applicationId: string,
    expectedVersion: number,
    options?: ApplicationReadOptions
  ): Promise<ApplicationDeletionReceiptV1>;
}

export interface ApplicationMigrationSelectionV1 {
  localIds: string[];
}

export interface ApplicationMigrationPreviewV1 {
  /** No ownerId, backend ID or durable-write claim before RIS verification. */
  drafts: SessionApplicationV1[];
  duplicateJobIds: string[];
  warnings: string[];
}

export interface ApplicationMigrationResultV1 {
  succeeded: Array<{ localId: string; applicationId: string; version: number }>;
  failed: Array<{ localId: string; reason: string }>;
}

/**
 * Contract only: no code calls this until RIS authentication, privacy and API
 * gates pass. There is intentionally no UI button for account persistence.
 */
export interface ApplicationMigrationPortV1 {
  preview(
    selection: ApplicationMigrationSelectionV1,
    signal?: AbortSignal
  ): Promise<ApplicationMigrationPreviewV1>;
  commit(
    selection: ApplicationMigrationSelectionV1,
    idempotencyKey: string,
    signal?: AbortSignal
  ): Promise<ApplicationMigrationResultV1>;
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
  /** Permanently disable this in-memory instance after a session/auth change. */
  invalidate(): void;
}

/** Explicit name for the current in-memory adapter. */
export type SessionApplicationRepository = ApplicationRepository;
