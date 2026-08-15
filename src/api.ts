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

export function isModelUnavailable(err: unknown): boolean {
  return err instanceof ApiError && err.code === "model_unavailable";
}

export interface FallbackResult<T> {
  data: T;
  usedFallback: boolean;
}

function fallbackOrder(
  initial: string | null,
  available: string[],
  recommended: string | null
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

  return order.slice(0, 3);
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
  request: (model: string | null) => Promise<T>;
}): Promise<FallbackResult<T>> {
  const order = fallbackOrder(initialModel, availableModels, recommendedModel);
  let lastError: unknown = null;
  let attempt = 0;

  for (const model of order) {
    attempt += 1;
    try {
      const data = await request(model);
      if (attempt > 1) {
        console.warn("[model] fallback attempt", attempt - 1, "succeeded with model:", model);
      }
      return { data, usedFallback: attempt > 1 };
    } catch (err) {
      if (!isModelUnavailable(err)) throw err;
      lastError = err;
      if (attempt < order.length) {
        console.warn("[model] model unavailable, fallback attempt", attempt + 1);
      }
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
      data.error || `Something went wrong (HTTP ${res.status}).`,
      res.status,
      data.code
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
  model?: string | null
): Promise<MatchResponse> {
  return apiFetch<MatchResponse>("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  hash?: string
): Promise<SuggestedProfile> {
  return apiFetch<SuggestedProfile>("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...(hash ? { hash } : {}), ...(model ? { model } : {}) }),
  });
}

export async function generateCoverLetter(
  profile: Profile,
  job: Job,
  prepareQuestion: string,
  language: string = "English",
  model?: string | null
): Promise<string> {
  const data = await apiFetch<{ letter: string }>("/api/cover-letter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
