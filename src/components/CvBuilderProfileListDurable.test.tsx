import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderProfileList from "./CvBuilderProfileList";
import { createEmptyCvBuilderDraft } from "../lib/cvBuilder/contractTypes";
import type { CvBuilderProfileV1 } from "../lib/cvBuilder/profileTypes";

const NOW = "2026-11-13T10:00:00.000Z";

function profile(cvId: string, name: string): CvBuilderProfileV1 {
  return {
    schemaVersion: 1,
    cvId,
    name,
    cvData: createEmptyCvBuilderDraft(),
    template: "classic",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function renderList(overrides: Partial<React.ComponentProps<typeof CvBuilderProfileList>> = {}) {
  const callbacks = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onDownload: vi.fn(),
    onSaveDurable: vi.fn(),
  };
  render(
    <LangProvider>
      <CvBuilderProfileList
        profiles={[profile("cvb-1", "Session"), profile("durable-cvp-1", "Account")]}
        structuredStorageEnabled
        durableStates={{
          "cvb-1": "session-only",
          "durable-cvp-1": "durable",
        }}
        {...callbacks}
        {...overrides}
      />
    </LangProvider>,
  );
  return callbacks;
}

beforeEach(() => localStorage.setItem("mj-lang", "de"));
afterEach(() => cleanup());

describe("structured CV profile status", () => {
  it("shows session and durable states and offers an explicit durable save", () => {
    const callbacks = renderList();
    expect(screen.getByText("Nur diese Sitzung")).toBeInTheDocument();
    expect(screen.getByText("Im Konto gespeichert")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Dauerhaft speichern" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Dauerhaft speichern" }));
    expect(callbacks.onSaveDurable).toHaveBeenCalledWith("cvb-1");
  });

  it("shows conflict/error/unsaved states without hiding the local profile", () => {
    renderList({
      durableStates: {
        "cvb-1": "conflict",
        "durable-cvp-1": "unsaved-changes",
      },
    });
    expect(screen.getByText("Versionskonflikt")).toBeInTheDocument();
    expect(screen.getByText("Ungespeicherte Änderungen")).toBeInTheDocument();
    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});
