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

describe("AUTH-UI-01: Routen Login ↔ Registrierung ↔ Job Matcher (reine GUI)", () => {
  it("/anmelden rendert Login-Maske mit allen Navigationen", () => {
    renderAt("/anmelden");
    expect(screen.getByRole("heading", { name: "Anmelden" })).toBeTruthy();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeTruthy();
    expect(screen.getByLabelText("Passwort")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Passwort vergessen?" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Noch kein Konto? Registrieren" }).getAttribute("href")
    ).toBe("/registrieren");
    expect(
      screen
        .getByRole("link", { name: "Zurück zum Job Matcher (als Gast fortfahren)" })
        .getAttribute("href")
    ).toBe("/search");
  });

  it("/registrieren rendert Registrierungsmaske mit allen Navigationen", () => {
    renderAt("/registrieren");
    expect(screen.getByRole("heading", { name: "Konto erstellen" })).toBeTruthy();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeTruthy();
    expect(screen.getByLabelText("Passwort", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("Passwort wiederholen")).toBeTruthy();
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
