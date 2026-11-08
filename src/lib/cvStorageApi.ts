/**
 * Browser client for the RIS CV document BFF.
 *
 * The browser never sees the RIS partner credential, S3 credentials, tenant or
 * user identity. Uploads use the short-lived presigned PUT returned by the BFF;
 * the actual PDF bytes never pass through the BFF.
 */

export const MAX_PERSISTENT_CVS = 10;

export type CvProcessingStatus = "pending" | "ready" | "failed" | "deleted";
export type CvConsentStatus = "NOT_GRANTED" | "GRANTED" | "WITHDRAWN";

export interface PersistentCv {
  cvId: string;
  filename: string;
  contentType?: "application/pdf";
  processingStatus: CvProcessingStatus;
  sizeBytes?: number;
  documentId?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  metadata?: { pageCount?: number; language?: string };
}

export interface CvConsent {
  purpose: "cv-storage";
  status: CvConsentStatus;
  noticeVersion: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
  version: number;
  specialCategoriesConsent: boolean;
  specialCategories: string[];
  externalTextVersion: string | null;
  externalTextSha256: string | null;
}

export interface CvConsentState {
  consent: CvConsent | null;
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

export interface CvUploadTicket {
  cvId: string;
  documentId: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export class CvStorageApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "CvStorageApiError";
    this.status = status;
    this.code = code;
  }
}

const CV_PATH = "/api/ris/cvs";
const CONSENT_PATH = "/api/ris/cv-consents";

export function isRisCvStorageEnabled(): boolean {
  return import.meta.env.VITE_RIS_CV_STORAGE_ENABLED === "true";
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
    throw new CvStorageApiError(
      payload?.error ?? "cv_storage_request_failed",
      response.status,
      payload?.code
    );
  }
  return payload as T;
}

function mapConsent(value: CvConsent | null | undefined): CvConsent | null {
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

export async function listCvDocuments(
  token: string,
  cursor?: string
): Promise<{ items: PersistentCv[]; nextCursor: string | null }> {
  const search = new URLSearchParams({ limit: "50" });
  if (cursor) search.set("cursor", cursor);
  return request<{ items: PersistentCv[]; nextCursor: string | null }>(
    `${CV_PATH}?${search.toString()}`,
    token,
    { method: "GET" }
  );
}

export async function createCvDocument(
  token: string,
  input: { filename: string; contentType?: "application/pdf"; metadata?: { pageCount?: number; language?: string } }
): Promise<PersistentCv> {
  const data = await request<{ cvId: string; filename: string; processingStatus: CvProcessingStatus; createdAt: string; updatedAt: string; version: number }>(
    CV_PATH,
    token,
    { method: "POST", body: JSON.stringify({ ...input, contentType: "application/pdf" }) }
  );
  return {
    ...data,
    contentType: "application/pdf",
  } as PersistentCv;
}

export async function requestCvUpload(
  token: string,
  cvId: string,
  contentType: "application/pdf" = "application/pdf"
): Promise<CvUploadTicket> {
  return request<CvUploadTicket>(
    `${CV_PATH}?id=${encodeURIComponent(cvId)}&action=upload`,
    token,
    { method: "POST", body: JSON.stringify({ contentType }) }
  );
}

export async function uploadCvBytes(ticket: CvUploadTicket, file: File): Promise<void> {
  const response = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: {
      ...ticket.requiredHeaders,
      "Content-Type": file.type || "application/pdf",
    },
    body: file,
  });
  if (!response.ok) {
    throw new CvStorageApiError("CV upload failed", response.status, "upload_failed");
  }
}

export async function completeCvUpload(
  token: string,
  cvId: string,
  documentId: string
): Promise<PersistentCv> {
  return request<PersistentCv>(
    `${CV_PATH}?id=${encodeURIComponent(cvId)}&action=complete`,
    token,
    { method: "POST", body: JSON.stringify({ documentId }) }
  );
}

export async function getCvDownloadUrl(token: string, cvId: string): Promise<string> {
  const data = await request<{ downloadUrl: string }>(
    `${CV_PATH}?id=${encodeURIComponent(cvId)}&action=document`,
    token,
    { method: "GET" }
  );
  if (typeof data?.downloadUrl !== "string" || !data.downloadUrl) {
    throw new CvStorageApiError("CV download URL is missing", 502, "invalid_download");
  }
  return data.downloadUrl;
}

export async function deleteCvDocument(token: string, cvId: string): Promise<void> {
  await request<Record<string, unknown>>(
    `${CV_PATH}?id=${encodeURIComponent(cvId)}`,
    token,
    { method: "DELETE" }
  );
}

export async function renameCvDocument(
  token: string,
  cvId: string,
  filename: string,
  expectedVersion: number
): Promise<PersistentCv> {
  return request<PersistentCv>(
    `${CV_PATH}?id=${encodeURIComponent(cvId)}`,
    token,
    { method: "PATCH", body: JSON.stringify({ filename, expectedVersion }) }
  );
}

export async function fetchCvConsent(token: string): Promise<CvConsentState> {
  const data = await request<{
    consent: CvConsent | null;
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
    textReason: data.textReason ?? null,
    specialCategoriesConsent: data.specialCategoriesConsent === true,
    specialCategories: Array.isArray(data.specialCategories)
      ? data.specialCategories.filter((entry): entry is string => typeof entry === "string")
      : [],
    externalTextVersion: data.externalTextVersion ?? null,
    externalTextSha256: data.externalTextSha256 ?? null,
  };
}

export async function grantCvConsent(token: string): Promise<CvConsent> {
  const data = await request<{ consent: CvConsent }>(CONSENT_PATH, token, {
    method: "POST",
    body: JSON.stringify({ purpose: "cv-storage", specialCategoriesConsent: true }),
  });
  const mapped = mapConsent(data.consent);
  if (!mapped) throw new CvStorageApiError("Consent response is missing", 502, "consent_missing");
  return mapped;
}

export async function withdrawCvConsent(token: string): Promise<CvConsent> {
  const data = await request<{ consent: CvConsent }>(`${CONSENT_PATH}?action=withdraw`, token, {
    method: "POST",
    body: JSON.stringify({ purpose: "cv-storage" }),
  });
  const mapped = mapConsent(data.consent);
  if (!mapped) throw new CvStorageApiError("Consent response is missing", 502, "consent_missing");
  return mapped;
}
