import { describe, expect, it } from "vitest";
import {
  createFlightPath,
  segmentCrossesZone,
  zoneOverlap,
} from "./flightPath";

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

const DESKTOP = { w: 1440, h: 738 };
const CENTER_ZONE = { x0: 0.3, x1: 0.7, y0: 0.25, y1: 0.7 };

describe("flightPath (wiederverwendbare 360°-Engine)", () => {
  it("zoneOverlap/segmentCrossesZone sind rein parametrisch (kein Hardcode)", () => {
    // Strecke waagerecht quer, Zone deckt x∈[0.5,0.6] mittig ab.
    const z = { x0: 0.5, x1: 0.6, y0: 0.5, y1: 0.6 };
    expect(zoneOverlap(0, 0.55, 1, 0.55, z)).toBeCloseTo(0.1, 10);
    expect(segmentCrossesZone(0, 0.55, 1, 0.55, z)).toBe(true);
    // Andere Zone → andere Antwort: die Zone ist ein Parameter.
    const far = { x0: -1, y0: -1, x1: -0.9, y1: -0.9 };
    expect(zoneOverlap(0, 0.55, 1, 0.55, far)).toBe(0);
    expect(segmentCrossesZone(0, 0.55, 1, 0.55, far)).toBe(false);
  });

  it("Bildschirm-Richtung ist gleichverteilt (16 Buckets, χ-artig gating)", () => {
    const rng = mulberry(4242);
    const BUCKETS = 16;
    const buckets = new Array(BUCKETS).fill(0);
    let n = 0;
    for (let i = 0; i < 4000; i++) {
      const p = createFlightPath(rng, DESKTOP, CENTER_ZONE);
      if (!p) continue;
      n += 1;
      const dx = (p.endX - p.startX) * DESKTOP.w;
      const dy = (p.endY - p.startY) * DESKTOP.h;
      const a = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
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
  });

  it("Pfade kreuzen die übergebene Zone nicht (Stichprobe 2000)", () => {
    const rng = mulberry(555);
    for (let i = 0; i < 2000; i++) {
      const p = createFlightPath(rng, DESKTOP, CENTER_ZONE);
      if (!p) continue;
      expect(segmentCrossesZone(p.startX, p.startY, p.endX, p.endY, CENTER_ZONE)).toBe(false);
      expect(zoneOverlap(p.startX, p.startY, p.endX, p.endY, CENTER_ZONE)).toBe(0);
    }
  });

  it("Determinismus: gleiche rng-Sequenz → identischer Pfad", () => {
    const a = createFlightPath(mulberry(99), DESKTOP, CENTER_ZONE);
    const b = createFlightPath(mulberry(99), DESKTOP, CENTER_ZONE);
    expect(a).toEqual(b);
    // Anderer Layer-Aspekt → anderer Pfad (das IST der Aspekt-Fix).
    const c = createFlightPath(mulberry(99), { w: 412, h: 915 }, CENTER_ZONE);
    expect(c).not.toEqual(a);
  });

  it("Start/Ende auf der Play-Box, Länge gebounded (0.85…1.8)", () => {
    const rng = mulberry(31337);
    for (let i = 0; i < 200; i++) {
      const p = createFlightPath(rng, DESKTOP, CENTER_ZONE);
      if (!p) continue;
      for (const [px, py] of [
        [p.startX, p.startY],
        [p.endX, p.endY],
      ]) {
        expect(px).toBeGreaterThanOrEqual(-0.151);
        expect(px).toBeLessThanOrEqual(1.151);
        expect(py).toBeGreaterThanOrEqual(-0.151);
        expect(py).toBeLessThanOrEqual(1.151);
      }
      const len = Math.hypot(p.endX - p.startX, p.endY - p.startY);
      expect(len).toBeGreaterThanOrEqual(0.85);
      expect(len).toBeLessThanOrEqual(1.8);
      expect(p.relLength).toBeGreaterThan(0.2);
      expect(p.relLength).toBeLessThan(2.5);
    }
  });
});
