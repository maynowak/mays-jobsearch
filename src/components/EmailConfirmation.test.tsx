import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "../i18n";
import EmailConfirmation from "./EmailConfirmation";
import { CognitoAuthError } from "../lib/cognitoAuthApi";

// JOBMATCHER-RIS-COGNITO-INTEGRATION-04: E-Mail-Bestätigung
// (ConfirmSignUp / ResendConfirmationCode) nach SignUp.

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

import {
  cognitoConfirmSignUp,
  cognitoResendConfirmationCode,
} from "../lib/cognitoAuthApi";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function renderConfirm(email = "test@example.com") {
  window.history.replaceState({}, "", `/email-bestaetigen?email=${email}`);
  return render(
    <LangProvider>
      <EmailConfirmation />
    </LangProvider>
  );
}

describe("JOBMATCHER-RIS-COGNITO-INTEGRATION-04: E-Mail-Bestätigung", () => {
  it("rendert Bestätigungscode-Feld, Bestätigen- und Erneut-Senden-Button", () => {
    renderConfirm();
    expect(screen.getByRole("heading", { name: "E-Mail bestätigen" })).toBeTruthy();
    expect(screen.getByLabelText("Bestätigungscode")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Bestätigen" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Code erneut senden" })
    ).toBeTruthy();
  });

  it("ohne email-Parameter → klarer Hinweis statt stiller Abbruch", () => {
    window.history.replaceState({}, "", "/email-bestaetigen");
    render(
      <LangProvider>
        <EmailConfirmation />
      </LangProvider>
    );
    expect(
      screen.getByText("Registrierungskontext fehlt. Bitte registriere dich erneut.")
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Noch kein Konto? Registrieren" })
    ).toBeTruthy();
  });

  it("unterstützt alte username-Links als Fallback", () => {
    window.history.replaceState({}, "", "/email-bestaetigen?username=legacy@example.com");
    render(
      <LangProvider>
        <EmailConfirmation />
      </LangProvider>
    );
    expect(screen.getByLabelText("Bestätigungscode")).toBeTruthy();
  });

  it("leeres Code-Feld → Fehlermeldung, kein API-Call", async () => {
    renderConfirm();
    fireEvent.submit(
      screen.getByRole("button", { name: "Bestätigen" }).closest("form")!
    );
    expect(
      await screen.findByText("Bitte gib den Bestätigungscode ein.")
    ).toBeTruthy();
    expect(cognitoConfirmSignUp).not.toHaveBeenCalled();
  });

  it("gültiger Code → ConfirmSignUp-Aufruf, Erfolgs-Anzeige, Link zur Anmeldung", async () => {
    const mockConfirm = cognitoConfirmSignUp as ReturnType<typeof vi.fn>;
    mockConfirm.mockResolvedValueOnce(undefined);
    renderConfirm("confirm@example.com");
    fireEvent.change(screen.getByLabelText("Bestätigungscode"), {
      target: { value: "123456" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Bestätigen" }).closest("form")!
    );
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm).toHaveBeenCalledWith({
      username: "confirm@example.com",
      code: "123456",
    });
    expect(
      await screen.findByText(/Deine E-Mail wurde bestätigt/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Weiter zur Anmeldung" })
    ).toBeTruthy();
  });

  it("falscher Code (CodeMismatch) → verständliche Fehlermeldung", async () => {
    const mockConfirm = cognitoConfirmSignUp as ReturnType<typeof vi.fn>;
    mockConfirm.mockRejectedValueOnce(
      new CognitoAuthError("code-mismatch", "Invalid code")
    );
    renderConfirm();
    fireEvent.change(screen.getByLabelText("Bestätigungscode"), {
      target: { value: "999999" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Bestätigen" }).closest("form")!
    );
    expect(
      await screen.findByText(/Der Bestätigungscode ist ungültig/i)
    ).toBeTruthy();
  });

  it("abgelaufener Code (ExpiredCode) → Hinweis auf neuen Code", async () => {
    const mockConfirm = cognitoConfirmSignUp as ReturnType<typeof vi.fn>;
    mockConfirm.mockRejectedValueOnce(
      new CognitoAuthError("code-expired", "Code expired")
    );
    renderConfirm();
    fireEvent.change(screen.getByLabelText("Bestätigungscode"), {
      target: { value: "000000" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Bestätigen" }).closest("form")!
    );
    expect(
      await screen.findByText(/Der Code ist abgelaufen/i)
    ).toBeTruthy();
  });

  it("ResendConfirmationCode → Bestätigungsnachricht", async () => {
    const mockResend = cognitoResendConfirmationCode as ReturnType<typeof vi.fn>;
    mockResend.mockResolvedValueOnce(undefined);
    renderConfirm("resend@example.com");
    fireEvent.click(
      screen.getByRole("button", { name: "Code erneut senden" })
    );
    await waitFor(() => expect(mockResend).toHaveBeenCalledTimes(1));
    expect(mockResend).toHaveBeenCalledWith({ username: "resend@example.com" });
    expect(
      await screen.findByText(/Ein neuer Code wurde an deine E-Mail-Adresse gesendet/i)
    ).toBeTruthy();
  });
});
