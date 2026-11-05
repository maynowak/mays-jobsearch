// Mapping between the actual RIS DEV2 ApplicationV1 JSON and the Jobsearch
// session/domain contract. RIS is authoritative; this layer never invents
// server fields, owner IDs or routes.

import type {
  ApplicationDocumentsV1,
  ApplicationExportV1,
  ApplicationJobReferenceV1,
  ApplicationStatus,
  ApplicationStatusHistoryEntryV1,
  ApplicationHistoryEntryV1,
  ApplicationV1,
  CoverLetterVersionV1,
  CreateApplicationDraftInputV1,
  UpdateApplicationDraftInputV1,
} from "../contractTypes";
import type {
  SessionApplicationV1,
  SessionApplicationUpdateChanges,
} from "../sessionApplications";

export interface RisApplicationPayload {
  schemaVersion?: number;
  applicationId: string;
  ownerId?: string;
  userId?: string;
  tenantId?: string;
  job: {
    jobId: string;
    title?: string;
    company?: string;
    companyName?: string;
    location?: string | string[];
    source?: string | string[];
    url?: string;
    originalUrl?: string;
    jobOrigin?: "source" | "manual";
  };
  documents?: {
    coverLetterDraft?: string;
    coverLetterVersions?: CoverLetterVersionV1[];
    cvReference?: {
      cvId: string;
      documentId?: string;
      label?: string;
      cvSource?: "uploaded" | "builder";
    };
    documentStatus?: "missing" | "draft" | "ready";
  };
  createdAt?: string;
  updatedAt?: string;
  applicationDate?: string;
  applicationChannel?: "online" | "email" | "portal" | "postal" | "other";
  contact?: { name?: string; email?: string; phone?: string };
  notes?: string;
  salary?: {
    expectation?: { amount: number; currency: string; period: "year" | "month" | "hour" };
    offer?: { amount: number; currency: string; period: "year" | "month" | "hour" };
  };
  followUp?: {
    dueOn: string;
    note?: string;
    status: "open" | "completed";
    completedAt?: string;
  };
  status?: string;
  stage?: string;
  statusHistory?: ApplicationStatusHistoryEntryV1[];
  history?: ApplicationHistoryEntryV1[];
  version?: number;
}

const STATUS_BY_RIS: Record<string, ApplicationStatus> = {
  DRAFT: "draft",
  READY: "draft",
  SUBMITTED: "submitted",
  WITHDRAWN: "withdrawn",
  ARCHIVED: "withdrawn",
  FEEDBACK: "feedback",
  INTERVIEW: "interview",
  OFFER: "offer",
  REJECTED: "rejected",
};

const STAGE_AS_STATUS: Record<string, ApplicationStatus> = {
  draft: "draft",
  submitted: "submitted",
  feedback: "feedback",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
  withdrawn: "withdrawn",
};

export function mapRisStatus(payload: RisApplicationPayload): ApplicationStatus {
  if (payload.stage && STAGE_AS_STATUS[payload.stage]) {
    return STAGE_AS_STATUS[payload.stage];
  }
  if (payload.status) {
    return STATUS_BY_RIS[payload.status] ?? "draft";
  }
  return "draft";
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function mapRisJob(job: RisApplicationPayload["job"]): ApplicationJobReferenceV1 {
  const location = asArray(job.location);
  const source = asArray(job.source);
  const originalUrl = job.url ?? job.originalUrl;
  return {
    jobId: job.jobId,
    title: job.title ?? "Untitled job",
    companyName: job.companyName ?? job.company ?? "Unknown company",
    location,
    source,
    ...(originalUrl ? { originalUrl } : {}),
    ...(job.jobOrigin === "manual" || !originalUrl
      ? { jobOrigin: "manual" as const }
      : {}),
  };
}

export function mapRisDocuments(
  documents: RisApplicationPayload["documents"]
): ApplicationDocumentsV1 {
  const coverLetterVersions = Array.isArray(documents?.coverLetterVersions)
    ? documents.coverLetterVersions
    : [];
  return {
    coverLetterDraft:
      typeof documents?.coverLetterDraft === "string"
        ? documents.coverLetterDraft
        : "",
    coverLetterVersions,
    ...(documents?.cvReference?.cvId
      ? { cvReference: documents.cvReference }
      : {}),
    documentStatus: documents?.documentStatus ?? "missing",
  };
}

export function mapRisToApplicationV1(payload: RisApplicationPayload): ApplicationV1 {
  const documents = mapRisDocuments(payload.documents);
  return {
    schemaVersion: 1,
    applicationId: payload.applicationId,
    // RIS does not expose the owner in ApplicationV1; it is server-derived and
    // never used as client input. The empty value is never sent back.
    ownerId: payload.ownerId ?? payload.userId ?? "",
    job: mapRisJob(payload.job),
    documents,
    createdAt: payload.createdAt ?? "",
    updatedAt: payload.updatedAt ?? "",
    ...(payload.applicationDate ? { applicationDate: payload.applicationDate } : {}),
    ...(payload.applicationChannel ? { applicationChannel: payload.applicationChannel } : {}),
    ...(payload.contact ? { contact: payload.contact } : {}),
    ...(typeof payload.notes === "string" ? { notes: payload.notes } : {}),
    ...(payload.salary ? { salary: payload.salary } : {}),
    ...(payload.followUp ? { followUp: payload.followUp } : {}),
    status: mapRisStatus(payload),
    statusHistory: Array.isArray(payload.statusHistory) ? payload.statusHistory : [],
    history: Array.isArray(payload.history) ? payload.history : [],
    version: Number(payload.version) > 0 ? Number(payload.version) : 1,
  };
}

export function applicationV1ToSession(application: ApplicationV1): SessionApplicationV1 {
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
    ...(typeof application.notes === "string" ? { notes: application.notes } : {}),
    ...(application.salary ? { salary: application.salary } : {}),
    ...(application.followUp ? { followUp: application.followUp } : {}),
    status: application.status,
    statusHistory: application.statusHistory,
    history: application.history,
    version: application.version,
  };
}

export function mapRisApplication(payload: RisApplicationPayload): SessionApplicationV1 {
  return applicationV1ToSession(mapRisToApplicationV1(payload));
}

function mapSalary(
  value: SessionApplicationUpdateChanges["salary"] | CreateApplicationDraftInputV1["salary"]
): CreateApplicationDraftInputV1["salary"] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const result: NonNullable<CreateApplicationDraftInputV1["salary"]> = {};
  if (value.expectation !== undefined && value.expectation !== null) {
    result.expectation = {
      amount: value.expectation.amount,
      currency: value.expectation.currency,
      period: value.expectation.period,
    };
  }
  if (value.offer !== undefined && value.offer !== null) {
    result.offer = {
      amount: value.offer.amount,
      currency: value.offer.currency,
      period: value.offer.period,
    };
  }
  return result;
}

export function toRisCreateBody(
  input: CreateApplicationDraftInputV1,
  idempotencyKey?: string
): Record<string, unknown> {
  const job = input.job;
  const documents = input.documents;
  const body: Record<string, unknown> = {
    job: {
      jobId: job.jobId,
      title: job.title,
      company: job.companyName,
      location: job.location.join(", "),
      source: job.source[0] ?? "jobsearch",
      ...(job.originalUrl ? { url: job.originalUrl } : {}),
    },
  };
  if (documents) {
    body.documents = {
      ...(documents.coverLetterDraft !== undefined
        ? { coverLetterDraft: documents.coverLetterDraft }
        : {}),
      ...(documents.coverLetterVersions !== undefined
        ? { coverLetterVersions: documents.coverLetterVersions }
        : {}),
      ...(documents.cvReference !== undefined
        ? { cvReference: documents.cvReference }
        : {}),
      ...(documents.documentStatus !== undefined
        ? { documentStatus: documents.documentStatus }
        : {}),
    };
  }
  if (input.applicationDate !== undefined) body.applicationDate = input.applicationDate;
  if (input.applicationChannel !== undefined) body.applicationChannel = input.applicationChannel;
  if (input.contact !== undefined) body.contact = input.contact;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.salary !== undefined) body.salary = mapSalary(input.salary);
  if (idempotencyKey) body.idempotencyKey = idempotencyKey;
  return body;
}

export function toRisUpdateBody(
  input: UpdateApplicationDraftInputV1
): Record<string, unknown> {
  const body: Record<string, unknown> = { expectedVersion: input.expectedVersion };
  if (input.applicationDate !== undefined) body.applicationDate = input.applicationDate;
  if (input.applicationChannel !== undefined) body.applicationChannel = input.applicationChannel;
  if (input.contact !== undefined) body.contact = input.contact;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.salary !== undefined) body.salary = mapSalary(input.salary);
  if (input.followUp !== undefined) body.followUp = input.followUp;
  if (input.documents !== undefined) body.documents = input.documents;
  return body;
}

export function toRisCreateFromSession(input: {
  job: ApplicationJobReferenceV1;
  coverLetter: string;
  cvReference?: ApplicationDocumentsV1["cvReference"];
  coverLetterVersion?: CoverLetterVersionV1;
}): CreateApplicationDraftInputV1 {
  const documents: Partial<ApplicationDocumentsV1> = {
    coverLetterDraft: input.coverLetter,
    coverLetterVersions: input.coverLetterVersion ? [input.coverLetterVersion] : [],
    documentStatus: input.coverLetter.trim() ? "draft" : "missing",
  };
  if (input.cvReference) documents.cvReference = input.cvReference;
  return { job: input.job, documents };
}

export function toRisUpdateFromSession(
  expectedVersion: number,
  changes: SessionApplicationUpdateChanges
): UpdateApplicationDraftInputV1 {
  const input: UpdateApplicationDraftInputV1 = { expectedVersion };
  if (changes.applicationDate !== undefined) input.applicationDate = changes.applicationDate ?? undefined;
  if (changes.applicationChannel !== undefined) input.applicationChannel = changes.applicationChannel ?? undefined;
  if (changes.contact !== undefined) input.contact = changes.contact ?? undefined;
  if (changes.notes !== undefined) input.notes = changes.notes;
  const salary = mapSalary(changes.salary);
  if (salary) input.salary = salary;
  if (changes.followUp !== undefined && changes.followUp !== null) {
    input.followUp = changes.followUp;
  }

  const documents: Partial<ApplicationDocumentsV1> = {};
  if (changes.coverLetterDraft !== undefined) documents.coverLetterDraft = changes.coverLetterDraft;
  if (changes.documentStatus !== undefined) documents.documentStatus = changes.documentStatus;
  if (changes.cvReference !== undefined) {
    documents.cvReference = changes.cvReference ?? undefined;
  }
  if (Object.keys(documents).length) input.documents = documents;
  return input;
}

export function mapRisExport(payload: {
  application?: RisApplicationPayload;
  exportedAt?: string;
} | RisApplicationPayload): ApplicationExportV1 {
  const application = "application" in payload && payload.application
    ? payload.application
    : (payload as RisApplicationPayload);
  const exportedAt = "exportedAt" in payload && payload.exportedAt
    ? payload.exportedAt
    : new Date().toISOString();
  return {
    schemaVersion: 1,
    exportedAt,
    application: {
      schemaVersion: 1,
      applicationId: application.applicationId,
      ownerId: application.ownerId ?? application.userId ?? "",
      job: mapRisJob(application.job),
      documents: mapRisDocuments(application.documents),
      createdAt: application.createdAt ?? "",
      updatedAt: application.updatedAt ?? "",
      ...(application.applicationDate ? { applicationDate: application.applicationDate } : {}),
      ...(application.applicationChannel ? { applicationChannel: application.applicationChannel } : {}),
      ...(application.contact ? { contact: application.contact } : {}),
      ...(typeof application.notes === "string" ? { notes: application.notes } : {}),
      ...(application.salary ? { salary: application.salary } : {}),
      ...(application.followUp ? { followUp: application.followUp } : {}),
      status: mapRisStatus(application),
      statusHistory: Array.isArray(application.statusHistory) ? application.statusHistory : [],
      history: Array.isArray(application.history) ? application.history : [],
      version: Number(application.version) > 0 ? Number(application.version) : 1,
    },
  };
}
