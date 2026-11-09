/**
 * Browser client for the existing RIS account-erasure endpoint.
 *
 * The browser never sees the RIS credential or the kernel base URL. The BFF
 * forwards the verified access token to POST /me/erasure. This action is
 * disabled unless the operator explicitly enables it for the test identity.
 */

export interface AccountErasureResult {
  userId?: string;
  tenantId?: string | null;
  complete?: boolean;
  credentialsRevoked?: number;
  profilesRevoked?: number;
  workCancelled?: number;
  applicationsDeleted?: number;
  searchProfilesDeleted?: number;
  documentsDeleted?: number;
  profileDeleted?: boolean;
  steps?: Array<{ step?: string; ok?: boolean; affected?: number; error?: string | null }>;
}

export class AccountErasureApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "AccountErasureApiError";
    this.status = status;
    this.code = code;
  }
}

export function isRisAccountErasureEnabled(): boolean {
  return import.meta.env.VITE_RIS_ACCOUNT_ERASURE_ENABLED === "true";
}

export async function requestAccountErasure(token: string): Promise<AccountErasureResult> {
  const response = await fetch("/api/ris/erasure", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AccountErasureApiError(
      payload?.error ?? "account_erasure_request_failed",
      response.status,
      payload?.code,
    );
  }
  return (payload ?? {}) as AccountErasureResult;
}
