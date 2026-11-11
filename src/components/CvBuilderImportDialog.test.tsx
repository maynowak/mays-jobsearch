import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByRole("heading", { name: "Deine Importauswahl" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auswahl übernehmen" }));

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
    const skillsSection = container.querySelector("#cv-import-section-skills") as HTMLElement;
    fireEvent.click(skillsSection.querySelector('input[type="checkbox"]') as HTMLInputElement);
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    fireEvent.click(screen.getByRole("button", { name: "Auswahl übernehmen" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Auswahl übernehmen" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    fireEvent.click(screen.getByRole("button", { name: "Auswahl übernehmen" }));
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onImported.mock.calls[0][0].projects[0].name).toBe("Zusätzliche Information");
    expect(onImported.mock.calls[0][0].profile.summary).toBeUndefined();
  });

  it("shows mapping provenance in English", async () => {
    localStorage.setItem("mj-lang", "en");
    vi.mocked(extractPdfText).mockResolvedValueOnce(`${pdfText}

Additional information
Additional detail`);
    const { container } = renderDialog();
    await chooseLocal(container);
    await screen.findByText("We found the following information in your CV.");
    expect(screen.getByText("Additional detail")).toBeInTheDocument();
    expect(screen.getByText(/p\. 1/)).toBeInTheDocument();
    expect(screen.getAllByText(/Unknown section/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Suggested: Do not use/).length).toBeGreaterThan(0);
  });

  it("keeps the empty-CV path available without importing", () => {
    const onCreateEmpty = vi.fn();
    renderDialog({ onCreateEmpty });
    fireEvent.click(screen.getByRole("button", { name: "Leeren Lebenslauf erstellen" }));
    expect(onCreateEmpty).toHaveBeenCalledTimes(1);
  });

  it('shows source, reason and suggestion for an unassigned line', async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce(`${pdfText}

Sonstiges
Zusätzliche Information`);
    const { container } = renderDialog();
    await chooseLocal(container);
    await screen.findByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.");
    expect(screen.getByText("Zusätzliche Information")).toBeInTheDocument();
    expect(screen.getByText(/S\. 1/)).toBeInTheDocument();
    expect(screen.getAllByText(/Unbekannter Abschnitt/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vorschlag: Nicht übernehmen/).length).toBeGreaterThan(0);
  });

  it("shows the compact overview and keeps review decisions across pages", async () => {
    const lines = Array.from({ length: 12 }, (_, index) => `Zusatz ${index + 1}`).join("\n");
    vi.mocked(extractPdfText).mockResolvedValueOnce(`${pdfText}

Sonstiges
${lines}`);
    const { container } = renderDialog();
    await chooseLocal(container);
    expect(await screen.findByRole("heading", { name: "Lebenslauf analysiert" })).toBeInTheDocument();
    expect(screen.getAllByText(/Zusatz \d+/).length).toBe(10);
    expect(screen.getByText("Seite 1 von 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("Zusatz 12")).toBeInTheDocument();
    expect(screen.getByText("Seite 2 von 2")).toBeInTheDocument();
    const pagination = screen.getByRole("navigation", { name: "Prüfseiten" });
    fireEvent.click(within(pagination).getByRole("button", { name: "Zurück" }));
    expect(screen.getByText("Zusatz 1")).toBeInTheDocument();
  });

  it("supports explicit correction and mapping before summary", async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce(`${pdfText}

Sonstiges
Unklare Angabe`);
    const onImported = vi.fn();
    const { container } = renderDialog({ onImported });
    await chooseLocal(container);
    await screen.findByRole("heading", { name: "Lebenslauf analysiert" });
    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Korrigierter Text" }), {
      target: { value: "Korrigiertes Projekt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Korrektur übernehmen" }));
    const select = screen.getByRole("combobox", { name: /Zuordnen zu/ });
    fireEvent.change(select, { target: { value: "projects" } });
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    fireEvent.click(screen.getByRole("button", { name: "Auswahl übernehmen" }));
    expect(onImported.mock.calls[0][0].projects[0].name).toBe("Korrigiertes Projekt");
  });

  it("keeps large skill lists unselected until the user chooses", async () => {
    const skills = Array.from({ length: 67 }, (_, index) => `Skill ${index + 1}`).join(", ");
    vi.mocked(extractPdfText).mockResolvedValueOnce(`Max Mustermann
E-Mail: max@example.com

Fähigkeiten
${skills}`);
    const onImported = vi.fn();
    const { container } = renderDialog({ onImported });
    await chooseLocal(container);
    await screen.findByRole("heading", { name: "Lebenslauf analysiert" });
    expect(screen.getByText("0 von 67 ausgewählt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alle auswählen" }));
    expect(screen.getByText("67 von 67 ausgewählt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auswahl zurücksetzen" }));
    expect(screen.getByText("0 von 67 ausgewählt")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Skill 1"));
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    fireEvent.click(screen.getByRole("button", { name: "Auswahl übernehmen" }));
    expect(onImported.mock.calls[0][0].skills).toEqual(["Skill 1"]);
  });

  it("requires explicit acknowledgement when pending review items remain", async () => {
    vi.mocked(extractPdfText).mockResolvedValueOnce(`${pdfText}

Sonstiges
Offene Angabe`);
    const onImported = vi.fn();
    const { container } = renderDialog({ onImported });
    await chooseLocal(container);
    await screen.findByRole("heading", { name: "Lebenslauf analysiert" });
    fireEvent.click(screen.getByRole("button", { name: "Angaben übernehmen" }));
    const apply = screen.getByRole("button", { name: "Auswahl übernehmen" });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Ich lasse 1 ungeprüfte Angaben vorerst aus/ }));
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onImported.mock.calls[0][0].profile.summary ?? "").not.toContain("Offene Angabe");
  });


  it("keeps review decisions and page context when filtering 55 items", async () => {
    const lines = Array.from({ length: 55 }, (_, index) => `Prüfzeile ${index + 1}`).join("\n");
    vi.mocked(extractPdfText).mockResolvedValueOnce(`Max Mustermann
E-Mail: max@example.com

Sonstiges
${lines}`);
    const { container } = renderDialog();
    await chooseLocal(container);
    await screen.findByRole("heading", { name: "Lebenslauf analysiert" });
    expect(screen.getByText("Seite 1 von 6")).toBeInTheDocument();
    expect(screen.getAllByText(/Prüfzeile \d+/).length).toBe(10);
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Korrigierter Text" }), {
      target: { value: "Prüfzeile 1 korrigiert" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Korrektur übernehmen" }));
    fireEvent.change(screen.getAllByRole("combobox", { name: /Zuordnen zu/ })[0], {
      target: { value: "projects" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Übernehmen" })[0]);
    const statusFilter = screen.getByLabelText("Status");
    fireEvent.change(statusFilter, { target: { value: "accepted" } });
    expect(screen.getByText("Prüfzeile 1 korrigiert")).toBeInTheDocument();
    expect(screen.queryByText("Prüfzeile 2")).toBeNull();
    fireEvent.change(statusFilter, { target: { value: "all" } });
    expect(screen.getByText("Prüfzeile 2")).toBeInTheDocument();
  });

});
