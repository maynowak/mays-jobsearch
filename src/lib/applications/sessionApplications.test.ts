import { describe, expect, it } from "vitest";
import {
  addSessionCoverLetterVersion,
  addSessionFeedback,
  addSessionInterview,
  addSessionNote,
  createSessionApplication,
  deleteSessionApplication,
  exportSessionApplication,
  transitionSessionStatus,
  updateSessionApplication,
} from "./sessionApplications";
import type { ApplicationJobReferenceV1 } from "./contractTypes";

const NOW = "2026-11-02T10:00:00.000Z";
const job: ApplicationJobReferenceV1 = {
  jobId: "job-1",
  title: "Senior Fullstack Developer",
  companyName: "Siemens AG",
  location: ["Frankfurt am Main"],
  source: ["arbeitsagentur"],
  originalUrl: "https://www.arbeitsagentur.de/jobsuche/suche?id=10001-1-S",
};

function draft() {
  return createSessionApplication({
    localId: "local-1",
    now: NOW,
    coverLetter: "Dear team,",
    cvReference: { cvId: "cv-1", label: "Synthetic CV" },
    job,
  });
}

function submitted() {
  const application = draft();
  return transitionSessionStatus(application, {
    expectedVersion: 1,
    to: "submitted",
    at: "2026-11-02T11:00:00.000Z",
    confirmed: true,
  });
}

describe("APP-02 session applications", () => {
  it("creates a local draft without server identity", () => {
    const application = draft();
    expect(application.localId).toBe("local-1");
    expect(application).not.toHaveProperty("applicationId");
    expect(application).not.toHaveProperty("ownerId");
    expect(application.status).toBe("draft");
    expect(application.documents.cvReference?.cvId).toBe("cv-1");
  });

  it("requires explicit confirmation for submitted", () => {
    expect(() =>
      transitionSessionStatus(draft(), { expectedVersion: 1, to: "submitted", at: NOW })
    ).toThrowError(/explicit confirmation/i);
    expect(submitted().status).toBe("submitted");
  });

  it("records feedback, interview and note without changing status", () => {
    let application = submitted();
    application = addSessionFeedback(application, { expectedVersion: 2, id: "f1", at: NOW, text: "Feedback" });
    application = addSessionInterview(application, {
      expectedVersion: 3,
      id: "i1",
      at: NOW,
      scheduledAt: "2026-11-10T10:00:00.000Z",
    });
    application = addSessionNote(application, { expectedVersion: 4, id: "n1", at: NOW, text: "Note" });
    expect(application.status).toBe("submitted");
    expect(application.history).toHaveLength(3);
    expect(application.version).toBe(5);
  });

  it("binds letter versions to the job and increments locally", () => {
    const application = draft();
    const updated = addSessionCoverLetterVersion(application, {
      expectedVersion: 1,
      version: {
        versionId: "v1",
        jobId: job.jobId,
        createdAt: NOW,
        content: "Letter",
        source: "generated",
      },
    });
    expect(updated.documents.coverLetterVersions).toHaveLength(1);
    expect(updated.version).toBe(2);
    expect(() =>
      addSessionCoverLetterVersion(updated, {
        expectedVersion: 2,
        version: { versionId: "v2", jobId: "other", createdAt: NOW, content: "x", source: "generated" },
      })
    ).toThrowError(/another job/i);
  });

  it("rejects stale versions and supports update/export/delete", () => {
    const application = draft();
    expect(() => updateSessionApplication(application, 999, { notes: "x" }, NOW)).toThrowError(/version/i);
    const updated = updateSessionApplication(application, 1, { notes: "Follow up" }, NOW);
    const exported = exportSessionApplication(updated, NOW);
    expect(exported.localDraft).toBe(true);
    expect(exported.application.notes).toBe("Follow up");
    expect(deleteSessionApplication([updated], updated.localId)).toEqual([]);
  });
});
