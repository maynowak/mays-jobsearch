import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import { MAX_CV_FILE_SIZE_BYTES } from "../lib/cvFileValidation";
import type { CvBuilderPdfRisStatus } from "../lib/useCvBuilderPdfRisStorage";
import CvBuilderEditor from "./CvBuilderEditor";
import {
  createEmptyCvBuilderDraft,
  createExperienceEntry,
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
  return screen.getByRole("button", { name: "PDF dauerhaft speichern" });
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
    expect(await screen.findByText("PDF wurde dauerhaft gespeichert.")).toBeInTheDocument();
  });

  it("keeps the existing PDF download independent and unchanged", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "PDF herunterladen" }));

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
    await screen.findByText("PDF wurde dauerhaft gespeichert.");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows no success message when the upload fails", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<Harness onSave={onSave} />);

    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Das PDF konnte nicht dauerhaft gespeichert werden. Bitte versuche es erneut."
    );
    expect(screen.queryByText("PDF wurde dauerhaft gespeichert.")).not.toBeInTheDocument();
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
    expect(await screen.findByText("PDF wurde dauerhaft gespeichert.")).toBeInTheDocument();
  });

  it("does not offer the action when no storage callback is provided", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "PDF dauerhaft speichern" })).not.toBeInTheDocument();
  });
});

describe("CV builder save blocker UX", () => {
  it("keeps upload blocked for an invalid draft and explains the affected section", () => {
    const draft = validDraft();
    draft.personal.email = "invalid";
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness initial={draft} onSave={onSave} />);

    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveAttribute(
      "title",
      "PDF dauerhaft speichern ist erst möglich, wenn die markierten Felder korrigiert sind."
    );
    expect(screen.getByText("Betroffene Abschnitte: Persönliche Angaben")).toBeInTheDocument();
    expect(
      screen.getByText(
        "PDF-Export und RIS-Speicherung sind erst nach Korrektur der markierten Felder möglich."
      )
    ).toBeInTheDocument();
    fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(["modal", "fullpage"] as const)(
    "opens the first affected section and focuses its field in %s mode",
    async (layoutMode) => {
      const draft = validDraft();
      draft.personal.email = "invalid";
      render(<Harness initial={draft} layoutMode={layoutMode} />);

      fireEvent.click(screen.getByRole("button", { name: "Zum ersten Fehler" }));

      const email = screen.getByLabelText("E-Mail");
      await waitFor(() => expect(email).toHaveFocus());
      const details = document.querySelector("#cv-builder-personal details");
      expect(details).toHaveProperty("open", true);
      expect(email).toHaveAttribute("aria-invalid", "true");
    }
  );

  it("switches back from preview to edit before focusing the first error", async () => {
    const draft = validDraft();
    draft.personal.email = "invalid";
    render(<Harness initial={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "Vorschau" }));
    expect(document.querySelector(".cv-builder-workspace")).toHaveAttribute("data-view", "preview");

    fireEvent.click(screen.getByRole("button", { name: "Zum ersten Fehler" }));

    expect(document.querySelector(".cv-builder-workspace")).toHaveAttribute("data-view", "edit");
    await waitFor(() => expect(screen.getByLabelText("E-Mail")).toHaveFocus());
  });

  it("focuses the offending entry field instead of only the section", async () => {
    const draft = validDraft();
    draft.experience = [
      {
        ...createExperienceEntry(),
        position: "Entwicklerin",
        employer: "",
      },
    ];
    render(<Harness initial={draft} />);

    expect(screen.getByText("Betroffene Abschnitte: Berufserfahrung")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zum ersten Fehler" }));

    const employer = screen.getByLabelText("Arbeitgeber");
    await waitFor(() => expect(employer).toHaveFocus());
    expect(document.querySelector("#cv-builder-experience details")).toHaveProperty("open", true);
  });

  it("focuses the shared skills field for a duplicate-skill error", async () => {
    const draft = validDraft();
    draft.skills = ["React", "react"];
    render(<Harness initial={draft} />);

    expect(screen.getByText("Betroffene Abschnitte: Fähigkeiten")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zum ersten Fehler" }));

    const skills = document.getElementById("cv-builder-field-skills") as HTMLTextAreaElement;
    await waitFor(() => expect(skills).toHaveFocus());
    expect(document.querySelector("#cv-builder-skills details")).toHaveProperty("open", true);
  });

  it("re-enables saving after the invalid field is corrected", async () => {
    const draft = validDraft();
    draft.personal.email = "invalid";
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness initial={draft} onSave={onSave} />);
    expect(saveButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("E-Mail"), {
      target: { value: "alex@example.invalid" },
    });

    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("PDF wurde dauerhaft gespeichert.")).toBeInTheDocument();
  });
});

describe("JM-CV-UX-02 save action labels and states", () => {
  it("uses distinct labels and a prominent primary storage action", () => {
    render(<Harness onSave={vi.fn().mockResolvedValue(true)} />);

    const storage = saveButton();
    expect(storage).toHaveTextContent("PDF dauerhaft speichern");
    expect(storage).toHaveClass("cv-builder-save-ris");
    expect(storage.querySelector(".cv-builder-save-ris__icon")).toBeTruthy();

    const download = screen.getByRole("button", { name: "PDF herunterladen" });
    expect(download).not.toHaveClass("cv-builder-save-ris");
    expect(download).toHaveTextContent("PDF herunterladen");
    expect(screen.getByText("Noch nicht dauerhaft gespeichert.")).toBeInTheDocument();
  });

  it("shows a loading state and prevents a second save while PDF storage is in flight", async () => {
    let resolveSave!: (value: boolean) => void;
    const onSave = vi.fn(
      () => new Promise<boolean>((resolve) => { resolveSave = resolve; })
    );
    render(<Harness onSave={onSave} />);

    const button = document.querySelector(".cv-builder-save-ris") as HTMLButtonElement;
    fireEvent.click(button);

    expect(button).toHaveClass("is-loading");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".cv-builder-save-ris__spinner")).toBeTruthy();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);

    resolveSave(true);
    await screen.findByText("PDF wurde dauerhaft gespeichert.");
    expect(button).not.toHaveClass("is-loading");
    expect(button).toHaveAttribute("aria-busy", "false");
  });

  it("shows the saved state only after confirmation and resets it after an edit", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Harness onSave={onSave} />);

    expect(screen.getByText("Noch nicht dauerhaft gespeichert.")).toBeInTheDocument();
    fireEvent.click(saveButton());

    expect(await screen.findByText("PDF wurde dauerhaft gespeichert.")).toBeInTheDocument();
    expect(screen.queryByText("Noch nicht dauerhaft gespeichert.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("E-Mail"), {
      target: { value: "neu@example.invalid" },
    });

    expect(await screen.findByText("Noch nicht dauerhaft gespeichert.")).toBeInTheDocument();
  });

  it("provides the English labels and banner consistently", () => {
    localStorage.setItem("mj-lang", "en");
    render(<Harness onSave={vi.fn().mockResolvedValue(true)} />);

    expect(screen.getByRole("button", { name: "Save PDF permanently" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByText(/Your editable draft stays only in this session/)).toBeInTheDocument();
    expect(
      screen.getByText(/“Download PDF” creates the file locally/)
    ).toBeInTheDocument();
  });
});
