import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import RegisterForm from "./RegisterForm";
import { CognitoAuthError } from "../lib/cognitoAuthApi";

// EMAIL-ONLY-REGISTRATION-01: Registrierung mit lokalem Formular
// (E-Mail/Passwort). Die E-Mail-Adresse ist der Cognito-Username;
// ein separates Benutzername-Feld existiert nicht mehr. Cognito SignUp
// läuft über die unauthentifizierte Operation in cognitoAuthApi.ts.

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

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Passwort"), {
    target: { value: password },
  });
}

describe("EMAIL-ONLY-REGISTRATION-01: Registrierung mit E-Mail und Passwort", () => {
  it("rendert nur die Pflichtfelder E-Mail und Passwort", () => {
    const { container } = renderForm();
    expect(screen.getByRole("heading", { name: "Konto erstellen" })).toBeTruthy();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeTruthy();
    expect(screen.getByLabelText("Passwort")).toBeTruthy();
    expect(screen.queryByLabelText("Benutzername")).toBeNull();
    expect(container.querySelectorAll("form input")).toHaveLength(2);
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
    expect(await screen.findByText("Bitte gib deine E-Mail-Adresse ein.")).toBeTruthy();
    expect(await screen.findByText("Bitte gib ein Passwort ein.")).toBeTruthy();
    expect(cognitoSignUp).not.toHaveBeenCalled();
  });

  it("E-Mail-Format-Validierung → Fehlermeldung", async () => {
    renderForm();
    fillForm("not-an-email", "Testpass1");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    expect(await screen.findByText(/Bitte gib eine gültige E-Mail-Adresse ein/i)).toBeTruthy();
    expect(cognitoSignUp).not.toHaveBeenCalled();
  });

  it("Passwort-Policy-Validierung (zu kurz, keine Zahl) → Fehlermeldung", async () => {
    renderForm();
    fillForm("test@example.com", "abc");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    expect(
      await screen.findByText(/mindestens 8 Zeichen lang sein sowie Groß- und Kleinbuchstaben und eine Zahl enthalten/i)
    ).toBeTruthy();
    expect(cognitoSignUp).not.toHaveBeenCalled();
  });

  it("gültige Eingabe → SignUp wird mit E-Mail als Username aufgerufen", async () => {
    const mockSignUp = cognitoSignUp as ReturnType<typeof vi.fn>;
    mockSignUp.mockResolvedValueOnce({ userSub: "test-sub", confirmed: false });
    renderForm();
    fillForm("test@example.com", "Testpass1A");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp).toHaveBeenCalledWith({
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
    fillForm("test@example.com", "Testpass1A");
    fireEvent.submit(screen.getByRole("button", { name: "Konto erstellen" }).closest("form")!);
    expect(
      await screen.findByText(/bereits registriert/i)
    ).toBeTruthy();
    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });
});
