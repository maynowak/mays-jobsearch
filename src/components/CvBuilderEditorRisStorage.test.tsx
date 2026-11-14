import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import { MAX_CV_FILE_SIZE_BYTES } from "../lib/cvFileValidation";
import type { CvBuilderPdfRisStatus } from "../lib/useCvBuilderPdfRisStorage";
import CvBuilderEditor from "./CvBuilderEditor";
import {
  createEmptyCvBuilderDraft,
  type CvBuilderDraftV1,
} from "../lib/cvBuilder/contractTypes";

const pdfMocks = vi.hoisted(() => ({
  createCvBuilderPdf: vi.fn(),
  downloadCvBuilderPdf: vi.fn(),
  cvBuilderFileName: vi.fn(() => "Lebenslauf-Alex-Beispiel.pdf"),
}));

vi.mock("../lib/cvBuilder/pdfExport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/cvBuilder/pdfExport")>();
  return {
    ...actual,
    createCvBuilderPdf: pdfMocks.createCvBuilderPdf,
    downloadCvBuilderPdf: pdfMocks.downloadCvBuilderPdf,
    cvBuilderFileName: pdfMocks.cvBuilderFileName,
  };
});

function validDraft(): CvBuilderDraftV1 {
  const draft = createEmptyCvBuilderDraft();
  draft.personal = { fullName: "Alex Beispiel", email: "alex@example.invalid" };
  draft.profile = { headline: "Frontend Entwicklerin" };
  return draft;
}

function Harness({
  initial = validDraft(),
  status = "available",
  onSave,
  layoutMode = "modal",
}: {
  initial?: CvBuilderDraftV1;
  status?: CvBuilderPdfRisStatus;
  onSave?: (file: File) => Promise<boolean>;
  layoutMode?: "modal" | "fullpage";
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <LangProvider>
      <CvBuilderEditor
        draft={draft}
        onChange={setDraft}
        onClose={vi.fn()}
        layoutMode={layoutMode}
        onSavePdfToRis={onSave}
        pdfRisStatus={status}
      />
    </LangProvider>
  );
}

function saveButton() {
  return screen.getByRole("button", { name: "In RIS speichern" });
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  pdfMocks.createCvBuilderPdf.mockReset();
  pdfMocks.downloadCvBuilderPdf.mockReset();
  pdfMocks.cvBuilderFileName.mockClear();
  pdfMocks.createCvBuilderPdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
  pdfMocks.cvBuilderFileName.mockReturnValue("Lebenslauf-Alex-Beispiel.pdf");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("CV builder PDF snapshot to existing RIS CV storage", () => {
  it("passes a valid builder PDF as a PDF File with the existing filename", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness onSave={onSave} />);

    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const file = onSave.mock.calls[0][0] as File;
    expect(file.name).toBe("Lebenslauf-Alex-Beispiel.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBe(3);
    expect(pdfMocks.createCvBuilderPdf).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("PDF wurde in RIS gespeichert.")).toBeInTheDocument();
  });

  it("keeps the existing PDF download independent and unchanged", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Als PDF herunterladen" }));

    await waitFor(() =>
      expect(pdfMocks.downloadCvBuilderPdf).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3]),
        "Lebenslauf-Alex-Beispiel.pdf"
      )
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("invokes the upload callback only once while the save is in flight", async () => {
    let resolveSave!: (value: boolean) => void;
    const onSave = vi.fn(
      () => new Promise<boolean>((resolve) => { resolveSave = resolve; })
    );
    render(<Harness onSave={onSave} />);

    const button = saveButton();
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    resolveSave(true);
    await screen.findByText("PDF wurde in RIS gespeichert.");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows no success message when the upload fails", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<Harness onSave={onSave} />);

    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das PDF konnte nicht in RIS gespeichert werden."
    );
    expect(screen.queryByText("PDF wurde in RIS gespeichert.")).not.toBeInTheDocument();
  });

  it("blocks missing consent before calling the upload", () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness status="consent-required" onSave={onSave} />);

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Vor dem Hochladen ist die CV-Speicherfreigabe erforderlich.")).toBeInTheDocument();
    fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks unauthenticated users", () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness status="unauthenticated" onSave={onSave} />);

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Bitte melde dich an, um das PDF dauerhaft zu speichern.")).toBeInTheDocument();
  });

  it("blocks disabled storage", () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness status="unavailable" onSave={onSave} />);

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("CV-Speicherung ist nicht verfügbar.")).toBeInTheDocument();
  });

  it("blocks at the 10/10 capacity boundary", () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness status="capacity" onSave={onSave} />);

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/Maximal 10 dauerhaft gespeicherte Lebensläufe/)).toBeInTheDocument();
  });

  it("rejects a generated PDF larger than 10 MB", async () => {
    pdfMocks.createCvBuilderPdf.mockResolvedValue(
      new Uint8Array(MAX_CV_FILE_SIZE_BYTES + 1)
    );
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness onSave={onSave} />);

    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das PDF überschreitet das Limit von 10 MB."
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects an empty generated PDF", async () => {
    pdfMocks.createCvBuilderPdf.mockResolvedValue(new Uint8Array([]));
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness onSave={onSave} />);

    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das erzeugte PDF ist leer."
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("renders the same guarded action in the fullpage editor", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness layoutMode="fullpage" onSave={onSave} />);

    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("PDF wurde in RIS gespeichert.")).toBeInTheDocument();
  });

  it("does not offer the action when no storage callback is provided", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "In RIS speichern" })).not.toBeInTheDocument();
  });
});
