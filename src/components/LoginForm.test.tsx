import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LoginForm from "./LoginForm";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({ signinRedirect: vi.fn() }),
}));

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

describe("REGISTRATION-UI-01: Login-Maske mit Cognito OIDC", () => {
  it("rendert Überschrift, Lead und Login-Button ohne Passwortfeld", () => {
    renderForm();
    expect(screen.getByRole("heading", { name: "Anmelden" })).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
    expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();
    expect(screen.queryByLabelText("Passwort")).toBeNull();
  });

  it("Navigation Login ↔ Registrierung und zurück zum Gastmodus", () => {
    renderForm();
    expect(
      screen.getByRole("link", { name: "Noch kein Konto? Registrieren" }).getAttribute("href")
    ).toBe("/registrieren");
    expect(
      screen
        .getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
        .getAttribute("href")
    ).toBe("/search");
  });
});
