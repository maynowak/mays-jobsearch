import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error("boom");
}

describe("BROWSER-12: ErrorBoundary hält die UI bedienbar", () => {
  it("zeigt bei einem Render-Fehler eine kontrollierte Fehleransicht statt abzustürzen", () => {
    // React loggt Boundary-Fehler in die Console — im Test unterdrücken
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary title="Fehler" message="Etwas ist schiefgelaufen" reloadLabel="Neu laden">
        <Broken />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Fehler")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Neu laden" })).toBeTruthy();
  });

  it("rendert Kinder normal, wenn kein Fehler auftritt", () => {
    render(
      <ErrorBoundary title="Fehler" message="x" reloadLabel="Neu laden">
        <p>alles gut</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("alles gut")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Reload-Button löst einen Seiten-Reload aus", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload },
      configurable: true,
    });
    render(
      <ErrorBoundary title="Fehler" message="x" reloadLabel="Neu laden">
        <Broken />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: "Neu laden" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
