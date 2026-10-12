import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";
import { LangProvider } from "./i18n";
import { fetchModels } from "./api";
import { __resetModelsCacheForTests } from "./hooks/useAvailableModels";
import type { ModelsResponse } from "./types";

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

const singleModel: ModelsResponse = {
  models: [{ id: "model-x", name: "Model X" }],
  defaultModel: "model-x",
  fallbackModel: null,
  recommendedModel: null,
};

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  __resetModelsCacheForTests();
  vi.mocked(fetchModels).mockReset();
  vi.mocked(fetchModels).mockResolvedValue(singleModel);
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

describe("AUTH-UI-01: Routen Login ↔ Registrierung ↔ Job Matcher mit Cognito OIDC", () => {
  it("/anmelden rendert Login-Maske mit Navigationen, ohne Passwortfeld", () => {
    renderAt("/anmelden");
    expect(screen.getByRole("heading", { name: "Anmelden" })).toBeTruthy();
    expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();
    expect(screen.queryByLabelText("Passwort")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Noch kein Konto? Registrieren" }).getAttribute("href")
    ).toBe("/registrieren");
    expect(
      screen
        .getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
        .getAttribute("href")
    ).toBe("/search");
  });

  it("/registrieren rendert Registrierungsmaske mit Navigationen, ohne Passwortfelder", () => {
    renderAt("/registrieren");
    expect(screen.getByRole("heading", { name: "Konto erstellen" })).toBeTruthy();
    expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();
    expect(screen.queryByLabelText("Passwort")).toBeNull();
    expect(screen.queryByLabelText("Passwort wiederholen")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Bereits registriert? Anmelden" }).getAttribute("href")
    ).toBe("/anmelden");
    expect(
      screen
        .getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
        .getAttribute("href")
    ).toBe("/search");
  });

  it("Gastmodus /search rendert weiterhin die Jobsuche (kein Auth-Zwang)", () => {
    renderAt("/search");
    expect(screen.getByRole("button", { name: "Meine Treffer finden" })).toBeTruthy();
  });
});

describe("NEURAL-GATEWAY-01 + FLOATING-FOOTER-01: Auth-Hintergrund und Footer auf Auth-Seiten", () => {
  it("rendert Gateway-Ebenen auf /anmelden (Bild, 5 Bahnen, 5 Impulse, Glow)", () => {
    const { container } = renderAt("/anmelden");
    const gateway = container.querySelector(".auth-gateway");
    expect(gateway).toBeTruthy();
    expect(gateway?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".auth-gateway__image")).toBeTruthy();
    expect(container.querySelectorAll(".conduit").length).toBe(5);
    expect(container.querySelectorAll(".light-dot").length).toBe(5);
    expect(container.querySelector(".auth-gateway__glow")).toBeTruthy();
  });

  it("rendern kein Gateway auf /search (keine Regression der Searchpage)", () => {
    const { container } = renderAt("/search");
    expect(container.querySelector(".auth-gateway")).toBeNull();
  });

  it("Footer bleibt auf /anmelden mit allen Legal-/Meta-Inhalten erreichbar", () => {
    const { container } = renderAt("/anmelden");
    const footer = container.querySelector("footer.footer");
    expect(footer).toBeTruthy();
    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum");
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/datenschutz");
    expect(screen.getByRole("link", { name: "Datenschutzprinzipien" })).toHaveAttribute(
      "href",
      "/datenschutzprinzipien"
    );
    // Dock-Scope presence: auth-main und .footer sind DOM-Geschwister
    expect(container.querySelector("main.auth-main ~ footer.footer")).toBeTruthy();
  });
});
