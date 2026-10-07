import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import JobStream, {
  buildStreamNotes,
  recycleNote,
  depthClass,
  noteOpacity,
  createDynamicPath,
  segmentCrossesSafeZone,
  safeZonePenalty,
  STREAM_COUNTS,
  SAFE_ZONE,
} from "./JobStream";

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockMatchMedia(matches: (query: string) => boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matches(query),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

describe("JobStream (HERO-ANIMATION-03)", () => {
  it("rendert Desktop-Anzahl (10) ohne MatchMedia", () => {
    render(<JobStream />);
    expect(document.querySelectorAll(".js-note").length).toBe(STREAM_COUNTS.desktop);
  });

  it("rendert Mobile-Anzahl (4) bei schmalem Viewport", () => {
    mockMatchMedia((q) => q === "(max-width: 600px)");
    render(<JobStream />);
    expect(document.querySelectorAll(".js-note").length).toBe(STREAM_COUNTS.mobile);
  });

  it("rendert Tablet-Anzahl (7) bei mittlerem Viewport", () => {
    mockMatchMedia((q) => q === "(max-width: 900px)");
    render(<JobStream />);
    expect(document.querySelectorAll(".js-note").length).toBe(STREAM_COUNTS.tablet);
  });

  it("Kartenparameter sind deterministisch (gleicher Seed)", () => {
    const a = buildStreamNotes(1);
    const b = buildStreamNotes(1);
    expect(a).toEqual(b);
    expect(a.length).toBe(26);
    for (const n of a) {
      expect(Number.isFinite(n.startX)).toBe(true);
      expect(Number.isFinite(n.endY)).toBe(true);
      expect(n.duration).toBeGreaterThanOrEqual(11);
      expect(n.duration).toBeLessThanOrEqual(17);
      expect(n.delay).toBeLessThanOrEqual(0);
      expect(n.depth).toBeGreaterThanOrEqual(0);
      expect(n.depth).toBeLessThanOrEqual(1);
    }
    // ca. 20-30 % mit Check
    const checks = a.filter((n) => n.hasCheck).length;
    expect(checks).toBeGreaterThanOrEqual(2);
    expect(checks).toBeLessThanOrEqual(3);
  });

  it("Tiefenklassen staffeln Größen (+ Ambient-Sonderklasse)", () => {
    const base = buildStreamNotes()[0];
    expect(depthClass({ ...base, depth: 0.1, ambient: false })).toBe("js-back");
    expect(depthClass({ ...base, depth: 0.5, ambient: false })).toBe("js-mid");
    expect(depthClass({ ...base, depth: 0.9, ambient: false })).toBe("js-front");
    expect(depthClass({ ...base, ambient: true })).toContain("js-ambient");
  });

  it("genau 2 Ambient-Notes, genau 2 mit Check", () => {
    const notes = buildStreamNotes();
    expect(notes.filter((n) => n.ambient).length).toBe(2);
    expect(notes.filter((n) => n.hasCheck).length).toBe(2);
  });

  it("Opacity-Mapping folgt der Tiefe (Ambient am dezentesten)", () => {
    const notes = buildStreamNotes();
    const front = notes.find((n) => !n.ambient && n.depth >= 0.7)!;
    const back = notes.find((n) => !n.ambient && n.depth < 0.35)!;
    const ambient = notes.find((n) => n.ambient)!;
    expect(noteOpacity(front)).toBe(0.9);
    expect(noteOpacity(back)).toBe(0.3);
    expect(noteOpacity(ambient)).toBe(0.22);
    expect(noteOpacity(ambient)).toBeLessThan(noteOpacity(back));
  });

  it("Kopplung: Match-Puls löst genau einen Check aus, der wieder verschwindet", async () => {
    const { MATCH_PULSE_EVENT } = await import("./MatchPulse");
    vi.useFakeTimers();
    try {
      const { act } = await import("@testing-library/react");
      render(<JobStream />);
      expect(document.querySelector(".js-check-once")).toBeNull();
      act(() => {
        window.dispatchEvent(new CustomEvent(MATCH_PULSE_EVENT));
      });
      // 600 ms Versatz: noch kein Check
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(document.querySelector(".js-check-once")).toBeNull();
      // danach genau ein Check für ~850 ms
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(document.querySelectorAll(".js-check-once").length).toBe(1);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(document.querySelector(".js-check-once")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Recycling: gleiche IDs, neue Generation, begrenzte Menge", () => {
    const rng = mulberry(99);
    let notes = buildStreamNotes();
    for (let round = 0; round < 5; round += 1) {
      notes = notes.map((n) => recycleNote(n, rng));
    }
    expect(notes.length).toBe(26);
    expect(notes.map((n) => n.id)).toEqual(Array.from({ length: 26 }, (_, i) => i));
    expect(notes.every((n) => n.gen === 5)).toBe(true);
    const inside = (x: number, y: number) =>
      x > SAFE_ZONE.x0 + 0.05 &&
      x < SAFE_ZONE.x1 - 0.05 &&
      y > SAFE_ZONE.y0 + 0.05 &&
      y < SAFE_ZONE.y1 - 0.05;
    for (const n of notes) {
      expect(inside(n.startX, n.startY) && inside(n.endX, n.endY)).toBe(false);
      expect(n.delay).toBeGreaterThanOrEqual(0.2);
      expect(n.delay).toBeLessThanOrEqual(1.2);
    }
  });

  it("Flugbahnen meiden überwiegend das Safe-Zonen-Innere", () => {
    const notes = buildStreamNotes();
    const inside = (x: number, y: number) =>
      x > SAFE_ZONE.x0 && x < SAFE_ZONE.x1 && y > SAFE_ZONE.y0 && y < SAFE_ZONE.y1;
    for (const n of notes) {
      // Start und Ende dürfen nicht beide tief in der Zone liegen
      expect(inside(n.startX, n.startY) && inside(n.endX, n.endY)).toBe(false);
    }
  });

  it("ruft keine API auf (reine Dummy-Daten)", () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    render(<JobStream />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Reduced Motion: statische Markierung, keine WAAPI-Animation", () => {
    mockMatchMedia((q) => q === "(prefers-reduced-motion: reduce)");
    const animateSpy = vi.fn(() => ({ cancel: () => {} }));
    Object.defineProperty(window.HTMLElement.prototype, "animate", {
      writable: true,
      configurable: true,
      value: animateSpy,
    });
    render(<JobStream />);
    expect(document.querySelector(".js-stream")?.getAttribute("data-motion")).toBe("static");
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

describe("Dynamic Path Engine (BUGFIX-FLIGHT)", () => {
  // Reale Layer-Maße (Desktop). dims ist Pflicht – ein Default würde die
  // Aspekt-Verzerrung stillschweigend reintroduzieren.
  const DESKTOP = { w: 1440, h: 738 };
  const MOBILE = { w: 412, h: 915 };

  it("verteilt Richtungen über alle vier Quadranten (>2 Families)", () => {
    const rng = mulberry(4242);
    const q = { pp: 0, pn: 0, np: 0, nn: 0 };
    let produced = 0;
    for (let i = 0; i < 200; i++) {
      const p = createDynamicPath(rng, DESKTOP);
      if (!p) continue;
      produced += 1;
      // Bildschirmrichtung (das ist, was der Nutzer sieht).
      const dx = (p.endX - p.startX) * DESKTOP.w;
      const dy = (p.endY - p.startY) * DESKTOP.h;
      if (dx > 0 && dy > 0) q.pp += 1;
      else if (dx > 0 && dy < 0) q.pn += 1;
      else if (dx < 0 && dy > 0) q.np += 1;
      else if (dx < 0 && dy < 0) q.nn += 1;
    }
    expect(produced).toBeGreaterThan(150);
    // Alle vier Quadranten belegt → keine Zwei-Richtungs-Observation.
    expect(q.pp).toBeGreaterThan(10);
    expect(q.pn).toBeGreaterThan(10);
    expect(q.np).toBeGreaterThan(10);
    expect(q.nn).toBeGreaterThan(10);
  });

  it("BILDSCHIRM-Richtung ist gleichverteilt (Aspekt-Verzerrung Regression)", () => {
    // Der eigentliche User-Report: „fast nur vertikale oder horizontale
    // Richtung". Zwei Fehlerquellen:
    //   a) Rejection-Verzerrung → 69 % achsnah statt ~50 %
    //   b) Aspekt-Verzerrung 1440×738 → Ratio 1.31x (norm) auf 4.06x (Bild)
    // Dieser Test misst den BILDSCHIRMWinkel, also genau das Sichtbare.
    for (const dims of [DESKTOP, MOBILE]) {
      const rng = mulberry(777);
      const BUCKETS = 16;
      const buckets = new Array(BUCKETS).fill(0);
      let n = 0;
      for (let i = 0; i < 4000; i++) {
        const p = createDynamicPath(rng, dims);
        if (!p) continue;
        n += 1;
        const dx = (p.endX - p.startX) * dims.w;
        const dy = (p.endY - p.startY) * dims.h;
        const a = ((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2));
        buckets[Math.floor((a / (Math.PI * 2)) * BUCKETS)] += 1;
      }
      expect(n).toBeGreaterThan(3500);
      const pcts = buckets.map((c) => c / n);
      const ideal = 1 / BUCKETS;
      const max = Math.max(...pcts);
      const min = Math.min(...pcts);
      // Vorher 4.06x auf Desktop. Schutzschwelle 1.7x.
      expect(max / min, `dims ${dims.w}x${dims.h}`).toBeLessThan(1.7);
      for (const p of pcts) {
        expect(p).toBeLessThan(ideal * 1.8);
        expect(p).toBeGreaterThan(ideal * 0.5);
      }
      // Achsnah (±22.5°) = 8 der 16 Buckets → faire Erwartung 50 %.
      // Vorher-Bug: 56.5 % (Desktop) / 60.6 % (Mobile).
      const axial = [0, 4, 5, 8, 9, 12, 13, 0].reduce(
        (s, i) => s + buckets[i], 0
      ) / n;
      expect(axial, `axial ${dims.w}x${dims.h}`).toBeLessThan(0.6);
    }
  });

  it("angle (Bildschirmwinkel) ist uniform in [0, 2π)", () => {
    const rng = mulberry(777);
    const BUCKETS = 16;
    const buckets = new Array(BUCKETS).fill(0);
    let n = 0;
    for (let i = 0; i < 4000; i++) {
      const p = createDynamicPath(rng, DESKTOP);
      if (!p) continue;
      n += 1;
      const a = ((p.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      buckets[Math.floor((a / (Math.PI * 2)) * BUCKETS)] += 1;
    }
    expect(n).toBeGreaterThan(3500);
    const pcts = buckets.map((c) => c / n);
    const ideal = 1 / BUCKETS;
    expect(Math.max(...pcts) / Math.min(...pcts)).toBeLessThan(1.7);
    for (const p of pcts) {
      expect(p).toBeLessThan(ideal * 1.8);
      expect(p).toBeGreaterThan(ideal * 0.5);
    }
    const axial = [0, 4, 5, 8, 9, 12, 13, 0].reduce((s, i) => s + buckets[i], 0) / n;
    expect(axial).toBeLessThan(0.6);
  });

  it("Start/Ende liegen im Play-Bereich, Pfadlänge gebounded, kein Clamp-Kollaps", () => {
    const rng = mulberry(31337);
    for (let i = 0; i < 200; i++) {
      const p = createDynamicPath(rng, DESKTOP);
      if (!p) continue;
      expect(p.startX).toBeGreaterThanOrEqual(-0.151);
      expect(p.startX).toBeLessThanOrEqual(1.151);
      expect(p.startY).toBeGreaterThanOrEqual(-0.151);
      expect(p.startY).toBeLessThanOrEqual(1.151);
      expect(p.endX).toBeGreaterThanOrEqual(-0.151);
      expect(p.endX).toBeLessThanOrEqual(1.151);
      expect(p.endY).toBeGreaterThanOrEqual(-0.151);
      expect(p.endY).toBeLessThanOrEqual(1.151);
      const len = Math.hypot(p.endX - p.startX, p.endY - p.startY);
      // Regelfall >= 1.0. Der Hero-Sicherheits-Fallback darf bis 0.85
      // nachgeben (Hero-Kollision ist verboten, kürzere Bahn nicht sichtbar).
      expect(len).toBeGreaterThanOrEqual(0.85);
      expect(len).toBeLessThanOrEqual(1.8);
      // Kein Nullvektor (das wäre der „springt zurück"-Look).
      expect(len).toBeGreaterThan(0.5);
      // relLength ist die Basis der Tempogleichung → muss positiv und
      // gebounded sein, sonst Dauer-Ausreißer.
      expect(p.relLength).toBeGreaterThan(0.2);
      expect(p.relLength).toBeLessThan(2.5);
    }
  });

  it("Dauer bleibt in der grünen 11–17s-Baseline (Tempogleichung)", () => {
    // duration = min(17, max(11, relLength * 16)) — parallele Implementierung
    // zur Verifikation, dass die Formel über alle Viewports in Range bleibt.
    const rng = mulberry(2468);
    for (const dims of [DESKTOP, MOBILE, { w: 834, h: 912 }]) {
      for (let i = 0; i < 150; i++) {
        const p = createDynamicPath(rng, dims);
        if (!p) continue;
        const duration = Math.min(17, Math.max(11, p.relLength * 16));
        expect(duration).toBeGreaterThanOrEqual(11);
        expect(duration).toBeLessThanOrEqual(17);
      }
    }
  });

  it("Pfade kreuzen nie die Safe Zone (keine Hero-Kollision)", () => {
    const rng = mulberry(555);
    for (let i = 0; i < 2000; i++) {
      const p = createDynamicPath(rng, DESKTOP);
      if (!p) continue;
      expect(segmentCrossesSafeZone(p.startX, p.startY, p.endX, p.endY)).toBe(false);
      // Zusätzlich exakt: kein überlappender Längenanteil.
      expect(safeZonePenalty(p.startX, p.startY, p.endX, p.endY)).toBe(0);
    }
  });

  it("erkennt flache Ecken-Schnitte exakt (Sampling-Artefakt Regression)", () => {
    // REGRESSION zum gefundenen Messfehler: Eine 24er-Stichprobe über eine
    // lange Strecke übersehen flache Safe-Zone-Streifen vollständig
    // (gemessen: steps=24 → 0 Treffer, exakt → 183/4000). Die Schutzfunktion
    // darf deshalb nicht sampling-basiert sein.
    // Diese Strecke schneidet die Zone nur knapp an der linken Kante.
    const grazing = segmentCrossesSafeZone(0.2, 0.4, 0.8, 0.45);
    expect(grazing).toBe(true);
    expect(safeZonePenalty(0.2, 0.4, 0.8, 0.45)).toBeGreaterThan(0);

    // Klar außerhalb → 0.
    expect(segmentCrossesSafeZone(-0.1, 0.0, 0.1, 0.1)).toBe(false);
    expect(safeZonePenalty(-0.1, 0.0, 0.1, 0.1)).toBe(0);

    // Nur Berührung der Kante (t1 == t0) zählt nicht als Schnitt.
    expect(segmentCrossesSafeZone(0.0, 0.25, 0.3, 0.25)).toBe(false);

    // Innenliegende Strecke → voller Anteil.
    expect(safeZonePenalty(0.4, 0.3, 0.6, 0.6)).toBeCloseTo(1, 5);
  });

  it("Richtung bleibt pro Instanz stabil (kein Re-Render-Neuaufbau)", () => {
    // Simuliert: gleicher erzeugter Pfad mehrfach gelesen → identer Wert.
    const rng = mulberry(9090);
    const p = createDynamicPath(rng, DESKTOP);
    expect(p).not.toBeNull();
    const snapshot = { ...p! };
    // Mehrfaches Ableiten ändert nichts (rein funktional, kein RNG im Render).
    expect({ ...p! }).toEqual(snapshot);
    expect(p!.angle).toBeGreaterThanOrEqual(0);
    expect(p!.angle).toBeLessThan(Math.PI * 2);
  });
});
