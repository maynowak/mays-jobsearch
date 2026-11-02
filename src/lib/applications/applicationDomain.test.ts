import { describe, expect, it } from "vitest";
import {
  addApplicationFeedback,
  addApplicationInterview,
  addApplicationNote,
  addCoverLetterVersion,
  canTransitionApplicationStatus,
  createApplicationDeletionReceipt,
  createApplicationDraft,
  exportApplication,
  markApplicationSubmitted,
  transitionApplicationStatus,
  updateApplicationDraft,
} from "./applicationDomain";
import { validateApplicationV1 } from "./applicationValidation";
import type { ApplicationV1, CreateApplicationDraftInputV1 } from "./contractTypes";

const NOW = "2026-11-02T10:00:00.000Z";
const SUBMITTED_AT = "2026-11-02T11:00:00.000Z";
const FEEDBACK_AT = "2026-11-03T09:00:00.000Z";
const INTERVIEW_AT = "2026-11-04T09:00:00.000Z";

const job = {
  jobId: "job-1",
  title: "Senior Fullstack Developer",
  companyName: "Siemens AG",
  location: ["Frankfurt am Main"],
  source: ["arbeitsagentur"],
  originalUrl: "https://www.arbeitsagentur.de/jobsuche/suche?id=10001-1-S",
};

function input(overrides: Partial<CreateApplicationDraftInputV1> = {}): CreateApplicationDraftInputV1 {
  return {
    job,
    ...overrides,
  };
}

function draft(overrides: Partial<CreateApplicationDraftInputV1> = {}): ApplicationV1 {
  return createApplicationDraft(input(overrides), {
    ownerId: "owner-verified-1",
    applicationId: "application-1",
    now: NOW,
  });
}

function submitted(application = draft()): ApplicationV1 {
  return markApplicationSubmitted(application, "owner-verified-1", {
    expectedVersion: application.version,
    to: "submitted",
    at: SUBMITTED_AT,
    confirmed: true,
  });
}

describe("APP-01 application domain", () => {
  it("creates an application only as a draft with schema, owner, history and version", () => {
    const application = draft({
      documents: {
        coverLetterDraft: "Dear team,",
        documentStatus: "draft",
        cvReference: { cvId: "cv-1", label: "Synthetic CV" },
      },
      salary: { expectation: { amount: 80000, currency: "EUR", period: "year" } },
    });

    expect(application.schemaVersion).toBe(1);
    expect(application.applicationId).toBe("application-1");
    expect(application.ownerId).toBe("owner-verified-1");
    expect(application.status).toBe("draft");
    expect(application.version).toBe(1);
    expect(application.statusHistory).toEqual([{ at: NOW, from: null, to: "draft" }]);
    expect(application.history).toEqual([]);
    expect(application.documents.cvReference?.cvId).toBe("cv-1");
    expect(application.documents.coverLetterVersions).toEqual([]);
    expect(application.salary?.expectation?.amount).toBe(80000);
  });

  it("requires explicit confirmation before marking a draft as submitted", () => {
    const application = draft();

    expect(() =>
      markApplicationSubmitted(application, "owner-verified-1", {
        expectedVersion: 1,
        to: "submitted",
        at: SUBMITTED_AT,
        confirmed: false,
      })
    ).toThrowError(/explicit confirmation/i);

    const sent = submitted(application);
    expect(sent.status).toBe("submitted");
    expect(sent.applicationDate).toBe(SUBMITTED_AT);
    expect(sent.version).toBe(2);
    expect(sent.statusHistory.at(-1)).toMatchObject({ from: "draft", to: "submitted" });
  });

  it("supports the status chain feedback -> interview -> offer", () => {
    let application = submitted();
    application = transitionApplicationStatus(application, "owner-verified-1", {
      expectedVersion: application.version,
      to: "feedback",
      at: FEEDBACK_AT,
    });
    application = transitionApplicationStatus(application, "owner-verified-1", {
      expectedVersion: application.version,
      to: "interview",
      at: INTERVIEW_AT,
    });
    application = transitionApplicationStatus(application, "owner-verified-1", {
      expectedVersion: application.version,
      to: "offer",
      at: "2026-11-05T09:00:00.000Z",
    });

    expect(application.status).toBe("offer");
    expect(application.statusHistory.map((entry) => entry.to)).toEqual([
      "draft",
      "submitted",
      "feedback",
      "interview",
      "offer",
    ]);
    expect(application.version).toBe(5);
  });

  it("supports rejection and withdrawal as terminal states", () => {
    const rejected = transitionApplicationStatus(submitted(), "owner-verified-1", {
      expectedVersion: 2,
      to: "rejected",
      at: FEEDBACK_AT,
    });
    expect(rejected.status).toBe("rejected");
    expect(canTransitionApplicationStatus("rejected", "withdrawn")).toBe(false);

    const withdrawn = transitionApplicationStatus(submitted(), "owner-verified-1", {
      expectedVersion: 2,
      to: "withdrawn",
      at: FEEDBACK_AT,
    });
    expect(withdrawn.status).toBe("withdrawn");
    expect(() =>
      transitionApplicationStatus(withdrawn, "owner-verified-1", {
        expectedVersion: 3,
        to: "feedback",
        at: INTERVIEW_AT,
      })
    ).toThrowError(/Invalid status transition/i);
  });

  it("records feedback, interview and note history without auto-changing the status", () => {
    const application = submitted();
    const withFeedback = addApplicationFeedback(application, "owner-verified-1", {
      expectedVersion: application.version,
      id: "feedback-1",
      at: FEEDBACK_AT,
      text: "We would like to talk.",
    });
    const withInterview = addApplicationInterview(withFeedback, "owner-verified-1", {
      expectedVersion: withFeedback.version,
      id: "interview-1",
      at: INTERVIEW_AT,
      scheduledAt: "2026-11-10T10:00:00.000Z",
      note: "Video call",
    });
    const withNote = addApplicationNote(withInterview, "owner-verified-1", {
      expectedVersion: withInterview.version,
      id: "note-1",
      at: "2026-11-04T12:00:00.000Z",
      text: "Prepare architecture examples.",
    });

    expect(withNote.status).toBe("submitted");
    expect(withNote.history).toEqual([
      expect.objectContaining({ kind: "feedback", id: "feedback-1" }),
      expect.objectContaining({ kind: "interview", id: "interview-1" }),
      expect.objectContaining({ kind: "note", id: "note-1" }),
    ]);
    expect(withNote.version).toBe(5);
  });

  it("keeps cover-letter versions tied to the application job and rejects duplicates", () => {
    const application = draft();
    const version = {
      versionId: "letter-v1",
      jobId: application.job.jobId,
      createdAt: NOW,
      content: "Dear team,",
      source: "generated" as const,
    };
    const withVersion = addCoverLetterVersion(application, "owner-verified-1", {
      expectedVersion: application.version,
      version,
    });

    expect(withVersion.documents.coverLetterVersions).toHaveLength(1);
    expect(withVersion.documents.documentStatus).toBe("draft");
    expect(() =>
      addCoverLetterVersion(withVersion, "owner-verified-1", {
        expectedVersion: withVersion.version,
        version: { ...version, versionId: "letter-v2", jobId: "other-job" },
      })
    ).toThrowError(/another job/i);
    expect(() =>
      addCoverLetterVersion(withVersion, "owner-verified-1", {
        expectedVersion: withVersion.version,
        version: { ...version, content: "Duplicate" },
      })
    ).toThrowError(/Duplicate cover-letter version/i);
  });

  it("updates draft data without changing status and increments the version", () => {
    const application = draft();
    const updated = updateApplicationDraft(
      application,
      "owner-verified-1",
      {
        expectedVersion: 1,
        notes: "Follow up next week.",
        documents: { coverLetterDraft: "New draft", documentStatus: "draft" },
      },
      "2026-11-02T10:15:00.000Z"
    );

    expect(updated.status).toBe("draft");
    expect(updated.version).toBe(2);
    expect(updated.documents.coverLetterDraft).toBe("New draft");
    expect(updated.notes).toBe("Follow up next week.");
  });

  it("rejects stale versions and foreign owners", () => {
    const application = draft();
    expect(() =>
      updateApplicationDraft(application, "owner-verified-1", { expectedVersion: 999 }, NOW)
    ).toThrowError(/version conflict/i);

    expect(() =>
      updateApplicationDraft(application, "owner-other", { expectedVersion: 1 }, NOW)
    ).toThrowError(/owner/i);
    expect(() =>
      transitionApplicationStatus(application, "owner-other", {
        expectedVersion: 1,
        to: "submitted",
        at: SUBMITTED_AT,
        confirmed: true,
      })
    ).toThrowError(/owner/i);
    expect(() => exportApplication(application, "owner-other", NOW)).toThrowError(/owner/i);
    expect(() => createApplicationDeletionReceipt(application, "owner-other", NOW)).toThrowError(/owner/i);
  });

  it("exports a copy and returns a deletion receipt without persistence", () => {
    const application = submitted();
    const exported = exportApplication(application, "owner-verified-1", "2026-11-05T00:00:00.000Z");
    expect(exported.schemaVersion).toBe(1);
    expect(exported.application.applicationId).toBe(application.applicationId);
    expect(exported.application).not.toBe(application);

    const receipt = createApplicationDeletionReceipt(application, "owner-verified-1", "2026-11-05T00:00:00.000Z");
    expect(receipt).toEqual({
      schemaVersion: 1,
      applicationId: "application-1",
      ownerId: "owner-verified-1",
      deletedAt: "2026-11-05T00:00:00.000Z",
    });
  });

  it("validates persisted application shape and rejects unknown fields", () => {
    const application = draft();
    expect(() => validateApplicationV1(application)).not.toThrow();
    expect(() =>
      validateApplicationV1({ ...application, unexpected: true })
    ).toThrowError(/Unexpected field/i);
  });

  it("validates optional follow-up calendar data and completion consistency", () => {
    const application = draft();
    expect(() =>
      validateApplicationV1({
        ...application,
        followUp: { dueOn: "2026-11-16", note: "Nachfassen", status: "open" },
      })
    ).not.toThrow();
    expect(() =>
      validateApplicationV1({
        ...application,
        followUp: { dueOn: "2026-11-16", status: "completed" },
      })
    ).toThrowError(/completedAt/i);
    expect(() =>
      validateApplicationV1({
        ...application,
        followUp: { dueOn: "2026-02-31", status: "open" },
      })
    ).toThrowError(/calendar date/i);
  });

  it("rejects invalid job URLs, salary and alternative-owner fields", () => {
    expect(() =>
      createApplicationDraft(
        { ...input(), job: { ...job, originalUrl: "javascript:alert(1)" } },
        { ownerId: "owner-1", applicationId: "app-1", now: NOW }
      )
    ).toThrowError(/Invalid URL/i);

    expect(() =>
      createApplicationDraft(
        { ...input(), salary: { expectation: { amount: 1, currency: "EURO", period: "year" } } },
        { ownerId: "owner-1", applicationId: "app-1", now: NOW }
      )
    ).toThrowError(/Invalid salary currency/i);

    expect(() =>
      createApplicationDraft(
        { ...input(), ownerId: "attacker" } as unknown as CreateApplicationDraftInputV1,
        { ownerId: "owner-1", applicationId: "app-1", now: NOW }
      )
    ).toThrowError(/Unexpected field/i);
  });

  it("rejects feedback for a draft and invalid status transitions", () => {
    const application = draft();
    expect(() =>
      addApplicationFeedback(application, "owner-verified-1", {
        expectedVersion: 1,
        id: "feedback-1",
        at: FEEDBACK_AT,
        text: "Too early",
      })
    ).toThrowError(/draft/i);

    expect(() =>
      transitionApplicationStatus(application, "owner-verified-1", {
        expectedVersion: 1,
        to: "offer",
        at: FEEDBACK_AT,
      })
    ).toThrowError(/Invalid status transition/i);
  });
});
