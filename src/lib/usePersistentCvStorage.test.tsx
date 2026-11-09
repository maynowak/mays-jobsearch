import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePersistentCvStorage } from "./usePersistentCvStorage";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

function readyCv() {
  return {
    cvId: "cv-1",
    filename: "Lebenslauf.pdf",
    contentType: "application/pdf",
    processingStatus: "ready",
    sizeBytes: 2048,
    documentId: "doc-1",
    createdAt: "2026-11-08T10:00:00Z",
    updatedAt: "2026-11-08T10:00:00Z",
    version: 2,
  };
}

function consentState() {
  return {
    consent: {
      purpose: "cv-storage",
      status: "GRANTED",
      noticeVersion: "1.0",
      grantedAt: "2026-11-08T10:00:00Z",
      withdrawnAt: null,
      version: 1,
      specialCategoriesConsent: true,
      specialCategories: ["health"],
      externalTextVersion: "cv-storage-consent-2026-11-08-v1",
      externalTextSha256: "test",
    },
    noticeVersion: "1.0",
    noticeState: "DRAFT",
    noticeApproved: false,
    acceptedForNewGrant: true,
    grantAllowed: true,
    noticeReason: null,
    textVersion: "cv-storage-consent-2026-11-08-v1",
    textHash: "test",
    textState: "APPROVED",
    textMapped: true,
    textApproved: true,
    textReason: null,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let documents: ReturnType<typeof readyCv>[];
let completeStarted: boolean;

beforeEach(() => {
  documents = [];
  completeStarted = false;
  fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = String(init.method ?? "GET").toUpperCase();
    if (url.includes("/api/ris/cv-consents")) {
      if (url.includes("action=withdraw")) {
        return jsonResponse(200, { consent: { ...consentState().consent, status: "WITHDRAWN" } });
      }
      return jsonResponse(200, consentState());
    }
    if (url.includes("action=document")) {
      return jsonResponse(200, { downloadUrl: "https://s3.example/get" });
    }
    if (url.includes("/api/ris/cvs?") && method === "GET") {
      return jsonResponse(200, { items: documents, nextCursor: null });
    }
    if (url.endsWith("/api/ris/cvs") && method === "POST") {
      return jsonResponse(201, {
        cvId: "cv-1", filename: "Lebenslauf.pdf", processingStatus: "pending",
        createdAt: "2026-11-08T10:00:00Z", updatedAt: "2026-11-08T10:00:00Z", version: 1,
      });
    }
    if (url.includes("action=upload")) {
      return jsonResponse(200, {
        cvId: "cv-1", documentId: "doc-1", uploadUrl: "https://s3.example/put",
        expiresAt: "2026-11-08T10:15:00Z", requiredHeaders: { "Content-Type": "application/pdf" },
      });
    }
    if (url === "https://s3.example/put") {
      return jsonResponse(200, {});
    }
    if (url.includes("action=complete")) {
      completeStarted = true;
      documents = [readyCv()];
      return jsonResponse(200, readyCv());
    }
    if (url.includes("/api/ris/cvs?id=cv-1") && method === "DELETE") {
      documents = [];
      return jsonResponse(200, { cvId: "cv-1", deleted: true, physicalPurge: false });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePersistentCvStorage", () => {
  it("loads consent and the durable CV list, uploads, downloads and deletes", async () => {
    const { result } = renderHook(() => usePersistentCvStorage("token", true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.consent?.consent?.status).toBe("GRANTED");
    expect(result.current.documents).toEqual([]);
    const listCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/ris/cvs?limit="));
    expect(String(listCall?.[0])).toContain("limit=50");

    expect(result.current.documents).toEqual([]);

    const file = new File([new Uint8Array([1, 2, 3])], "Lebenslauf.pdf", { type: "application/pdf" });
    let uploaded = false;
    await act(async () => { uploaded = await result.current.upload(file); });
    expect(uploaded).toBe(true);
    expect(completeStarted).toBe(true);
    await waitFor(() => expect(result.current.documents).toHaveLength(1));
    expect(result.current.documents[0].filename).toBe("Lebenslauf.pdf");

    await act(async () => { await result.current.download("cv-1"); });
    expect(window.open).toHaveBeenCalledWith("https://s3.example/get", "_blank", "noopener,noreferrer");

    let removed = false;
    await act(async () => { removed = await result.current.remove("cv-1"); });
    expect(removed).toBe(true);
    await waitFor(() => expect(result.current.documents).toHaveLength(0));
  });

  it("does not upload without an explicit GRANTED consent", async () => {
    const { result } = renderHook(() => usePersistentCvStorage("", false));
    const file = new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" });
    await act(async () => {
      expect(await result.current.upload(file)).toBe(false);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a retryable timeout message instead of a generic outage", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/ris/cv-consents")) return jsonResponse(200, consentState());
      if (url.includes("/api/ris/cvs?")) {
        return jsonResponse(503, { error: "RIS is unavailable", code: "unavailable" });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const { result } = renderHook(() => usePersistentCvStorage("token", true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain("nicht rechtzeitig");
  });
});
