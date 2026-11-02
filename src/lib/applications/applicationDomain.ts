import type {
  AddApplicationCoverLetterVersionInputV1,
  AddApplicationFeedbackInputV1,
  AddApplicationInterviewInputV1,
  AddApplicationNoteInputV1,
  ApplicationDeletionReceiptV1,
  ApplicationExportV1,
  ApplicationStatus,
  ApplicationV1,
  CreateApplicationDraftContextV1,
  CreateApplicationDraftInputV1,
  TransitionApplicationStatusInputV1,
  UpdateApplicationDraftInputV1,
} from "./contractTypes";
import {
  ApplicationValidationError,
  validateApplicationV1,
  validateCreateApplicationDraftInput,
  validateUpdateApplicationDraftInput,
} from "./applicationValidation";

const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  draft: ["submitted"],
  submitted: ["feedback", "interview", "rejected", "withdrawn"],
  feedback: ["interview", "offer", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["withdrawn"],
  rejected: [],
  withdrawn: [],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertOwner(application: ApplicationV1, ownerId: string): void {
  if (application.ownerId !== ownerId) {
    throw new ApplicationValidationError("Application owner does not match the verified identity", "owner_mismatch");
  }
}

function assertVersion(application: ApplicationV1, expectedVersion: number): void {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new ApplicationValidationError("expectedVersion must be a positive integer", "version_conflict");
  }
  if (application.version !== expectedVersion) {
    throw new ApplicationValidationError("Application version conflict", "version_conflict");
  }
}

function nextApplication(application: ApplicationV1, ownerId: string, expectedVersion: number, at: string): ApplicationV1 {
  assertOwner(application, ownerId);
  assertVersion(application, expectedVersion);
  if (!Number.isFinite(Date.parse(at))) {
    throw new ApplicationValidationError("Invalid updatedAt value");
  }
  return {
    ...application,
    updatedAt: at,
    version: application.version + 1,
  };
}

export function createApplicationDraft(
  input: CreateApplicationDraftInputV1,
  context: CreateApplicationDraftContextV1
): ApplicationV1 {
  validateCreateApplicationDraftInput(input);
  if (!context.ownerId.trim() || !context.applicationId.trim()) {
    throw new ApplicationValidationError("A verified ownerId and server applicationId are required");
  }
  if (!Number.isFinite(Date.parse(context.now))) {
    throw new ApplicationValidationError("Invalid creation timestamp");
  }

  const draft = input.documents ?? {};
  const versions = (draft.coverLetterVersions ?? []).map((version) => clone(version));
  const coverLetterDraft = draft.coverLetterDraft ?? "";
  const documentStatus =
    draft.documentStatus ?? (coverLetterDraft.trim() || versions.length > 0 ? "draft" : "missing");

  const application: ApplicationV1 = {
    schemaVersion: 1,
    applicationId: context.applicationId,
    ownerId: context.ownerId,
    job: clone(input.job),
    documents: {
      coverLetterDraft,
      coverLetterVersions: versions,
      documentStatus,
      ...(draft.cvReference === undefined ? {} : { cvReference: clone(draft.cvReference) }),
    },
    createdAt: context.now,
    updatedAt: context.now,
    ...(input.applicationDate === undefined ? {} : { applicationDate: input.applicationDate }),
    ...(input.applicationChannel === undefined ? {} : { applicationChannel: input.applicationChannel }),
    ...(input.contact === undefined ? {} : { contact: clone(input.contact) }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.salary === undefined ? {} : { salary: clone(input.salary) }),
    status: "draft",
    statusHistory: [{ at: context.now, from: null, to: "draft" }],
    history: [],
    version: 1,
  };
  validateApplicationV1(application);
  return application;
}

export function updateApplicationDraft(
  application: ApplicationV1,
  ownerId: string,
  input: UpdateApplicationDraftInputV1,
  now: string
): ApplicationV1 {
  validateUpdateApplicationDraftInput(input);
  const next = nextApplication(application, ownerId, input.expectedVersion, now);
  const currentDocuments = application.documents;
  const documents = input.documents
    ? {
        ...currentDocuments,
        ...input.documents,
        coverLetterVersions:
          input.documents.coverLetterVersions === undefined
            ? currentDocuments.coverLetterVersions
            : input.documents.coverLetterVersions.map((version) => clone(version)),
        cvReference:
          input.documents.cvReference === undefined
            ? currentDocuments.cvReference
            : clone(input.documents.cvReference),
      }
    : currentDocuments;

  const updated: ApplicationV1 = {
    ...next,
    documents,
    ...(input.applicationDate === undefined ? {} : { applicationDate: input.applicationDate }),
    ...(input.applicationChannel === undefined ? {} : { applicationChannel: input.applicationChannel }),
    ...(input.contact === undefined ? {} : { contact: clone(input.contact) }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.salary === undefined ? {} : { salary: clone(input.salary) }),
  };
  validateApplicationV1(updated);
  return updated;
}

export function canTransitionApplicationStatus(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionApplicationStatus(
  application: ApplicationV1,
  ownerId: string,
  input: TransitionApplicationStatusInputV1
): ApplicationV1 {
  assertOwner(application, ownerId);
  assertVersion(application, input.expectedVersion);
  if (!Number.isFinite(Date.parse(input.at))) {
    throw new ApplicationValidationError("Invalid status timestamp");
  }
  if (!TRANSITIONS[application.status].includes(input.to)) {
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

  const updated: ApplicationV1 = {
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
    updatedAt: input.at,
    version: application.version + 1,
    ...(application.applicationDate === undefined ? { applicationDate: input.at } : {}),
  };
  validateApplicationV1(updated);
  return updated;
}

export function markApplicationSubmitted(
  application: ApplicationV1,
  ownerId: string,
  input: TransitionApplicationStatusInputV1
): ApplicationV1 {
  if (input.to !== "submitted") {
    throw new ApplicationValidationError("markApplicationSubmitted requires to: submitted", "invalid_transition");
  }
  if (input.confirmed !== true) {
    throw new ApplicationValidationError(
      "Marking an application as submitted requires explicit confirmation",
      "confirmation_required"
    );
  }
  return transitionApplicationStatus(application, ownerId, input);
}

function appendHistory(
  application: ApplicationV1,
  ownerId: string,
  expectedVersion: number,
  at: string,
  entry: ApplicationV1["history"][number]
): ApplicationV1 {
  const next = nextApplication(application, ownerId, expectedVersion, at);
  const updated: ApplicationV1 = {
    ...next,
    history: [...application.history, entry],
  };
  validateApplicationV1(updated);
  return updated;
}

export function addApplicationFeedback(
  application: ApplicationV1,
  ownerId: string,
  input: AddApplicationFeedbackInputV1
): ApplicationV1 {
  if (application.status === "draft") {
    throw new ApplicationValidationError("Feedback cannot be recorded for a draft", "invalid_transition");
  }
  return appendHistory(application, ownerId, input.expectedVersion, input.at, {
    kind: "feedback",
    id: input.id,
    at: input.at,
    text: input.text,
  });
}

export function addApplicationInterview(
  application: ApplicationV1,
  ownerId: string,
  input: AddApplicationInterviewInputV1
): ApplicationV1 {
  if (application.status === "draft") {
    throw new ApplicationValidationError("An interview cannot be recorded for a draft", "invalid_transition");
  }
  return appendHistory(application, ownerId, input.expectedVersion, input.at, {
    kind: "interview",
    id: input.id,
    at: input.at,
    scheduledAt: input.scheduledAt,
    ...(input.note === undefined ? {} : { note: input.note }),
  });
}

export function addApplicationNote(
  application: ApplicationV1,
  ownerId: string,
  input: AddApplicationNoteInputV1
): ApplicationV1 {
  return appendHistory(application, ownerId, input.expectedVersion, input.at, {
    kind: "note",
    id: input.id,
    at: input.at,
    text: input.text,
  });
}

export function addCoverLetterVersion(
  application: ApplicationV1,
  ownerId: string,
  input: AddApplicationCoverLetterVersionInputV1
): ApplicationV1 {
  assertOwner(application, ownerId);
  assertVersion(application, input.expectedVersion);
  if (input.version.jobId !== application.job.jobId) {
    throw new ApplicationValidationError("Cover-letter version belongs to another job");
  }
  if (application.documents.coverLetterVersions.some((version) => version.versionId === input.version.versionId)) {
    throw new ApplicationValidationError("Duplicate cover-letter version ID");
  }
  const updated: ApplicationV1 = {
    ...application,
    documents: {
      ...application.documents,
      coverLetterVersions: [...application.documents.coverLetterVersions, clone(input.version)],
      documentStatus: application.documents.documentStatus === "missing" ? "draft" : application.documents.documentStatus,
    },
    updatedAt: input.version.createdAt,
    version: application.version + 1,
  };
  validateApplicationV1(updated);
  return updated;
}

export function exportApplication(
  application: ApplicationV1,
  ownerId: string,
  exportedAt: string
): ApplicationExportV1 {
  assertOwner(application, ownerId);
  if (!Number.isFinite(Date.parse(exportedAt))) {
    throw new ApplicationValidationError("Invalid export timestamp");
  }
  validateApplicationV1(application);
  return {
    schemaVersion: 1,
    exportedAt,
    application: clone(application),
  };
}

export function createApplicationDeletionReceipt(
  application: ApplicationV1,
  ownerId: string,
  deletedAt: string
): ApplicationDeletionReceiptV1 {
  assertOwner(application, ownerId);
  if (!Number.isFinite(Date.parse(deletedAt))) {
    throw new ApplicationValidationError("Invalid deletion timestamp");
  }
  return {
    schemaVersion: 1,
    applicationId: application.applicationId,
    ownerId: application.ownerId,
    deletedAt,
  };
}

export { assertOwner, assertVersion, TRANSITIONS };
