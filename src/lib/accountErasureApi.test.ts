import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountErasureApiError, requestAccountErasure } from "./accountErasureApi";

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("accountErasureApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts to the existing BFF route and returns the lifecycle report", async () => {
    const fetchMock = vi.fn(async () => response(207, {
      complete: false,
      searchProfilesDeleted: 3,
      documentsDeleted: 0,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestAccountErasure("token");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/ris/erasure");
    expect(init.method).toBe("POST");
    expect(result.searchProfilesDeleted).toBe(3);
  });

  it("surfaces the server error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(503, {
      error: "disabled",
      code: "account_erasure_disabled",
    })));
    await expect(requestAccountErasure("token")).rejects.toBeInstanceOf(AccountErasureApiError);
  });
});
