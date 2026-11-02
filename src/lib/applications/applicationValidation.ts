import type {
  ApplicationChannel,
  ApplicationDocumentsV1,
  ApplicationHistoryEntryV1,
  ApplicationJobReferenceV1,
  ApplicationSalaryV1,
  ApplicationFollowUpV1,
  ApplicationStatus,
  ApplicationStatusHistoryEntryV1,
  ApplicationV1,
  CoverLetterVersionV1,
  CreateApplicationDraftInputV1,
  UpdateApplicationDraftInputV1,
} from "./contractTypes";

export type ApplicationValidationCode =
  | "validation_error"
  | "owner_mismatch"
  | "version_conflict"
  | "invalid_transition"
  | "confirmation_required";

export class ApplicationValidationError extends Error {
  readonly code: ApplicationValidationCode;

  constructor(message: string, code: ApplicationValidationCode = "validation_error") {
    super(message);
    this.name = "ApplicationValidationError";
    this.code = code;
  }
}

const STATUSES: readonly ApplicationStatus[] = [
  "draft",
  "submitted",
  "feedback",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];
const CHANNELS: readonly ApplicationChannel[] = ["online", "email", "portal", "postal", "other"];
const DOCUMENT_STATUSES = ["missing", "draft", "ready"] as const;
const VERSION_SOURCES = ["generated", "revised", "manual"] as const;
const HISTORY_KINDS = ["feedback", "interview", "note"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertKeys = (value: Record<string, unknown>, allowed: readonly string[], prefix: string): void => {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected) throw new ApplicationValidationError(`Unexpected field: ${prefix}${unexpected}`);
};

const readString = (
  value: unknown,
  field: string,
  { allowEmpty = false, maxLength = 2000 }: { allowEmpty?: boolean; maxLength?: number } = {}
): string => {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0) || value.length > maxLength) {
    throw new ApplicationValidationError(`Invalid string field: ${field}`);
  }
  return value;
};

const readOptionalString = (value: unknown, field: string, maxLength = 2000): string | undefined => {
  if (value === undefined) return undefined;
  return readString(value, field, { allowEmpty: true, maxLength });
};

const readDateTime = (value: unknown, field: string): string => {
  const text = readString(value, field, { maxLength: 100 });
  if (!Number.isFinite(Date.parse(text))) {
    throw new ApplicationValidationError(`Invalid date-time field: ${field}`);
  }
  return text;
};

const readStringList = (value: unknown, field: string, { allowEmpty = true } = {}): string[] => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new ApplicationValidationError(`Invalid string list: ${field}`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new ApplicationValidationError(`List must not be empty: ${field}`);
  }
  return value.map((entry) => entry as string);
};

const readUrl = (value: unknown, field: string): string => {
  const text = readString(value, field, { maxLength: 2000 });
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
  } catch {
    throw new ApplicationValidationError(`Invalid URL field: ${field}`);
  }
  return text;
};

const readEnum = <T extends string>(value: unknown, allowed: readonly T[], field: string): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ApplicationValidationError(`Invalid enum field: ${field}`);
  }
  return value as T;
};

const readVersion = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new ApplicationValidationError(`Invalid version field: ${field}`);
  }
  return value as number;
};

function validateJob(value: unknown): ApplicationJobReferenceV1 {
  if (!isRecord(value)) throw new ApplicationValidationError("job must be an object");
  assertKeys(value, ["jobId", "title", "companyName", "location", "source", "originalUrl"], "job.");
  return {
    jobId: readString(value.jobId, "job.jobId", { maxLength: 500 }),
    title: readString(value.title, "job.title", { maxLength: 500 }),
    companyName: readString(value.companyName, "job.companyName", { maxLength: 500 }),
    location: readStringList(value.location, "job.location"),
    source: readStringList(value.source, "job.source", { allowEmpty: false }),
    originalUrl: readUrl(value.originalUrl, "job.originalUrl"),
  };
}

function validateCvReference(value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new ApplicationValidationError("documents.cvReference must be an object");
  assertKeys(value, ["cvId", "documentId", "label"], "documents.cvReference.");
  readString(value.cvId, "documents.cvReference.cvId", { maxLength: 500 });
  if (value.documentId !== undefined) readString(value.documentId, "documents.cvReference.documentId", { maxLength: 500 });
  if (value.label !== undefined) readString(value.label, "documents.cvReference.label", { allowEmpty: true, maxLength: 500 });
}

function validateSalary(value: unknown, field: string): ApplicationSalaryV1 {
  if (!isRecord(value)) throw new ApplicationValidationError(`${field} must be an object`);
  assertKeys(value, ["amount", "currency", "period"], `${field}.`);
  if (typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount < 0) {
    throw new ApplicationValidationError(`Invalid salary amount: ${field}`);
  }
  if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) {
    throw new ApplicationValidationError(`Invalid salary currency: ${field}`);
  }
  const period = readEnum(value.period, ["year", "month", "hour"] as const, `${field}.period`);
  return { amount: value.amount, currency: value.currency, period };
}

function validateSalaryContext(value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new ApplicationValidationError("salary must be an object");
  assertKeys(value, ["expectation", "offer"], "salary.");
  if (value.expectation !== undefined) validateSalary(value.expectation, "salary.expectation");
  if (value.offer !== undefined) validateSalary(value.offer, "salary.offer");
}

function validateContact(value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new ApplicationValidationError("contact must be an object");
  assertKeys(value, ["name", "email", "phone"], "contact.");
  if (value.name !== undefined) readOptionalString(value.name, "contact.name", 500);
  if (value.email !== undefined) readOptionalString(value.email, "contact.email", 500);
  if (value.phone !== undefined) readOptionalString(value.phone, "contact.phone", 500);
}

function validateCoverLetterVersion(value: unknown): CoverLetterVersionV1 {
  if (!isRecord(value)) throw new ApplicationValidationError("cover-letter version must be an object");
  assertKeys(
    value,
    ["versionId", "jobId", "createdAt", "content", "source", "language", "model"],
    "documents.coverLetterVersions."
  );
  const language = value.language === undefined ? undefined : readEnum(value.language, ["de", "en"] as const, "language");
  return {
    versionId: readString(value.versionId, "versionId", { maxLength: 500 }),
    jobId: readString(value.jobId, "jobId", { maxLength: 500 }),
    createdAt: readDateTime(value.createdAt, "createdAt"),
    content: readString(value.content, "content", { allowEmpty: false, maxLength: 50000 }),
    source: readEnum(value.source, VERSION_SOURCES, "source"),
    ...(language ? { language } : {}),
    ...(value.model === undefined ? {} : { model: readString(value.model, "model", { maxLength: 500 }) }),
  };
}

function validateDocuments(value: unknown, jobId: string): ApplicationDocumentsV1 {
  if (!isRecord(value)) throw new ApplicationValidationError("documents must be an object");
  assertKeys(
    value,
    ["coverLetterDraft", "coverLetterVersions", "cvReference", "documentStatus"],
    "documents."
  );
  const versions = value.coverLetterVersions;
  if (!Array.isArray(versions)) throw new ApplicationValidationError("documents.coverLetterVersions must be an array");
  const parsedVersions = versions.map(validateCoverLetterVersion);
  const versionIds = new Set<string>();
  for (const version of parsedVersions) {
    if (version.jobId !== jobId) throw new ApplicationValidationError("Cover-letter version belongs to another job");
    if (versionIds.has(version.versionId)) throw new ApplicationValidationError("Duplicate cover-letter version ID");
    versionIds.add(version.versionId);
  }
  validateCvReference(value.cvReference);
  return {
    coverLetterDraft: readString(value.coverLetterDraft, "documents.coverLetterDraft", {
      allowEmpty: true,
      maxLength: 50000,
    }),
    coverLetterVersions: parsedVersions,
    ...(value.cvReference === undefined ? {} : { cvReference: value.cvReference as ApplicationDocumentsV1["cvReference"] }),
    documentStatus: readEnum(value.documentStatus, DOCUMENT_STATUSES, "documents.documentStatus"),
  };
}

function validateStatusHistory(value: unknown): ApplicationStatusHistoryEntryV1[] {
  if (!Array.isArray(value)) throw new ApplicationValidationError("statusHistory must be an array");
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new ApplicationValidationError(`statusHistory[${index}] must be an object`);
    assertKeys(entry, ["at", "from", "to", "note"], `statusHistory[${index}].`);
    if (entry.from !== null) readEnum(entry.from, STATUSES, `statusHistory[${index}].from`);
    return {
      at: readDateTime(entry.at, `statusHistory[${index}].at`),
      from: entry.from === null ? null : (entry.from as ApplicationStatus),
      to: readEnum(entry.to, STATUSES, `statusHistory[${index}].to`),
      ...(entry.note === undefined ? {} : { note: readString(entry.note, `statusHistory[${index}].note`, { allowEmpty: true, maxLength: 2000 }) }),
    };
  });
}

function validateHistoryEntry(value: unknown, index: number): ApplicationHistoryEntryV1 {
  if (!isRecord(value)) throw new ApplicationValidationError(`history[${index}] must be an object`);
  assertKeys(value, ["kind", "id", "at", "text", "scheduledAt", "note"], `history[${index}].`);
  const kind = readEnum(value.kind, HISTORY_KINDS, `history[${index}].kind`);
  const id = readString(value.id, `history[${index}].id`, { maxLength: 500 });
  const at = readDateTime(value.at, `history[${index}].at`);
  if (kind === "feedback") {
    return { kind, id, at, text: readString(value.text, `history[${index}].text`, { maxLength: 5000 }) };
  }
  if (kind === "interview") {
    return {
      kind,
      id,
      at,
      scheduledAt: readDateTime(value.scheduledAt, `history[${index}].scheduledAt`),
      ...(value.note === undefined ? {} : { note: readString(value.note, `history[${index}].note`, { allowEmpty: true, maxLength: 2000 }) }),
    };
  }
  return { kind, id, at, text: readString(value.text, `history[${index}].text`, { maxLength: 5000 }) };
}

export function validateFollowUp(value: unknown): ApplicationFollowUpV1 {
  if (!isRecord(value)) throw new ApplicationValidationError("followUp must be an object");
  assertKeys(value, ["dueOn", "note", "status", "completedAt"], "followUp.");
  const dueOn = readString(value.dueOn, "followUp.dueOn", { maxLength: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) {
    throw new ApplicationValidationError("Invalid follow-up calendar date");
  }
  const parsed = new Date(`${dueOn}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueOn) {
    throw new ApplicationValidationError("Invalid follow-up calendar date");
  }
  const status = readEnum(value.status, ["open", "completed"] as const, "followUp.status");
  const note = value.note === undefined ? undefined : readOptionalString(value.note, "followUp.note", 2000);
  const completedAt = value.completedAt === undefined ? undefined : readDateTime(value.completedAt, "followUp.completedAt");
  if (status === "completed" && !completedAt) {
    throw new ApplicationValidationError("Completed follow-up requires completedAt");
  }
  if (status === "open" && completedAt) {
    throw new ApplicationValidationError("Open follow-up must not have completedAt");
  }
  return {
    dueOn,
    status,
    ...(note === undefined ? {} : { note }),
    ...(completedAt === undefined ? {} : { completedAt }),
  };
}

export function validateApplicationV1(value: unknown): asserts value is ApplicationV1 {
  if (!isRecord(value)) throw new ApplicationValidationError("Application must be an object");
  assertKeys(
    value,
    [
      "schemaVersion",
      "applicationId",
      "ownerId",
      "job",
      "documents",
      "createdAt",
      "updatedAt",
      "applicationDate",
      "applicationChannel",
      "contact",
      "notes",
      "salary",
      "followUp",
      "status",
      "statusHistory",
      "history",
      "version",
    ],
    ""
  );
  if (value.schemaVersion !== 1) throw new ApplicationValidationError("Unsupported application schema version");
  const job = validateJob(value.job);
  validateDocuments(value.documents, job.jobId);
  const statusHistory = validateStatusHistory(value.statusHistory);
  if (!statusHistory.length) throw new ApplicationValidationError("Status history must not be empty");
  if (statusHistory[0].from !== null) throw new ApplicationValidationError("Status history must start with a from:null entry");
  const status = readEnum(value.status, STATUSES, "status");
  if (statusHistory[statusHistory.length - 1].to !== status) {
    throw new ApplicationValidationError("Status history does not match the current status");
  }
  const history = value.history;
  if (!Array.isArray(history)) throw new ApplicationValidationError("history must be an array");
  const historyIds = new Set<string>();
  for (const [index, entry] of history.entries()) {
    const parsed = validateHistoryEntry(entry, index);
    if (historyIds.has(parsed.id)) throw new ApplicationValidationError("Duplicate history ID");
    historyIds.add(parsed.id);
  }
  if (value.applicationDate !== undefined) readDateTime(value.applicationDate, "applicationDate");
  if (value.applicationChannel !== undefined) readEnum(value.applicationChannel, CHANNELS, "applicationChannel");
  validateContact(value.contact);
  validateSalaryContext(value.salary);
  if (value.followUp !== undefined) validateFollowUp(value.followUp);
  if (value.notes !== undefined) readOptionalString(value.notes, "notes", 10000);
  readString(value.applicationId, "applicationId", { maxLength: 500 });
  readString(value.ownerId, "ownerId", { maxLength: 500 });
  readDateTime(value.createdAt, "createdAt");
  readDateTime(value.updatedAt, "updatedAt");
  readVersion(value.version, "version");
}

function validatePartialDocuments(value: unknown, jobId: string): void {
  if (!isRecord(value)) throw new ApplicationValidationError("documents must be an object");
  assertKeys(
    value,
    ["coverLetterDraft", "coverLetterVersions", "cvReference", "documentStatus"],
    "documents."
  );
  if (value.coverLetterDraft !== undefined) {
    readString(value.coverLetterDraft, "documents.coverLetterDraft", { allowEmpty: true, maxLength: 50000 });
  }
  if (value.coverLetterVersions !== undefined) {
    if (!Array.isArray(value.coverLetterVersions)) {
      throw new ApplicationValidationError("documents.coverLetterVersions must be an array");
    }
    const ids = new Set<string>();
    for (const version of value.coverLetterVersions) {
      const parsed = validateCoverLetterVersion(version);
      if (parsed.jobId !== jobId) throw new ApplicationValidationError("Cover-letter version belongs to another job");
      if (ids.has(parsed.versionId)) throw new ApplicationValidationError("Duplicate cover-letter version ID");
      ids.add(parsed.versionId);
    }
  }
  validateCvReference(value.cvReference);
  if (value.documentStatus !== undefined) {
    readEnum(value.documentStatus, DOCUMENT_STATUSES, "documents.documentStatus");
  }
}

export function validateCreateApplicationDraftInput(value: unknown): asserts value is CreateApplicationDraftInputV1 {
  if (!isRecord(value)) throw new ApplicationValidationError("Create input must be an object");
  assertKeys(value, ["job", "documents", "applicationDate", "applicationChannel", "contact", "notes", "salary"], "");
  const job = validateJob(value.job);
  if (value.documents !== undefined) validatePartialDocuments(value.documents, job.jobId);
  if (value.applicationDate !== undefined) readDateTime(value.applicationDate, "applicationDate");
  if (value.applicationChannel !== undefined) readEnum(value.applicationChannel, CHANNELS, "applicationChannel");
  validateContact(value.contact);
  validateSalaryContext(value.salary);
  if (value.notes !== undefined) readOptionalString(value.notes, "notes", 10000);
}

export function validateUpdateApplicationDraftInput(value: unknown): asserts value is UpdateApplicationDraftInputV1 {
  if (!isRecord(value)) throw new ApplicationValidationError("Update input must be an object");
  assertKeys(value, ["expectedVersion", "documents", "applicationDate", "applicationChannel", "contact", "notes", "salary", "followUp"], "");
  readVersion(value.expectedVersion, "expectedVersion");
  if (value.documents !== undefined && !isRecord(value.documents)) {
    throw new ApplicationValidationError("documents must be an object");
  }
  if (value.applicationDate !== undefined) readDateTime(value.applicationDate, "applicationDate");
  if (value.applicationChannel !== undefined) readEnum(value.applicationChannel, CHANNELS, "applicationChannel");
  validateContact(value.contact);
  validateSalaryContext(value.salary);
  if (value.followUp !== undefined) validateFollowUp(value.followUp);
  if (value.notes !== undefined) readOptionalString(value.notes, "notes", 10000);
}

export { STATUSES, CHANNELS };
