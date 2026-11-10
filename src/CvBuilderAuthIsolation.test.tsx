import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LangProvider } from "./i18n";

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: true,
    user: { profile: { sub: "auth-user-a", iss: "https://issuer.example.invalid" } },
  } as { isAuthenticated: boolean; user?: { profile?: { sub?: string; iss?: string } } },
}));

vi.mock("react-oidc-context", () => ({
  useAuth: () => authState.current,
}));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchModels: vi.fn(async () => ({
      models: [{ id: "mock-model", name: "Mock Model" }],
      defaultModel: "mock-model",
      recommendedModel: "mock-model",
      fallbackModel: null,
    })),
    fetchModel: vi.fn(async () => "mock-model"),
  };
});

import App from "./App";

function renderApp() {
  return render(
    <LangProvider>
      <App />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  window.history.replaceState({}, "", "/search");
  authState.current = {
    isAuthenticated: true,
    user: { profile: { sub: "auth-user-a", iss: "https://issuer.example.invalid" } },
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("CV-BUILDER-01A auth session isolation", () => {
  it("clears the structured CV draft when the authenticated identity changes", async () => {
    const view = renderApp();
    fireEvent.click(await screen.findByRole("tab", { name: "Lebenslauf hochladen" }));
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf erstellen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Leeren Lebenslauf erstellen" }));
    await screen.findByRole("heading", { name: "Strukturierter Lebenslauf-Editor" });
    fireEvent.click(screen.getByText("Persönliche Angaben", { selector: "summary span" }));
    fireEvent.change(screen.getByLabelText("Vollständiger Name"), {
      target: { value: "Nutzer A" },
    });

    authState.current = {
      isAuthenticated: true,
      user: { profile: { sub: "auth-user-b", iss: "https://issuer.example.invalid" } },
    };
    view.rerender(
      <LangProvider>
        <App />
      </LangProvider>
    );

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Strukturierter Lebenslauf-Editor" })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("tab", { name: "Lebenslauf hochladen" }));
    fireEvent.click(screen.getByRole("button", { name: "Lebenslauf erstellen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Leeren Lebenslauf erstellen" }));
    await screen.findByRole("heading", { name: "Strukturierter Lebenslauf-Editor" });
    fireEvent.click(screen.getByText("Persönliche Angaben", { selector: "summary span" }));
    expect(screen.getByLabelText("Vollständiger Name")).toHaveValue("");
  });
});
