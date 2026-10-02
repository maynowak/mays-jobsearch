import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import JobStream, {
  buildStreamNotes,
  depthClass,
  STREAM_COUNTS,
  SAFE_ZONE,
} from "./JobStream";

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

  it("Tiefenklassen staffeln Größen", () => {
    expect(depthClass(0.1)).toBe("js-back");
    expect(depthClass(0.5)).toBe("js-mid");
    expect(depthClass(0.9)).toBe("js-front");
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
