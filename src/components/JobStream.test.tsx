import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import JobStream, {
  buildStreamNotes,
  recycleNote,
  depthClass,
  noteOpacity,
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
    expect(a.length).toBe(10);
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
    expect(notes.length).toBe(10);
    expect(notes.map((n) => n.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
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
