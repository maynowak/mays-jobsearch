import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvConsentGate from "./CvConsentGate";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

function renderGate(overrides: Partial<Parameters<typeof CvConsentGate>[0]> = {}) {
  const props = {
    fileName: "cv.pdf",
    onAccept: vi.fn(),
    onCancel: vi.fn(),
    processingInfo: "ATS-Analyse",
    externalAI: true,
    disabled: false,
    ...overrides,
  };
  return { ...render(<LangProvider><CvConsentGate {...props} /></LangProvider>), props };
}

describe("BROWSER-BUG-06: Consent ist verpflichtend", () => {
  it("Zustand Checkbox unchecked -> Button 'Verarbeitung erlauben' disabled", () => {
    renderGate();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    const confirm = screen.getByRole("button", { name: "Verarbeitung erlauben" }) as HTMLButtonElement;

    expect(checkbox.checked).toBe(false);
    expect(confirm.disabled).toBe(true);
  });

  it("ohne Zustimmung wird keine Verarbeitung gestartet (Klick auf disabled Button)", () => {
    const { props } = renderGate();
    const confirm = screen.getByRole("button", { name: "Verarbeitung erlauben" });
    fireEvent.click(confirm);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it("Zustand Checkbox checked -> Button enabled -> Klick startet Verarbeitung", () => {
    const { props } = renderGate();
    const checkbox = screen.getByRole("checkbox");
    const confirm = screen.getByRole("button", { name: "Verarbeitung erlauben" }) as HTMLButtonElement;

    fireEvent.click(checkbox);
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);
    expect(props.onAccept).toHaveBeenCalledTimes(1);
  });

  it("Abwählen der Checkbox sperrt den Button wieder", () => {
    renderGate();
    const checkbox = screen.getByRole("checkbox");
    const confirm = screen.getByRole("button", { name: "Verarbeitung erlauben" }) as HTMLButtonElement;

    fireEvent.click(checkbox);
    expect(confirm.disabled).toBe(false);
    fireEvent.click(checkbox);
    expect(confirm.disabled).toBe(true);
  });
});
