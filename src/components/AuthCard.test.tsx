import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AuthCard from "./AuthCard";

afterEach(() => {
  cleanup();
});

describe("HOLOGRAPHIC-CONSOLE-01: AuthCard Hologramm-Konsole", () => {
  it("rendert Section mit aria-label und Kindern im Hologramm-Card-Stil", () => {
    const { container } = render(
      <AuthCard label="Anmelden">
        <h2>Anmelden</h2>
      </AuthCard>
    );

    const section = screen.getByRole("region", { name: "Anmelden" });
    expect(section).toBeInTheDocument();
    expect(section.className).toContain("card");
    expect(section.className).toContain("auth-card");
    expect(container.querySelector(".auth-card-outer")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Anmelden" })).toBeTruthy();
  });

  it("setzt auf Touch/kein Hover keine Tilt-CSS-Variablen", () => {
    // jsdom: matchMedia ist nicht implementiert → hoverCapableRef bleibt false,
    // MouseMove darf keine CSS-Variablen setzen (kein Maus-Tilt auf Touch).
    const { container } = render(
      <AuthCard label="Anmelden">
        <button type="button" className="auth-submit">Login</button>
      </AuthCard>
    );

    const section = container.querySelector(".auth-card") as HTMLElement;
    expect(section.style.getPropertyValue("--rx")).toBe("");
  });
});
