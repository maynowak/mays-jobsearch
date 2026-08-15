import type {
  Job,
  JobsResponse,
  MatchResponse,
  ModelsResponse,
  Profile,
  SuggestedProfile,
} from "./types";

export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);

const NON_TRANSIENT_CODES = new Set([
  "bad_request",
  "method",
  "unauthorized",
  "model_invalid",
  "model_not_free",
  "key_invalid",
  "insufficient_credits",
  "missing_key",
  "missing_config",
  "bad_ai_response",
  "text_too_long",
  "missing_text",
  "models_unavailable",
  "internal",
  "error",
]);

export function isModelUnavailable(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.code === "model_unavailable") return true;
    if (
      err.status &&
      TRANSIENT_STATUSES.has(err.status) &&
      !(err.code && NON_TRANSIENT_CODES.has(err.code))
    ) {
      return true;
    }
    return false;
  }
  return (
    err instanceof Error &&
    (err.name === "TypeError" || err.name === "TimeoutError" || err.name === "AbortError")
  );
}

export interface FallbackResult<T> {
  data: T;
  usedFallback: boolean;
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return `status=${err.status ?? "-"} code=${err.code ?? "-"}`;
  }
  if (err instanceof Error) return err.name;
  return String(err);
}

let fallbackMaxAttempts = 3;

export function setFallbackMaxAttempts(limit: number) {
  if (Number.isFinite(limit) && limit > 0) {
    fallbackMaxAttempts = Math.floor(limit);
  }
}

function fallbackOrder(
  initial: string | null,
  available: string[],
  recommended: string | null,
  maxAttempts = fallbackMaxAttempts
): (string | null)[] {
  const seen = new Set<string>();
  const order: (string | null)[] = [];

  if (initial) {
    order.push(initial);
    seen.add(initial);
  }
  if (recommended && !seen.has(recommended)) {
    order.push(recommended);
    seen.add(recommended);
  }
  for (const id of available) {
    if (id && !seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  if (order.length === 0) order.push(null);

  return order.slice(0, Math.max(1, maxAttempts));
}

export async function withModelFallback<T>({
  initialModel,
  availableModels,
  recommendedModel,
  request,
}: {
  initialModel: string | null;
  availableModels: string[];
  recommendedModel: string | null;
  request: (model: string | null, attempt: number) => Promise<T>;
}): Promise<FallbackResult<T>> {
  const order = fallbackOrder(initialModel, availableModels, recommendedModel);
  let lastError: unknown = null;
  let attempt = 0;

  for (const model of order) {
    attempt += 1;
    try {
      const data = await request(model, attempt);
      if (attempt > 1) {
        console.warn(
          `[model] attempt=${attempt} model=${model ?? "(none)"} succeeded (fallback used)`
        );
      }
      return { data, usedFallback: attempt > 1 };
    } catch (err) {
      if (!isModelUnavailable(err)) throw err;
      lastError = err;
      console.warn(
        `[model] attempt=${attempt} model=${model ?? "(none)"} unavailable (${describeError(err)}); ` +
          `${attempt < order.length ? `trying fallback attempt=${attempt + 1}` : "no more fallbacks left"}`
      );
    }
  }

  throw lastError;
}

export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  let data: { error?: string; code?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* noop */
  }
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : `Something went wrong (HTTP ${res.status}).`,
      res.status,
      typeof data.code === "string" ? data.code : undefined
    );
  }
  return data as T;
}

export async function fetchJobs(profile: Profile): Promise<JobsResponse> {
  const params = new URLSearchParams();
  if (profile.skills) params.set("skills", profile.skills);
  if (profile.targetRole) params.set("targetRole", profile.targetRole);
  if (profile.city) params.set("city", profile.city);
  return apiFetch<JobsResponse>(`/api/jobs?${params.toString()}`);
}

export async function fetchMatches(
  profile: Profile,
  jobs: Job[],
  model?: string | null,
  attempt?: number
): Promise<MatchResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (attempt && attempt > 1) headers["x-mj-attempt"] = String(attempt);
  return apiFetch<MatchResponse>("/api/match", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...profile, jobs, ...(model ? { model } : {}) }),
  });
}

export async function fetchModels(): Promise<ModelsResponse> {
  return apiFetch<ModelsResponse>("/api/models");
}

export async function fetchModel(): Promise<string> {
  const data = await apiFetch<{ model: string }>("/api/model");
  return data.model;
}

export async function createProfile(
  text: string,
  model?: string | null,
  hash?: string,
  attempt?: number
): Promise<SuggestedProfile> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (attempt && attempt > 1) headers["x-mj-attempt"] = String(attempt);
  return apiFetch<SuggestedProfile>("/api/profile", {
    method: "POST",
    headers,
    body: JSON.stringify({ text, ...(hash ? { hash } : {}), ...(model ? { model } : {}) }),
  });
}

export async function generateCoverLetter(
  profile: Profile,
  job: Job,
  prepareQuestion: string,
  language: string = "English",
  model?: string | null,
  attempt?: number
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (attempt && attempt > 1) headers["x-mj-attempt"] = String(attempt);
  const data = await apiFetch<{ letter: string }>("/api/cover-letter", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...profile, job, prepareQuestion, language, ...(model ? { model } : {}) }),
  });
  return data.letter;
}

export async function subscribeAlert(email: string, profile: Profile): Promise<string> {
  const data = await apiFetch<{ message: string }>("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ...profile }),
  });
  return data.message;
}

export async function unsubscribeAlert(email: string): Promise<string> {
  const data = await apiFetch<{ message: string }>("/api/alerts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return data.message;
}
