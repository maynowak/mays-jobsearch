import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderImportDialog from "./CvBuilderImportDialog";
import { extractPdfText } from "../lib/pdf";
import type { PersistentCv } from "../lib/cvStorageApi";

vi.mock("../lib/pdf", () => ({ extractPdfText: vi.fn() }));

const pdfText = `Max Mustermann
E-Mail: max@example.com
Ort: Berlin

Profil
Senior Frontend Engineer
Barrierefreie React-Anwendungen.

Berufserfahrung
Acme GmbH
Senior Frontend Engineer
Jan 2020 – Present
- React

Fähigkeiten
React, TypeScript

Sprachen
Deutsch (Muttersprache)`;

const cv: PersistentCv = {
  cvId: "cv-1",
  filename: "Lebenslauf.pdf",
  contentType: "application/pdf",
  processingStatus: "ready",
  sizeBytes: 2048,
  createdAt: "2026-11-10T10:00:00Z",
  updatedAt: "2026-11-10T10:00:00Z",
  version: 1,
};

function file(name = "lebenslauf.pdf"): File {
  return new File(["synthetic"], name, { type: "application/pdf" });
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof CvBuilderImportDialog>> = {}) {
  return render(
    <LangProvider>
      <CvBuilderImportDialog
        open
        onClose={vi.fn()}
        onCreateEmpty={vi.fn()}
        risAvailable={false}
        persistentCvs={[]}
        onDownloadRis={vi.fn(async () => file())}
        onImported={vi.fn()}
        {...overrides}
      />
    </LangProvider>
  );
}

async function chooseLocal(container: HTMLElement, name = "lebenslauf.pdf") {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file(name)] } });
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  vi.mocked(extractPdfText).mockReset();
  vi.mocked(extractPdfText).mockResolvedValue(pdfText);
});
afterEach(() => cleanup());

describe("CvBuilderImportDialog", () => {
  it("imports a local PDF into a reviewed preview and transfers selected sections", async () => {
    const onImported = vi.fn();
    const { container } = renderDialog({ onImported });

    await chooseLocal(container);
    expect(await screen.findByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.")).toBeInTheDocument();
    expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText(/2 Kandidaten/)).toBeInTheDocument();
    expect(screen.getAllByText("Details anzeigen").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));

    expect(onImported).toHaveBeenCalledTimes(1);
    const draft = onImported.mock.calls[0][0];
    expect(draft.personal.fullName).toBe("Max Mustermann");
    expect(draft.experience).toHaveLength(1);
    expect(draft.skills).toEqual(["React", "TypeScript"]);
    expect(onImported.mock.calls[0][1]).toBe("lebenslauf");
  });

  it("can exclude a section before transfer", async () => {
    const onImported = vi.fn();
    const { container } = renderDialog({ onImported });
    await chooseLocal(container);
    await screen.findByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.");
    const skillsSection = screen.getByText("Fähigkeiten").closest("section") as HTMLElement;
    fireEvent.click(skillsSection.querySelector('input[type="checkbox"]') as HTMLInputElement);
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    expect(onImported.mock.calls[0][0].skills).toEqual([]);
  });

  it("uses a stored RIS CV through the existing download callback", async () => {
    const onDownloadRis = vi.fn(async () => file("RIS-Lebenslauf.pdf"));
    const onImported = vi.fn();
    renderDialog({ risAvailable: true, persistentCvs: [cv], onDownloadRis, onImported });

    fireEvent.click(screen.getByRole("button", { name: "Diesen Lebenslauf importieren" }));
    await waitFor(() => expect(onDownloadRis).toHaveBeenCalledWith(cv));
    await screen.findByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.");
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    expect(onImported.mock.calls[0][0].personal.fullName).toBe("Max Mustermann");
  });

  it("shows a clear error for a PDF without readable text", async () => {
    vi.mocked(extractPdfText).mockResolvedValue("");
    const { container } = renderDialog();
    await chooseLocal(container);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dieser Lebenslauf enthält keinen zuverlässig auslesbaren Text."
    );
  });

  it("shows a clear error for a password-protected PDF", async () => {
    vi.mocked(extractPdfText).mockRejectedValue(Object.assign(new Error("password"), { name: "PasswordException" }));
    const { container } = renderDialog();
    await chooseLocal(container);
    expect(await screen.findByRole("alert")).toHaveTextContent("passwortgeschützt");
  });

  it("rejects an invalid file before extraction", async () => {
    const { container } = renderDialog();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["text"], "note.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Bitte wähle eine PDF-Datei aus.");
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("shows a RIS download error without opening the preview", async () => {
    const onDownloadRis = vi.fn(async () => {
      const error = new Error("download_failed") as Error & { code: string };
      error.code = "download_failed";
      throw error;
    });
    renderDialog({ risAvailable: true, persistentCvs: [cv], onDownloadRis });
    fireEvent.click(screen.getByRole("button", { name: "Diesen Lebenslauf importieren" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("konnte nicht heruntergeladen werden");
    expect(screen.queryByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.")).toBeNull();
  });

  it("shows a session-ended error from a RIS download", async () => {
    const onDownloadRis = vi.fn(async () => {
      const error = new Error("session_ended") as Error & { code: string };
      error.code = "session_ended";
      throw error;
    });
    renderDialog({ risAvailable: true, persistentCvs: [cv], onDownloadRis });
    fireEvent.click(screen.getByRole("button", { name: "Diesen Lebenslauf importieren" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sitzung wurde beendet");
  });

  it("allows individual unassigned lines to be assigned to builder sections", async () => {
    vi.mocked(extractPdfText).mockResolvedValue(`Max Mustermann
E-Mail: max@example.com

Sonstiges
Zusätzliche Information`);
    const onImported = vi.fn();
    const { container } = renderDialog({ onImported });
    await chooseLocal(container);
    await screen.findByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.");
    const select = screen.getByRole("combobox", { name: /Zuordnen zu/ });
    fireEvent.change(select, { target: { value: "projects" } });
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onImported.mock.calls[0][0].projects[0].name).toBe("Zusätzliche Information");
    expect(onImported.mock.calls[0][0].profile.summary).toBeUndefined();
  });

  it("keeps the empty-CV path available without importing", () => {
    const onCreateEmpty = vi.fn();
    renderDialog({ onCreateEmpty });
    fireEvent.click(screen.getByRole("button", { name: "Leeren Lebenslauf erstellen" }));
    expect(onCreateEmpty).toHaveBeenCalledTimes(1);
  });
});
