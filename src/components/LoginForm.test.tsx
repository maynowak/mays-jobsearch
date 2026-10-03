import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LoginForm from "./LoginForm";

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
      <LoginForm />
    </LangProvider>
  );
}

describe("REGISTRATION-UI-01: Login-Maske (Navigationsziel, reine GUI, kein Backend)", () => {
  it("rendert E-Mail, Passwort, Submit und beide Navigationslinks", () => {
    renderForm();
    expect(screen.getByRole("heading", { name: "Anmelden" })).toBeTruthy();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeTruthy();
    expect(screen.getByLabelText("Passwort")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Noch kein Konto? Jetzt erstellen" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
    ).toBeTruthy();
  });

  it("leeres Absenden zeigt Pflichtfehler, kein Placeholder", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));
    expect(screen.getByText("Bitte gib deine E-Mail-Adresse ein.")).toBeTruthy();
    expect(screen.getByText("Bitte gib ein Passwort ein.")).toBeTruthy();
    expect(screen.queryByText("Anmeldung vorbereitet.")).toBeNull();
  });

  it("gültiges Absenden zeigt Placeholder und ruft kein Backend auf", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    renderForm();
    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
      target: { value: "name@beispiel.de" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "geheim123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));
    expect(screen.getByText("Anmeldung vorbereitet.")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Navigation Login ↔ Registrierung und zurück zum Gastmodus", () => {
    renderForm();
    expect(
      screen.getByRole("link", { name: "Noch kein Konto? Jetzt erstellen" }).getAttribute("href")
    ).toBe("/registrieren");
    expect(
      screen
        .getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
        .getAttribute("href")
    ).toBe("/top");
  });
});
