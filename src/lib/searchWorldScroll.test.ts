import { describe, expect, it } from "vitest";
import { computeSearchWorldProgress } from "./searchWorldScroll";

// SEARCH-WORLD-04: Fortschritt der Search World muss 0 → 1 monoton durchlaufen
// und ausserhalb des Bereichs klemmen (kein Ueber-/Unterschiessen).
describe("computeSearchWorldProgress", () => {
  const base = { worldTop: 1000, worldHeight: 1200, viewportHeight: 900 };

  it("ist 0, solange die Search World den Viewport noch nicht erreicht hat", () => {
    // Section-Oberkante liegt 400 px unterhalb des Viewport-Bodems.
    expect(computeSearchWorldProgress({ ...base, scrollY: 0 })).toBe(0);
  });

  it("ist 1, sobald die Search World den Viewport vollständig verlassen hat", () => {
    // worldTop + worldHeight = 2200 → Section komplett überfahren.
    expect(computeSearchWorldProgress({ ...base, scrollY: 2400 })).toBe(1);
  });

  it("liefert bei halber Durchfahrt ~0.5 und bleibt monoton", () => {
    const travel = base.viewportHeight + base.worldHeight; // 2100
    const midScroll = base.worldTop + travel / 2 - base.viewportHeight;
    const mid = computeSearchWorldProgress({ ...base, scrollY: midScroll });
    expect(mid).toBeCloseTo(0.5, 2);

    let previous = -1;
    for (let scrollY = 0; scrollY <= 3000; scrollY += 100) {
      const value = computeSearchWorldProgress({ ...base, scrollY });
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("klemmt ausserhalb auf 0 bzw. 1 (kein Ueber-/Unterschiessen)", () => {
    expect(computeSearchWorldProgress({ ...base, scrollY: -500 })).toBe(0);
    expect(computeSearchWorldProgress({ ...base, scrollY: 99999 })).toBe(1);
  });

  it("behandelt leere Section und ungültige Werte robust", () => {
    expect(
      computeSearchWorldProgress({ worldTop: 100, worldHeight: 0, scrollY: 0, viewportHeight: 0 })
    ).toBe(0);
    expect(
      computeSearchWorldProgress({
        worldTop: Number.NaN,
        worldHeight: 100,
        scrollY: 0,
        viewportHeight: 100,
      })
    ).toBe(0);
  });
});
