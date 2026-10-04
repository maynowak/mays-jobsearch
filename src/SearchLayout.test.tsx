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

// SEARCH-HERO-BG-03: Layout-Reihenfolge der Search-Seite absichern.
// Sollte: Hero -> Suchmaske -> Ergebnisliste -> Lobby-Band -> Footer.
describe("SEARCH-HERO-BG-03: Reihenfolge Suchmaske / Ergebnisse / Bildband / Footer", () => {
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

  it("Leerzustand: Suchmaske vor Bildband, Bildband vor Footer", () => {
    const { container } = renderApp();
    const form = container.querySelector(".search-card");
    const band = container.querySelector(".lobby-band");
    const footer = container.querySelector("footer");
    expect(form).toBeTruthy();
    expect(band).toBeTruthy();
    expect(footer).toBeTruthy();
    expect(follows(form as Element, band as Element)).toBe(true);
    expect(follows(band as Element, footer as Element)).toBe(true);
  });

  it("Mit Ergebnissen: Ergebnisliste vor Bildband, Bildband vor Footer", async () => {
    const { container } = renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "AWS" } });
    fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Cloud Engineer" } });
    fireEvent.change(screen.getByLabelText("Stadt oder PLZ"), { target: { value: "Berlin" } });
    fireEvent.click(screen.getByRole("button", { name: "Meine Treffer finden" }));

    await waitFor(() => expect(container.querySelector(".results-workspace")).toBeTruthy());

    const results = container.querySelector(".results-workspace");
    const band = container.querySelector(".lobby-band");
    const footer = container.querySelector("footer");
    expect(band).toBeTruthy();
    // Ergebnisliste vollständig VOR dem Band, Band VOR dem Footer.
    expect(follows(results as Element, band as Element)).toBe(true);
    expect(follows(band as Element, footer as Element)).toBe(true);
    // Band liegt nicht innerhalb des Inhaltscontainers.
    expect((band as Element).closest("main")).toBeNull();
  });
});