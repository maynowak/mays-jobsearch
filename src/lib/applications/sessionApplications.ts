import type {
  ApplicationChannel,
  ApplicationContactV1,
  ApplicationDocumentsV1,
  ApplicationHistoryEntryV1,
  ApplicationJobReferenceV1,
  ApplicationSalaryContextV1,
  ApplicationStatus,
  ApplicationStatusHistoryEntryV1,
  CoverLetterVersionV1,
  CreateApplicationDraftInputV1,
  ISODateTime,
} from "./contractTypes";
import { canTransitionApplicationStatus } from "./applicationDomain";
import {
  ApplicationValidationError,
  validateCreateApplicationDraftInput,
} from "./applicationValidation";

/**
 * APP-02 session-only record. This is deliberately NOT ApplicationV1:
 * applicationId and ownerId belong to a future verified server context.
 * localId exists only to identify a record in this browser session.
 */
export interface SessionApplicationV1 {
  schemaVersion: 1;
  localId: string;
  job: ApplicationJobReferenceV1;
  documents: ApplicationDocumentsV1;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  applicationDate?: ISODateTime;
  applicationChannel?: ApplicationChannel;
  contact?: ApplicationContactV1;
  notes?: string;
  salary?: ApplicationSalaryContextV1;
  status: ApplicationStatus;
  statusHistory: ApplicationStatusHistoryEntryV1[];
  history: ApplicationHistoryEntryV1[];
  version: number;
}

export interface SessionApplicationExportV1 {
  schemaVersion: 1;
  exportedAt: ISODateTime;
  /** Explicitly distinguishes a local preview from a server resource. */
  localDraft: true;
  note: string;
  application: SessionApplicationV1;
}

export interface CreateSessionApplicationInput {
  job: ApplicationJobReferenceV1;
  coverLetter: string;
  cvReference?: ApplicationDocumentsV1["cvReference"];
  now: ISODateTime;
  localId: string;
}

export interface SessionStatusInput {
  expectedVersion: number;
  to: ApplicationStatus;
  at: ISODateTime;
  note?: string;
  confirmed?: boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertText(value: string, field: string, maxLength: number, allowEmpty = false): string {
  const text = String(value ?? "");
  if ((!allowEmpty && !text.trim()) || text.length > maxLength) {
    throw new ApplicationValidationError(`Invalid local text field: ${field}`);
  }
  return text;
}

function assertLocalVersion(application: SessionApplicationV1, expectedVersion: number): void {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || application.version !== expectedVersion) {
    throw new ApplicationValidationError("Local application version conflict", "version_conflict");
  }
}

function next(application: SessionApplicationV1, expectedVersion: number, at: ISODateTime): SessionApplicationV1 {
  assertLocalVersion(application, expectedVersion);
  if (!Number.isFinite(Date.parse(at))) {
    throw new ApplicationValidationError("Invalid local update timestamp");
  }
  return { ...application, updatedAt: at, version: application.version + 1 };
}

export function createSessionApplication(input: CreateSessionApplicationInput): SessionApplicationV1 {
  if (!input.localId.trim()) throw new ApplicationValidationError("A local application id is required");
  const draftInput: CreateApplicationDraftInputV1 = {
    job: clone(input.job),
    documents: {
      coverLetterDraft: input.coverLetter,
      coverLetterVersions: [],
      documentStatus: input.coverLetter.trim() ? "draft" : "missing",
      ...(input.cvReference ? { cvReference: clone(input.cvReference) } : {}),
    },
  };
  validateCreateApplicationDraftInput(draftInput);
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new ApplicationValidationError("Invalid local creation timestamp");
  }
  return {
    schemaVersion: 1,
    localId: input.localId,
    job: clone(input.job),
    documents: {
      coverLetterDraft: input.coverLetter,
      coverLetterVersions: [],
      documentStatus: input.coverLetter.trim() ? "draft" : "missing",
      ...(input.cvReference ? { cvReference: clone(input.cvReference) } : {}),
    },
    createdAt: input.now,
    updatedAt: input.now,
    status: "draft",
    statusHistory: [{ at: input.now, from: null, to: "draft" }],
    history: [],
    version: 1,
  };
}

export function updateSessionApplication(
  application: SessionApplicationV1,
  expectedVersion: number,
  changes: {
    applicationDate?: ISODateTime;
    applicationChannel?: ApplicationChannel;
    contact?: ApplicationContactV1;
    notes?: string;
    salary?: ApplicationSalaryContextV1;
    coverLetterDraft?: string;
    documentStatus?: ApplicationDocumentsV1["documentStatus"];
  },
  now: ISODateTime
): SessionApplicationV1 {
  if (changes.notes !== undefined) assertText(changes.notes, "notes", 10000, true);
  if (changes.coverLetterDraft !== undefined) assertText(changes.coverLetterDraft, "coverLetterDraft", 50000, true);
  const base = next(application, expectedVersion, now);
  const documents = changes.coverLetterDraft === undefined && changes.documentStatus === undefined
    ? base.documents
    : {
        ...base.documents,
        ...(changes.coverLetterDraft === undefined ? {} : { coverLetterDraft: changes.coverLetterDraft }),
        ...(changes.documentStatus === undefined ? {} : { documentStatus: changes.documentStatus }),
      };
  return {
    ...base,
    documents,
    ...(changes.applicationDate === undefined ? {} : { applicationDate: changes.applicationDate }),
    ...(changes.applicationChannel === undefined ? {} : { applicationChannel: changes.applicationChannel }),
    ...(changes.contact === undefined ? {} : { contact: clone(changes.contact) }),
    ...(changes.notes === undefined ? {} : { notes: changes.notes }),
    ...(changes.salary === undefined ? {} : { salary: clone(changes.salary) }),
  };
}

export function transitionSessionStatus(
  application: SessionApplicationV1,
  input: SessionStatusInput
): SessionApplicationV1 {
  assertLocalVersion(application, input.expectedVersion);
  if (!canTransitionApplicationStatus(application.status, input.to)) {
    throw new ApplicationValidationError(
      `Invalid status transition: ${application.status} -> ${input.to}`,
      "invalid_transition"
    );
  }
  if (application.status === "draft" && input.to === "submitted" && input.confirmed !== true) {
    throw new ApplicationValidationError(
      "Marking an application as submitted requires explicit confirmation",
      "confirmation_required"
    );
  }
  if (!Number.isFinite(Date.parse(input.at))) {
    throw new ApplicationValidationError("Invalid status timestamp");
  }
  if (input.note !== undefined) assertText(input.note, "status note", 2000, true);
  return {
    ...application,
    status: input.to,
    statusHistory: [
      ...application.statusHistory,
      {
        at: input.at,
        from: application.status,
        to: input.to,
        ...(input.note === undefined ? {} : { note: input.note }),
      },
    ],
    applicationDate: application.applicationDate ?? input.at,
    updatedAt: input.at,
    version: application.version + 1,
  };
}

export function addSessionFeedback(
  application: SessionApplicationV1,
  input: { expectedVersion: number; id: string; at: ISODateTime; text: string }
): SessionApplicationV1 {
  if (application.status === "draft") {
    throw new ApplicationValidationError("Feedback cannot be recorded for a draft", "invalid_transition");
  }
  assertText(input.text, "feedback", 5000);
  const base = next(application, input.expectedVersion, input.at);
  return {
    ...base,
    history: [...application.history, { kind: "feedback", id: input.id, at: input.at, text: input.text }],
  };
}

export function addSessionInterview(
  application: SessionApplicationV1,
  input: { expectedVersion: number; id: string; at: ISODateTime; scheduledAt: ISODateTime; note?: string }
): SessionApplicationV1 {
  if (application.status === "draft") {
    throw new ApplicationValidationError("An interview cannot be recorded for a draft", "invalid_transition");
  }
  if (!Number.isFinite(Date.parse(input.scheduledAt))) {
    throw new ApplicationValidationError("Invalid interview timestamp");
  }
  if (input.note !== undefined) assertText(input.note, "interview note", 2000, true);
  const base = next(application, input.expectedVersion, input.at);
  return {
    ...base,
    history: [
      ...application.history,
      {
        kind: "interview",
        id: input.id,
        at: input.at,
        scheduledAt: input.scheduledAt,
        ...(input.note === undefined ? {} : { note: input.note }),
      },
    ],
  };
}

export function addSessionNote(
  application: SessionApplicationV1,
  input: { expectedVersion: number; id: string; at: ISODateTime; text: string }
): SessionApplicationV1 {
  assertText(input.text, "note", 5000);
  const base = next(application, input.expectedVersion, input.at);
  return {
    ...base,
    history: [...application.history, { kind: "note", id: input.id, at: input.at, text: input.text }],
  };
}

export function addSessionCoverLetterVersion(
  application: SessionApplicationV1,
  input: { expectedVersion: number; version: CoverLetterVersionV1 }
): SessionApplicationV1 {
  assertLocalVersion(application, input.expectedVersion);
  if (input.version.jobId !== application.job.jobId) {
    throw new ApplicationValidationError("Cover-letter version belongs to another job");
  }
  if (application.documents.coverLetterVersions.some((version) => version.versionId === input.version.versionId)) {
    throw new ApplicationValidationError("Duplicate cover-letter version ID");
  }
  return {
    ...application,
    documents: {
      ...application.documents,
      coverLetterVersions: [...application.documents.coverLetterVersions, clone(input.version)],
      documentStatus: application.documents.documentStatus === "missing" ? "draft" : application.documents.documentStatus,
    },
    updatedAt: input.version.createdAt,
    version: application.version + 1,
  };
}

export function exportSessionApplication(
  application: SessionApplicationV1,
  exportedAt: ISODateTime
): SessionApplicationExportV1 {
  if (!Number.isFinite(Date.parse(exportedAt))) {
    throw new ApplicationValidationError("Invalid export timestamp");
  }
  return {
    schemaVersion: 1,
    exportedAt,
    localDraft: true,
    note: "Local session draft only. No server-verified application ID or owner identity is implied.",
    application: clone(application),
  };
}

export function deleteSessionApplication(
  applications: SessionApplicationV1[],
  localId: string
): SessionApplicationV1[] {
  return applications.filter((application) => application.localId !== localId);
}

export function sessionApplicationForJob(
  applications: SessionApplicationV1[],
  jobId: string
): SessionApplicationV1 | null {
  return applications.find((application) => application.job.jobId === jobId) ?? null;
}
