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

export async function createProfile(text: string, model?: string | null): Promise<SuggestedProfile> {
  return apiFetch<SuggestedProfile>("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...(model ? { model } : {}) }),
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
