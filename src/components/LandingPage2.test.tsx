import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LandingPage2 from "./LandingPage2";

afterEach(() => {
  cleanup();
});

function renderPage() {
  return render(
    <LangProvider>
      <LandingPage2 />
    </LangProvider>
  );
}

describe("LandingPage2 (LANDINGPAGE-02 Prototype)", () => {
  it("rendert Header, Hero-Bühne, Content und Footer", () => {
    const { container } = renderPage();
    expect(screen.getByText("May's Job Matcher")).toBeTruthy();
    expect(screen.getByLabelText("Visuelle Bühne")).toBeTruthy();
    expect(screen.getByText("Jobsearch")).toBeTruthy();
    expect(screen.getByText(/Dein nächster Karriereschritt/)).toBeTruthy();
    expect(screen.getByText("mit KI")).toBeTruthy();
    expect(screen.getByText(/die zu dir passen/)).toBeTruthy();
    expect(screen.getByLabelText("Highlights")).toBeTruthy();
    expect(container.querySelector(".lp2-footer")).toBeTruthy();
  });

  it("Hero-Schichten: Background, Overlay, leerer JobStreamLayer, Content", () => {
    const { container } = renderPage();
    const hero = screen.getByLabelText("Visuelle Bühne");
    expect(within(hero).getByRole("img", { name: /Futuristische Stadt/i })).toBeTruthy();
    expect(hero.querySelector(".lp2-background")).toBeTruthy();
    expect(hero.querySelector(".lp2-overlay")).toBeTruthy();
    const stream = hero.querySelector(".job-stream-layer") as HTMLElement;
    expect(stream).toBeTruthy();
    expect(stream.getAttribute("aria-hidden")).toBe("true");
    expect(stream.childElementCount).toBe(0);
    expect(hero.querySelector(".lp2-hero-content")).toBeTruthy();
    expect(container.querySelector(".lp2-background")).toBeTruthy();
  });

  it("Hintergrundbild ist eingebunden (nicht verzerrt per CSS: cover)", () => {
    renderPage();
    const bg = document.querySelector(".lp2-background") as HTMLElement;
    expect(bg.style.backgroundImage).toContain("Futuristische_Stadt");
  });

  it("Links führen zu Bestand-Routen (kein Umbau der App-Navigation)", () => {
    renderPage();
    const ctas = screen.getAllByText("Zum Job-Matcher") as HTMLAnchorElement[];
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta.href).toContain("/top");
    const jobs = screen.getByText("Jobs finden") as HTMLAnchorElement;
    expect(jobs.href).toContain("/top");
  });
});
