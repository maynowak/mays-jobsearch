import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderProfileList from "./CvBuilderProfileList";
import { createEmptyCvBuilderDraft } from "../lib/cvBuilder/contractTypes";
import type { CvBuilderProfileV1 } from "../lib/cvBuilder/profileTypes";

const NOW = "2026-11-04T10:00:00.000Z";

function profile(overrides: Partial<CvBuilderProfileV1> = {}): CvBuilderProfileV1 {
  return {
    schemaVersion: 1,
    cvId: "cvb-1",
    name: "Java-Entwicklerin",
    cvData: createEmptyCvBuilderDraft(),
    template: "classic",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function renderList(overrides: Partial<React.ComponentProps<typeof CvBuilderProfileList>> = {}) {
  const callbacks = {
    onCreate: vi.fn(),
    onAdoptDraft: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onDownload: vi.fn(),
  };
  render(
    <LangProvider>
      <CvBuilderProfileList
        profiles={[profile(), profile({ cvId: "cvb-2", name: "Cloud Engineer", template: "modern" })]}
        activeCvId="cvb-1"
        canAdoptDraft
        {...callbacks}
        {...overrides}
      />
    </LangProvider>
  );
  return callbacks;
}

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("CvBuilderProfileList", () => {
  it("lists profiles and triggers edit/duplicate/download", () => {
    const callbacks = renderList();
    expect(screen.getByText("Java-Entwicklerin")).toBeInTheDocument();
    expect(screen.getByText("Cloud Engineer")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Bearbeiten" })[0]);
    expect(callbacks.onEdit).toHaveBeenCalledWith("cvb-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Duplizieren" })[1]);
    expect(callbacks.onDuplicate).toHaveBeenCalledWith("cvb-2");
    fireEvent.click(screen.getAllByRole("button", { name: "PDF herunterladen" })[0]);
    expect(callbacks.onDownload).toHaveBeenCalledWith("cvb-1");
    fireEvent.click(screen.getByRole("button", { name: "Bestehenden Entwurf übernehmen" }));
    expect(callbacks.onAdoptDraft).toHaveBeenCalledTimes(1);
  });

  it("renames and deletes only after confirmation", () => {
    const callbacks = renderList();
    fireEvent.click(screen.getAllByRole("button", { name: "Umbenennen" })[0]);
    fireEvent.change(screen.getByLabelText("Name des Lebenslaufs"), {
      target: { value: "Senior Java" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Namen speichern" }));
    expect(callbacks.onRename).toHaveBeenCalledWith("cvb-1", "Senior Java");

    fireEvent.click(screen.getAllByRole("button", { name: "Löschen" })[0]);
    expect(screen.getByText(/Nur dieser strukturierte Lebenslauf/)).toBeInTheDocument();
    expect(callbacks.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf löschen" }));
    expect(callbacks.onDelete).toHaveBeenCalledWith("cvb-1");
  });

  it("supports the English labels", () => {
    localStorage.setItem("mj-lang", "en");
    render(
      <LangProvider>
        <CvBuilderProfileList
          profiles={[]}
          onCreate={vi.fn()}
          onEdit={vi.fn()}
          onDuplicate={vi.fn()}
          onRename={vi.fn()}
          onDelete={vi.fn()}
          onDownload={vi.fn()}
        />
      </LangProvider>
    );
    expect(screen.getByText("My CVs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create new CV/ })).toBeInTheDocument();
  });

  it("shows empty state and creates a new profile", () => {
    const callbacks = renderList({ profiles: [], canAdoptDraft: false });
    expect(screen.getByText("In dieser Sitzung wurde noch kein Lebenslauf erstellt.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Neuen Lebenslauf erstellen/ }));
    expect(callbacks.onCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Bestehenden Entwurf übernehmen" })).toBeNull();
  });
});
