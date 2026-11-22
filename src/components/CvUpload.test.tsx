import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvUpload from "./CvUpload";

const renderUpload = () =>
  render(
    <LangProvider>
      <CvUpload
        onManual={vi.fn()}
        onWorkflowStart={vi.fn()}
      />
    </LangProvider>
  );

describe("JM-CV-UPLOAD-PRIVACY-INFO-05", () => {
  beforeEach(() => {
    localStorage.setItem("mj-lang", "de");
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem("mj-lang");
  });

  it("keeps the full German privacy note behind a closed native disclosure", () => {
    renderUpload();
    const summary = screen.getByText("Datenschutz & KI-Verarbeitung");
    const details = summary.closest("details") as HTMLDetailsElement;

    expect(details).toBeTruthy();
    expect(details.open).toBe(false);
    expect(screen.getByText(/Privat: Deine PDF wird für diese Funktion lokal/)).toBeTruthy();
    expect(screen.getByText(/vollständige Anonymität kann nicht garantiert werden/)).toBeTruthy();

    fireEvent.click(summary);
    expect(details.open).toBe(true);
    fireEvent.click(summary);
    expect(details.open).toBe(false);
  });

  it("provides the English disclosure title and note without changing the note text", () => {
    localStorage.setItem("mj-lang", "en");
    renderUpload();

    expect(screen.getByText("Privacy & AI processing")).toBeTruthy();
    expect(screen.getByText(/Private: Your PDF is read locally in your browser/)).toBeTruthy();
    expect(screen.getByText(/Complete anonymity cannot be guaranteed/)).toBeTruthy();
  });

  it("is keyboard-focusable through the native summary", () => {
    renderUpload();
    const summary = screen.getByText("Datenschutz & KI-Verarbeitung").closest("summary");
    expect(summary).toBeTruthy();
    (summary as HTMLElement).focus();
    expect(document.activeElement).toBe(summary);
  });
});
