import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "../i18n";

const authState = vi.hoisted(() => ({
  current: {
    isLoading: false,
    isAuthenticated: false,
    user: undefined as { profile?: { sub?: string; iss?: string } } | undefined,
  },
}));

vi.mock("react-oidc-context", () => ({
  useAuth: () => authState.current,
}));

import CvBuilderWorkspacePage from "./CvBuilderWorkspacePage";

function renderPage() {
  return render(
    <LangProvider>
      <CvBuilderWorkspacePage />
    </LangProvider>
  );
}

async function enterDraft(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Leeren Lebenslauf erstellen" }));
  await screen.findByRole("heading", { name: "Strukturierter Lebenslauf-Editor" });
  fireEvent.click(screen.getByText("Persönliche Angaben", { selector: "summary span" }));
  fireEvent.change(screen.getByLabelText("Vollständiger Name"), { target: { value: name } });
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  window.history.replaceState({}, "", "/cv-builder/workspace");
  authState.current = { isLoading: false, isAuthenticated: false, user: undefined };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("CV-BUILDER-03A direct workspace identity isolation", () => {
  it("clears direct-route CV data when the identity changes", async () => {
    const view = renderPage();
    await enterDraft("Direkter Workspace A");

    authState.current = {
      isLoading: false,
      isAuthenticated: true,
      user: { profile: { sub: "direct-user-b", iss: "https://issuer.example.invalid" } },
    };
    view.rerender(
      <LangProvider>
        <CvBuilderWorkspacePage />
      </LangProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Strukturierter Lebenslauf-Editor" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Die angemeldete Identität hat sich geändert. Diese Übergabe wurde nicht übernommen.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Direkter Workspace A")).not.toBeInTheDocument();
  });


  it("asks before closing a dirty workspace editor and keeps the draft on cancel", async () => {
    renderPage();
    await enterDraft("Workspace Schließen");

    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf-Editor schließen" }));
    const prompt = await screen.findByRole("alertdialog", { name: "CV-Workspace schließen?" });
    expect(within(prompt).getByText(/ungespeicherte Änderungen/i)).toBeInTheDocument();

    fireEvent.click(within(prompt).getByRole("button", { name: "Weiter bearbeiten" }));
    expect(screen.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Workspace Schließen")).toBeInTheDocument();
  });

  it("discards only after the explicit close-prompt decision", async () => {
    renderPage();
    await enterDraft("Workspace Verwerfen");

    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf-Editor schließen" }));
    const prompt = await screen.findByRole("alertdialog", { name: "CV-Workspace schließen?" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Verwerfen und schließen" }));

    expect(await screen.findByRole("heading", { name: "CV-Workspace starten" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Workspace Verwerfen")).not.toBeInTheDocument();
    expect(screen.getByText("Dieser Workspace wurde direkt geöffnet. Der Editor wurde geschlossen; Sitzungsprofile bleiben verfügbar.")).toBeInTheDocument();
  });

  it("saves the draft into the session list before closing when explicitly chosen", async () => {
    renderPage();
    await enterDraft("Workspace Sitzung");

    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf-Editor schließen" }));
    const prompt = await screen.findByRole("alertdialog", { name: "CV-Workspace schließen?" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Entwurf in Sitzungsliste übernehmen" }));

    expect(await screen.findByRole("heading", { name: "CV-Workspace starten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter bearbeiten" })).toBeInTheDocument();
    expect(screen.getByText(/Sitzungsprofile bleiben verfügbar/i)).toBeInTheDocument();
  });

  it("keeps RIS PDF saving disabled without a verified identity", async () => {
    renderPage();
    await enterDraft("Workspace ohne Anmeldung");

    const save = screen.getByRole("button", { name: "PDF dauerhaft speichern" });
    expect(save).toBeDisabled();
    expect(screen.getByText("Bitte melde dich an, um das PDF dauerhaft zu speichern.")).toBeInTheDocument();
  });

  it("shows validation and login blockers together for permanent PDF saving", async () => {
    renderPage();
    await enterDraft("Workspace Sperrgründe");
    fireEvent.click(screen.getByRole("button", { name: /Berufserfahrung hinzufügen/ }));
    fireEvent.change(screen.getByLabelText("Arbeitgeber"), { target: { value: "Acme" } });

    expect(await screen.findByText("PDF dauerhaft speichern ist gesperrt:")).toBeInTheDocument();
    expect(screen.getByText("PDF dauerhaft speichern ist erst möglich, wenn die markierten Felder korrigiert sind.")).toBeInTheDocument();
    expect(screen.getByText("Bitte melde dich an, um das PDF dauerhaft zu speichern.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF dauerhaft speichern" })).toBeDisabled();
  });

  it("does not treat the initial auth load as an identity change", async () => {
    authState.current = { isLoading: true, isAuthenticated: false, user: undefined };
    const view = renderPage();
    await enterDraft("Direkter Workspace Initial");

    authState.current = {
      isLoading: false,
      isAuthenticated: true,
      user: { profile: { sub: "direct-user-a", iss: "https://issuer.example.invalid" } },
    };
    view.rerender(
      <LangProvider>
        <CvBuilderWorkspacePage />
      </LangProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" })).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Direkter Workspace Initial")).toBeInTheDocument();
  });
});
