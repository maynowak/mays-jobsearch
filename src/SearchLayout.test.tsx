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

// SEARCH-WORLD-01: "Future Search World" trägt den Search-Bereich vom Hero
// bis zum Footer. Sollte: Hero -> .search-world (Suchmaske + Ergebnisliste) -> Footer,
// mit Hintergrund-/Overlay-/Deko-/Fade-/Content-Layern. Kein Bildstreifen am Ende.
describe("SEARCH-WORLD-01: Search-World trägt Search-Bereich, kein Streifen am Ende", () => {
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

  it("Leerzustand: Hero -> search-world (Suchmaske) -> Footer, alle Layer vorhanden", () => {
    const { container } = renderApp();
    const hero = container.querySelector("header.hero");
    const world = container.querySelector(".search-world");
    const form = container.querySelector(".search-card");
    const footer = container.querySelector("footer");

    expect(hero).toBeTruthy();
    expect(world).toBeTruthy();
    expect(form).toBeTruthy();
    expect(footer).toBeTruthy();
    // Suchmaske liegt im Content-Layer der Welt.
    expect(world?.contains(form as Element)).toBe(true);
    // Reihenfolge Hero -> World -> Footer.
    expect(follows(hero as Element, world as Element)).toBe(true);
    expect(follows(world as Element, footer as Element)).toBe(true);

    // Layer-Vollständigkeit: Background, Top-Light, Intelligence, Floor, Fade, Content.
    expect(world?.querySelector(".search-world__background")).toBeTruthy();
    expect(world?.querySelector(".search-world__top-light")).toBeTruthy();
    expect(world?.querySelector(".search-world__intelligence")).toBeTruthy();
    expect(world?.querySelector(".search-world__floor")).toBeTruthy();
    expect(world?.querySelector(".search-world__fade")).toBeTruthy();
    expect(world?.querySelector(".search-world__content")).toBeTruthy();

    // SEARCH-WORLD-02: Portal, Deck und Boden sind rein dekorativ.
    for (const sel of [
      ".search-world__top-light",
      ".search-world__intelligence",
      ".search-world__floor",
      ".search-world__fade",
    ]) {
      expect(world?.querySelector(sel)?.getAttribute("aria-hidden")).toBe("true");
    }
    // Boden liegt vor dem Footer (kein weisses Loch dazwischen).
    const floor = world?.querySelector(".search-world__floor");
    if (floor) expect(follows(floor as Element, footer as Element)).toBe(true);

    // Deko ist rein dekorativ (aria-hidden) und liegt AUSSERHALB des Contents.
    const intel = world?.querySelector(".search-world__intelligence");
    expect(intel?.getAttribute("aria-hidden")).toBe("true");
    expect(intel?.contains(form as Element)).toBe(false);

    // Alter Bildstreifen / alte Stage existiert nicht mehr.
    expect(container.querySelector(".lobby-band")).toBeNull();
    expect(container.querySelector(".search-stage")).toBeNull();
  });

  it("Mit Ergebnissen: Ergebnisliste im World, World vor Footer, kein Streifen", async () => {
    const { container } = renderApp();

    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "AWS" } });
    fireEvent.change(screen.getByLabelText("Zielrolle"), { target: { value: "Cloud Engineer" } });
    fireEvent.change(screen.getByLabelText("Stadt oder PLZ"), { target: { value: "Berlin" } });
    fireEvent.click(screen.getByRole("button", { name: "Meine Treffer finden" }));

    await waitFor(() => expect(container.querySelector(".results-workspace")).toBeTruthy());

    const world = container.querySelector(".search-world");
    const results = container.querySelector(".results-workspace");
    const footer = container.querySelector("footer");
    expect(world?.contains(results as Element)).toBe(true);
    expect(follows(world as Element, footer as Element)).toBe(true);
    expect(container.querySelector(".lobby-band")).toBeNull();
    expect(container.querySelector(".search-stage")).toBeNull();
  });

  it("Auth- und Landing-Routen erhalten keinen Search-Hintergrund", () => {
    cleanup();
    window.history.pushState({}, "", "/anmelden");
    const { container: login } = render(
      <LangProvider>
        <App />
      </LangProvider>
    );
    expect(login.querySelector(".search-world")).toBeNull();
    expect(login.querySelector("header.hero")).toBeNull();

    cleanup();
    window.history.pushState({}, "", "/");
    const { container: landing } = render(
      <LangProvider>
        <App />
      </LangProvider>
    );
    expect(landing.querySelector(".search-world")).toBeNull();
  });
});
