import type {
  ApplicationChannel,
  ApplicationContactV1,
  ApplicationDocumentsV1,
  ApplicationFollowUpV1,
  ApplicationHistoryEntryV1,
  ApplicationJobReferenceV1,
  ApplicationSalaryContextV1,
  ApplicationSalaryV1,
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
  validateFollowUp,
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
  followUp?: ApplicationFollowUpV1;
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

export interface SessionSalaryUpdate {
  expectation?: ApplicationSalaryV1 | null;
  offer?: ApplicationSalaryV1 | null;
}

export interface SessionApplicationUpdateChanges {
  applicationDate?: ISODateTime | null;
  applicationChannel?: ApplicationChannel | null;
  contact?: ApplicationContactV1 | null;
  notes?: string;
  salary?: SessionSalaryUpdate | null;
  followUp?: ApplicationFollowUpV1 | null;
  coverLetterDraft?: string;
  documentStatus?: ApplicationDocumentsV1["documentStatus"];
  cvReference?: ApplicationDocumentsV1["cvReference"] | null;
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

const CHANNELS: readonly ApplicationChannel[] = ["online", "email", "portal", "postal", "other"];
const SALARY_PERIODS: readonly ApplicationSalaryV1["period"][] = ["year", "month", "hour"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertOptionalContactText(value: string | undefined, field: string): void {
  if (value === undefined) return;
  assertText(value, field, 500, true);
}

function assertContactUpdate(contact: ApplicationContactV1): void {
  assertOptionalContactText(contact.name, "contact.name");
  assertOptionalContactText(contact.email, "contact.email");
  assertOptionalContactText(contact.phone, "contact.phone");
  if (contact.email?.trim() && !EMAIL_RE.test(contact.email.trim())) {
    throw new ApplicationValidationError("Invalid contact email address");
  }
  if (contact.phone && /[\u0000-\u001f\u007f]/.test(contact.phone)) {
    throw new ApplicationValidationError("Invalid contact phone number");
  }
}

function assertSalaryUpdate(salary: ApplicationSalaryV1, field: string): void {
  if (
    typeof salary.amount !== "number" ||
    !Number.isFinite(salary.amount) ||
    salary.amount <= 0
  ) {
    throw new ApplicationValidationError(`Invalid salary amount: ${field}`);
  }
  if (typeof salary.currency !== "string" || !/^[A-Z]{3}$/.test(salary.currency)) {
    throw new ApplicationValidationError(`Invalid salary currency: ${field}`);
  }
  if (!SALARY_PERIODS.includes(salary.period)) {
    throw new ApplicationValidationError(`Invalid salary period: ${field}`);
  }
}

function updateSalary(
  current: ApplicationSalaryContextV1 | undefined,
  update: SessionSalaryUpdate | null | undefined
): ApplicationSalaryContextV1 | undefined {
  if (update === undefined) return current;
  if (update === null) return undefined;
  const expectation =
    update.expectation === undefined ? current?.expectation : update.expectation ?? undefined;
  const offer = update.offer === undefined ? current?.offer : update.offer ?? undefined;
  if (expectation) assertSalaryUpdate(expectation, "salary.expectation");
  if (offer) assertSalaryUpdate(offer, "salary.offer");
  if (!expectation && !offer) return undefined;
  return {
    ...(expectation ? { expectation: clone(expectation) } : {}),
    ...(offer ? { offer: clone(offer) } : {}),
  };
}

export function updateSessionApplication(
  application: SessionApplicationV1,
  expectedVersion: number,
  changes: SessionApplicationUpdateChanges,
  now: ISODateTime
): SessionApplicationV1 {
  if (changes.notes !== undefined) assertText(changes.notes, "notes", 10000, true);
  if (changes.coverLetterDraft !== undefined) assertText(changes.coverLetterDraft, "coverLetterDraft", 50000, true);
  if (changes.applicationDate !== undefined && changes.applicationDate !== null) {
    if (!Number.isFinite(Date.parse(changes.applicationDate))) {
      throw new ApplicationValidationError("Invalid application date");
    }
  }
  if (
    changes.applicationChannel !== undefined &&
    changes.applicationChannel !== null &&
    !CHANNELS.includes(changes.applicationChannel)
  ) {
    throw new ApplicationValidationError("Invalid application channel");
  }
  if (changes.contact !== undefined && changes.contact !== null) {
    assertContactUpdate(changes.contact);
  }
  if (changes.followUp !== undefined && changes.followUp !== null) {
    validateFollowUp(changes.followUp);
  }

  const base = next(application, expectedVersion, now);
  const hasCvReference = changes.cvReference !== undefined;
  const documents =
    changes.coverLetterDraft === undefined &&
    changes.documentStatus === undefined &&
    !hasCvReference
      ? base.documents
      : {
          ...base.documents,
          ...(changes.coverLetterDraft === undefined ? {} : { coverLetterDraft: changes.coverLetterDraft }),
          ...(changes.documentStatus === undefined ? {} : { documentStatus: changes.documentStatus }),
          cvReference: changes.cvReference === null ? undefined : changes.cvReference === undefined
            ? base.documents.cvReference
            : clone(changes.cvReference),
        };

  const applicationDate =
    changes.applicationDate === undefined
      ? base.applicationDate
      : changes.applicationDate ?? undefined;
  const applicationChannel =
    changes.applicationChannel === undefined
      ? base.applicationChannel
      : changes.applicationChannel ?? undefined;
  const contact =
    changes.contact === undefined ? base.contact : changes.contact === null ? undefined : clone(changes.contact);
  const notes =
    changes.notes === undefined
      ? base.notes
      : changes.notes.trim()
        ? changes.notes
        : undefined;
  const salary = updateSalary(base.salary, changes.salary);
  const followUp =
    changes.followUp === undefined
      ? base.followUp
      : changes.followUp === null
        ? undefined
        : clone(changes.followUp);

  return {
    ...base,
    documents,
    applicationDate,
    applicationChannel,
    contact,
    notes,
    salary,
    followUp,
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
