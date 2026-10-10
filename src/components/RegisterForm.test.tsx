import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import RegisterForm from "./RegisterForm";

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
      <RegisterForm />
    </LangProvider>
  );
}

describe("REGISTRATION-UI-01: Registrierungsmaske mit Cognito OIDC", () => {
  it("rendert Überschrift und Registrierungs-Button ohne Passwortfelder", () => {
    renderForm();
    expect(screen.getByRole("heading", { name: "Konto erstellen" })).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
    expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();
    expect(screen.queryByLabelText("Passwort")).toBeNull();
  });

  it("Navigation Registrierung ↔ Anmeldung und zurück zum Gastmodus", () => {
    renderForm();
    expect(
      screen.getByRole("link", { name: "Bereits registriert? Anmelden" }).getAttribute("href")
    ).toBe("/anmelden");
    expect(
      screen.getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" }).getAttribute("href")
    ).toBe("/search");
  });
});
