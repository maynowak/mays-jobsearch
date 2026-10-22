import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import RegisterForm from "./RegisterForm";
import { CognitoAuthError } from "../lib/cognitoAuthApi";

// JOBMATCHER-RIS-COGNITO-INTEGRATION-04: Registrierung mit lokalem Formular
// (Benutzername/E-Mail/Passwort) + Cognito SignUp via unauthentifizierte
// Operation (cognitoAuthApi.ts). Kein Passwortfeld mehr "bewusst abwesend" —
// der bisherige Hosted-UI-Only-Ansatz (REGISTRATION-UI-01) wurde ersetzt.

vi.mock("../lib/cognitoAuthApi", () => ({
  CognitoAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  cognitoSignUp: vi.fn(),
  cognitoConfirmSignUp: vi.fn(),
  cognitoResendConfirmationCode: vi.fn(),
}));

import { cognitoSignUp } from "../lib/cognitoAuthApi";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function renderForm() {
  return render(
    <LangProvider>
      <RegisterForm />
    </LangProvider>
  );
}

function fillForm(username: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Benutzername"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Passwort"), {
    target: { value: password },
  });
}

describe("JOBMATCHER-RIS-COGNITO-INTEGRATION-04: Registrierung mit lokalem Formular", () => {
  it("rendert Pflichtfelder Benutzername, E-Mail und Passwort", () => {
    renderForm();
    expect(screen.getByRole("heading", { name: "Konto erstellen" })).toBeTruthy();
    expect(screen.getByLabelText("Benutzername")).toBeTruthy();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeTruthy();
    expect(screen.getByLabelText("Passwort")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Konto erstellen" })).toBeTruthy();
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

  it("Pflichtfeld-Validierung: leere Felder → Fehlermeldungen, kein SignUp", async () => {
    renderForm();
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    expect(await screen.findByText("Dieses Feld ist erforderlich.")).toBeTruthy();
    expect(cognitoSignUp).not.toHaveBeenCalled();
  });

  it("E-Mail-Format-Validierung → Fehlermeldung", async () => {
    renderForm();
    fillForm("testuser", "not-an-email", "Testpass1");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    expect(await screen.findByText(/Bitte gib eine gültige E-Mail-Adresse ein/i)).toBeTruthy();
    expect(cognitoSignUp).not.toHaveBeenCalled();
  });

  it("Passwort-Policy-Validierung (zu kurz, keine Zahl) → Fehlermeldung", async () => {
    renderForm();
    fillForm("testuser", "test@example.com", "abc");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    expect(
      await screen.findByText(/mindestens 8 Zeichen lang sein sowie Groß- und Kleinbuchstaben und eine Zahl enthalten/i)
    ).toBeTruthy();
    expect(cognitoSignUp).not.toHaveBeenCalled();
  });

  it("gültige Eingabe → SignUp wird aufgerufen mit korrekten Daten", async () => {
    const mockSignUp = cognitoSignUp as ReturnType<typeof vi.fn>;
    mockSignUp.mockResolvedValueOnce({ userSub: "test-sub", confirmed: false });
    renderForm();
    fillForm("testuser", "test@example.com", "Testpass1A");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp).toHaveBeenCalledWith({
      username: "testuser",
      email: "test@example.com",
      password: "Testpass1A",
    });
  });

  it("SignUp-Fehler 'UsernameExists' → verständliche Fehlermeldung, keine Weiterleitung", async () => {
    const mockSignUp = cognitoSignUp as ReturnType<typeof vi.fn>;
    mockSignUp.mockRejectedValueOnce(
      new CognitoAuthError("user-exists", "User already exists")
    );
    renderForm();
    fillForm("existinguser", "test@example.com", "Testpass1A");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    expect(
      await screen.findByText(/bereits registriert/i)
    ).toBeTruthy();
    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });
});
