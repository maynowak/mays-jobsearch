// Browser-side client for the Jobsearch BFF (/api/ris). The RIS partner
// credential never appears here; only the caller's access token is forwarded.

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
} from "../contractTypes";
import type {
  ApplicationListOptions,
  ApplicationMetricsV1,
  ApplicationPageV1,
  ApplicationPersistencePort,
  ApplicationReadOptions,
  ApplicationRepositoryErrorCode,
} from "../repositoryTypes";
import { ApplicationRepositoryError } from "../repositoryTypes";
import {
  mapRisExport,
  mapRisToApplicationV1,
  toRisCreateBody,
  toRisUpdateBody,
  type RisApplicationPayload,
} from "./risMapping";

export interface RisPersistenceOptions {
  basePath?: string;
  getAccessToken: () => string | null | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface RisErrorBody {
  error?: unknown;
  code?: unknown;
}

const CODE_MAP: Record<string, ApplicationRepositoryErrorCode> = {
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  not_found: "not_found",
  version_conflict: "version_conflict",
  idempotency_conflict: "idempotency_conflict",
  validation_error: "validation_error",
  capacity_exceeded: "capacity_exceeded",
  unavailable: "unavailable",
  conflict: "conflict",
  unsupported: "unsupported",
};

function mapHttpError(status: number, body: RisErrorBody): ApplicationRepositoryError {
  const raw = typeof body.code === "string" ? body.code.toLowerCase() : "";
  if (CODE_MAP[raw]) return new ApplicationRepositoryError("RIS application request failed", CODE_MAP[raw]);
  if (status === 401) return new ApplicationRepositoryError("Please sign in again.", "unauthorized");
  if (status === 403) return new ApplicationRepositoryError("Forbidden", "forbidden");
  if (status === 404) return new ApplicationRepositoryError("Not found", "not_found");
  if (status === 409) return new ApplicationRepositoryError("Conflict", "conflict");
  if (status === 422) return new ApplicationRepositoryError("Invalid application data", "validation_error");
  if (status === 429) return new ApplicationRepositoryError("Too many requests", "capacity_exceeded");
  return new ApplicationRepositoryError("Application service unavailable", "unavailable");
}

export function createRisApplicationPersistencePort(
  options: RisPersistenceOptions
): ApplicationPersistencePort {
  const basePath = (options.basePath ?? "/api/ris").replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 15000);

  async function request<T>(
    path: string,
    init: RequestInit = {},
    signal?: AbortSignal
  ): Promise<T> {
    const token = options.getAccessToken();
    if (!token) {
      throw new ApplicationRepositoryError("Please sign in again.", "unauthorized");
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const response = await fetchImpl(basePath + path, {
        ...init,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
        credentials: "same-origin",
      });

      if (response.status === 204) {
        return undefined as T;
      }

      let body: unknown = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }

      if (!response.ok) {
        throw mapHttpError(response.status, body as RisErrorBody);
      }
      return body as T;
    } catch (err) {
      if (err instanceof ApplicationRepositoryError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApplicationRepositoryError(
          timedOut ? "Application service timed out" : "Request cancelled",
          timedOut ? "unavailable" : "aborted"
        );
      }
      throw new ApplicationRepositoryError("Application service unavailable", "unavailable");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  function query(options: ApplicationListOptions): string {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.status) params.set("status", options.status.toUpperCase());
    const value = params.toString();
    return value ? `?${value}` : "";
  }

  return {
    async list(listOptions: ApplicationListOptions = {}): Promise<ApplicationPageV1> {
      const data = await request<{ items?: RisApplicationPayload[]; nextCursor?: string | null }>(
        `/applications${query(listOptions)}`,
        { method: "GET" },
        listOptions.signal
      );
      return {
        items: Array.isArray(data.items) ? data.items.map(mapRisToApplicationV1) : [],
        nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
      };
    },

    async metrics(metricsOptions?: ApplicationReadOptions): Promise<ApplicationMetricsV1> {
      const data = await request<{ metrics?: ApplicationMetricsV1 }>(
        "/applications/metrics",
        { method: "GET" },
        metricsOptions?.signal
      );
      const metrics = data?.metrics;
      return {
        total: Number(metrics?.total ?? 0),
        drafts: Number(metrics?.drafts ?? 0),
        submitted: Number(metrics?.submitted ?? 0),
        interviews: Number(metrics?.interviews ?? 0),
        openFollowUps: Number(metrics?.openFollowUps ?? 0),
        overdueFollowUps: Number(metrics?.overdueFollowUps ?? 0),
      };
    },

    async get(applicationId: string, readOptions?: ApplicationReadOptions): Promise<ApplicationV1> {
      const data = await request<RisApplicationPayload>(
        `/applications/${encodeURIComponent(applicationId)}`,
        { method: "GET" },
        readOptions?.signal
      );
      return mapRisToApplicationV1(data);
    },

    async create(
      input: CreateApplicationDraftInputV1,
      createOptions?: ApplicationReadOptions & { idempotencyKey?: string }
    ): Promise<ApplicationV1> {
      const data = await request<RisApplicationPayload>(
        "/applications",
        {
          method: "POST",
          body: JSON.stringify(toRisCreateBody(input, createOptions?.idempotencyKey)),
        },
        createOptions?.signal
      );
      return mapRisToApplicationV1(data);
    },

    async update(
      applicationId: string,
      input: UpdateApplicationDraftInputV1,
      updateOptions?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      const data = await request<RisApplicationPayload>(
        `/applications/${encodeURIComponent(applicationId)}`,
        { method: "PATCH", body: JSON.stringify(toRisUpdateBody(input)) },
        updateOptions?.signal
      );
      return mapRisToApplicationV1(data);
    },

    async transitionStatus(
      _applicationId: string,
      _input: TransitionApplicationStatusInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw new ApplicationRepositoryError(
        "Status transitions are not supported by the current RIS integration.",
        "unsupported"
      );
    },

    async addFeedback(
      _applicationId: string,
      _input: AddApplicationFeedbackInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw new ApplicationRepositoryError(
        "Feedback history is not supported by the current RIS integration.",
        "unsupported"
      );
    },

    async addInterview(
      _applicationId: string,
      _input: AddApplicationInterviewInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw new ApplicationRepositoryError(
        "Interview history is not supported by the current RIS integration.",
        "unsupported"
      );
    },

    async addNote(
      _applicationId: string,
      _input: AddApplicationNoteInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw new ApplicationRepositoryError(
        "Application notes are not supported by the current RIS integration.",
        "unsupported"
      );
    },

    async addCoverLetterVersion(
      _applicationId: string,
      _input: AddApplicationCoverLetterVersionInputV1,
      _options?: ApplicationReadOptions
    ): Promise<ApplicationV1> {
      throw new ApplicationRepositoryError(
        "Cover-letter versions are not supported by the current RIS integration.",
        "unsupported"
      );
    },

    async export(
      applicationId: string,
      exportOptions?: ApplicationReadOptions
    ): Promise<ApplicationExportV1> {
      const data = await request<{ application?: RisApplicationPayload; exportedAt?: string } | RisApplicationPayload>(
        `/applications/${encodeURIComponent(applicationId)}/export`,
        { method: "GET" },
        exportOptions?.signal
      );
      return mapRisExport(data);
    },

    async delete(
      applicationId: string,
      expectedVersion: number,
      deleteOptions?: ApplicationReadOptions
    ): Promise<ApplicationDeletionReceiptV1> {
      await request<void>(
        `/applications/${encodeURIComponent(applicationId)}`,
        { method: "DELETE", body: JSON.stringify({ expectedVersion }) },
        deleteOptions?.signal
      );
      return {
        schemaVersion: 1,
        applicationId,
        ownerId: "",
        deletedAt: new Date().toISOString(),
      };
    },
  };
}
