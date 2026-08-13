import type { Job, JobsResponse, MatchResponse, Profile } from "./types";

export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  let data: { error?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* noop */
  }
  if (!res.ok) {
    throw new Error(data.error || `Something went wrong (HTTP ${res.status}).`);
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

export async function fetchMatches(profile: Profile, jobs: Job[]): Promise<MatchResponse> {
  return apiFetch<MatchResponse>("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...profile, jobs }),
  });
}

export async function fetchModel(): Promise<string> {
  const data = await apiFetch<{ model: string }>("/api/model");
  return data.model;
}

export async function generateCoverLetter(
  profile: Profile,
  job: Job,
  prepareQuestion: string,
  language: string = "English"
): Promise<string> {
  const data = await apiFetch<{ letter: string }>("/api/cover-letter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...profile, job, prepareQuestion, language }),
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
