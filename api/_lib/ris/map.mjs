export class RisMappingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RisMappingError";
    this.code = code;
    this.status = 422;
  }
}

function requiredText(value, field, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new RisMappingError("invalid_field", `${field} is invalid`);
  }
  return value;
}

function optionalText(value, field, max = 500) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.length > max) {
    throw new RisMappingError("invalid_field", `${field} is invalid`);
  }
  return value;
}

function singleValue(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RisMappingError(`unsupported_${field}_empty`, `${field} must contain exactly one value`);
  }
  if (value.length !== 1) {
    throw new RisMappingError(
      `unsupported_${field}_multiple`,
      `${field} contains multiple values that RIS ApplicationV1 cannot store losslessly`
    );
  }
  const only = value[0];
  if (typeof only !== "string" || !only.trim()) {
    throw new RisMappingError(`invalid_${field}`, `${field} is invalid`);
  }
  return only;
}

function httpUrl(value, field) {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    const url = new URL(String(value));
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
    return url.toString();
  } catch {
    throw new RisMappingError("invalid_url", `${field} must be an http(s) URL`);
  }
}

function toRisJob(job) {
  if (!job || typeof job !== "object") throw new RisMappingError("invalid_job", "job is required");
  const source = singleValue(job.source, "source");
  const location = singleValue(job.location, "location");
  const url = httpUrl(job.originalUrl, "job.originalUrl");
  if (job.jobOrigin === "manual" && source !== "manual") {
    throw new RisMappingError("invalid_manual_source", "manual job must use source \"manual\"");
  }
  return {
    jobId: requiredText(job.jobId, "job.jobId"),
    source,
    title: requiredText(job.title, "job.title"),
    company: requiredText(job.companyName ?? job.company, "job.companyName"),
    location,
    ...(url ? { url } : {}),
  };
}

function toRisCoverLetterVersion(version) {
  if (!version || typeof version !== "object") {
    throw new RisMappingError("invalid_cover_letter", "cover-letter version is required");
  }
  if (!["generated", "revised", "manual"].includes(version.source)) {
    throw new RisMappingError("invalid_cover_letter_source", "cover-letter source is unsupported");
  }
  return {
    ...(version.versionId ? { versionId: requiredText(version.versionId, "versionId") } : {}),
    jobId: requiredText(version.jobId, "jobId"),
    ...(version.createdAt ? { createdAt: requiredText(version.createdAt, "createdAt", 100) } : {}),
    content: requiredText(version.content, "content", 100000),
    source: version.source,
    ...(version.language ? { language: version.language } : {}),
    ...(version.model ? { model: requiredText(version.model, "model") } : {}),
  };
}

function toRisDocuments(documents) {
  if (documents === undefined || documents === null) return undefined;
  if (typeof documents !== "object") throw new RisMappingError("invalid_documents", "documents is invalid");
  const result = {};
  if (documents.coverLetterDraft !== undefined) {
    result.coverLetterDraft = optionalText(documents.coverLetterDraft, "coverLetterDraft", 100000) ?? "";
  }
  if (Array.isArray(documents.coverLetterVersions)) {
    result.coverLetterVersions = documents.coverLetterVersions.map(toRisCoverLetterVersion);
  }
  if (documents.cvReference) {
    const reference = documents.cvReference;
    if (reference.cvSource === "builder") {
      throw new RisMappingError(
        "builder_cv_unsupported",
        "RIS ApplicationV1 cannot store a builder-CV reference losslessly"
      );
    }
    result.cvReference = {
      cvId: requiredText(reference.cvId, "cvReference.cvId"),
      ...(reference.documentId ? { documentId: requiredText(reference.documentId, "cvReference.documentId") } : {}),
      ...(reference.label ? { label: requiredText(reference.label, "cvReference.label") } : {}),
    };
  }
  if (documents.documentStatus !== undefined) result.documentStatus = documents.documentStatus;
  return result;
}

export function toRisCreate(input, idempotencyKey) {
  if (!input || typeof input !== "object") throw new RisMappingError("invalid_body", "body is required");
  const result = { job: toRisJob(input.job) };
  const documents = toRisDocuments(input.documents);
  if (documents) result.documents = documents;
  for (const field of ["applicationDate", "applicationChannel", "contact", "notes", "salary", "followUp"]) {
    if (input[field] !== undefined) result[field] = input[field];
  }
  if (input.profileRef) {
    result.profileRef = { id: requiredText(input.profileRef.id, "profileRef.id"), version: Number(input.profileRef.version) || 0 };
  }
  if (idempotencyKey) {
    const key = String(idempotencyKey);
    if (key.length < 1 || key.length > 200) throw new RisMappingError("invalid_idempotency_key", "Idempotency-Key is invalid");
    result.idempotencyKey = key;
  }
  return result;
}

export function toRisPatch(input, expectedVersion) {
  if (!input || typeof input !== "object") throw new RisMappingError("invalid_body", "body is required");
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new RisMappingError("expected_version_required", "expectedVersion is required");
  }
  const result = { expectedVersion };
  if (input.job !== undefined) result.job = toRisJob(input.job);
  if (input.documents !== undefined) {
    const documents = toRisDocuments(input.documents);
    result.documents = documents ?? null;
  }
  for (const field of ["applicationDate", "applicationChannel", "contact", "notes", "salary", "followUp"]) {
    if (input[field] !== undefined) result[field] = input[field];
  }
  return result;
}

export function toRisStatus(status, expectedVersion, note) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new RisMappingError("expected_version_required", "expectedVersion is required");
  }
  if (!["draft", "submitted", "feedback", "interview", "offer", "rejected", "withdrawn"].includes(status)) {
    throw new RisMappingError("invalid_status", "status is invalid");
  }
  return {
    stage: status,
    expectedVersion,
    confirm: status === "submitted",
    ...(note ? { note: String(note).slice(0, 2000) } : {}),
  };
}

export function toRisHistory(event, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new RisMappingError("expected_version_required", "expectedVersion is required");
  }
  if (!event || typeof event !== "object" || !["feedback", "interview", "note"].includes(event.kind)) {
    throw new RisMappingError("invalid_history_event", "history event is invalid");
  }
  return { event, expectedVersion };
}

export function toRisCoverLetter(version, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new RisMappingError("expected_version_required", "expectedVersion is required");
  }
  return { version: toRisCoverLetterVersion(version), expectedVersion };
}

function stageFromStatus(status) {
  return {
    DRAFT: "draft",
    READY: "draft",
    SUBMITTED: "submitted",
    WITHDRAWN: "withdrawn",
    ARCHIVED: "withdrawn",
  }[status] ?? "draft";
}

function fromRisJob(job) {
  if (!job || typeof job !== "object") return undefined;
  return {
    jobId: job.jobId,
    title: job.title,
    companyName: job.company,
    location: job.location ? [String(job.location)] : [],
    source: job.source ? [String(job.source)] : [],
    ...(job.url ? { originalUrl: job.url } : {}),
    ...(job.source === "manual" ? { jobOrigin: "manual" } : {}),
  };
}

function fromRisDocuments(documents) {
  if (!documents || typeof documents !== "object") return undefined;
  return {
    coverLetterDraft: documents.coverLetterDraft ?? "",
    coverLetterVersions: Array.isArray(documents.coverLetterVersions) ? documents.coverLetterVersions : [],
    ...(documents.cvReference ? { cvReference: documents.cvReference } : {}),
    documentStatus: documents.documentStatus ?? "missing",
  };
}

export function fromRisApplication(application, ownerId) {
  if (!application || typeof application !== "object") {
    throw new RisMappingError("invalid_ris_response", "RIS returned an invalid application");
  }
  const history = Array.isArray(application.history) ? application.history : [];
  const derivedStatusHistory = history
    .filter((entry) => entry && entry.fromStage !== undefined && entry.toStage !== undefined)
    .map((entry) => ({
      at: entry.createdAt ?? entry.at,
      from: entry.fromStage ?? null,
      to: entry.toStage,
      ...(entry.note ? { note: entry.note } : {}),
    }));
  return {
    schemaVersion: 1,
    applicationId: application.applicationId,
    ownerId,
    job: fromRisJob(application.job),
    documents: fromRisDocuments(application.documents) ?? {
      coverLetterDraft: "",
      coverLetterVersions: [],
      documentStatus: "missing",
    },
    status: application.stage ?? stageFromStatus(application.status),
    statusHistory: Array.isArray(application.statusHistory) ? application.statusHistory : derivedStatusHistory,
    history,
    version: application.version,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    ...(application.applicationDate ? { applicationDate: application.applicationDate } : {}),
    ...(application.applicationChannel ? { applicationChannel: application.applicationChannel } : {}),
    ...(application.contact ? { contact: application.contact } : {}),
    ...(application.notes ? { notes: application.notes } : {}),
    ...(application.salary ? { salary: application.salary } : {}),
    ...(application.followUp ? { followUp: application.followUp } : {}),
  };
}

export function fromRisList(data, ownerId) {
  const items = Array.isArray(data?.items) ? data.items.map((item) => fromRisApplication(item, ownerId)) : [];
  return { items, nextCursor: data?.nextCursor ?? null };
}

export function fromRisExport(data, ownerId) {
  if (!data || typeof data !== "object") throw new RisMappingError("invalid_ris_response", "RIS export is invalid");
  return {
    application: fromRisApplication(data.application, ownerId),
    history: Array.isArray(data.history) ? data.history : [],
    coverLetterVersions: Array.isArray(data.coverLetterVersions) ? data.coverLetterVersions : [],
  };
}

export function deletionReceipt() {
  return { deleted: true, idempotent: false };
}
