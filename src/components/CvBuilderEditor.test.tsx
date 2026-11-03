import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderEditor from "./CvBuilderEditor";
import { createEmptyCvBuilderDraft, type CvBuilderDraftV1 } from "../lib/cvBuilder/contractTypes";

function Harness({
  initial = createEmptyCvBuilderDraft(),
  onClose = vi.fn(),
}: {
  initial?: CvBuilderDraftV1;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <LangProvider>
      <CvBuilderEditor draft={draft} onChange={setDraft} onClose={onClose} />
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
    expect(screen.getByText(/PDF-Download wird in einer kommenden Entwicklungsphase ergänzt/)).toBeInTheDocument();
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
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Cloud Architecture")).toBeInTheDocument();
    expect(screen.getAllByText("React")).toHaveLength(1);
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

  it("closes through the dialog close action", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf-Editor schließen" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
