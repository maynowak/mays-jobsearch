import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { LangProvider } from "./i18n";
import App from "./App";
import type { ModelsResponse } from "./types";

// JOBMATCHER-PROFILE-ROUTING-FIX-01
// Regression: /profil ist eine eigene Route und darf nicht vom
// Landing-Early-Return abgefangen werden.

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    fetchJobs: vi.fn(),
    fetchMatches: vi.fn(),
    fetchModels: vi.fn(),
    fetchModel: vi.fn(),
    createProfile: vi.fn(),
    analyzeATS: vi.fn(),
  };
});

const authState: { isAuthenticated: boolean } = { isAuthenticated: false };

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({
    isLoading: false,
    error: undefined,
    isAuthenticated: authState.isAuthenticated,
    user: authState.isAuthenticated
      ? { profile: { sub: "profile-sub-123", email: "profil@example.invalid", name: "Test Person" } }
      : undefined,
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
  }),
}));

beforeEach(async () => {
  localStorage.setItem("mj-lang", "de");
  authState.isAuthenticated = false;
  const { __resetModelsCacheForTests } = await import("./hooks/useAvailableModels");
  const { fetchModels } = await import("./api");
  const models: ModelsResponse = {
    models: [{ id: "model-x", name: "Model X" }],
    defaultModel: "model-x",
    fallbackModel: null,
    recommendedModel: null,
  };
  __resetModelsCacheForTests();
  vi.mocked(fetchModels).mockReset();
  vi.mocked(fetchModels).mockResolvedValue(models);
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/search");
});

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <LangProvider>
      <App />
    </LangProvider>
  );
}

describe("PROFILE-ROUTING-FIX-01: /profil rendert die Profilseite", () => {
  it("/ zeigt weiterhin die Landingpage (kein Profil)", () => {
    const { container } = renderAt("/");
    expect(container.querySelector(".landing")).toBeTruthy();
    expect(screen.queryByText("Benutzer-ID")).toBeNull();
    expect(screen.queryByText("profile.title")).toBeNull();
  });

  it("/profil rendert bei Authentifizierung die Profilseite mit Daten", () => {
    authState.isAuthenticated = true;
    const { container } = renderAt("/profil");
    // Profilseite, nicht Landing-Hero
    expect(container.querySelector(".landing")).toBeNull();
    expect(screen.getByRole("heading", { name: "Profil" })).toBeTruthy();
    expect(screen.getByText("profile-sub-123")).toBeTruthy();
    expect(screen.getByText("profil@example.invalid")).toBeTruthy();
    // Logout gibt es in der Profilkarte (Navbar hat zusätzlich einen eigenen).
    const main = container.querySelector("main") as HTMLElement;
    expect(within(main).getByRole("button", { name: "Logout" })).toBeTruthy();
    // Keine rohen i18n-Keys
    expect(screen.queryByText("profile.title")).toBeNull();
  });

  it("/profil ohne Anmeldung zeigt keine Profildaten", () => {
    authState.isAuthenticated = false;
    const { container } = renderAt("/profil");
    expect(container.querySelector(".landing")).toBeNull();
    expect(screen.getByText("Du bist nicht angemeldet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeTruthy();
    expect(screen.queryByText("profil@example.invalid")).toBeNull();
    expect(screen.queryByText("Benutzer-ID")).toBeNull();
    expect(screen.queryByRole("button", { name: "Logout" })).toBeNull();
  });

  it("Navbar-Profil-Link zeigt auf /profil und ist auf der Profilseite vorhanden", () => {
    authState.isAuthenticated = true;
    renderAt("/search");
    const link = screen.getByRole("link", { name: "Profil" });
    expect(link.getAttribute("href")).toBe("/profil");

    cleanup();
    const { container } = renderAt("/profil");
    const onProfile = container.querySelector('a.nav-link[href="/profil"]');
    expect(onProfile).toBeTruthy();
  });

  it("Navbar behält auf /profil die Suche als Navigation", () => {
    authState.isAuthenticated = true;
    const { container } = renderAt("/profil");
    const navLinks = container.querySelector(".nav-links");
    expect(navLinks?.querySelector('a[href="/search"]')).toBeTruthy();
  });

  it("/search bleibt die Jobsuche (keine Regression)", () => {
    renderAt("/search");
    expect(screen.getByRole("button", { name: "Meine Treffer finden" })).toBeTruthy();
    expect(screen.queryByText("Benutzer-ID")).toBeNull();
  });

  it("/impressum bleibt unverändert", () => {
    renderAt("/impressum");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByText("Benutzer-ID")).toBeNull();
  });
});
