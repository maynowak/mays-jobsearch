import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import PersistentCvList from "./PersistentCvList";
import type { CvConsentState, PersistentCv } from "../lib/cvStorageApi";

function consent(status: "NOT_GRANTED" | "GRANTED" | "WITHDRAWN"): CvConsentState {
  return {
    consent: {
      purpose: "cv-storage",
      status,
      noticeVersion: "1.0",
      grantedAt: null,
      withdrawnAt: null,
      version: 1,
      specialCategoriesConsent: false,
      specialCategories: [],
      externalTextVersion: null,
      externalTextSha256: null,
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
    specialCategoriesConsent: false,
    specialCategories: [],
    externalTextVersion: null,
    externalTextSha256: null,
  };
}

function cv(overrides: Partial<PersistentCv> = {}): PersistentCv {
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
    ...overrides,
  };
}

function renderList(overrides: Record<string, unknown> = {}) {
  return render(
    <LangProvider>
      <PersistentCvList
        documents={[cv()]}
        consent={consent("GRANTED")}
        loading={false}
        consentLoading={false}
        busy={false}
        error={null}
        notice={null}
        onUpload={vi.fn(async () => true)}
        onDownload={vi.fn(async () => undefined)}
        onDelete={vi.fn(async () => true)}
        onGrantConsent={vi.fn(async () => true)}
        onWithdrawConsent={vi.fn(async () => true)}
        {...overrides}
      />
    </LangProvider>
  );
}

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("PersistentCvList", () => {
  it("shows a granted consent, storage status, download and delete", async () => {
    const onDownload = vi.fn(async () => undefined);
    const onDelete = vi.fn(async () => true);
    renderList({ onDownload, onDelete });

    expect(screen.getByText("Dauerhaft gespeicherte Lebensläufe")).toBeInTheDocument();
    expect(screen.getAllByText("Dauerhaft gespeichert").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Herunterladen" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Herunterladen" }));
    await waitFor(() => expect(onDownload).toHaveBeenCalledWith("cv-1"));

    fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
    fireEvent.click(screen.getByRole("button", { name: "Dauerhaft löschen" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("cv-1"));
  });

  it("requires the explicit consent checkbox before granting", () => {
    const onGrantConsent = vi.fn(async () => true);
    renderList({ consent: consent("NOT_GRANTED"), onGrantConsent });

    const button = screen.getByRole("button", { name: "CV-Speicherfreigabe erteilen" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onGrantConsent).toHaveBeenCalled();
  });

  it("rejects an empty PDF before any BFF upload", async () => {
    const onUpload = vi.fn(async () => true);
    const { container } = renderList({ onUpload });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const empty = new File([], "leer.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [empty] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/leer \(0 Byte\)/);
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("aligns the durable CV capacity with the Jobsearch limit of 10", () => {
    const documents = Array.from({ length: 10 }, (_, index) =>
      cv({ cvId: `cv-${index}`, filename: `Lebenslauf-${index}.pdf` })
    );
    renderList({ documents });
    expect(screen.getByText(/Maximal 10 dauerhaft gespeicherte Lebensläufe/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lebenslauf dauerhaft hochladen" })).toBeDisabled();
  });

  it("processes a ready durable CV through the existing workflow handoff", async () => {
    const onProcess = vi.fn(async () => undefined);
    renderList({ onProcess });

    fireEvent.click(screen.getByRole("button", { name: "Verarbeiten Lebenslauf.pdf" }));
    await waitFor(() => expect(onProcess).toHaveBeenCalledWith(cv()));
    expect(await screen.findByText("In den bestehenden CV-Workflow übernommen.")).toBeInTheDocument();
  });

  it("shows a retry action when loading the durable CV fails", async () => {
    const onProcess = vi.fn()
      .mockRejectedValueOnce(new Error("Download fehlgeschlagen"))
      .mockResolvedValueOnce(undefined);
    renderList({ onProcess });

    fireEvent.click(screen.getByRole("button", { name: "Verarbeiten Lebenslauf.pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Download fehlgeschlagen");
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(onProcess).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("In den bestehenden CV-Workflow übernommen.")).toBeInTheDocument();
  });

  it("disables download until the upload is ready", () => {
    renderList({ documents: [cv({ processingStatus: "pending", sizeBytes: undefined })] });
    expect(screen.getByText("Upload ausstehend")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Herunterladen" })).toBeDisabled();
  });
});

  it("shows RIS profile counts from the provided loader", async () => {
    const onLoadProfileCounts = vi.fn(async () => ({ searchProfiles: 2, atsProfiles: 3 }));
    renderList({ onLoadProfileCounts });

    await waitFor(() => expect(onLoadProfileCounts).toHaveBeenCalledWith("cv-1"));
    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });
