import { describe, expect, it } from "vitest";
import {
  adoptSessionCoverLetter,
  createSessionApplication,
} from "./sessionApplications";
import type { CoverLetterVersionV1 } from "./contractTypes";
import { createSessionApplicationRepository } from "./sessionRepository";

const NOW = "2026-11-04T10:00:00.000Z";
const job = {
  jobId: "manual:test-1",
  title: "Initiativbewerbung",
  companyName: "Unternehmen nicht angegeben",
  location: [],
  source: ["manual"],
  jobOrigin: "manual" as const,
};

function version(overrides: Partial<CoverLetterVersionV1> = {}): CoverLetterVersionV1 {
  return {
    versionId: "letter-v1",
    jobId: job.jobId,
    createdAt: NOW,
    content: "Sehr geehrte Damen und Herren,",
    source: "generated",
    language: "de",
    ...overrides,
  };
}

describe("session cover-letter adoption", () => {
  it("creates the first version in the same create operation", () => {
    const application = createSessionApplication({
      localId: "local-1",
      now: NOW,
      coverLetter: "Sehr geehrte Damen und Herren,",
      coverLetterVersion: version(),
      job,
    });
    expect(application.documents.coverLetterVersions).toHaveLength(1);
    expect(application.documents.coverLetterVersions[0].content).toBe(
      "Sehr geehrte Damen und Herren,"
    );
    expect(application.documents.documentStatus).toBe("draft");
    expect(application.version).toBe(1);
  });

  it("adds the first version to an existing draft without a version", () => {
    const application = createSessionApplication({
      localId: "local-draft",
      now: NOW,
      coverLetter: "",
      job,
    });
    expect(application.documents.coverLetterVersions).toHaveLength(0);
    const updated = adoptSessionCoverLetter(application, {
      expectedVersion: 1,
      version: version({ versionId: "letter-first", content: "Erste Fassung" }),
    });
    expect(updated.documents.coverLetterVersions).toHaveLength(1);
    expect(updated.documents.coverLetterDraft).toBe("Erste Fassung");
  });

  it("adds a version and updates the draft without losing history", () => {
    const application = createSessionApplication({
      localId: "local-1",
      now: NOW,
      coverLetter: "Erste Fassung",
      coverLetterVersion: version({ content: "Erste Fassung" }),
      job,
    });
    const updated = adoptSessionCoverLetter(application, {
      expectedVersion: 1,
      version: version({
        versionId: "letter-v2",
        content: "Zweite Fassung",
        source: "revised",
      }),
    });
    expect(updated.documents.coverLetterDraft).toBe("Zweite Fassung");
    expect(updated.documents.coverLetterVersions).toHaveLength(2);
    expect(updated.documents.coverLetterVersions[0].content).toBe("Erste Fassung");
    expect(updated.documents.coverLetterVersions[1].content).toBe("Zweite Fassung");
    expect(updated.version).toBe(2);
  });

  it("updates the CV reference while preserving cover-letter versions", () => {
    const application = createSessionApplication({
      localId: "local-1",
      now: NOW,
      coverLetter: "Erste Fassung",
      coverLetterVersion: version({ content: "Erste Fassung" }),
      cvReference: { cvId: "cv-1", label: "Legacy upload" },
      job,
    });
    const updated = adoptSessionCoverLetter(application, {
      expectedVersion: 1,
      version: version({ versionId: "letter-v2", content: "Zweite Fassung" }),
      cvReference: {
        cvId: "cvb-1",
        label: "AWS Cloud Engineer",
        cvSource: "builder",
      },
    });
    expect(updated.documents.cvReference).toEqual({
      cvId: "cvb-1",
      label: "AWS Cloud Engineer",
      cvSource: "builder",
    });
    expect(updated.documents.coverLetterVersions).toHaveLength(2);
    expect(updated.documents.coverLetterVersions[0].content).toBe("Erste Fassung");
  });

  it("keeps legacy CV references without cvSource unchanged", () => {
    const application = createSessionApplication({
      localId: "local-1",
      now: NOW,
      coverLetter: "Erste Fassung",
      coverLetterVersion: version({ content: "Erste Fassung" }),
      cvReference: { cvId: "cv-1", label: "Legacy upload" },
      job,
    });
    const updated = adoptSessionCoverLetter(application, {
      expectedVersion: 1,
      version: version({ versionId: "letter-v2" }),
    });
    expect(updated.documents.cvReference).toEqual({ cvId: "cv-1", label: "Legacy upload" });
  });

  it("rejects an invalid CV source", () => {
    const application = createSessionApplication({
      localId: "local-1",
      now: NOW,
      coverLetter: "Erste Fassung",
      job,
    });
    expect(() =>
      adoptSessionCoverLetter(application, {
        expectedVersion: 1,
        version: version({ versionId: "letter-v2" }),
        cvReference: {
          cvId: "cvb-1",
          cvSource: "unknown" as never,
        },
      })
    ).toThrowError(/cvSource/);
  });

  it("rejects duplicate version IDs and foreign job IDs", () => {
    const application = createSessionApplication({
      localId: "local-1",
      now: NOW,
      coverLetter: "Erste Fassung",
      coverLetterVersion: version({ content: "Erste Fassung" }),
      job,
    });
    expect(() => adoptSessionCoverLetter(application, {
      expectedVersion: 1,
      version: version({ content: "Doppelt" }),
    })).toThrowError(/Duplicate/);
    expect(() => adoptSessionCoverLetter(application, {
      expectedVersion: 1,
      version: version({ versionId: "letter-other", jobId: "other" }),
    })).toThrowError(/another job/);
  });

  it("rejects a stale expectedVersion", () => {
    const application = createSessionApplication({
      localId: "local-1",
      now: NOW,
      coverLetter: "Erste Fassung",
      coverLetterVersion: version({ content: "Erste Fassung" }),
      job,
    });
    expect(() => adoptSessionCoverLetter(application, {
      expectedVersion: 99,
      version: version({ versionId: "letter-v2" }),
    })).toThrowError(/version/i);
  });

  it("rejects adoption after the session was invalidated", async () => {
    const repo = createSessionApplicationRepository();
    const created = await repo.create({
      job,
      coverLetter: "Erste Fassung",
      coverLetterVersion: version({ content: "Erste Fassung" }),
    });
    repo.invalidate();
    await expect(repo.adoptCoverLetter(created.localId, {
      expectedVersion: created.version,
      version: version({ versionId: "letter-after-reset" }),
    })).rejects.toMatchObject({ code: "session_ended" });
  });

  it("uses the current repository state and appends versions", async () => {
    const repo = createSessionApplicationRepository();
    const created = await repo.create({
      job,
      coverLetter: "Erste Fassung",
      coverLetterVersion: version({ content: "Erste Fassung" }),
    });
    const updated = await repo.adoptCoverLetter(created.localId, {
      expectedVersion: created.version,
      version: version({ versionId: "letter-v2", content: "Zweite Fassung" }),
    });
    expect(updated.documents.coverLetterVersions).toHaveLength(2);
    expect(await repo.findByJob(job.jobId)).toMatchObject({
      localId: created.localId,
      version: 2,
    });
  });
});
