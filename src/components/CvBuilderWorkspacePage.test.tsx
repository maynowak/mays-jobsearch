import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
