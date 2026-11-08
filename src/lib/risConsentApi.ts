/**
 * Client for the Jobsearch BFF consent route (/api/ris/consents).
 *
 * The browser never sees the partner credential and never chooses the notice
 * version: both are owned by the server.
 */

export type RisConsentStatus = "NOT_GRANTED" | "GRANTED" | "WITHDRAWN";

export interface RisConsent {
  purpose: "application-storage";
  status: RisConsentStatus;
  noticeVersion: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
  version: number;
  specialCategoriesConsent: boolean;
  specialCategories: string[];
  externalTextVersion: string | null;
  externalTextSha256: string | null;
}

export interface RisConsentState {
  consent: RisConsent | null;
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
  textReason: string | null;
  specialCategoriesConsent: boolean;
  specialCategories: string[];
  externalTextVersion: string | null;
  externalTextSha256: string | null;
}

export class RisConsentApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "RisConsentApiError";
    this.status = status;
    this.code = code;
  }
}

const PATH = "/api/ris/consents";

async function request<T>(token: string, init: RequestInit, search = ""): Promise<T> {
  const response = await fetch(PATH + search, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new RisConsentApiError(
      payload?.error ?? "consent_request_failed",
      response.status,
      payload?.code
    );
  }
  return payload as T;
}

function mapConsent(value: RisConsent | null | undefined): RisConsent | null {
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

function mappedConsent(value: RisConsent | null | undefined): RisConsent {
  const mapped = mapConsent(value);
  if (!mapped) throw new RisConsentApiError("consent_missing", 502, "consent_missing");
  return mapped;
}

export async function fetchRisConsent(token: string): Promise<RisConsentState> {
  const data = await request<{
    consent: RisConsent | null;
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
    textReason?: string | null;
    specialCategoriesConsent?: boolean;
    specialCategories?: string[];
    externalTextVersion?: string | null;
    externalTextSha256?: string | null;
  }>(token, { method: "GET" });
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
    textReason: data.textReason ?? null,
    specialCategoriesConsent: data.specialCategoriesConsent === true,
    specialCategories: Array.isArray(data.specialCategories)
      ? data.specialCategories.filter((entry): entry is string => typeof entry === "string")
      : [],
    externalTextVersion: typeof data.externalTextVersion === "string"
      ? data.externalTextVersion : null,
    externalTextSha256: typeof data.externalTextSha256 === "string"
      ? data.externalTextSha256 : null,
  };
}

export async function grantRisConsent(
  token: string,
  specialCategoriesConsent: boolean
): Promise<RisConsent> {
  const data = await request<{ consent: RisConsent }>(token, {
    method: "POST",
    body: JSON.stringify({
      purpose: "application-storage",
      specialCategoriesConsent: specialCategoriesConsent === true,
    }),
  });
  return mappedConsent(data.consent);
}

export async function withdrawRisConsent(token: string): Promise<RisConsent> {
  const data = await request<{ consent: RisConsent }>(token, {
    method: "POST",
    body: JSON.stringify({ purpose: "application-storage" }),
  }, "?action=withdraw");
  return mappedConsent(data.consent);
}

export async function fetchRisConsentHistory(token: string): Promise<Array<Record<string, unknown>>> {
  const data = await request<{ items: Array<Record<string, unknown>> }>(token, {
    method: "GET",
  }, "?action=history");
  return data.items ?? [];
}
