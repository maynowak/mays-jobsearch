import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useSearchWorldMotion } from "./useSearchWorldMotion";

const PROPERTY = "--sw-progress";

// SEARCH-WORLD-04: Der Hook darf nur die CSS-Property schreiben — kein React-State,
// kein Re-Rendering. Der Listener wird nur bei eingebautem Element angehaengt und
// bei Reduced Motion nicht ausgefuehrt.
function Harness() {
  const ref = useSearchWorldMotion();
  return <div data-testid="world" ref={ref} />;
}

function setViewport(scrollY: number, viewportHeight: number) {
  Object.defineProperty(window, "scrollY", { value: scrollY, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", {
    value: viewportHeight,
    configurable: true,
    writable: true,
  });
}

function frame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  setViewport(0, 900);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useSearchWorldMotion", () => {
  it("schreibt beim Mount die Progress-Property und reagiert auf Scroll", async () => {
    const { getByTestId } = render(<Harness />);
    const el = getByTestId("world");

    // Section im Dokument: top 1000, height 1200; Viewport 900, scrollY 1000.
    // getBoundingClientRect liefert Viewport-Koordinaten, deshalb top = 0,
    // damit worldTop = rect.top + scrollY = 1000 ergibt.
    const scrollY = 1000;
    setViewport(scrollY, 900);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 1000 - scrollY,
      height: 1200,
      bottom: 2200 - scrollY,
      left: 0,
      right: 1440,
      width: 1440,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    window.dispatchEvent(new Event("scroll"));
    await frame();

    const value = Number(el.style.getPropertyValue(PROPERTY));
    expect(Number.isFinite(value)).toBe(true);
    // (1000 + 900 - 1000) / (900 + 1200) = 0.4286
    expect(value).toBeCloseTo(0.4286, 3);
  });

  it("setzt die Property bei prefers-reduced-motion: reduce nicht", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    const { getByTestId } = render(<Harness />);
    const el = getByTestId("world");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 1000,
      height: 1200,
      bottom: 2200,
      left: 0,
      right: 1440,
      width: 1440,
      x: 0,
      y: 1000,
      toJSON: () => ({}),
    } as DOMRect);

    const scrollY = 1000;
    setViewport(scrollY, 900);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 0,
      height: 1200,
      bottom: 1200,
      left: 0,
      right: 1440,
      width: 1440,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    window.dispatchEvent(new Event("scroll"));
    await frame();

    expect(el.style.getPropertyValue(PROPERTY)).toBe("");
  });

  it("entfernt den Scroll-Listener beim Unmount mit demselben Handler (kein Leak)", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Harness />);

    // Der Hook muss seinen Scroll-Handler registriert haben …
    const scrollAdd = add.mock.calls.find(([type]) => type === "scroll");
    expect(scrollAdd).toBeTruthy();

    unmount();

    // … und genau denselben Handler wieder abmeldden.
    const removedHandlers = remove.mock.calls
      .filter(([type]) => type === "scroll")
      .map(([, handler]) => handler);
    expect(removedHandlers).toContain(scrollAdd?.[1]);
  });
});
