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

  it("mounts the particle layer only in profile routes", () => {
    expect(app.match(/<ProfileParticles\s*\/>/g)).toHaveLength(3);
    expect(app).toContain('from "./components/ProfileParticles"');
  });
});
