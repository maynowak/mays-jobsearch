import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PersistentCvStorageState } from "./usePersistentCvStorage";
import { useCvBuilderPdfRisStorage } from "./useCvBuilderPdfRisStorage";

function storage(upload: PersistentCvStorageState["upload"]): PersistentCvStorageState {
  return {
    enabled: true,
    loading: false,
    consentLoading: false,
    busy: false,
    documents: [],
    consent: {
      consent: { status: "GRANTED" },
    } as PersistentCvStorageState["consent"],
    error: null,
    notice: null,
    refresh: vi.fn(),
    upload,
    download: vi.fn(),
    remove: vi.fn(),
    grantConsent: vi.fn(),
    withdrawConsent: vi.fn(),
  } as unknown as PersistentCvStorageState;
}

describe("useCvBuilderPdfRisStorage", () => {
  it("does not start an upload from an old callback after identity change", async () => {
    const upload = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
      ({ identityKey }) => useCvBuilderPdfRisStorage(storage(upload), true, identityKey),
      { initialProps: { identityKey: "issuer|user-a" } }
    );
    const oldSave = result.current.save;
    rerender({ identityKey: "issuer|user-b" });

    const file = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });
    await expect(oldSave(file)).resolves.toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("does not report success when the identity changes during upload", async () => {
    let resolveUpload!: (value: boolean) => void;
    const upload = vi.fn(
      () => new Promise<boolean>((resolve) => { resolveUpload = resolve; })
    );
    const { result, rerender } = renderHook(
      ({ identityKey }) => useCvBuilderPdfRisStorage(storage(upload), true, identityKey),
      { initialProps: { identityKey: "issuer|user-a" } }
    );

    expect(result.current.status).toBe("available");
    const file = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });
    let saveResult: Promise<boolean>;
    act(() => {
      saveResult = result.current.save(file);
    });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));

    rerender({ identityKey: "issuer|user-b" });
    resolveUpload(true);

    await expect(saveResult!).resolves.toBe(false);
  });
});
