import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderEditor from "./CvBuilderEditor";
import { createEducationEntry, createEmptyCvBuilderDraft, createExperienceEntry, type CvBuilderDraftV1 } from "../lib/cvBuilder/contractTypes";
import type { CvBuilderImportReviewSummary } from "./CvBuilderImportReview";

function Harness({
  initial = createEmptyCvBuilderDraft(),
  onClose = vi.fn(),
  onSave,
  dirty = false,
  saved = false,
  saving = false,
  saveError = "",
  importReview = null,
}: {
  initial?: CvBuilderDraftV1;
  onClose?: () => void;
  onSave?: () => Promise<void> | void;
  dirty?: boolean;
  saved?: boolean;
  saving?: boolean;
  saveError?: string;
  importReview?: CvBuilderImportReviewSummary | null;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <LangProvider>
      <CvBuilderEditor
        draft={draft}
        onChange={setDraft}
        onClose={onClose}
        onSave={onSave}
        dirty={dirty}
        saved={saved}
        saving={saving}
        saveError={saveError}
        importReview={importReview}
      />
    </LangProvider>
  );
}

function openSection(title: string) {
  const summary = screen.getByText(title, { selector: "summary span" });
  fireEvent.click(summary);
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("CV-BUILDER-01A editor", () => {
  it("shows the session-only and PDF-phase notices", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" })).toBeInTheDocument();
    expect(screen.getByText(/nur während der aktuellen Sitzung bearbeitet/)).toBeInTheDocument();
    expect(screen.getByText(/PDF-Export erfolgt lokal im Browser/)).toBeInTheDocument();
    expect(screen.getByText("0 Einträge · 0 Validierungshinweise")).toBeInTheDocument();
  });

  it("edits personal data and reports invalid email without deleting it", async () => {
    render(<Harness />);
    openSection("Persönliche Angaben");
    const name = screen.getByLabelText("Vollständiger Name");
    const email = screen.getByLabelText("E-Mail");
    fireEvent.change(name, { target: { value: "Zoë Beispiel" } });
    fireEvent.change(email, { target: { value: "invalid" } });

    expect(name).toHaveValue("Zoë Beispiel");
    expect(email).toHaveValue("invalid");
    expect(screen.getByText("Bitte gib eine gültige E-Mail-Adresse ein.")).toBeInTheDocument();
    fireEvent.change(email, { target: { value: "zoe@example.invalid" } });
    await waitFor(() =>
      expect(screen.queryByText("Bitte gib eine gültige E-Mail-Adresse ein.")).not.toBeInTheDocument()
    );
  });

  it("adds, edits, reorders and removes work experience with stable focus", async () => {
    render(<Harness />);
    openSection("Berufserfahrung");
    const add = screen.getByRole("button", { name: "+ Berufserfahrung hinzufügen" });
    fireEvent.click(add);
    fireEvent.click(add);
    const positions = screen.getAllByLabelText("Position");
    fireEvent.change(positions[0], { target: { value: "Erste Rolle" } });
    fireEvent.change(positions[1], { target: { value: "Zweite Rolle" } });

    const down = screen.getAllByRole("button", { name: "Eintrag nach oben" })[1];
    fireEvent.click(down);
    expect(screen.getAllByLabelText("Position")[0]).toHaveValue("Zweite Rolle");

    const removeButtons = screen.getAllByRole("button", { name: "Eintrag entfernen" });
    fireEvent.click(removeButtons[1]);
    const confirm = screen.getByText("Diesen Eintrag entfernen?").closest('[role="alert"]') as HTMLElement;
    expect(confirm).not.toBeNull();
    const confirmYes = within(confirm).getByRole("button", { name: "Ja, entfernen" });
    await waitFor(() => expect(confirmYes).toHaveFocus());
    fireEvent.click(confirmYes);
    expect(screen.getAllByLabelText("Position")).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Berufserfahrung hinzufügen" })).toHaveFocus());
  });

  it("supports education, projects and certificates", () => {
    render(<Harness />);
    openSection("Ausbildung");
    fireEvent.click(screen.getByRole("button", { name: "+ Ausbildung hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Bildungseinrichtung"), { target: { value: "Beispiel-Uni" } });
    fireEvent.change(screen.getByLabelText("Abschluss"), { target: { value: "B.Sc." } });
    fireEvent.change(screen.getByLabelText("Beginn (Monat/Jahr)"), { target: { value: "2018-10" } });

    openSection("Projekte");
    fireEvent.click(screen.getByRole("button", { name: "+ Projekt hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Projektname"), { target: { value: "Job Matcher" } });
    fireEvent.change(screen.getByLabelText("Technologien"), { target: { value: "React, TypeScript" } });

    openSection("Zertifikate");
    fireEvent.click(screen.getByRole("button", { name: "+ Zertifikat hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Zertifikat"), { target: { value: "AWS Cloud Practitioner" } });
    fireEvent.change(screen.getByLabelText("Ausstellende Organisation"), { target: { value: "Amazon" } });

    expect(screen.getByLabelText("Bildungseinrichtung")).toHaveValue("Beispiel-Uni");
    expect(screen.getByLabelText("Projektname")).toHaveValue("Job Matcher");
    expect(screen.getByLabelText("Zertifikat")).toHaveValue("AWS Cloud Practitioner");
  });

  it("deduplicates skills while preserving multi-word skills", () => {
    render(<Harness />);
    openSection("Fähigkeiten");
    const skills = screen.getByLabelText("Fähigkeiten");
    fireEvent.change(skills, { target: { value: "React, TypeScript\nReact, Cloud Architecture" } });
    expect(screen.getAllByText("React").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cloud Architecture").length).toBeGreaterThan(0);
  });

  it("edits languages and links, rejects unsafe URLs and safely renders HTML-like text", () => {
    render(<Harness />);
    openSection("Sprachen und Links");
    fireEvent.click(screen.getByRole("button", { name: "+ Sprache hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Sprache"), { target: { value: "Deutsch" } });
    fireEvent.change(screen.getByLabelText("Kenntnisstand"), { target: { value: "native" } });

    fireEvent.click(screen.getByRole("button", { name: "+ Link hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Bezeichnung"), { target: { value: "<img src=x onerror=alert(1)>" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "javascript:alert(1)" } });
    expect(screen.getByText("Bitte gib eine gültige http(s)-URL ein.")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByDisplayValue("<img src=x onerror=alert(1)>")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://example.invalid/profile" } });
    expect(screen.getByLabelText("Sprache")).toHaveValue("Deutsch");
  });

  it("updates the live preview and switches templates without changing the draft", () => {
    render(<Harness />);
    openSection("Persönliche Angaben");
    fireEvent.change(screen.getByLabelText("Vollständiger Name"), { target: { value: "Alex Beispiel" } });
    const preview = screen.getByRole("region", { name: "Live-Vorschau des Lebenslaufs" });
    expect(within(preview).getByRole("heading", { name: "Alex Beispiel" })).toBeInTheDocument();
    expect(document.querySelector(".cv-preview")).toHaveAttribute("data-template", "classic");

    fireEvent.click(screen.getByRole("button", { name: "Modern" }));
    expect(document.querySelector(".cv-preview")).toHaveAttribute("data-template", "modern");
    expect(within(preview).getByRole("heading", { name: "Alex Beispiel" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vollständiger Name")).toHaveValue("Alex Beispiel");

    fireEvent.click(screen.getByRole("button", { name: "Kompakt" }));
    expect(document.querySelector(".cv-preview")).toHaveAttribute("data-template", "compact");
  });

  it("switches between mobile edit and preview views without losing data", () => {
    render(<Harness />);
    openSection("Persönliche Angaben");
    fireEvent.change(screen.getByLabelText("Vollständiger Name"), { target: { value: "Alex Beispiel" } });
    const previewButton = screen.getByRole("button", { name: "Vorschau" });
    const editButton = screen.getByRole("button", { name: "Bearbeiten" });
    expect(editButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(previewButton);
    expect(previewButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Live-Vorschau des Lebenslaufs" })).toBeInTheDocument();
    fireEvent.click(editButton);
    expect(editButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Vollständiger Name")).toHaveValue("Alex Beispiel");
  });

  it("closes through the dialog close action", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf-Editor schließen" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });


function SaveHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [draft, setDraft] = useState(createEmptyCvBuilderDraft());
  const [dirty, setDirty] = useState(true);
  const [saved, setSaved] = useState(false);
  return (
    <LangProvider>
      <CvBuilderEditor
        draft={draft}
        onChange={(next) => { setDraft(next); setDirty(true); }}
        onClose={onClose}
        onSave={async () => { setDirty(false); setSaved(true); }}
        dirty={dirty}
        saved={saved}
      />
    </LangProvider>
  );
}

describe("CV-BUILDER-WORKFLOW-02A save status", () => {
  it("shows the correct session status for unsaved, saved and modified drafts", () => {
    const { rerender } = render(<Harness />);
    expect(screen.getByText("Noch nicht gespeichert")).toBeInTheDocument();
    rerender(<Harness saved />);
    expect(screen.getByText("In dieser Sitzung gespeichert")).toBeInTheDocument();
    rerender(<Harness saved dirty />);
    expect(screen.getByText("Ungespeicherte Änderungen")).toBeInTheDocument();
    rerender(<Harness saved={false} dirty />);
    expect(screen.getByText("Noch nicht gespeichert")).toBeInTheDocument();
  });

  it("shows the success state with the close, continue and PDF actions", async () => {
    const onClose = vi.fn();
    render(<SaveHarness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf speichern" }));
    expect((await screen.findAllByText("Dein Lebenslauf wurde in dieser Sitzung gespeichert.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Zur Lebenslaufübersicht" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter bearbeiten" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Als PDF herunterladen" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Zur Lebenslaufübersicht" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps save errors visible and does not fake a success", () => {
    render(<Harness saveError="Speichern fehlgeschlagen" saved={false} />);
    expect(screen.getAllByText("Speichern fehlgeschlagen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dein Lebenslauf wurde in dieser Sitzung gespeichert.")).toBeNull();
  });
});
});


describe("CV-BUILDER-PDF-EXPORT-FIX-01 editor", () => {
  it("enables export for imported entries with unknown months and no degree", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.personal.fullName = "Import Test";
    draft.experience = [{
      ...createExperienceEntry(),
      employer: "Beispiel GmbH",
      position: "Architekt",
      startMonth: "",
    }];
    draft.education = [{
      ...createEducationEntry(),
      institution: "Weiterbildung",
      degree: "",
      startMonth: "",
    }];
    render(<Harness initial={draft} />);
    expect(screen.getByText("2 Einträge · 0 Validierungshinweise")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Als PDF herunterladen" })).toBeEnabled();
  });
});


describe("CV-BUILDER-REAL-WORLD-QA-02E import quality", () => {
  it("shows import review separately from field validation", () => {
    render(
      <Harness
        initial={{ ...createEmptyCvBuilderDraft(), personal: { fullName: "Nora Beispiel" } }}
        importReview={{ total: 4, pending: 2, accepted: 1, ignored: 1 }}
      />
    );
    expect(screen.getByText("Feldvalidierung:")).toBeInTheDocument();
    expect(screen.getByText("Keine Feldfehler")).toBeInTheDocument();
    expect(screen.getByText("Importprüfung:")).toBeInTheDocument();
    expect(screen.getByText(/2 ungeprüft · 1 manuell übernommen · 1 bewusst ausgeschlossen/)).toBeInTheDocument();
  });
});
