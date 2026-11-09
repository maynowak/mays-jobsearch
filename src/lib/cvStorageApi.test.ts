import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCvFile } from "./cvStorageApi";

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadCvFile", () => {
  it("uses the existing BFF download URL and returns a session File", async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/ris/cvs?")) {
        expect(url).toContain("action=document");
        return jsonResponse(200, { downloadUrl: "https://s3.example/get/cv-1" });
      }
      if (url === "https://s3.example/get/cv-1") {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob([pdfBytes], { type: "application/pdf" }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = await downloadCvFile("token", "cv-1", "Lebenslauf.pdf");
    expect(file.name).toBe("Lebenslauf.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBe(pdfBytes.length);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: "no-store", credentials: "omit" });
  });

  it("fails closed when the presigned download is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/ris/cvs?")) {
        return jsonResponse(200, { downloadUrl: "https://s3.example/empty" });
      }
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob([], { type: "application/pdf" }),
      } as unknown as Response;
    }));

    await expect(downloadCvFile("token", "cv-1", "leer.pdf")).rejects.toMatchObject({
      code: "download_empty",
    });
  });
});
