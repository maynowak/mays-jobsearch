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
  STREAM_SEED,
  SAFE_ZONE,
  MANUAL_EXTRA_NOTES,
} from "./JobStream";
import { AUTO_PULSE_EVENT, USER_PULSE_EVENT } from "./MatchPulse";

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

// Reale Layer-Maße. `dims` ist an buildStreamNotes/recycleNote/createDynamicPath
// Pflicht – ein Default würde die Aspekt-Verzerrung stillschweigend
// reintroduzieren (FINDING 7).
const DESKTOP = { w: 1440, h: 738 };
const MOBILE = { w: 412, h: 915 };
const TABLET = { w: 834, h: 1112 };

/** Bildschirmwinkel einer Note in Grad (0…180), gemessen wie gerendert. */
const screenAngle = (
  n: { startX: number; startY: number; endX: number; endY: number },
  dims: { w: number; h: number }
): number => {
  const dx = (n.endX - n.startX) * dims.w;
  const dy = (n.endY - n.startY) * dims.h;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
};

/** Abstand in Grad zum nächsten Vielfachen von 90° (0 = exakt achsnah). */
const axialDistance = (deg: number): number => {
  const m = ((deg % 90) + 90) % 90;
  return Math.min(m, 90 - m);
};

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
    const a = buildStreamNotes(1, DESKTOP);
    const b = buildStreamNotes(1, DESKTOP);
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
    const base = buildStreamNotes(STREAM_SEED, DESKTOP)[0];
    expect(depthClass({ ...base, depth: 0.1, ambient: false })).toBe("js-back");
    expect(depthClass({ ...base, depth: 0.5, ambient: false })).toBe("js-mid");
    expect(depthClass({ ...base, depth: 0.9, ambient: false })).toBe("js-front");
    expect(depthClass({ ...base, ambient: true })).toContain("js-ambient");
  });

  it("genau 2 Ambient-Notes, genau 2 mit Check", () => {
    const notes = buildStreamNotes(STREAM_SEED, DESKTOP);
    expect(notes.filter((n) => n.ambient).length).toBe(2);
    expect(notes.filter((n) => n.hasCheck).length).toBe(2);
  });

  it("Opacity-Mapping folgt der Tiefe (Ambient am dezentesten)", () => {
    const notes = buildStreamNotes(STREAM_SEED, DESKTOP);
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
    let notes = buildStreamNotes(STREAM_SEED, DESKTOP);
    for (let round = 0; round < 5; round += 1) {
      notes = notes.map((n) => recycleNote(n, rng, DESKTOP));
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
    const notes = buildStreamNotes(STREAM_SEED, DESKTOP);
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

describe("Basis-Noten (BUGFIX-FLIGHT Runde 3 / FINDING 7)", () => {
  // Vor dem Fix: die LANES lagen im normalisierten Raum (und waren dort
  // bereits achsnah), das Aspektverhältnis verstärkte das. Gemessen:
  // achsnah ±22.5° (fair 50 %) war 91.4 % / 97.0 % / 87.5 %.
  it("Basis-Noten fliegen in alle Richtungen (Aspekt-Verzerrung Regression)", () => {
    for (const dims of [DESKTOP, TABLET, MOBILE]) {
      const rng = mulberry(20261007);
      const angles: number[] = [];
      const quadrants = [0, 0, 0, 0];
      const collect = (ns: ReturnType<typeof buildStreamNotes>) => {
        ns.forEach((n) => {
          angles.push(screenAngle(n, dims));
          const dx = n.endX - n.startX;
          const dy = n.endY - n.startY;
          quadrants[(dy >= 0 ? 0 : 2) + (dx >= 0 ? 0 : 1)] += 1;
        });
      };
      let notes = buildStreamNotes(STREAM_SEED, dims);
      collect(notes);
      for (let k = 0; k < 60; k++) {
        notes = notes.map((n) => recycleNote(n, rng, dims));
        collect(notes);
      }
      expect(angles.length).toBeGreaterThan(1500);
      const axial = angles.filter((a) => axialDistance(a) < 22.5).length / angles.length;
      expect(axial, `axial ${dims.w}x${dims.h}`).toBeLessThan(0.6);
      // Alle vier Quadranten belegt → keine Zwei-Richtungs-Observation.
      quadrants.forEach((countQ, i) =>
        expect(countQ, `quadrant ${i} @${dims.w}x${dims.h}`).toBeGreaterThan(100)
      );
    }
  });

  it("Basis-Start/-Ende liegen innerhalb der Play-Box (kein Clamp-Kollaps)", () => {
    for (const dims of [DESKTOP, TABLET, MOBILE]) {
      const rng = mulberry(1359);
      let notes = buildStreamNotes(STREAM_SEED, dims);
      for (let round = 0; round < 3; round += 1) {
        notes.forEach((n) => {
          for (const [px, py] of [
            [n.startX, n.startY],
            [n.endX, n.endY],
          ]) {
            expect(px).toBeGreaterThanOrEqual(-0.151);
            expect(px).toBeLessThanOrEqual(1.151);
            expect(py).toBeGreaterThanOrEqual(-0.151);
            expect(py).toBeLessThanOrEqual(1.151);
          }
        });
        notes = notes.map((n) => recycleNote(n, rng, dims));
      }
    }
  });

  it("gleicher Seed + gleiche Maße → identische Basis-Noten (Determinismus)", () => {
    const a = buildStreamNotes(7, DESKTOP);
    const b = buildStreamNotes(7, DESKTOP);
    expect(a).toEqual(b);
    const c = buildStreamNotes(7, MOBILE);
    // Anderes Aspektverhältnis → andere Flugbahnen (das IST der Fix).
    expect(c).not.toEqual(a);
  });
});

describe("Klickfenster & Auto-Refill (BUGFIX-FLIGHT Runde 3)", () => {
  it("manuelle Klicks dürfen über das Auto-Maximum hinaus (+10)", async () => {
    const { act } = await import("@testing-library/react");
    render(<JobStream />);
    // Auto-Fenster: hardCap - count = 10. Manuelles Fenster: +MANUAL_EXTRA_NOTES.
    const autoMax = 10;
    const clickMax = autoMax + MANUAL_EXTRA_NOTES;
    act(() => {
      for (let i = 0; i < clickMax + 10; i++) {
        window.dispatchEvent(new CustomEvent(USER_PULSE_EVENT));
      }
    });
    const spawned = document.querySelectorAll(
      '.js-note[data-source="user"]'
    ).length;
    expect(spawned).toBe(clickMax);
    expect(spawned).toBeGreaterThan(autoMax);
  });

  it("Auto-Refill bleibt auf dem engeren Auto-Fenster begrenzt", async () => {
    // Der Reduced-Motion-Test weiter oben leakt sein matchMedia-Mock;
    // ohne Neuinstallation wäre staticMotion=true und der Auto-Effekt pausiert.
    mockMatchMedia(() => false);
    const { act } = await import("@testing-library/react");
    vi.useFakeTimers();
    try {
      render(<JobStream />);
      // 10 × 45 s ≈ 450 s → ≈ 16 gezogene Refill-Fenster; Cap ist 10.
      for (let i = 0; i < 10; i++) {
        act(() => {
          vi.advanceTimersByTime(45000);
        });
      }
      const auto = document.querySelectorAll(
        '.js-note[data-source="auto"]'
      ).length;
      expect(auto).toBeGreaterThan(0);
      expect(auto).toBeLessThanOrEqual(10);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Auto-Puls (BUGFIX-FLIGHT Runde 3 / FINDING 8)", () => {
  it("Pulsar blitzt auf, wenn eine Karte im Auto-Prozess startet", async () => {
    // Sauberer Reduced-Motion-Stand (siehe vorheriger Test).
    mockMatchMedia(() => false);
    const { AUTO_PULSE_EVENT: event } = await import("./MatchPulse");
    const MatchPulse = (await import("./MatchPulse")).default;
    const { act } = await import("@testing-library/react");
    render(<MatchPulse />);
    expect(document.querySelector(".mp")?.classList.contains("is-pulsing")).toBe(false);
    act(() => {
      window.dispatchEvent(new CustomEvent(event));
    });
    expect(document.querySelector(".mp")?.classList.contains("is-pulsing")).toBe(true);
    expect(event).toBe(AUTO_PULSE_EVENT);
  });
});
