import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderEditor from "./CvBuilderEditor";
import { createEmptyCvBuilderDraft } from "../lib/cvBuilder/contractTypes";
import type { CvBuilderTemplate } from "../lib/cvBuilder/templates";

function Harness({
  onSave = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
}: {
  onSave?: () => Promise<void>;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(createEmptyCvBuilderDraft());
  const [template, setTemplate] = useState<CvBuilderTemplate>("classic");
  const [dirty, setDirty] = useState(false);
  return (
    <LangProvider>
      <CvBuilderEditor
        draft={draft}
        onChange={(next) => {
          setDraft(next);
          setDirty(true);
        }}
        onClose={onClose}
        initialTemplate={template}
        onTemplateChange={(next) => {
          setTemplate(next);
          setDirty(true);
        }}
        onSave={onSave}
        dirty={dirty}
      />
    </LangProvider>
  );
}

function openPersonal() {
  fireEvent.click(screen.getByText("Persönliche Angaben", { selector: "summary span" }));
}

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("CV-BUILDER-02B profile editor integration", () => {
  it("keeps the selected profile template and reports template changes", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Modern" }));
    expect(document.querySelector(".cv-preview")).toHaveAttribute("data-template", "modern");
    expect(screen.getByRole("button", { name: "Modern" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves explicitly and confirms unsaved changes on close", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<Harness onSave={onSave} onClose={onClose} />);
    openPersonal();
    fireEvent.change(screen.getByLabelText("Vollständiger Name"), {
      target: { value: "Alex Beispiel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf speichern" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf-Editor schließen" }));
    expect(screen.getByText("Ungespeicherte Änderungen")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Verwerfen und schließen" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can save and close from the unsaved dialog", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<Harness onSave={onSave} onClose={onClose} />);
    openPersonal();
    fireEvent.change(screen.getByLabelText("Vollständiger Name"), {
      target: { value: "Alex Beispiel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf-Editor schließen" }));
    fireEvent.click(screen.getByRole("button", { name: "Speichern und schließen" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
