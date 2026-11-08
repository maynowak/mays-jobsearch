/**
 * Browser client for the RIS search-profile BFF.
 *
 * One route (`/api/ris/search-profiles`) reuses the existing RIS contracts for
 * manual, CV-search and ATS profiles. The browser never sees the partner
 * credential, tenant/user identity or the consent notice version.
 *
 * Option A:
 * - manual profiles have no CV parent;
 * - CV-search profiles require a durable RIS `cvId`;
 * - ATS profiles require a durable CV-search-profile id;
 * - session CVs and their profiles never come through this client.
 */

import type {
  ATSSearchProfileV1,
  CVSearchProfileV1,
  CreateATSProfileInputV1,
  CreateCVSearchProfileInputV1,
  CreateManualSearchProfileInputV1,
  ManualSearchProfileV1,
  UpdateATSProfileInputV1,
  UpdateCVSearchProfileInputV1,
  UpdateManualSearchProfileInputV1,
} from "./profiles/contractTypes";

export type SearchProfileType = "manual" | "cv" | "ats";
export type SearchProfileConsentStatus = "NOT_GRANTED" | "GRANTED" | "WITHDRAWN";

export interface SearchProfileConsent {
  purpose: "search-profile-storage";
  status: SearchProfileConsentStatus;
  noticeVersion: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
  version: number;
  specialCategoriesConsent: boolean;
  specialCategories: string[];
  externalTextVersion: string | null;
  externalTextSha256: string | null;
}

export interface SearchProfileConsentState {
  consent: SearchProfileConsent | null;
  noticeVersion: string | null;
  noticeState: string | null;
  noticeApproved: boolean;
  acceptedForNewGrant: boolean;
  grantAllowed: boolean;
  noticeReason: string | null;
  textVersion: string | null;
  textHash: string | null;
  textState: string | null;
  textMapped: boolean;
  textApproved: boolean;
  textSyntheticAllowed: boolean;
  textReason: string | null;
  specialCategoriesConsent: boolean;
  specialCategories: string[];
  externalTextVersion: string | null;
  externalTextSha256: string | null;
}

export class SearchProfilesApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "SearchProfilesApiError";
    this.status = status;
    this.code = code;
  }
}

const PROFILES_PATH = "/api/ris/search-profiles";
const CONSENT_PATH = "/api/ris/search-profile-consents";

export function isRisSearchProfileStorageEnabled(): boolean {
  return import.meta.env.VITE_RIS_SEARCH_PROFILE_STORAGE_ENABLED === "true";
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SearchProfilesApiError(
      payload?.error ?? "search_profile_request_failed",
      response.status,
      payload?.code
    );
  }
  return payload as T;
}

function profilesQuery(type: SearchProfileType, ids: {
  id?: string;
  cvId?: string;
  searchProfileId?: string;
  cursor?: string;
  limit?: number;
} = {}): string {
  const params = new URLSearchParams({ type });
  if (ids.id) params.set("id", ids.id);
  if (ids.cvId) params.set("cvId", ids.cvId);
  if (ids.searchProfileId) params.set("searchProfileId", ids.searchProfileId);
  if (ids.cursor) params.set("cursor", ids.cursor);
  if (ids.limit !== undefined) params.set("limit", String(ids.limit));
  return `${PROFILES_PATH}?${params.toString()}`;
}

function listOf<T>(value: { items?: T[]; nextCursor?: string | null }): { items: T[]; nextCursor: string | null } {
  return {
    items: Array.isArray(value?.items) ? value.items : [],
    nextCursor: typeof value?.nextCursor === "string" ? value.nextCursor : null,
  };
}

export async function listManualSearchProfiles(token: string): Promise<ManualSearchProfileV1[]> {
  const data = await request<{ items?: ManualSearchProfileV1[] }>(
    profilesQuery("manual", { limit: 50 }), token, { method: "GET" }
  );
  return listOf(data).items;
}

export async function createManualSearchProfile(
  token: string,
  input: CreateManualSearchProfileInputV1
): Promise<ManualSearchProfileV1> {
  return request<ManualSearchProfileV1>(profilesQuery("manual"), token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateManualSearchProfile(
  token: string,
  id: string,
  input: UpdateManualSearchProfileInputV1
): Promise<ManualSearchProfileV1> {
  return request<ManualSearchProfileV1>(profilesQuery("manual", { id }), token, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteManualSearchProfile(token: string, id: string): Promise<void> {
  await request<Record<string, unknown>>(profilesQuery("manual", { id }), token, {
    method: "DELETE",
  });
}

export async function listCvSearchProfiles(token: string, cvId: string): Promise<CVSearchProfileV1[]> {
  const data = await request<{ items?: CVSearchProfileV1[] }>(
    profilesQuery("cv", { cvId, limit: 50 }), token, { method: "GET" }
  );
  return listOf(data).items;
}

export async function createCvSearchProfile(
  token: string,
  cvId: string,
  input: CreateCVSearchProfileInputV1
): Promise<CVSearchProfileV1> {
  return request<CVSearchProfileV1>(profilesQuery("cv", { cvId }), token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCvSearchProfile(
  token: string,
  cvId: string,
  id: string,
  input: UpdateCVSearchProfileInputV1
): Promise<CVSearchProfileV1> {
  return request<CVSearchProfileV1>(profilesQuery("cv", { cvId, id }), token, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteCvSearchProfile(token: string, cvId: string, id: string): Promise<void> {
  await request<Record<string, unknown>>(profilesQuery("cv", { cvId, id }), token, {
    method: "DELETE",
  });
}

export async function listAtsProfiles(
  token: string,
  searchProfileId: string
): Promise<ATSSearchProfileV1[]> {
  const data = await request<{ items?: ATSSearchProfileV1[] }>(
    profilesQuery("ats", { searchProfileId, limit: 50 }), token, { method: "GET" }
  );
  return listOf(data).items;
}

export async function createAtsProfile(
  token: string,
  searchProfileId: string,
  input: CreateATSProfileInputV1
): Promise<ATSSearchProfileV1> {
  return request<ATSSearchProfileV1>(profilesQuery("ats", { searchProfileId }), token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAtsProfile(
  token: string,
  searchProfileId: string,
  id: string,
  input: UpdateATSProfileInputV1
): Promise<ATSSearchProfileV1> {
  return request<ATSSearchProfileV1>(profilesQuery("ats", { searchProfileId, id }), token, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteAtsProfile(
  token: string,
  searchProfileId: string,
  id: string
): Promise<void> {
  await request<Record<string, unknown>>(profilesQuery("ats", { searchProfileId, id }), token, {
    method: "DELETE",
  });
}

function mapConsent(value: SearchProfileConsent | null | undefined): SearchProfileConsent | null {
  if (!value) return null;
  return {
    ...value,
    specialCategoriesConsent: value.specialCategoriesConsent === true,
    specialCategories: Array.isArray(value.specialCategories)
      ? value.specialCategories.filter((entry): entry is string => typeof entry === "string")
      : [],
    externalTextVersion: typeof value.externalTextVersion === "string"
      ? value.externalTextVersion : null,
    externalTextSha256: typeof value.externalTextSha256 === "string"
      ? value.externalTextSha256 : null,
  };
}

export async function fetchSearchProfileConsent(token: string): Promise<SearchProfileConsentState> {
  const data = await request<{
    consent: SearchProfileConsent | null;
    noticeVersion?: string | null;
    noticeState?: string | null;
    noticeApproved?: boolean;
    acceptedForNewGrant?: boolean;
    grantAllowed?: boolean;
    noticeReason?: string | null;
    textVersion?: string | null;
    textHash?: string | null;
    textState?: string | null;
    textMapped?: boolean;
    textApproved?: boolean;
    textSyntheticAllowed?: boolean;
    textReason?: string | null;
    specialCategoriesConsent?: boolean;
    specialCategories?: string[];
    externalTextVersion?: string | null;
    externalTextSha256?: string | null;
  }>(CONSENT_PATH, token, { method: "GET" });
  return {
    consent: mapConsent(data.consent),
    noticeVersion: data.noticeVersion ?? null,
    noticeState: data.noticeState ?? null,
    noticeApproved: data.noticeApproved === true,
    acceptedForNewGrant: data.acceptedForNewGrant === true,
    grantAllowed: data.grantAllowed === true,
    noticeReason: data.noticeReason ?? null,
    textVersion: data.textVersion ?? null,
    textHash: data.textHash ?? null,
    textState: data.textState ?? null,
    textMapped: data.textMapped === true,
    textApproved: data.textApproved === true,
    textSyntheticAllowed: data.textSyntheticAllowed === true,
    textReason: data.textReason ?? null,
    specialCategoriesConsent: data.specialCategoriesConsent === true,
    specialCategories: Array.isArray(data.specialCategories)
      ? data.specialCategories.filter((entry): entry is string => typeof entry === "string")
      : [],
    externalTextVersion: data.externalTextVersion ?? null,
    externalTextSha256: data.externalTextSha256 ?? null,
  };
}

export async function grantSearchProfileConsent(token: string): Promise<SearchProfileConsent> {
  const data = await request<{ consent: SearchProfileConsent }>(CONSENT_PATH, token, {
    method: "POST",
    body: JSON.stringify({ purpose: "search-profile-storage" }),
  });
  const mapped = mapConsent(data.consent);
  if (!mapped) throw new SearchProfilesApiError("Consent response is missing", 502, "consent_missing");
  return mapped;
}

export async function withdrawSearchProfileConsent(token: string): Promise<SearchProfileConsent> {
  const data = await request<{ consent: SearchProfileConsent }>(
    `${CONSENT_PATH}?action=withdraw`, token,
    { method: "POST", body: JSON.stringify({ purpose: "search-profile-storage" }) }
  );
  const mapped = mapConsent(data.consent);
  if (!mapped) throw new SearchProfilesApiError("Consent response is missing", 502, "consent_missing");
  return mapped;
}
