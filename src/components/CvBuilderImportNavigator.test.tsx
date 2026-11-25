import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderImportDialog from "./CvBuilderImportDialog";
import { extractPdfText } from "../lib/pdf";

vi.mock("../lib/pdf", () => ({ extractPdfText: vi.fn() }));

function file(name = "navigator-test.pdf"): File {
  return new File(["synthetic"], name, { type: "application/pdf" });
}

function importText(lines: number): string {
  return `Max Mustermann
E-Mail: max@example.com

Sonstiges
${Array.from({ length: lines }, (_, index) => `Prüfzeile ${index + 1}`).join("\n")}`;
}

function renderFullpage() {
  return render(
    <LangProvider>
      <CvBuilderImportDialog
        open
        layoutMode="fullpage"
        onClose={vi.fn()}
        onCreateEmpty={vi.fn()}
        risAvailable={false}
        persistentCvs={[]}
        onDownloadRis={vi.fn(async () => file())}
        onImported={vi.fn()}
      />
    </LangProvider>
  );
}

async function chooseFile(container: HTMLElement): Promise<void> {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file()] } });
  await screen.findByRole("heading", { name: /Lebenslauf analysiert|CV analysed/ });
}

function candidatePanelButtons(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(
    '[data-navigator-panel-id^="cv-import-candidate-"]'
  ));
}

async function openOverview(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole("button", { name: "Importübersicht" }));
  return screen.getByRole("dialog", { name: "CV-Import-Navigation" });
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  vi.mocked(extractPdfText).mockReset();
});

afterEach(() => {
  cleanup();
  localStorage.removeItem("mj-lang");
  vi.restoreAllMocks();
});

describe("JM-CV-IMPORT-NAVIGATOR-02", () => {
  it.each([5, 10, 35])("exposes all %i review candidates in the mobile overview", async (count) => {
    vi.mocked(extractPdfText).mockResolvedValue(importText(count));
    const { container } = renderFullpage();
    await chooseFile(container);
    const panel = await openOverview();
    expect(within(panel).getAllByRole("button", { name: /Prüfkandidat \d+/ })).toHaveLength(count);
    expect(candidatePanelButtons()[0]).toHaveAttribute("data-navigator-status", "pending");
    expect(candidatePanelButtons()[0]).toHaveTextContent("Offen");
  });

  it("opens the correct review page for a candidate that is not currently rendered", async () => {
    vi.mocked(extractPdfText).mockResolvedValue(importText(12));
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const { container } = renderFullpage();
    await chooseFile(container);
    expect(screen.getByText("Seite 1 von 2")).toBeInTheDocument();
    const panel = await openOverview();
    fireEvent.click(within(panel).getByRole("button", { name: /Prüfkandidat 12/ }));

    await waitFor(() => expect(screen.getByText("Prüfzeile 12")).toBeInTheDocument());
    expect(screen.getByText("Seite 2 von 2")).toBeInTheDocument();
    expect(screen.getByText("Die Navigation hat Prüfseite 2 geöffnet.")).toBeInTheDocument();
    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute("id", "cv-import-review-item-11")
    );
    expect(document.getElementById("cv-import-review-item-11")).toHaveClass("is-radar-highlight");
  });

  it("resets filters only when needed and keeps prior decisions", async () => {
    vi.mocked(extractPdfText).mockResolvedValue(importText(12));
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const { container } = renderFullpage();
    await chooseFile(container);

    const firstItem = container.querySelector('[data-cv-import-candidate-index="0"]') as HTMLElement;
    fireEvent.change(within(firstItem).getByRole("combobox", { name: /Zuordnen zu/ }), {
      target: { value: "projects" },
    });
    fireEvent.click(within(firstItem).getByRole("button", { name: "Übernehmen" }));
    await openOverview();
    expect(document.querySelector('[data-navigator-panel-id="cv-import-candidate-0"]'))
      .toHaveAttribute("data-navigator-status", "completed");
    fireEvent.keyDown(document, { key: "Escape" });

    const statusFilter = screen.getByLabelText("Status");
    fireEvent.change(statusFilter, { target: { value: "accepted" } });
    expect(screen.getByText("Prüfzeile 1")).toBeInTheDocument();
    expect(screen.queryByText("Prüfzeile 2")).toBeNull();

    const reopened = await openOverview();
    fireEvent.click(within(reopened).getByRole("button", { name: /Prüfkandidat 2/ }));
    await waitFor(() => expect(screen.getByText("Prüfzeile 2")).toBeInTheDocument());
    expect(statusFilter).toHaveValue("all");
    expect(screen.getByText(/Die Navigation hat die Prüffilter zurückgesetzt/)).toBeInTheDocument();
    expect(screen.getByText("Prüfzeile 1")).toBeInTheDocument();
    expect(container.querySelector('[data-cv-import-candidate-index="0"]')).toHaveClass("is-accepted");
  });

  it("renders English radar labels and status text", async () => {
    localStorage.setItem("mj-lang", "en");
    vi.mocked(extractPdfText).mockResolvedValue(importText(5));
    const { container } = renderFullpage();
    await chooseFile(container);
    fireEvent.click(screen.getByRole("button", { name: "Import overview" }));
    const panel = screen.getByRole("dialog", { name: "CV import navigation" });
    expect(within(panel).getByRole("button", { name: "Review item 1, Open" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Import decision" })).toBeInTheDocument();
  });

  it("is absent in the modal and in screenshot mode, and returns after screenshot mode", async () => {
    vi.mocked(extractPdfText).mockResolvedValue(importText(5));

    const modal = render(
      <LangProvider>
        <CvBuilderImportDialog
          open
          onClose={vi.fn()}
          onCreateEmpty={vi.fn()}
          risAvailable={false}
          persistentCvs={[]}
          onDownloadRis={vi.fn(async () => file())}
          onImported={vi.fn()}
        />
      </LangProvider>
    );
    await chooseFile(modal.container);
    expect(modal.container.querySelector(".cv-import-radar")).toBeNull();
    cleanup();

    const fullpage = renderFullpage();
    await chooseFile(fullpage.container);
    expect(fullpage.container.querySelector(".cv-import-radar")).not.toBeNull();
    const details = fullpage.container.querySelector<HTMLDetailsElement>(".cv-import-section__details");
    expect(details?.open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Alle Abschnitte aufklappen" }));
    expect(details?.open).toBe(true);
    expect(fullpage.container.querySelector(".cv-import-radar")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "📸 Screenshot-Ansicht" }));
    expect(fullpage.container.querySelector(".cv-import-radar")).toBeNull();
    expect(details?.open).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Screenshot-Ansicht beenden" }));
    expect(fullpage.container.querySelector(".cv-import-radar")).not.toBeNull();
    expect(details?.open).toBe(true);
  });
});
