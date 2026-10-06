import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import RegisterForm from "./RegisterForm";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm() {
  return render(
    <LangProvider>
      <RegisterForm />
    </LangProvider>
  );
}

function fillValidExcept(overrides: { email?: string; password?: string; repeat?: string } = {}) {
  fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
    target: { value: overrides.email ?? "name@beispiel.de" },
  });
  fireEvent.change(screen.getByLabelText("Passwort", { exact: true }), {
    target: { value: overrides.password ?? "geheim123" },
  });
  fireEvent.change(screen.getByLabelText("Passwort wiederholen"), {
    target: { value: overrides.repeat ?? "geheim123" },
  });
  fireEvent.click(screen.getByLabelText("Ich akzeptiere die Datenschutzerklärung."));
  fireEvent.click(screen.getByLabelText("Ich akzeptiere die Nutzungsbedingungen."));
}

describe("REGISTRATION-UI-01: Registrierungsmaske (reine GUI, kein Backend)", () => {
  it("rendert alle Pflichtfelder, Checkboxen, Buttons und Navigationslinks", () => {
    renderForm();
    expect(screen.getByRole("heading", { name: "Konto erstellen" })).toBeTruthy();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeTruthy();
    expect(screen.getByLabelText("Passwort", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("Passwort wiederholen")).toBeTruthy();
    expect(screen.getByLabelText("Ich akzeptiere die Datenschutzerklärung.")).toBeTruthy();
    expect(screen.getByLabelText("Ich akzeptiere die Nutzungsbedingungen.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Konto erstellen" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bereits registriert? Anmelden" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
    ).toBeTruthy();
  });

  it("leeres Absenden zeigt Pflichtfehler an jedem Feld, kein Placeholder", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
    expect(screen.getByText("Bitte gib deine E-Mail-Adresse ein.")).toBeTruthy();
    expect(screen.getByText("Bitte gib ein Passwort ein.")).toBeTruthy();
    expect(screen.getByText("Bitte akzeptiere die Datenschutzerklärung.")).toBeTruthy();
    expect(screen.getByText("Bitte akzeptiere die Nutzungsbedingungen.")).toBeTruthy();
    expect(screen.queryByText("Registrierung vorbereitet.")).toBeNull();
  });

  it("ungültiges E-Mail-Format wird beanstandet", () => {
    renderForm();
    fillValidExcept({ email: "keine-mail" });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
    expect(screen.getByText("Bitte gib eine gültige E-Mail-Adresse ein.")).toBeTruthy();
    expect(screen.queryByText("Registrierung vorbereitet.")).toBeNull();
  });

  it("zu kurzes Passwort wird beanstandet", () => {
    renderForm();
    fillValidExcept({ password: "kurz", repeat: "kurz" });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
    expect(screen.getByText("Das Passwort muss mindestens 8 Zeichen lang sein.")).toBeTruthy();
    expect(screen.queryByText("Registrierung vorbereitet.")).toBeNull();
  });

  it("Passwort-Mismatch wird beanstandet", () => {
    renderForm();
    fillValidExcept({ repeat: "anders123" });
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
    expect(screen.getByText("Die Passwörter stimmen nicht überein.")).toBeTruthy();
    expect(screen.queryByText("Registrierung vorbereitet.")).toBeNull();
  });

  it("fehlende Checkbox wird beanstandet (nur Terms akzeptiert)", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
      target: { value: "name@beispiel.de" },
    });
    fireEvent.change(screen.getByLabelText("Passwort", { exact: true }), {
      target: { value: "geheim123" },
    });
    fireEvent.change(screen.getByLabelText("Passwort wiederholen"), {
      target: { value: "geheim123" },
    });
    fireEvent.click(screen.getByLabelText("Ich akzeptiere die Nutzungsbedingungen."));
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
    expect(screen.getByText("Bitte akzeptiere die Datenschutzerklärung.")).toBeTruthy();
    expect(screen.queryByText("Registrierung vorbereitet.")).toBeNull();
  });

  it("gültiges Absenden zeigt Placeholder und ruft kein Backend auf", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    renderForm();
    fillValidExcept();
    fireEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));
    expect(screen.getByText("Registrierung vorbereitet.")).toBeTruthy();
    expect(
      screen.getByText(
        "Die Registrierung ist vorbereitet. Die Kontoerstellung wird im nächsten Schritt mit dem Authentifizierungssystem verbunden."
      )
    ).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Navigation: Links zeigen auf Login und Gastmodus", () => {
    renderForm();
    expect(
      screen.getByRole("link", { name: "Bereits registriert? Anmelden" }).getAttribute("href")
    ).toBe("/anmelden");
    expect(
      screen
        .getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
        .getAttribute("href")
    ).toBe("/search");
  });
});
