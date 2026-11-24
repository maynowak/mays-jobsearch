import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderEditor from "./CvBuilderEditor";
import { createEmptyCvBuilderDraft, type CvBuilderDraftV1 } from "../lib/cvBuilder/contractTypes";

function Harness({
  initial = createEmptyCvBuilderDraft(),
  fullpage = true,
}: {
  initial?: CvBuilderDraftV1;
  fullpage?: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <LangProvider>
      <CvBuilderEditor
        draft={draft}
        onChange={setDraft}
        onClose={vi.fn()}
        onSave={vi.fn()}
        layoutMode={fullpage ? "fullpage" : "modal"}
      />
    </LangProvider>
  );
}

async function openSectionOverview(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole("button", { name: "Abschnittsübersicht" }));
  return screen.getByRole("dialog", { name: "CV-Editor-Navigation" });
}

function panelTarget(id: string): HTMLElement {
  return document.querySelector(`[data-navigator-panel-id="${id}"]`) as HTMLElement;
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  localStorage.removeItem("mj-lang");
  vi.restoreAllMocks();
});

describe("JM-CV-EDITOR-NAVIGATOR-03", () => {
  it("renders German and English radar labels with status text", async () => {
    render(<Harness />);
    const panel = await openSectionOverview();
    expect(panel.textContent).toContain("Abschnitte und Validierung");
    expect(panelTarget("cv-builder-actions")).toHaveTextContent("Bereit");
    cleanup();
    localStorage.setItem("mj-lang", "en");

    const english = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Section overview" }));
    const englishPanel = screen.getByRole("dialog", { name: "CV editor navigation" });
    expect(englishPanel.textContent).toContain("Sections and validation");
    expect(panelTarget("cv-builder-section-personal")).toHaveTextContent("Section");
    expect(panelTarget("cv-builder-actions")).toHaveTextContent("Ready");
    expect(english.container.querySelector(".cv-editor-radar")).not.toBeNull();
  });

  it("is only present in the fullpage editor", () => {
    const modal = render(<Harness fullpage={false} />);
    expect(modal.container.querySelector(".cv-editor-radar")).toBeNull();
    cleanup();

    const fullpage = render(<Harness />);
    expect(fullpage.container.querySelector(".cv-editor-radar")).not.toBeNull();
    expect(fullpage.container.querySelector(".cv-builder-scroll-hands")).not.toBeNull();
  });

  it("exposes all eight sections and the action target", async () => {
    const { container } = render(<Harness />);
    const panel = await openSectionOverview();
    expect(panel.querySelectorAll('[data-navigator-panel-id^="cv-builder-section-"]')).toHaveLength(8);
    expect(panelTarget("cv-builder-actions")).toHaveTextContent("Speichern und Export");
    expect(container.querySelector(".cv-editor-radar")).not.toBeNull();
  });

  it("opens a collapsed section and keeps radar/hands independent", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const { container } = render(<Harness />);
    const details = container.querySelector("#cv-builder-experience details") as HTMLDetailsElement;
    details.open = false;
    await openSectionOverview();
    fireEvent.click(panelTarget("cv-builder-section-experience"));
    await waitFor(() => expect(details).toHaveProperty("open", true));
    expect(container.querySelector(".cv-editor-radar")).not.toBeNull();
    expect(container.querySelector(".cv-builder-scroll-hands")).not.toBeNull();
  });

  it("focuses and highlights the first actual error field", async () => {
    const draft = createEmptyCvBuilderDraft();
    draft.personal = { email: "invalid" };
    const { container } = render(<Harness initial={draft} />);
    expect(screen.getAllByText("1 Fehler").length).toBeGreaterThan(0);
    await openSectionOverview();
    expect(panelTarget("cv-builder-validation")).toHaveAttribute("data-navigator-kind", "error");
    expect(panelTarget("cv-builder-section-personal")).toHaveAttribute("data-navigator-status", "warning");
    expect(panelTarget("cv-builder-section-personal")).toHaveTextContent("1 Fehler");
    expect(panelTarget("cv-builder-actions")).toHaveAttribute("data-navigator-status", "warning");

    fireEvent.click(panelTarget("cv-builder-section-personal"));
    await waitFor(() =>
      expect(document.getElementById("cv-builder-personal")?.querySelector("details")).toHaveProperty("open", true)
    );
    const field = document.getElementById("cv-builder-field-personal-email") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field).toHaveClass("cv-builder-field--radar-highlight");
    expect(container.querySelector(".cv-editor-radar")).not.toBeNull();
  });

  it("removes the error status after the field is corrected", async () => {
    const draft = createEmptyCvBuilderDraft();
    draft.personal = { email: "invalid" };
    const { container } = render(<Harness initial={draft} />);
    await openSectionOverview();
    fireEvent.click(panelTarget("cv-builder-section-personal"));
    const field = await screen.findByLabelText("E-Mail");
    fireEvent.change(field, { target: { value: "valid@example.invalid" } });
    await waitFor(() => expect(screen.queryByText("1 Fehler")).toBeNull());
    const reopened = await openSectionOverview();
    expect(reopened.querySelector('[data-navigator-panel-id="cv-builder-validation"]')).toBeNull();
    expect(panelTarget("cv-builder-section-personal")).toHaveAttribute("data-navigator-status", "normal");
    expect(panelTarget("cv-builder-actions")).toHaveAttribute("data-navigator-status", "completed");
    expect(container.querySelector(".cv-editor-radar")).not.toBeNull();
  });

  it("switches from preview to edit when a section is selected", async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Vorschau" }));
    await waitFor(() =>
      expect(container.querySelector(".cv-builder-workspace")).toHaveAttribute("data-view", "preview")
    );
    await openSectionOverview();
    fireEvent.click(panelTarget("cv-builder-section-skills"));
    await waitFor(() =>
      expect(container.querySelector(".cv-builder-workspace")).toHaveAttribute("data-view", "edit")
    );
    expect(container.querySelector(".cv-editor-radar")).not.toBeNull();
  });

  it("removes the radar and hands in screenshot mode and restores them", async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Ansicht wechseln" }));
    expect(container.querySelector(".cv-editor-radar")).toBeNull();
    expect(container.querySelector(".cv-builder-scroll-hands")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ansicht wechseln" }));
    expect(container.querySelector(".cv-editor-radar")).not.toBeNull();
    expect(container.querySelector(".cv-builder-scroll-hands")).not.toBeNull();
  });
});
