import { afterEach, describe, expect, it, vi } from "vitest";

import { ApplicationRepositoryError } from "./repositoryTypes";
import { beginNewApplicationSession } from "./sessionRepository";
import {
  createRisApplicationRepository,
  isRisRemoteStorageEnabled,
  type RisRemoteRepositoryOptions,
} from "./risRemoteRepository";
import type { ApplicationV1 } from "./contractTypes";

const TOKEN = "test-access-token";
const CREDENTIAL_SENTINEL = "ris_secret_must_not_leak";

function fixture(overrides: Partial<ApplicationV1> = {}): ApplicationV1 {
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
    },
    documents: { coverLetterDraft: "", coverLetterVersions: [], documentStatus: "missing" },
    status: "draft",
    statusHistory: [],
    history: [],
    version: 1,
    createdAt: "2026-11-05T10:00:00Z",
    updatedAt: "2026-11-05T10:00:00Z",
    ...overrides,
  } as ApplicationV1;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as Response;
}

function makeFetch(...responses: Array<Response | (() => Promise<Response>)>) {
  let index = 0;
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const entry = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return typeof entry === "function" ? entry() : entry;
  });
}

function headerOf(
  mock: ReturnType<typeof makeFetch>,
  index: number,
  name: string
): string | undefined {
  const init = mock.mock.calls[index]?.[1];
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.[name];
}

function makeRepo(
  fetchImpl: ReturnType<typeof makeFetch>,
  overrides: Partial<RisRemoteRepositoryOptions> = {}
) {
  return createRisApplicationRepository({
    enabled: true,
    getAccessToken: async () => TOKEN,
    getOwnerId: () => "user-1",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => "2026-11-05T12:00:00Z",
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RIS remote application repository", () => {
  it("erstellt eine Bewerbung mit Server-ID, Bearer-Token und Idempotency-Key", async () => {
    const fetchImpl = makeFetch(jsonResponse(201, { application: fixture() }));
    const repo = makeRepo(fetchImpl);

    const result = await repo.create(
      {
        job: {
          jobId: "job-1",
          title: "Test Software Engineer",
          companyName: "Synthetic Test Company",
          location: ["Darmstadt"],
          source: ["synthetic"],
        },
      },
      { idempotencyKey: "stable-key-1" }
    );

    expect(result.applicationId).toBe("app-1");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/ris/applications");
    expect(init?.method).toBe("POST");
    expect(headerOf(fetchImpl, 0, "Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headerOf(fetchImpl, 0, "Idempotency-Key")).toBe("stable-key-1");
    expect(JSON.parse(init?.body as string).job.jobId).toBe("job-1");
  });

  it("lädt Liste inklusive Cursor und nächster Seite", async () => {
    const fetchImpl = makeFetch(
      jsonResponse(200, { items: [fixture()], nextCursor: "cursor-2" })
    );
    const repo = makeRepo(fetchImpl);
    const page = await repo.list({ limit: 10, cursor: "cursor-1" });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe("cursor-2");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("limit=10");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("cursor=cursor-1");
  });

  it("lädt ein Detail", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture({ version: 4 }) }));
    const repo = makeRepo(fetchImpl);
    const result = await repo.get("app-1");
    expect(result.version).toBe(4);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("id=app-1");
  });

  it("sendet expectedVersion beim Update", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture({ version: 3 }) }));
    const repo = makeRepo(fetchImpl);
    await repo.update("app-1", { expectedVersion: 2, notes: "updated" });
    const body = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(body.expectedVersion).toBe(2);
  });

  it("mappt 409 auf version_conflict", async () => {
    const fetchImpl = makeFetch(
      jsonResponse(409, { error: "Application conflict", code: "version_conflict" })
    );
    const repo = makeRepo(fetchImpl);
    await expect(repo.update("app-1", { expectedVersion: 1 })).rejects.toMatchObject({
      code: "version_conflict",
    });
  });

  it("exportiert als ApplicationExportV1", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture() }));
    const repo = makeRepo(fetchImpl);
    const result = await repo.export("app-1");
    expect(result.schemaVersion).toBe(1);
    expect(result.exportedAt).toBe("2026-11-05T12:00:00Z");
    expect(result.application.applicationId).toBe("app-1");
  });

  it("erzeugt nach bestätigtem Delete ein Receipt", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { deleted: true, idempotent: false }));
    const repo = makeRepo(fetchImpl);
    const receipt = await repo.delete("app-1", 2);
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      applicationId: "app-1",
      ownerId: "user-1",
      deletedAt: "2026-11-05T12:00:00Z",
    });
  });

  it("liefert Metrics", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { metrics: { total: 3 } }));
    const repo = makeRepo(fetchImpl);
    await expect(repo.metrics()).resolves.toEqual({ total: 3 });
    expect(String(fetchImpl.mock.calls[0][0])).toContain("action=metrics");
  });

  it("mappt 422 auf validation_error (nicht unterstützte Felder)", async () => {
    const fetchImpl = makeFetch(
      jsonResponse(422, { error: "location is unsupported", code: "unsupported_location_multiple" })
    );
    const repo = makeRepo(fetchImpl);
    await expect(
      repo.create({
        job: {
          jobId: "job-1",
          title: "Test",
          companyName: "Synthetic",
          location: ["Darmstadt", "Frankfurt"],
          source: ["synthetic"],
        },
      })
    ).rejects.toMatchObject({ code: "validation_error" });
  });

  it("mappt Builder-CV-Ablehnung auf validation_error", async () => {
    const fetchImpl = makeFetch(
      jsonResponse(422, { error: "builder cv", code: "builder_cv_unsupported" })
    );
    const repo = makeRepo(fetchImpl);
    await expect(
      repo.create({
        job: {
          jobId: "job-1",
          title: "Test",
          companyName: "Synthetic",
          location: ["Darmstadt"],
          source: ["synthetic"],
        },
        documents: { cvReference: { cvId: "cvb-1", cvSource: "builder" } },
      })
    ).rejects.toMatchObject({ code: "validation_error" });
  });

  it("erlaubt Create ohne profileRef", async () => {
    const fetchImpl = makeFetch(jsonResponse(201, { application: fixture() }));
    const repo = makeRepo(fetchImpl);
    await expect(
      repo.create({
        job: {
          jobId: "job-1",
          title: "Test",
          companyName: "Synthetic",
          location: ["Darmstadt"],
          source: ["synthetic"],
        },
      })
    ).resolves.toMatchObject({ applicationId: "app-1" });
  });

  it("lehnt fehlenden Access-Token ab", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture() }));
    const repo = makeRepo(fetchImpl, { getAccessToken: async () => null });
    await expect(repo.get("app-1")).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("mappt 401 auf unauthorized", async () => {
    const fetchImpl = makeFetch(jsonResponse(401, { error: "auth", code: "unauthenticated" }));
    const repo = makeRepo(fetchImpl);
    await expect(repo.get("app-1")).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("verwirft Antworten nach invalidate()/Logout", async () => {
    let rejectFetch: ((error: Error) => void) | null = null;
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject;
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    const repo = makeRepo(fetchImpl as unknown as ReturnType<typeof makeFetch>);
    const pending = repo.get("app-1");
    await Promise.resolve();
    repo.invalidate();
    await expect(pending).rejects.toMatchObject({ code: "session_ended" });
    expect(rejectFetch).toBeTypeOf("function");
  });

  it("verwirft Aufrufe nach Benutzerwechsel", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture() }));
    const repo = makeRepo(fetchImpl);
    beginNewApplicationSession();
    await expect(repo.get("app-1")).rejects.toMatchObject({ code: "session_ended" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("mappt Netzwerkausfall auf unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const repo = makeRepo(fetchImpl as unknown as ReturnType<typeof makeFetch>);
    await expect(repo.get("app-1")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("wiederholt Create nur mit demselben Idempotency-Key, ohne Auto-Retry", async () => {
    const fetchImpl = makeFetch(
      jsonResponse(201, { application: fixture() }),
      jsonResponse(201, { application: fixture() })
    );
    const repo = makeRepo(fetchImpl);
    const input = {
      job: {
        jobId: "job-1",
        title: "Test",
        companyName: "Synthetic",
        location: ["Darmstadt"],
        source: ["synthetic"],
      },
    };
    await repo.create(input, { idempotencyKey: "same-key" });
    await repo.create(input, { idempotencyKey: "same-key" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(headerOf(fetchImpl, 0, "Idempotency-Key")).toBe("same-key");
    expect(headerOf(fetchImpl, 1, "Idempotency-Key")).toBe("same-key");
  });

  it("lehnt Notes über 10.000 Zeichen vor dem Request ab", async () => {
    const fetchImpl = makeFetch(jsonResponse(201, { application: fixture() }));
    const repo = makeRepo(fetchImpl);
    await expect(
      repo.create({
        job: {
          jobId: "job-1",
          title: "Test",
          companyName: "Synthetic",
          location: ["Darmstadt"],
          source: ["synthetic"],
        },
        notes: "x".repeat(10001),
      })
    ).rejects.toMatchObject({ code: "validation_error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lehnt ungültige expectedVersion vor dem Request ab", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture() }));
    const repo = makeRepo(fetchImpl);
    await expect(repo.update("app-1", { expectedVersion: 0 })).rejects.toMatchObject({
      code: "validation_error",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("gibt keine Secrets in der Antwort aus", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture() }));
    const repo = makeRepo(fetchImpl);
    const result = await repo.get("app-1");
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain(CREDENTIAL_SENTINEL);
  });

  it("ist standardmäßig deaktiviert, wenn das Flag fehlt", async () => {
    const fetchImpl = makeFetch(jsonResponse(200, { application: fixture() }));
    const repo = createRisApplicationRepository({
      enabled: isRisRemoteStorageEnabled({}),
      getAccessToken: async () => TOKEN,
      getOwnerId: () => "user-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(repo.get("app-1")).rejects.toBeInstanceOf(ApplicationRepositoryError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
