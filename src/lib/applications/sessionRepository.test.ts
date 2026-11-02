import { describe, expect, it } from "vitest";
import { beginNewApplicationSession, createSessionApplicationRepository } from "./sessionRepository";
import { ApplicationRepositoryError } from "./repositoryTypes";
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

function repository() {
  return createSessionApplicationRepository({
    now: () => NOW,
    idFactory: () => "local-1",
  });
}

async function created() {
  const repo = repository();
  const application = await repo.create({ job, coverLetter: "Dear team," });
  return { repo, application };
}

describe("APP-03 session application repository", () => {
  it("creates, lists and gets an owned local draft", async () => {
    const { repo, application } = await created();
    const page = await repo.list();
    expect(page.items).toHaveLength(1);
    expect(page.items[0].localId).toBe("local-1");
    expect(await repo.get("local-1")).toEqual(application);
    expect(await repo.findByJob("job-1")).toEqual(application);
  });

  it("supports pagination and status filtering", async () => {
    const repo = createSessionApplicationRepository({
      now: () => NOW,
      idFactory: (() => {
        let i = 0;
        return () => `local-${++i}`;
      })(),
    });
    await repo.create({ job, coverLetter: "A" });
    await repo.create({ job: { ...job, jobId: "job-2" }, coverLetter: "B" });
    const page = await repo.list({ limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe("1");
    const next = await repo.list({ limit: 1, cursor: page.nextCursor });
    expect(next.items).toHaveLength(1);
    expect(next.items[0].localId).not.toBe(page.items[0].localId);
    const noDraft = await repo.list({ status: "submitted" });
    expect(noDraft.items).toHaveLength(0);
  });

  it("updates with version control and rejects stale writes", async () => {
    const { repo, application } = await created();
    const updated = await repo.update(application.localId, {
      expectedVersion: 1,
      changes: { notes: "Follow up" },
    });
    expect(updated.version).toBe(2);
    expect(updated.notes).toBe("Follow up");
    await expect(
      repo.update(application.localId, { expectedVersion: 1, changes: { notes: "stale" } })
    ).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("updates the cover-letter draft of an existing application without duplicating it", async () => {
    const { repo, application } = await created();
    const updated = await repo.update(application.localId, {
      expectedVersion: 1,
      changes: {
        coverLetterDraft: "Updated letter",
        documentStatus: "draft",
        cvReference: { cvId: "cv-2", label: "New CV" },
      },
    });
    expect(updated.documents.coverLetterDraft).toBe("Updated letter");
    expect(updated.documents.cvReference).toEqual({ cvId: "cv-2", label: "New CV" });
    expect(updated.status).toBe("draft");
    expect(updated.version).toBe(2);
    expect((await repo.list()).items).toHaveLength(1);
  });

  it("requires explicit status confirmation and supports history", async () => {
    const { repo, application } = await created();
    await expect(
      repo.transitionStatus(application.localId, { expectedVersion: 1, to: "submitted", at: NOW })
    ).rejects.toMatchObject({ code: "confirmation_required" });

    const submitted = await repo.transitionStatus(application.localId, {
      expectedVersion: 1,
      to: "submitted",
      at: NOW,
      confirmed: true,
    });
    expect(submitted.status).toBe("submitted");
    const withFeedback = await repo.addHistory(submitted.localId, {
      kind: "feedback",
      expectedVersion: submitted.version,
      id: "f1",
      at: NOW,
      text: "Feedback",
    });
    expect(withFeedback.history).toHaveLength(1);
    expect(withFeedback.status).toBe("submitted");

    const withInterview = await repo.addHistory(withFeedback.localId, {
      kind: "interview",
      expectedVersion: withFeedback.version,
      id: "i1",
      at: NOW,
      scheduledAt: "2026-11-10T10:00:00.000Z",
    });
    expect(withInterview.history).toHaveLength(2);
  });

  it("adds cover-letter versions with job binding and exports local drafts", async () => {
    const { repo, application } = await created();
    const updated = await repo.addCoverLetterVersion(application.localId, {
      expectedVersion: 1,
      version: {
        versionId: "v1",
        jobId: "job-1",
        createdAt: NOW,
        content: "Dear team,",
        source: "generated",
      },
    });
    expect(updated.documents.coverLetterVersions).toHaveLength(1);
    await expect(
      repo.addCoverLetterVersion(updated.localId, {
        expectedVersion: updated.version,
        version: { versionId: "v2", jobId: "other", createdAt: NOW, content: "x", source: "generated" },
      })
    ).rejects.toMatchObject({ code: "validation_error" });

    const exported = await repo.export(updated.localId);
    expect(exported.localDraft).toBe(true);
    expect(exported.application.localId).toBe(updated.localId);
  });

  it("prevents duplicate creates and supports idempotent delete", async () => {
    const { repo, application } = await created();
    await expect(repo.create({ job, coverLetter: "again" })).rejects.toMatchObject({
      code: "idempotency_conflict",
    });
    await expect(
      repo.delete(application.localId, { expectedVersion: 1 })
    ).resolves.toMatchObject({ deleted: true });
    await expect(
      repo.delete(application.localId, { expectedVersion: 1 })
    ).resolves.toMatchObject({ deleted: false, idempotent: true });
  });

  it("returns the latest record for a repeated idempotency key", async () => {
    const repo = repository();
    const first = await repo.create({ job, coverLetter: "A", idempotencyKey: "adopt:job-1" });
    const updated = await repo.update(first.localId, { expectedVersion: 1, changes: { notes: "Latest" } });
    const repeated = await repo.create({ job, coverLetter: "A", idempotencyKey: "adopt:job-1" });
    expect(repeated).toEqual(updated);
    expect((await repo.list()).items).toHaveLength(1);
  });

  it("keeps separate repositories isolated", async () => {
    const firstRepository = repository();
    await firstRepository.create({ job, coverLetter: "A" });
    const secondRepository = repository();
    expect((await secondRepository.list()).items).toHaveLength(0);
    expect(await secondRepository.findByJob("job-1")).toBeNull();
    await expect(
      secondRepository.create({ job, coverLetter: "B" })
    ).resolves.toMatchObject({ localId: "local-1", status: "draft" });
  });


  it("invalidates all existing instances on a session-generation change", async () => {
    const first = repository();
    await first.create({ job, coverLetter: "A" });
    beginNewApplicationSession();
    await expect(first.list()).rejects.toMatchObject({ code: "session_ended" });
    await expect(first.create({ job, coverLetter: "B" })).rejects.toMatchObject({ code: "session_ended" });
    expect((await repository().list()).items).toHaveLength(0);
  });

  it("invalidates a repository explicitly without carrying data forward", async () => {
    const first = repository();
    await first.create({ job, coverLetter: "A" });
    first.invalidate();
    await expect(first.get("local-1")).rejects.toMatchObject({ code: "session_ended" });
    await expect(first.export("local-1")).rejects.toMatchObject({ code: "session_ended" });
    expect((await repository().list()).items).toHaveLength(0);
  });
  it("aborts list operations through AbortSignal", async () => {
    const { repo } = await created();
    const controller = new AbortController();
    controller.abort();
    await expect(repo.list({ signal: controller.signal })).rejects.toBeInstanceOf(ApplicationRepositoryError);
    await expect(repo.list({ signal: controller.signal })).rejects.toMatchObject({ code: "aborted" });
  });
});
