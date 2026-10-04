import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { LangProvider } from "./i18n";
import { fetchJobs, fetchMatches, fetchModels } from "./api";
import { __resetModelsCacheForTests } from "./hooks/useAvailableModels";
import type { JobsResponse, Job, MatchResponse, ModelsResponse } from "./types";

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

const job: Job = {
  slug: "cloud-1",
  title: "Cloud Engineer",
  company_name: "Acme",
  location: ["Berlin"],
  remote: true,
  tags: ["aws"],
  url: "https://example.com/job",
  created_at: "2026-01-01",
  source: ["arbeitnow"],
};

const singleModel: ModelsResponse = {
  models: [{ id: "model-x", name: "Model X" }],
  defaultModel: "model-x",
  fallbackModel: null,
  recommendedModel: null,
};

// SEARCH-BG-POSITION-01: Atrium-Hintergrund trägt den Search-Bereich.
// Sollte: Hero -> .search-stage (Suchmaske + Ergebnisliste) -> Footer.
// Kein Bildstreifen am Seitenende mehr.
describe("SEARCH-BG-POSITION-01: Hintergrund trägt Search-Bereich, kein Streifen am Ende", () => {
  beforeEach(() => {
    localStorage.setItem("mj-lang", "de");
    window.history.pushState({}, "", "/top");
    __resetModelsCacheForTests();
    vi.mocked(fetchModels).mockResolvedValue(singleModel);
    vi.mocked(fetchJobs).mockResolvedValue({
      jobs: [job],
      meta: { totalScanned: 1, totalFiltered: 1 },
    } as JobsResponse);
    vi.mocked(fetchMatches).mockResolvedValue({
      matches: [{ score: 90, why: "passt", prepare: "Frage", job }],
      meta: { evaluated: 1, totalFound: 1, displayedInitially: 5 },
    } as MatchResponse);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderApp() {
    return render(
      <LangProvider>
        <App />
      </LangProvider>
    );
  }

  function follows(a: Element, b: Element) {
    return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
  }

  it("Leerzustand: Hero -> search-stage (Suchmaske) -> Footer, ohne Streifen", () => {
    const { container } = renderApp();
    const hero = container.querySelector("header.hero");
    const stage = container.querySelector(".search-stage");
    const form = container.querySelector(".search-card");
    const footer = container.querySelector("footer");

    expect(hero).toBeTruthy();
    expect(stage).toBeTruthy();
    expect(form).toBeTruthy();
    expect(footer).toBeTruthy();
    // Suchmaske liegt im Hintergrund-Container.
    expect(stage?.contains(form as Element)).toBe(true);
    // Reihenfolge Hero -> Stage -> Footer.
    expect(follows(hero as Element, stage as Element)).toBe(true);
    expect(follows(stage as Element, footer as Element)).toBe(true);
    // Alter Bildstreifen am Seitenende existiert nicht mehr.
    expect(container.querySelector(".lobby-band")).toBeNull();
  });

  it("Mit Ergebnissen: Ergebnisliste im Stage, Stage vor Footer, kein Streifen", async () => {
    const { container } = renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "AWS" } });
    fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Cloud Engineer" } });
    fireEvent.change(screen.getByLabelText("Stadt oder PLZ"), { target: { value: "Berlin" } });
    fireEvent.click(screen.getByRole("button", { name: "Meine Treffer finden" }));

    await waitFor(() => expect(container.querySelector(".results-workspace")).toBeTruthy());

    const stage = container.querySelector(".search-stage");
    const results = container.querySelector(".results-workspace");
    const footer = container.querySelector("footer");
    expect(stage?.contains(results as Element)).toBe(true);
    expect(follows(stage as Element, footer as Element)).toBe(true);
    expect(container.querySelector(".lobby-band")).toBeNull();
  });

  it("Auth- und Landing-Routen erhalten keinen Search-Hintergrund", () => {
    cleanup();
    window.history.pushState({}, "", "/anmelden");
    const { container: login } = render(
      <LangProvider>
        <App />
      </LangProvider>
    );
    expect(login.querySelector(".search-stage")).toBeNull();
    expect(login.querySelector("header.hero")).toBeNull();

    cleanup();
    window.history.pushState({}, "", "/");
    const { container: landing } = render(
      <LangProvider>
        <App />
      </LangProvider>
    );
    expect(landing.querySelector(".search-stage")).toBeNull();
  });
});
