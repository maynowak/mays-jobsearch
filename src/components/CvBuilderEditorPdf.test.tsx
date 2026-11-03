import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
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
  draft.personal = {
    fullName: "Alex Beispiel",
    email: "alex@example.invalid",
  };
  draft.profile = { headline: "Frontend Entwicklerin" };
  return draft;
}

function Harness({ initial = validDraft() }: { initial?: CvBuilderDraftV1 }) {
  const [draft, setDraft] = useState(initial);
  return (
    <LangProvider>
      <CvBuilderEditor draft={draft} onChange={setDraft} onClose={vi.fn()} />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  pdfMocks.createCvBuilderPdf.mockReset();
  pdfMocks.downloadCvBuilderPdf.mockReset();
  pdfMocks.cvBuilderFileName.mockClear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("CV-BUILDER-01C editor export", () => {
  it("exports the validated draft and selected template with the current language", async () => {
    pdfMocks.createCvBuilderPdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Modern" }));
    fireEvent.click(screen.getByRole("button", { name: "Als PDF herunterladen" }));

    await waitFor(() => expect(pdfMocks.createCvBuilderPdf).toHaveBeenCalledTimes(1));
    expect(pdfMocks.createCvBuilderPdf.mock.calls[0][1]).toBe("modern");
    expect(pdfMocks.createCvBuilderPdf.mock.calls[0][2]).toEqual({ language: "de" });
    await waitFor(() =>
      expect(pdfMocks.downloadCvBuilderPdf).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3]),
        "Lebenslauf-Alex-Beispiel.pdf"
      )
    );
    expect(await screen.findByText("PDF wurde erstellt.")).toBeInTheDocument();
  });

  it("disables export for an empty draft", () => {
    render(<Harness initial={createEmptyCvBuilderDraft()} />);
    expect(screen.getByRole("button", { name: "Als PDF herunterladen" })).toBeDisabled();
  });

  it("disables export while the draft has validation errors", () => {
    const draft = validDraft();
    draft.personal.email = "invalid";
    render(<Harness initial={draft} />);
    expect(screen.getByRole("button", { name: "Als PDF herunterladen" })).toBeDisabled();
  });

  it("shows a safe error message when PDF generation fails", async () => {
    pdfMocks.createCvBuilderPdf.mockRejectedValue(new Error("synthetic failure"));
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Als PDF herunterladen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das PDF konnte nicht erstellt werden."
    );
    expect(pdfMocks.downloadCvBuilderPdf).not.toHaveBeenCalled();
  });
});
