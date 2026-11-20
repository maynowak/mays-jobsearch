import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProfileParticles from "./ProfileParticles";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

afterEach(() => cleanup());

describe("JM-PROFILE-VISUAL-09 particles", () => {
  it("renders 12–20 deterministic particles inside one aria-hidden layer", () => {
    const { container } = render(<ProfileParticles />);
    const layer = container.querySelector(".profile-particles");
    expect(layer).toBeTruthy();
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.querySelectorAll("span")).toHaveLength(16);
  });

  it("uses pointer-events none and GPU-friendly drift styles", () => {
    const { container } = render(<ProfileParticles />);
    const layer = container.querySelector(".profile-particles");
    expect(layer).toBeTruthy();
    expect(css).toContain(".profile-particles");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain("@keyframes profile-particle-drift");
    expect(css).toContain("translate3d");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("nth-child(n + 9)");
  });

  it("keeps the brighter palette, opacity range and faster drift windows", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ProfileParticles.tsx"), "utf8");
    const opacities = [...source.matchAll(/--opacity": ([0-9.]+)/g)].map((match) => Number(match[1]));
    const durations = [...source.matchAll(/--duration": "([0-9]+)s"/g)].map((match) => Number(match[1]));
    expect(opacities).toHaveLength(16);
    expect(opacities.every((value) => value >= 0.6 && value <= 0.9)).toBe(true);
    expect(durations).toHaveLength(16);
    expect(durations.every((value) => value >= 14 && value <= 22)).toBe(true);
    expect(source).toContain("#22D3EE");
    expect(source).toContain("#67E8F9");
    expect(source).toContain("#A5F3FC");
    expect(css).toContain("radial-gradient(circle at 42% 38%");
  });

  it("mounts the particle layer only in profile routes", () => {
    expect(app.match(/<ProfileParticles\s*\/>/g)).toHaveLength(3);
    expect(app).toContain('from "./components/ProfileParticles"');
  });
});
