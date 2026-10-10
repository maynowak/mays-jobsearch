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
