import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationV1 } from "./contractTypes";
import type { ApplicationPersistencePort, ApplicationRepository } from "./repositoryTypes";
import { ApplicationRepositoryError } from "./repositoryTypes";
import { createApplicationMigration, type ApplicationMigrationOptions } from "./applicationMigration";
import { beginNewApplicationSession } from "./sessionRepository";
import { createSessionApplication, type SessionApplicationV1 } from "./sessionApplications";

const NOW = "2026-11-05T10:00:00Z";

function localApplication(overrides: Partial<SessionApplicationV1> = {}): SessionApplicationV1 {
  const application = createSessionApplication({
    localId: "local-1",
    now: NOW,
    coverLetter: "Hello",
    job: {
      jobId: "job-1",
      title: "Test Software Engineer",
      companyName: "Synthetic Test Company",
      location: ["Darmstadt"],
      source: ["synthetic"],
      originalUrl: "https://example.invalid/job",
    },
  });
  return { ...application, ...overrides } as SessionApplicationV1;
}

function remoteApplication(local: SessionApplicationV1, applicationId = "remote-1"): ApplicationV1 {
  return {
    schemaVersion: 1,
    applicationId,
    ownerId: "user-1",
    job: local.job,
    documents: local.documents,
    status: local.status,
    statusHistory: local.statusHistory,
    history: local.history,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function harness(
  applications: SessionApplicationV1[],
  remote: Partial<ApplicationPersistencePort> = {},
  options: Partial<ApplicationMigrationOptions> = {}
) {
  const byId = new Map(applications.map((application) => [application.localId, application]));
  const sessionRepository = {
    get: vi.fn(async (localId: string) => byId.get(localId) ?? null),
  } as unknown as Pick<ApplicationRepository, "get">;
  const remotePort = {
    list: vi.fn(async () => ({ items: [], nextCursor: null })),
    create: vi.fn(async () => remoteApplication(applications[0])),
    get: vi.fn(async () => remoteApplication(applications[0])),
    ...remote,
  };
  const migration = createApplicationMigration({
    sessionRepository,
    remotePort,
    storageConsent: async () => true,
    consentSource: "simulated",
    ...options,
  });
  return { migration, sessionRepository, remotePort, applications };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("application migration", () => {
  it("meldet kompatible Bewerbungen als READY, ohne zu schreiben", async () => {
    const { migration, remotePort } = harness([localApplication()]);
    const preview = await migration.preview({ localIds: ["local-1"] });
    expect(preview.items[0]).toMatchObject({ status: "READY", duplicate: false, reasons: [] });
    expect(remotePort.create).not.toHaveBeenCalled();
  });

  it("blockiert mehrere Standorte", async () => {
    const application = localApplication({
      job: { ...localApplication().job, location: ["Darmstadt", "Frankfurt"] },
    });
    const { migration } = harness([application]);
    const preview = await migration.preview({ localIds: ["local-1"] });
    expect(preview.items[0].status).toBe("INCOMPATIBLE");
    expect(preview.items[0].reasons).toContain("location_not_single");
  });

  it("blockiert manuelle Stellen", async () => {
    const application = localApplication({
      job: { ...localApplication().job, jobOrigin: "manual", source: ["manual"] },
    });
    const { migration } = harness([application]);
    const preview = await migration.preview({ localIds: ["local-1"] });
    expect(preview.items[0].reasons).toContain("manual_job_unsupported");
  });

  it("blockiert Builder-CV-Referenzen", async () => {
    const application = localApplication({
      documents: {
        ...localApplication().documents,
        cvReference: { cvId: "cvb-1", cvSource: "builder" },
      },
    });
    const { migration } = harness([application]);
    const preview = await migration.preview({ localIds: ["local-1"] });
    expect(preview.items[0].reasons).toContain("builder_cv_unsupported");
  });

  it("blockiert nicht übertragbare History", async () => {
    const application = localApplication({
      history: [{ kind: "note", id: "n1", at: NOW, text: "note" }],
    });
    const { migration } = harness([application]);
    const preview = await migration.preview({ localIds: ["local-1"] });
    expect(preview.items[0].reasons).toContain("history_not_transferable");
  });

  it("erkennt Duplikate über die Remote-Liste", async () => {
    const local = localApplication();
    const remote = remoteApplication(local, "remote-existing");
    const { migration } = harness([local], {
      list: vi.fn(async () => ({ items: [remote], nextCursor: null })),
    });
    const preview = await migration.preview({ localIds: ["local-1"] });
    expect(preview.items[0].status).toBe("CONFLICT");
    expect(preview.duplicateJobIds).toEqual(["job-1"]);
  });

  it("verlangt eine ausdrückliche Bestätigung", async () => {
    const { migration } = harness([localApplication()]);
    await expect(migration.commit({ localIds: ["local-1"] }, "mig-1")).rejects.toMatchObject({
      code: "confirmation_required",
    });
  });

  it("bleibt ohne serverseitige Speicherfreigabe fail-closed", async () => {
    const { migration } = harness([localApplication()], {}, { consentSource: "server" });
    await expect(
      migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1")
    ).rejects.toMatchObject({ code: "storage_consent_required" });
  });

  it("überträgt eine kompatible Bewerbung mit stabilem Idempotenzschlüssel und verifiziert sie", async () => {
    const local = localApplication();
    const remote = remoteApplication(local);
    const { migration, remotePort } = harness([local], {
      create: vi.fn(async () => remote),
      get: vi.fn(async () => remote),
    });
    const result = await migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1");
    expect(result.succeeded).toEqual([
      { localId: "local-1", applicationId: "remote-1", version: 1 },
    ]);
    const createOptions = vi.mocked(remotePort.create).mock.calls[0][1];
    expect(createOptions?.idempotencyKey).toBe("mig-1:local-1");
    expect(vi.mocked(remotePort.get)).toHaveBeenCalledWith("remote-1", expect.anything());
  });

  it("erstellt eine bereits übertragene Bewerbung nicht erneut", async () => {
    const local = localApplication();
    const remote = remoteApplication(local);
    const { migration, remotePort } = harness([local], {
      create: vi.fn(async () => remote),
      get: vi.fn(async () => remote),
    });
    await migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1");
    await migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1");
    expect(vi.mocked(remotePort.create)).toHaveBeenCalledTimes(1);
    expect(migration.transferredId("local-1")).toBe("remote-1");
  });

  it("meldet nach Timeout CONFIRMATION_PENDING und erzeugt keinen zweiten Create", async () => {
    const local = localApplication();
    const { migration, remotePort } = harness([local], {
      create: vi.fn(async () => {
        throw new ApplicationRepositoryError("timeout", "unavailable");
      }),
      list: vi.fn(async () => ({ items: [], nextCursor: null })),
    });
    const result = await migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1");
    expect(result.failed).toEqual([{ localId: "local-1", reason: "confirmation_pending" }]);
    expect(vi.mocked(remotePort.create)).toHaveBeenCalledTimes(1);
  });

  it("gleicht nach Timeout einen bereits erstellten Remote-Datensatz ab", async () => {
    const local = localApplication();
    const remote = remoteApplication(local, "remote-reconciled");
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({ items: [remote], nextCursor: null });
    const { migration } = harness([local], {
      create: vi.fn(async () => {
        throw new ApplicationRepositoryError("timeout", "unavailable");
      }),
      list,
    });
    const result = await migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1");
    expect(result.succeeded[0]).toMatchObject({ localId: "local-1", applicationId: "remote-reconciled" });
  });

  it("überträgt teilweise und lässt inkompatible lokal", async () => {
    const compatible = localApplication();
    const incompatible = localApplication({
      localId: "local-2",
      job: { ...localApplication().job, location: ["A", "B"] },
    });
    const remote = remoteApplication(compatible);
    const { migration } = harness([compatible, incompatible], {
      create: vi.fn(async () => remote),
      get: vi.fn(async () => remote),
    });
    const result = await migration.commit(
      { localIds: ["local-1", "local-2"], confirmed: true },
      "mig-1"
    );
    expect(result.succeeded.map((entry) => entry.localId)).toEqual(["local-1"]);
    expect(result.failed[0]).toMatchObject({ localId: "local-2" });
  });

  it("verwirft Migration nach Logout/Benutzerwechsel", async () => {
    const { migration } = harness([localApplication()]);
    beginNewApplicationSession();
    await expect(
      migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1")
    ).rejects.toMatchObject({ code: "session_ended" });
  });

  it("lässt die lokale Bewerbung nach Erfolg unverändert", async () => {
    const local = localApplication();
    const remote = remoteApplication(local);
    const { migration } = harness([local], {
      create: vi.fn(async () => remote),
      get: vi.fn(async () => remote),
    });
    await migration.commit({ localIds: ["local-1"], confirmed: true }, "mig-1");
    expect(local.localId).toBe("local-1");
    expect(local.status).toBe("draft");
  });

  it("migriert nicht automatisch ohne preview/commit", async () => {
    const { remotePort } = harness([localApplication()]);
    expect(remotePort.create).not.toHaveBeenCalled();
  });
});
