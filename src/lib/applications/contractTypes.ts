// APP-01 — Versioned application-management contract.
//
// This is a persistence-neutral domain contract. No React state, File objects,
// CV hashes, storage keys, auth tokens or provider payloads are part of it.
// Server-owned fields (applicationId, ownerId, timestamps, version) are never
// accepted from a browser as authorization input.

export type ApplicationSchemaVersion = 1;
export type ISODateTime = string;
export type OpaqueId = string;

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "feedback"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ApplicationChannel = "online" | "email" | "portal" | "postal" | "other";
export type SalaryPeriod = "year" | "month" | "hour";
export type DocumentStatus = "missing" | "draft" | "ready";
export type CoverLetterVersionSource = "generated" | "revised" | "manual";
export type ApplicationHistoryKind = "feedback" | "interview" | "note";

export interface ApplicationJobReferenceV1 {
  /** Stable source-specific job key, never the application ID. */
  jobId: OpaqueId;
  title: string;
  companyName: string;
  location: string[];
  source: string[];
  originalUrl: string;
}

export interface ApplicationCvReferenceV1 {
  /** Existing CV domain/document reference only; no PDF bytes or hash. */
  cvId: OpaqueId;
  documentId?: OpaqueId;
  label?: string;
}

export interface CoverLetterVersionV1 {
  versionId: OpaqueId;
  /** Must equal the owning application's job.jobId. */
  jobId: OpaqueId;
  createdAt: ISODateTime;
  content: string;
  source: CoverLetterVersionSource;
  language?: "de" | "en";
  model?: string;
}

export interface ApplicationDocumentsV1 {
  coverLetterDraft: string;
  coverLetterVersions: CoverLetterVersionV1[];
  cvReference?: ApplicationCvReferenceV1;
  documentStatus: DocumentStatus;
}

export interface ApplicationContactV1 {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ApplicationSalaryV1 {
  amount: number;
  /** ISO 4217-style three-letter code, e.g. EUR. */
  currency: string;
  period: SalaryPeriod;
}

export interface ApplicationSalaryContextV1 {
  expectation?: ApplicationSalaryV1;
  offer?: ApplicationSalaryV1;
}

export interface ApplicationFollowUpV1 {
  /** Calendar date (YYYY-MM-DD), not a UTC timestamp. */
  dueOn: string;
  note?: string;
  status: "open" | "completed";
  completedAt?: ISODateTime;
}

export interface ApplicationStatusHistoryEntryV1 {
  at: ISODateTime;
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  note?: string;
}

export interface ApplicationFeedbackEntryV1 {
  kind: "feedback";
  id: OpaqueId;
  at: ISODateTime;
  text: string;
}

export interface ApplicationInterviewEntryV1 {
  kind: "interview";
  id: OpaqueId;
  at: ISODateTime;
  scheduledAt: ISODateTime;
  note?: string;
}

export interface ApplicationNoteEntryV1 {
  kind: "note";
  id: OpaqueId;
  at: ISODateTime;
  text: string;
}

export type ApplicationHistoryEntryV1 =
  | ApplicationFeedbackEntryV1
  | ApplicationInterviewEntryV1
  | ApplicationNoteEntryV1;

export interface ApplicationV1 {
  schemaVersion: ApplicationSchemaVersion;
  applicationId: OpaqueId;
  /** Server-owned, derived from the verified auth identity (iss + sub). */
  ownerId: OpaqueId;
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
  /** Projection target: all status changes, including the initial draft. */
  statusHistory: ApplicationStatusHistoryEntryV1[];
  /** Non-status timeline entries. Status changes stay in statusHistory. */
  history: ApplicationHistoryEntryV1[];
  /** Optimistic concurrency token. */
  version: number;
}

export interface CreateApplicationDraftInputV1 {
  job: ApplicationJobReferenceV1;
  documents?: Partial<ApplicationDocumentsV1>;
  applicationDate?: ISODateTime;
  applicationChannel?: ApplicationChannel;
  contact?: ApplicationContactV1;
  notes?: string;
  salary?: ApplicationSalaryContextV1;
}

export interface CreateApplicationDraftContextV1 {
  ownerId: OpaqueId;
  applicationId: OpaqueId;
  now: ISODateTime;
}

export interface UpdateApplicationDraftInputV1 {
  expectedVersion: number;
  documents?: Partial<ApplicationDocumentsV1>;
  applicationDate?: ISODateTime;
  applicationChannel?: ApplicationChannel;
  contact?: ApplicationContactV1;
  notes?: string;
  salary?: ApplicationSalaryContextV1;
  followUp?: ApplicationFollowUpV1;
}

export interface TransitionApplicationStatusInputV1 {
  expectedVersion: number;
  to: ApplicationStatus;
  at: ISODateTime;
  note?: string;
  /** Required for draft -> submitted. */
  confirmed?: boolean;
}

export interface AddApplicationFeedbackInputV1 {
  expectedVersion: number;
  id: OpaqueId;
  at: ISODateTime;
  text: string;
}

export interface AddApplicationInterviewInputV1 {
  expectedVersion: number;
  id: OpaqueId;
  at: ISODateTime;
  scheduledAt: ISODateTime;
  note?: string;
}

export interface AddApplicationCoverLetterVersionInputV1 {
  expectedVersion: number;
  version: CoverLetterVersionV1;
}

export interface AddApplicationNoteInputV1 {
  expectedVersion: number;
  id: OpaqueId;
  at: ISODateTime;
  text: string;
}

export interface ApplicationExportV1 {
  schemaVersion: ApplicationSchemaVersion;
  exportedAt: ISODateTime;
  application: ApplicationV1;
}

export interface ApplicationDeletionReceiptV1 {
  schemaVersion: ApplicationSchemaVersion;
  applicationId: OpaqueId;
  ownerId: OpaqueId;
  deletedAt: ISODateTime;
}
