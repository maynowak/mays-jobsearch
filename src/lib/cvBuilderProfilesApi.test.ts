import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyCvBuilderDraft } from "./cvBuilder/contractTypes";
import {
  createStructuredCvProfile,
  deleteStructuredCvProfile,
  exportStructuredCvProfile,
  getStructuredCvConsentStatus,
  getStructuredCvProfile,
  isRisStructuredCvStorageEnabled,
  listStructuredCvProfiles,
  normalizeStructuredCvImportReview,
  updateStructuredCvProfile,
} from "./cvBuilderProfilesApi";

const PROFILE_ID = "cvp-12345678";

function jsonResponse(status: number, body: unknown, etag?: string): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    headers: { get: (name: string) => name.toLowerCase() === "etag" ? etag ?? null : null },
  } as unknown as Response;
}

function profile(version = 1) {
  return {
    schemaVersion: 1,
    profileId: PROFILE_ID,
    name: "Synthetic CV",
    template: "classic",
    cvData: createEmptyCvBuilderDraft(),
    version,
    createdAt: "2026-11-13T00:00:00Z",
    updatedAt: "2026-11-13T00:00:00Z",
  };
}

function reviewItems(count = 44) {
  return Array.from({ length: count }, (_, index) => ({
    id: `review-${index}`,
    index,
    text: `text ${index}`,
    original: `original ${index}`,
    edited: index % 3 === 0,
    target: "skills" as const,
    status: index % 2 === 0 ? "pending" as const : "accepted" as const,
    applied: index % 2 === 1,
    page: 1,
    sectionHeading: "Kenntnisse",
    reason: "ambiguous" as const,
    suggestedTarget: "skills" as const,
  }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("VITE_RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED", "true");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("structured CV browser client gating", () => {
  it("does not call RIS when the client flag is off", async () => {
    vi.stubEnv("VITE_RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED", "false");
    expect(isRisStructuredCvStorageEnabled()).toBe(false);
    await expect(listStructuredCvProfiles("token")).rejects.toMatchObject({
      code: "storage_disabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists profiles with bounded pagination", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [profile()], nextCursor: "next" }));
    const result = await listStructuredCvProfiles("token", { limit: 20, cursor: "cursor-1" });
    expect(result.nextCursor).toBe("next");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/ris/cv-builder-profiles?limit=20");
    expect(String(fetchMock.mock.calls[0][0])).toContain("cursor=cursor-1");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
  });

  it("preserves ETag and version on get", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, profile(3), '"v3"'));
    await expect(getStructuredCvProfile("token", PROFILE_ID)).resolves.toMatchObject({
      profile: { profileId: PROFILE_ID, version: 3 },
      etag: '"v3"',
    });
  });
});

describe("structured CV create/update safety", () => {
  it("sends the caller's idempotency key and returns the server profile id/ETag", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, profile(), '"v1"'));
    const result = await createStructuredCvProfile("token", {
      name: "Synthetic CV",
      template: "classic",
      cvData: createEmptyCvBuilderDraft(),
    }, { idempotencyKey: "idem-1234567890abcdef" });
    expect(result.profile.profileId).toBe(PROFILE_ID);
    expect(result.etag).toBe('"v1"');
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("idem-1234567890abcdef");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).profileId).toBeUndefined();
  });

  it("does not retry a timed-out create and lets the caller reuse the same key", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "AbortError"));
    await expect(createStructuredCvProfile("token", {
      name: "Synthetic CV", template: "classic", cvData: createEmptyCvBuilderDraft(),
    }, { idempotencyKey: "idem-timeout-123456" })).rejects.toMatchObject({ code: "aborted" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse(201, profile(), '"v1"'));
    await createStructuredCvProfile("token", {
      name: "Synthetic CV", template: "classic", cvData: createEmptyCvBuilderDraft(),
    }, { idempotencyKey: "idem-timeout-123456" });
    expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe("idem-timeout-123456");
  });

  it("sends If-Match and never overwrites on a 409", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: "conflict", code: "VERSION_CONFLICT" }));
    await expect(updateStructuredCvProfile("token", PROFILE_ID, {
      name: "Changed",
    }, { version: 2 })).rejects.toMatchObject({ code: "version_conflict" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers["If-Match"]).toBe('"v2"');
  });

  it("sends optional If-Match for delete and supports export", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));
    await deleteStructuredCvProfile("token", PROFILE_ID, { version: 4 });
    expect(fetchMock.mock.calls[0][1].headers["If-Match"]).toBe('"v4"');

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      schemaVersion: 1, exportedAt: "2026-11-13T00:00:00Z",
      source: "ris-structured-cv-profile", profile: profile(4),
    }));
    const exported = await exportStructuredCvProfile("token", PROFILE_ID);
    expect(exported.profile.version).toBe(4);
    expect(String(fetchMock.mock.calls[1][0])).toContain("action=export");
  });
});

describe("structured CV review DTO compatibility", () => {
  it("normalizes older missing applied/schemaVersion without dropping 44 items", () => {
    const review = {
      total: 44,
      pending: 22,
      accepted: 22,
      ignored: 0,
      items: reviewItems(44).map(({ applied: _applied, ...item }) => item),
    };
    const normalized = normalizeStructuredCvImportReview(review);
    expect(normalized?.schemaVersion).toBe(1);
    expect(normalized?.items).toHaveLength(44);
    expect(normalized?.items[0].applied).toBe(false);
    expect(normalized?.items[1].applied).toBe(false);
    expect(normalized?.items[1].status).toBe("accepted");
  });

  it("rejects counts-only review data instead of storing it as complete", () => {
    expect(() => normalizeStructuredCvImportReview({
      total: 44, pending: 44, accepted: 0, ignored: 0, items: [],
    })).toThrow(expect.objectContaining({ code: "import_review_incomplete" }));
  });

  it("preserves accepted/applied separation and text provenance", () => {
    const normalized = normalizeStructuredCvImportReview({
      items: reviewItems(2),
      total: 2,
      pending: 1,
      accepted: 1,
      ignored: 0,
    });
    expect(normalized?.items[0]).toMatchObject({
      status: "pending", applied: false, original: "original 0", edited: true,
    });
    expect(normalized?.items[1]).toMatchObject({
      status: "accepted", applied: true, original: "original 1",
    });
  });

  it("rejects oversized payloads before fetch", async () => {
    const draft = createEmptyCvBuilderDraft();
    draft.profile.summary = "x".repeat(300001);
    await expect(createStructuredCvProfile("token", {
      name: "Large", template: "classic", cvData: draft,
    }, { idempotencyKey: "idem-oversize-123456" })).rejects.toMatchObject({
      code: "payload_too_large",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps 403, 428 and 503 without retrying or exposing content", async () => {
    for (const [status, code] of [[403, "forbidden"], [428, "precondition_required"], [503, "storage_disabled"]]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(status, { error: "safe", code: "SAFE_CODE" }));
      await expect(getStructuredCvProfile("token", PROFILE_ID)).rejects.toMatchObject({ code, status });
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reads the technical consent status through the read-only BFF route", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      consent: null, noticeVersion: null, noticeState: "DRAFT", noticeApproved: false,
      acceptedForNewGrant: false, grantAllowed: false, noticeReason: "notice_version_not_mapped",
      textVersion: null, textHash: null, textState: "DRAFT", textMapped: false,
      textApproved: false, textReason: "consent_text_not_approved",
    }));
    const status = await getStructuredCvConsentStatus("token");
    expect(status.noticeState).toBe("DRAFT");
    expect(status.grantAllowed).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain("purpose=cv-builder-profile-storage");
  });
});
