import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
    expect(world?.querySelector(".search-world__fade")).toBeTruthy();
    // SEARCH-WORLD-09: Der Boden liegt nicht mehr INNERHALB der World, sondern
    // als letzter Abschluss hinter dem Footer.
    expect(world?.querySelector(".search-world__floor")).toBeNull();
    expect(container.querySelector(".search-world__floor")).toBeTruthy();
    expect(world?.querySelector(".search-world__content")).toBeTruthy();

    // SEARCH-WORLD-02: Portal, Deck und Boden sind rein dekorativ.
    for (const sel of [".search-world__top-light", ".search-world__intelligence", ".search-world__fade"]) {
      expect(world?.querySelector(sel)?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(container.querySelector(".search-world__floor")?.getAttribute("aria-hidden")).toBe("true");
    // SEARCH-WORLD-09: Das Podium kommt NACH dem Footer (letzter Abschluss)
    // statt davor — kein weisses Loch dazwischen, da der Fade den World-
    // Abschluss bildet.
    const floor = container.querySelector(".search-world__floor");
    if (floor) expect(follows(footer as Element, floor as Element)).toBe(true);

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

  it("SEARCH-WORLD-08: Column-Gruppe ist zentriert, untere Welt bleibt im Fluss und kompakt", async () => {
    // Regression: `padding-left: 36% / padding-right: 3%` + `space-around`
    // schob die AI/MATCH/ATS-Gruppe messbar nach rechts (bei 1440 px:
    // Gruppenmitte 957 px bei Viewportmitte 720 px = +237 px). Symmetrie +
    // center ist die stabile Invariarte fuer eine mittige Gruppe.
    const css = await readFile(resolve(process.cwd(), "src/styles.css"), "utf8");

    const rule = (selector: string): string => {
      const m = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
      expect(m, `Regel .${selector} nicht gefunden`).toBeTruthy();
      return m![1];
    };

    const cols = rule("search-world__columns");
    const pl = cols.match(/padding-left:\s*([\d.]+)%/)?.[1];
    const pr = cols.match(/padding-right:\s*([\d.]+)%/)?.[1];
    // Symmetrisch -> die Gruppe sitzt auf der Viewport-Achse.
    expect(pl, "padding-left als % erwartet").toBeTruthy();
    expect(pr, "padding-right als % erwartet").toBeTruthy();
    expect(pl).toBe(pr);
    expect(cols).toMatch(/justify-content:\s*center/);

    // SW-05 bleibt: die untere Welt ist im normalen Fluss, nicht verankert.
    for (const sel of ["search-world__columns", "search-world__intelligence", "search-world__fade"]) {
      expect(rule(sel)).toMatch(/position:\s*relative/);
      expect(rule(sel)).not.toMatch(/bottom:/);
    }
    // SEARCH-WORLD-09: Das Podium bleibt im normalen Fluss (nur hinter dem
    // Footer platziert) und darf nicht section-verankert werden.
    const podium = rule("search-world__floor");
    expect(podium).toMatch(/position:\s*relative/);
    expect(podium).not.toMatch(/bottom:/);
  });

  it("SEARCH-WORLD-07: Results bekommen den groesseren Breitenanteil, Sidebar bleibt kompakt", async () => {
    // Regression: `max-width: 1220px` auf dem Workspace-Container liess auf einem
    // 1440px-Viewport nur 788px fuer die Results (55% der Breite) zu -> die
    // Card wirkte als schmaler vertikaler Datenstreifen. Der Deckel ist angehoben;
    // die Sidebar bleibt bewusst 360px und das Grid 360px/1fr (Results = Rest).
    const css = await readFile(resolve(process.cwd(), "src/styles.css"), "utf8");

    const rule = (selector: string): string => {
      const m = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
      expect(m, `Regel .${selector} nicht gefunden`).toBeTruthy();
      return m![1];
    };

    const container = rule("container\\.layout-search");
    const cap = Number(container.match(/max-width:\s*(\d+)px/)?.[1] ?? 0);
    // Genug Reserve, damit die Results den verfuegbaren Viewport ausschoepfen.
    expect(cap).toBeGreaterThanOrEqual(1400);

    // Sidebar bleibt eine kompakte Steuerzentrale, kein Redesign.
    expect(rule("search-sidebar")).toMatch(/flex:\s*0 0 360px/);

    // Desktop-Grid unveraendert: 360px Sidebar, Rest fuer die Results.
    const gridBlock = css.match(/@media \(min-width: 900px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(gridBlock).toMatch(/grid-template-columns:\s*360px 1fr/);

    // Keine kuenstliche Begrenzung der Results-Spalte oder der Card -> das war
    // die Ursache der Saeulenwirkung.
    expect(rule("results-workspace")).not.toMatch(/max-width/);
    expect(rule("match-card")).not.toMatch(/max-width/);

    // Einspaltig bleibt einspaltig: keine Mehrspalten-/Raster-/Masonry-Regel.
    expect(rule("match-list")).not.toMatch(/grid-template-columns|column-count|columns:/);
  });

  it("SEARCH-WORLD-06: Results-Workspace ist visuell OFFEN (kein Turm, keine Seitenkante)", async () => {
    // Regression: SW-05 hatte Hintergrund + 3px-Cyan-Rand + Radius + Schatten
    // + Padding um die GESAMTE Ergebnisliste. Das erzeugte eine hohe, geschlossene
    // vertikale "Results-Sa(e)ule". Der Bereich muss strukturell Flow-Container
    // bleiben, visuell aber transparent sein — nur AI/MATCH/ATS sind Saulen.
    const css = await readFile(resolve(process.cwd(), "src/styles.css"), "utf8");

    const rule = (selector: string): string => {
      const m = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
      expect(m, `Regel .${selector} nicht gefunden`).toBeTruthy();
      return m![1];
    };

    const ws = rule("results-workspace");
    expect(ws).toMatch(/background:\s*none/);
    expect(ws).toMatch(/border:\s*0/);
    expect(ws).toMatch(/box-shadow:\s*none/);
    expect(ws).toMatch(/padding:\s*0/);
    // Keine Fläche, keine Seitenkanten, kein Radius, kein Verlauf im Bereich.
    expect(ws).not.toMatch(/linear-gradient|radial-gradient/);
    expect(ws).not.toMatch(/border-(left|right|top|bottom)/);
    expect(ws).toMatch(/border-radius:\s*0/);
    // Struktur bleibt: Flow-Container mit Flex.
    expect(ws).toMatch(/flex:\s*1/);

    // Die Job Card selbst traegt weiterhin ihr eigenes, unveraendertes Design.
    const card = rule("match-card");
    expect(card).toMatch(/background:\s*var\(--main-gradient\)/);
    expect(card).toMatch(/border:\s*3px solid var\(--border-primary\)/);
    expect(card).toMatch(/border-radius:\s*var\(--radius\)/);
    expect(card).toMatch(/box-shadow:/);

    // Klare Zwischenraeume zwischen den einzelnen Cards.
    const list = rule("match-list");
    const gap = Number(list.match(/gap:\s*(\d+)px/)?.[1] ?? 0);
    expect(gap).toBeGreaterThanOrEqual(24);
  });

  it("SEARCH-WORLD-05: Untere Welt liegt im Dokumentfluss NACH dem Content", () => {
    // Regression: Deck/Columns duerfen nie section-verankert sein, sonst
    // landen sie bei wachsender Ergebnisliste hinter den Job Cards.
    const { container } = renderApp();
    // SEARCH-WORLD-09: Das Podium ist nicht mehr Teil dieses Flusses
    // (es liegt hinter dem Footer) — der World-Fluss endet mit dem Fade.
    const order = [
      ".search-world__content",
      ".search-world__columns",
      ".search-world__intelligence",
      ".search-world__fade",
      "footer",
    ].map((sel) => container.querySelector(sel));
    order.forEach((el) => expect(el).toBeTruthy());

    for (let i = 0; i < order.length - 1; i += 1) {
      const current = order[i] as Element;
      const next = order[i + 1] as Element;
      expect(follows(current, next)).toBe(true);
    }
  });

  it("SEARCH-WORLD-09: Halbrundes Podium liegt als letzter Abschluss hinter dem Footer", async () => {
    // Reihenfolge ist hier die eigentliche Anforderung: Das bestehende Podium
    // (`.search-world__floor`, unveraendert wiederverwendet) ist der LETZTE
    // visuelle Abschluss der Seite und liegt hinter dem Footer. Zuvor war es
    // letztes Kind der Search World und stand damit VOR dem Footer.
    const { container } = renderApp();
    const podium = container.querySelector(".search-world__floor");
    const footer = container.querySelector("footer");
    const fade = container.querySelector(".search-world__fade");
    expect(podium).toBeTruthy();
    expect(footer).toBeTruthy();
    expect(fade).toBeTruthy();

    // Fade -> Footer -> Podium.
    expect(follows(fade as Element, footer as Element)).toBe(true);
    expect(follows(footer as Element, podium as Element)).toBe(true);

    // Das Podium ist nicht mehr Teil der Search World (kein Grund, dort
    // weiterhin Platz zu reservieren oder es per overflow zu beschneiden).
    expect(container.querySelector(".search-world .search-world__floor")).toBeNull();

    // Layering: Footer ueber Podium, Podium bleibt rein dekorativ.
    const css = await readFile(resolve(process.cwd(), "src/styles.css"), "utf8");
    const rule = (selector: string): string => {
      const m = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
      expect(m, `Regel .${selector} nicht gefunden`).toBeTruthy();
      return m![1];
    };
    const z = (ruleText: string): number => Number(ruleText.match(/z-index:\s*(-?\d+)/)?.[1] ?? 0);
    expect(z(rule("footer"))).toBeGreaterThan(z(rule("search-world__floor")));
    expect(rule("search-world__floor")).toMatch(/pointer-events:\s*none/);
    // Ueberlappung ohne zusaetzlichen Leerraum: das Podium zieht sich mit
    // negativem margin-top hinter die Fusszeile.
    expect(rule("search-world__floor")).toMatch(/margin-top:\s*calc\(-1\s*\*/);
    // Kein horizontaler Ueberstand mehr (die World-clipte ihn vorher).
    expect(rule("search-world__floor")).toMatch(/width:\s*100%/);
    expect(rule("search-world__floor")).not.toMatch(/width:\s*calc\(/);
  });

  it("SEARCH-WORLD-10: untere World bleibt kompakt, Podium bleibt unberuehrt", async () => {
    // Die Kompression ist eine rein geometrische Groessenentscheidung. Damit sie
    // nicht durch eine spaetere Aenderung still zurueckfaellt, werden die vier
    // Stellschrauben der unteren World als Ober- UND Untergrenzen festgehalten —
    // inklusive der Bedingung, dass der Results->Columns-Atemraum nicht
    // verschwindet und dass die Aenderung das Podium (SW-09) nicht mitzieht.
    const css = await readFile(resolve(process.cwd(), "src/styles.css"), "utf8");
    const rule = (selector: string): string => {
      const m = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
      expect(m, `Regel .${selector} nicht gefunden`).toBeTruthy();
      return m![1];
    };
    // min / bevorzugte vh-Flaeche / max einer clamp()-Deklaration
    const clamp3 = (ruleText: string, prop: string): [number, number, number] => {
      const m = ruleText.match(new RegExp(`${prop}:\\s*clamp\\((\\d+)px,\\s*(\\d+(?:\\.\\d+)?)vh,\\s*(\\d+)px\\)`));
      expect(m, `clamp() fuer ${prop} erwartet`).toBeTruthy();
      return [Number(m![1]), Number(m![2]), Number(m![3])];
    };

    // Obergrenzen: die untere World darf nicht wieder zu einer Etage werden.
    for (const [sel, prop, maxVh, maxPx] of [
      ["search-world__columns", "height", 23, 300],
      ["search-world__intelligence", "height", 21, 260],
      ["search-world__fade", "height", 11, 140],
      ["search-world__columns", "margin-top", 3, 40],
    ] as const) {
      const [min, vh, max] = clamp3(rule(sel), prop);
      expect(vh, `${sel} ${prop}: vh-Anteil`).toBeLessThanOrEqual(maxVh);
      expect(max, `${sel} ${prop}: max`).toBeLessThanOrEqual(maxPx);
      // Untergrenze: nichts darf auf eine unsichtbare Resthoehe fallen.
      expect(min, `${sel} ${prop}: min`).toBeGreaterThanOrEqual(16);
    }

    // Der Uebergang Results -> Columns bleibt wahrnehmbar (nicht 0).
    expect(clamp3(rule("search-world__columns"), "margin-top")[0]).toBeGreaterThanOrEqual(22);

    // SW-05: nichts der unteren World wird section-verankert.
    for (const sel of ["search-world__columns", "search-world__intelligence", "search-world__fade", "search-world__floor"]) {
      expect(rule(sel)).toMatch(/position:\s*relative/);
      expect(rule(sel)).not.toMatch(/bottom:/);
    }

    // SW-09/SW-11: die Kompression darf das Podium nicht mitziehen — Breite,
    // Layering und Footer-Beziehung bleiben auf dem SW-09-Stand, die Hoehe ist
    // in SW-11 bewusst angehoben worden (104 px -> 124 px Obergrenze).
    const podium = rule("search-world__floor");
    const [, , podiumMax] = clamp3(podium, "height");
    expect(podiumMax).toBe(124);
    expect(podium).toMatch(/width:\s*100%/);
    expect(podium).toMatch(/z-index:\s*0/);
    expect(podium).toMatch(/margin-top:\s*calc\(-1\s*\*/);
    expect(podium).toMatch(/pointer-events:\s*none/);
  });

  it("SEARCH-WORLD-11: Podium bleibt sichtbares, blau integriertes Element ohne Bottom-Auslauf", async () => {
    // SW-11 haelt das halbrunde Podium als bewusstes visuelles Element am
    // Seitenende. Drei echte Rueckfall-Risiken werden hier festgeschrieben:
    // 1) die Kuppel muss dauerhaft breiter sichtbar sein als eine Randlinie,
    // 2) sie muss dauerhaft im vorhandenen blauen Farbraum liegen (kein
    //    Zurueckfallen auf ein blasses, faktisch farbloses Glas),
    // 3) der untere Leerraum (Fade) darf nicht wieder wachsen.
    const css = await readFile(resolve(process.cwd(), "src/styles.css"), "utf8");
    const rule = (selector: string, pseudo?: string): string => {
      const re = pseudo
        ? new RegExp(`\\.${selector}::${pseudo}\\s*\\{([^}]*)\\}`)
        : new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`);
      const m = css.match(re);
      expect(m, `Regel .${selector}${pseudo ? `::${pseudo}` : ""} nicht gefunden`).toBeTruthy();
      return m![1];
    };
    // min / vh-Anteil / max
    // Deklariert als clamp(...) oder in calc(-1 * clamp(...)) (negative Ueberdeckung)
    const clamp3 = (t: string, prop: string): [number, number, number] => {
      const m = t.match(new RegExp(`${prop}:[^;]*?clamp\\((\\d+)px,\\s*(\\d+(?:\\.\\d+)?)vh,\\s*(\\d+)px\\)`));
      expect(m, `clamp() fuer ${prop} erwartet`).toBeTruthy();
      return [Number(m![1]), Number(m![2]), Number(m![3])];
    };
    const at = ([min, vh, max]: [number, number, number], vhPx: number) =>
      Math.min(max, Math.max(min, vhPx * vh));
    const overlap = clamp3(rule("search-world__floor"), "margin-top");

    // 1) Sichtbare Kuppel: Hoehe minus Ueberdeckung ueber den Footer.
    // Mindestens 40 px bei jeder Viewport-Hoehe — eine 1px-Linie ist damit
    // ausgeschlossen (vor SW-11 waren es 45 px, davor das Blatt ~1 px).
    for (const vhPx of [320, 480, 600, 700, 768, 800, 844, 900, 1024, 1080, 1200]) {
      const visible = at(clamp3(rule("search-world__floor"), "height"), vhPx) - at(overlap, vhPx);
      expect(visible, `sichtbare Kuppel bei ${vhPx}px Viewport-Hoehe`).toBeGreaterThanOrEqual(40);
    }
    // Die Ueberdeckung muss kleiner sein als die Box, sonst verschwindet die
    // Kuppel komplett hinter dem Footer.
    expect(overlap[1]).toBeLessThan(clamp3(rule("search-world__floor"), "height")[1]);

    // 2) Blaue Integration: vorhandene World-Toene, kein blasses Glas.
    const before = rule("search-world__floor", "before");
    expect(before).toMatch(/rgba\(70, 150, 205, 0\.3\)/);
    expect(before).toMatch(/rgba\(133, 196, 238, 0\.42\)/);
    // Lichtkante des Bogens muss als Form lesbar bleiben (>= 0.5 Deckkraft).
    const edge = rule("search-world__floor", "after").match(/border-top:[^;]*rgba\(34, 211, 238, ([\d.]+)\)/);
    expect(edge, "Bogen-Lichtkante nicht gefunden").toBeTruthy();
    expect(Number(edge![1])).toBeGreaterThanOrEqual(0.5);

    // 3) Bottom-Space: der Fade bleibt kurz und wird nicht wieder zum Feld.
    const [, fadeVh, fadeMax] = clamp3(rule("search-world__fade"), "height");
    expect(fadeVh).toBeLessThanOrEqual(9);
    expect(fadeMax).toBeLessThanOrEqual(120);

    // SW-09 bleibt Grundlage: Podium hinter dem Footer, rein dekorativ, Form
    // unveraendert halbrund/elliptisch, ausserhalb der Search World.
    const podium = rule("search-world__floor");
    expect(podium).toMatch(/width:\s*100%/);
    expect(podium).toMatch(/z-index:\s*0/);
    expect(podium).toMatch(/pointer-events:\s*none/);
    expect(podium).toMatch(/position:\s*relative/);
    expect(podium).not.toMatch(/bottom:/);
    expect(rule("search-world__floor", "before")).toMatch(/border-radius:\s*50% 50% 0 0 \/ 100% 100% 0 0/);
    expect(rule("search-world__floor", "after")).toMatch(/border-radius:\s*50% 50% 0 0 \/ 100% 100% 0 0/);
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
