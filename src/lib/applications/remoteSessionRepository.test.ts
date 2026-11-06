import { describe, expect, it, vi } from "vitest";

import type { ApplicationV1 } from "./contractTypes";
import type { ApplicationPersistencePort } from "./repositoryTypes";
import { ApplicationRepositoryError } from "./repositoryTypes";
import { createRemoteApplicationRepository } from "./remoteSessionRepository";
import { createSessionApplication } from "./sessionApplications";

function application(overrides: Partial<ApplicationV1> = {}): ApplicationV1 {
  return {
    schemaVersion: 1,
    applicationId: "app-1",
    ownerId: "user-1",
    job: {
      jobId: "job-1",
      title: "Test Software Engineer",
      companyName: "Synthetic Test Company",
      location: ["Darmstadt"],
      source: ["synthetic"],
      jobOrigin: "source",
    },
    documents: { coverLetterDraft: "Hello", coverLetterVersions: [], documentStatus: "draft" },
    status: "draft",
    statusHistory: [{ at: "2026-11-05T10:00:00Z", from: null, to: "draft" }],
    history: [],
    version: 2,
    createdAt: "2026-11-05T10:00:00Z",
    updatedAt: "2026-11-05T10:00:00Z",
    ...overrides,
  };
}

function fakePort(overrides: Partial<ApplicationPersistencePort> = {}): ApplicationPersistencePort & { invalidate: () => void } {
  return {
    list: vi.fn(async () => ({ items: [application()], nextCursor: null })),
    get: vi.fn(async () => application()),
    create: vi.fn(async () => application()),
    update: vi.fn(async () => application()),
    transitionStatus: vi.fn(async () => application()),
    addFeedback: vi.fn(async () => application()),
    addInterview: vi.fn(async () => application()),
    addNote: vi.fn(async () => application()),
    addCoverLetterVersion: vi.fn(async () => application()),
    export: vi.fn(async () => ({
      schemaVersion: 1,
      exportedAt: "2026-11-05T12:00:00Z",
      application: application(),
    })),
    delete: vi.fn(async () => ({
      schemaVersion: 1,
      applicationId: "app-1",
      ownerId: "user-1",
      deletedAt: "2026-11-05T12:00:00Z",
    })),
    invalidate: vi.fn(),
    ...overrides,
  } as ApplicationPersistencePort & { invalidate: () => void };
}

describe("remote session bridge", () => {
  it("mappt Remote-Liste auf SessionApplicationV1 mit localId = applicationId", async () => {
    const repo = createRemoteApplicationRepository(fakePort());
    const page = await repo.list();
    expect(page.items[0].localId).toBe("app-1");
    expect(page.items[0]).not.toHaveProperty("ownerId");
    expect(page.items[0]).not.toHaveProperty("applicationId");
  });

  it("mappt Create inklusive Cover-Letter und CV-Referenz", async () => {
    const port = fakePort();
    const repo = createRemoteApplicationRepository(port);
    await repo.create({
      job: {
        jobId: "job-1",
        title: "Test",
        companyName: "Synthetic",
        location: ["Darmstadt"],
        source: ["synthetic"],
      },
      coverLetter: "Hello",
      coverLetterVersion: {
        versionId: "v1",
        jobId: "job-1",
        createdAt: "2026-11-05T10:00:00Z",
        content: "Hello",
        source: "manual",
      },
      cvReference: { cvId: "cv-1" },
      idempotencyKey: "key-1",
    });
    const [input, options] = vi.mocked(port.create).mock.calls[0];
    expect(input.documents?.coverLetterDraft).toBe("Hello");
    expect(input.documents?.coverLetterVersions?.[0].versionId).toBe("v1");
    expect(input.documents?.cvReference).toEqual({ cvId: "cv-1" });
    expect(options?.idempotencyKey).toBe("key-1");
  });

  it("mappt Update inklusive expectedVersion und Dokumentänderungen", async () => {
    const port = fakePort();
    const repo = createRemoteApplicationRepository(port);
    await repo.update("app-1", {
      expectedVersion: 2,
      changes: { notes: "note", documentStatus: "ready", coverLetterDraft: "new" },
    });
    const [id, input] = vi.mocked(port.update).mock.calls[0];
    expect(id).toBe("app-1");
    expect(input.expectedVersion).toBe(2);
    expect(input.notes).toBe("note");
    expect(input.documents).toMatchObject({ documentStatus: "ready", coverLetterDraft: "new" });
  });

  it("mappt Statuswechsel", async () => {
    const port = fakePort();
    const repo = createRemoteApplicationRepository(port);
    await repo.transitionStatus("app-1", {
      expectedVersion: 2,
      to: "submitted",
      at: "2026-11-05T10:00:00Z",
      confirmed: true,
    });
    const [id, input] = vi.mocked(port.transitionStatus).mock.calls[0];
    expect(id).toBe("app-1");
    expect(input).toMatchObject({ expectedVersion: 2, to: "submitted", confirmed: true });
  });

  it("verweigert nicht unterstützte Remote-Funktionen", async () => {
    const repo = createRemoteApplicationRepository(fakePort());
    await expect(
      repo.addHistory("app-1", { kind: "note", expectedVersion: 1, id: "n1", at: "2026-11-05T10:00:00Z", text: "x" })
    ).rejects.toMatchObject({ code: "not_supported" });
    await expect(
      repo.addCoverLetterVersion("app-1", {
        expectedVersion: 1,
        version: { versionId: "v1", jobId: "job-1", createdAt: "x", content: "x", source: "manual" },
      })
    ).rejects.toMatchObject({ code: "not_supported" });
    await expect(
      repo.adoptCoverLetter("app-1", {
        expectedVersion: 1,
        version: { versionId: "v1", jobId: "job-1", createdAt: "x", content: "x", source: "manual" },
      })
    ).rejects.toMatchObject({ code: "not_supported" });
  });

  it("exportiert als nicht-lokalen Export", async () => {
    const repo = createRemoteApplicationRepository(fakePort(), { now: () => "2026-11-05T12:00:00Z" });
    const exported = await repo.export("app-1");
    expect(exported.localDraft).toBe(false);
    expect(exported.exportedAt).toBe("2026-11-05T12:00:00Z");
    expect(exported.application.localId).toBe("app-1");
  });

  it("mappt Delete erst nach Serverbestätigung", async () => {
    const port = fakePort();
    const repo = createRemoteApplicationRepository(port);
    const result = await repo.delete("app-1", { expectedVersion: 3 });
    expect(result).toEqual({ deleted: true, localId: "app-1", idempotent: false });
    expect(vi.mocked(port.delete)).toHaveBeenCalledWith("app-1", 3, expect.anything());
  });

  it("findet per findByJob über mehrere Seiten", async () => {
    const port = fakePort({
      list: vi
        .fn()
        .mockResolvedValueOnce({ items: [application({ applicationId: "a", job: { ...application().job, jobId: "other" } })], nextCursor: "c2" })
        .mockResolvedValueOnce({ items: [application({ applicationId: "b" })], nextCursor: null }),
    });
    const repo = createRemoteApplicationRepository(port);
    const found = await repo.findByJob("job-1");
    expect(found?.localId).toBe("b");
  });

  it("wirft bei nicht vollständig durchsuchbarer findByJob-Suche", async () => {
    const port = fakePort({
      list: vi.fn(async () => ({
        items: [application({ applicationId: "a", job: { ...application().job, jobId: "other" } })],
        nextCursor: "more",
      })),
    });
    const repo = createRemoteApplicationRepository(port, { findByJobMaxPages: 2 });
    await expect(repo.findByJob("job-1")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("gibt bei not_found null zurück", async () => {
    const port = fakePort({
      get: vi.fn(async () => {
        throw new ApplicationRepositoryError("not found", "not_found");
      }),
    });
    const repo = createRemoteApplicationRepository(port);
    await expect(repo.get("missing")).resolves.toBeNull();
  });

  it("invalidiert den Remote-Port", () => {
    const port = fakePort();
    const repo = createRemoteApplicationRepository(port);
    repo.invalidate();
    expect(port.invalidate).toHaveBeenCalled();
  });

  it("verändert das Session-Repository nicht", () => {
    const session = createSessionApplication({
      localId: "local-1",
      now: "2026-11-05T10:00:00Z",
      coverLetter: "Hello",
      job: {
        jobId: "job-1",
        title: "Test",
        companyName: "Synthetic",
        location: ["Darmstadt"],
        source: ["synthetic"],
        originalUrl: "https://example.invalid/job",
      },
    });
    expect(session.localId).toBe("local-1");
    expect(session.status).toBe("draft");
  });
});
