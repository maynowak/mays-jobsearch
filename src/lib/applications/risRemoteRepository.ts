import type {
  ApplicationListOptions,
  ApplicationPageV1,
  ApplicationPersistencePort,
  ApplicationReadOptions,
} from "./repositoryTypes";
import { ApplicationRepositoryError } from "./repositoryTypes";
import type {
  AddApplicationCoverLetterVersionInputV1,
  AddApplicationFeedbackInputV1,
  AddApplicationInterviewInputV1,
  AddApplicationNoteInputV1,
  ApplicationDeletionReceiptV1,
  ApplicationExportV1,
  ApplicationV1,
  CreateApplicationDraftInputV1,
  TransitionApplicationStatusInputV1,
  UpdateApplicationDraftInputV1,
} from "./contractTypes";
import { currentApplicationSessionGeneration } from "./sessionRepository";

const DEFAULT_BASE_URL = "/api/ris/applications";
const MAX_LIMIT = 100;

export interface RisRemoteRepositoryOptions {
  enabled: boolean;
  getAccessToken: () => string | null | Promise<string | null>;
  getOwnerId: () => string | null;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  now?: () => string;
  sessionGeneration?: number;
}

export interface RisRemoteApplicationRepository extends ApplicationPersistencePort {
  metrics(options?: ApplicationReadOptions): Promise<Record<string, unknown>>;
  invalidate(): void;
}

export function isRisRemoteStorageEnabled(
  env: Record<string, string | boolean | undefined> = import.meta.env as unknown as Record<string, string | boolean | undefined>
): boolean {
  return String(env.VITE_RIS_APPLICATION_STORAGE_ENABLED ?? "").toLowerCase() === "true";
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ris-${crypto.randomUUID()}`;
  }
  return `ris-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function unavailable(message: string): ApplicationRepositoryError {
  return new ApplicationRepositoryError(message, "unavailable");
}

function parseApplication(value: unknown): ApplicationV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw unavailable("RIS returned an invalid application");
  }
  const app = value as Partial<ApplicationV1>;
  const job = app.job as ApplicationV1["job"] | undefined;
  if (
    app.schemaVersion !== 1 ||
    typeof app.applicationId !== "string" ||
    typeof app.ownerId !== "string" ||
    typeof app.status !== "string" ||
    typeof app.version !== "number" ||
    !job ||
    typeof job.jobId !== "string" ||
    !Array.isArray(job.location) ||
    !Array.isArray(job.source)
  ) {
    throw unavailable("RIS returned an incomplete application");
  }
  return {
    ...(app as ApplicationV1),
    statusHistory: Array.isArray(app.statusHistory) ? app.statusHistory : [],
    history: Array.isArray(app.history) ? app.history : [],
  };
}

function parseEnvelope(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw unavailable("RIS returned an invalid response");
  }
  return (payload as Record<string, unknown>)[key];
}

function assertNotes(input: { notes?: string }): void {
  if (input.notes !== undefined && input.notes.length > 10000) {
    throw new ApplicationRepositoryError("notes must not exceed 10000 characters", "validation_error");
  }
}

function assertExpectedVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new ApplicationRepositoryError("expectedVersion is required", "validation_error");
  }
}

function mapHttpError(status: number, payload: unknown): ApplicationRepositoryError {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const code = typeof body.code === "string" ? body.code : "";
  const message = typeof body.error === "string" ? body.error : "RIS request failed";

  if (status === 401) return new ApplicationRepositoryError(message, "unauthorized");
  if (status === 403) return new ApplicationRepositoryError(message, "forbidden");
  if (status === 404) return new ApplicationRepositoryError(message, "not_found");
  if (status === 409) {
    if (code === "version_conflict") return new ApplicationRepositoryError(message, "version_conflict");
    if (code === "idempotency_conflict") {
      return new ApplicationRepositoryError(message, "idempotency_conflict");
    }
    return new ApplicationRepositoryError(message, "conflict");
  }
  if (status === 400 || status === 422) {
    return new ApplicationRepositoryError(message, "validation_error");
  }
  return unavailable(message);
}

export function createRisApplicationRepository(
  options: RisRemoteRepositoryOptions
): RisRemoteApplicationRepository {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  if (!baseUrl.startsWith("/") || baseUrl.startsWith("//")) {
    throw new Error("RIS remote base URL must be a same-origin path");
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? defaultNow;
  const generation = options.sessionGeneration ?? currentApplicationSessionGeneration();
  const controllers = new Set<AbortController>();
  let invalidated = false;

  const sessionEnded = () =>
    new ApplicationRepositoryError("The application session has ended", "session_ended");

  const assertActive = (): void => {
    if (invalidated || generation !== currentApplicationSessionGeneration()) {
      throw sessionEnded();
    }
  };

  const assertEnabled = (): void => {
    if (!options.enabled) throw unavailable("RIS remote storage is disabled");
  };

  const invalidate = (): void => {
    invalidated = true;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  };

  async function request(
    path: string,
    init: { method: string; body?: unknown; headers?: Record<string, string> },
    signal?: AbortSignal
  ): Promise<unknown> {
    assertEnabled();
    assertActive();

    const token = await options.getAccessToken();
    if (!token) throw new ApplicationRepositoryError("Authentication is required", "unauthorized");
    assertActive();

    const controller = new AbortController();
    controllers.add(controller);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });

      let payload: unknown = null;
      if (response.status !== 204) {
        payload = await response.json().catch(() => null);
      }

      if (invalidated || generation !== currentApplicationSessionGeneration()) {
        throw sessionEnded();
      }
      if (!response.ok) throw mapHttpError(response.status, payload);
      return payload;
    } catch (error) {
      if (invalidated || generation !== currentApplicationSessionGeneration()) {
        throw sessionEnded();
      }
      if (error instanceof ApplicationRepositoryError) throw error;
      if (signal?.aborted) throw new ApplicationRepositoryError("Request was aborted", "aborted");
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApplicationRepositoryError("Request was aborted", "aborted");
      }
      throw unavailable("RIS is unavailable");
    } finally {
      controllers.delete(controller);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  const repository: RisRemoteApplicationRepository = {
    async list(listOptions: ApplicationListOptions = {}): Promise<ApplicationPageV1> {
      const params = new URLSearchParams();
      const limit = Math.min(Math.max(listOptions.limit ?? 50, 1), MAX_LIMIT);
      params.set("limit", String(limit));
      if (listOptions.cursor) params.set("cursor", listOptions.cursor);
      if (listOptions.status) params.set("status", listOptions.status);
      const payload = await request(`?${params.toString()}`, { method: "GET" }, listOptions.signal);
      const items = payload && typeof payload === "object" ? (payload as Record<string, unknown>).items : null;
      const nextCursor =
        payload && typeof payload === "object" ? (payload as Record<string, unknown>).nextCursor : null;
      if (!Array.isArray(items)) throw unavailable("RIS returned an invalid application list");
      return {
        items: items.map(parseApplication),
        nextCursor: typeof nextCursor === "string" ? nextCursor : null,
      };
    },

    async get(applicationId: string, readOptions: ApplicationReadOptions = {}): Promise<ApplicationV1> {
      const payload = await request(
        `?id=${encodeURIComponent(applicationId)}`,
        { method: "GET" },
        readOptions.signal
      );
      return parseApplication(parseEnvelope(payload, "application"));
    },

    async create(
      input: CreateApplicationDraftInputV1,
      createOptions: ApplicationReadOptions & { idempotencyKey?: string } = {}
    ): Promise<ApplicationV1> {
      assertNotes(input);
      const payload = await request(
        "",
        {
          method: "POST",
          body: input,
          headers: { "Idempotency-Key": createOptions.idempotencyKey ?? defaultIdempotencyKey() },
        },
        createOptions.signal
      );
      return parseApplication(parseEnvelope(payload, "application"));
    },

    async update(
      applicationId: string,
      input: UpdateApplicationDraftInputV1,
      readOptions: ApplicationReadOptions = {}
    ): Promise<ApplicationV1> {
      assertNotes(input);
      assertExpectedVersion(input.expectedVersion);
      const payload = await request(
        `?id=${encodeURIComponent(applicationId)}`,
        { method: "PATCH", body: input },
        readOptions.signal
      );
      return parseApplication(parseEnvelope(payload, "application"));
    },

    async transitionStatus(
      applicationId: string,
      input: TransitionApplicationStatusInputV1,
      readOptions: ApplicationReadOptions = {}
    ): Promise<ApplicationV1> {
      assertExpectedVersion(input.expectedVersion);
      const payload = await request(
        `?id=${encodeURIComponent(applicationId)}&action=status`,
        {
          method: "POST",
          body: {
            status: input.to,
            expectedVersion: input.expectedVersion,
            confirmed: input.confirmed === true,
            ...(input.note ? { note: input.note } : {}),
          },
        },
        readOptions.signal
      );
      return parseApplication(parseEnvelope(payload, "application"));
    },

    async addFeedback(
      _applicationId: string,
      _input: AddApplicationFeedbackInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw unavailable("RIS history responses are not part of the 01C adapter contract");
    },

    async addInterview(
      _applicationId: string,
      _input: AddApplicationInterviewInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw unavailable("RIS history responses are not part of the 01C adapter contract");
    },

    async addNote(
      _applicationId: string,
      _input: AddApplicationNoteInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw unavailable("RIS history responses are not part of the 01C adapter contract");
    },

    async addCoverLetterVersion(
      _applicationId: string,
      _input: AddApplicationCoverLetterVersionInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw unavailable("RIS cover-letter responses are not part of the 01C adapter contract");
    },

    async export(
      applicationId: string,
      readOptions: ApplicationReadOptions = {}
    ): Promise<ApplicationExportV1> {
      const payload = await request(
        `?id=${encodeURIComponent(applicationId)}&action=export`,
        { method: "GET" },
        readOptions.signal
      );
      return {
        schemaVersion: 1,
        exportedAt: now(),
        application: parseApplication(parseEnvelope(payload, "application")),
      };
    },

    async delete(
      applicationId: string,
      expectedVersion: number,
      readOptions: ApplicationReadOptions = {}
    ): Promise<ApplicationDeletionReceiptV1> {
      assertActive();
      assertExpectedVersion(expectedVersion);
      const ownerId = options.getOwnerId();
      if (!ownerId) throw new ApplicationRepositoryError("Authentication is required", "unauthorized");
      const payload = await request(
        `?id=${encodeURIComponent(applicationId)}`,
        { method: "DELETE", body: { expectedVersion } },
        readOptions.signal
      );
      const deleted =
        payload && typeof payload === "object" && (payload as Record<string, unknown>).deleted === true;
      if (!deleted) throw unavailable("RIS did not confirm the deletion");
      return {
        schemaVersion: 1,
        applicationId,
        ownerId,
        deletedAt: now(),
      };
    },

    async metrics(readOptions: ApplicationReadOptions = {}): Promise<Record<string, unknown>> {
      const payload = await request("?action=metrics", { method: "GET" }, readOptions.signal);
      const metrics =
        payload && typeof payload === "object" ? (payload as Record<string, unknown>).metrics : null;
      if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
        throw unavailable("RIS returned invalid metrics");
      }
      return metrics as Record<string, unknown>;
    },

    invalidate,
  };

  return repository;
}
