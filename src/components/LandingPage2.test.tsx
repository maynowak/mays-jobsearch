import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LandingPage2 from "./LandingPage2";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.removeItem("lp2-lang");
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
    expect(bg.style.backgroundImage).toContain("Futuristische_Stadt_im_blauen_Abendlicht2");
  });

  it("Links führen zu Bestand-Routen (kein Umbau der App-Navigation)", () => {
    renderPage();
    const ctas = screen.getAllByText("Zum Job-Matcher") as HTMLAnchorElement[];
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta.href).toContain("/top");
    const jobs = screen.getByText("Jobs finden") as HTMLAnchorElement;
    expect(jobs.href).toContain("/top");
  });

  it("Top-Leiste enthält Brand, EN/DE mittig, Suche/Benachrichtigungen/Login", () => {
    renderPage();
    const bar = document.querySelector(".lp2-bar") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(within(bar).getByText("May's Job Matcher")).toBeTruthy();
    expect(within(bar).getByText("EN")).toBeTruthy();
    expect(within(bar).getByText("DE")).toBeTruthy();
    expect(within(bar).getByText("Suche")).toBeTruthy();
    expect(within(bar).getByText("Benachrichtigungen")).toBeTruthy();
    expect(within(bar).getByText("Login")).toBeTruthy();
  });

  it("EN/DE-Schalter wechselt die Sprache und merkt sie sich", () => {
    renderPage();
    fireEvent.click(screen.getByText("EN"));
    expect(screen.getByText("Find jobs")).toBeTruthy();
    expect(screen.getByText("Search")).toBeTruthy();
    expect(window.localStorage.getItem("lp2-lang")).toBe("en");
    fireEvent.click(screen.getByText("DE"));
    expect(screen.getByText("Jobs finden")).toBeTruthy();
    expect(screen.getByText("Suche")).toBeTruthy();
    expect(window.localStorage.getItem("lp2-lang")).toBe("de");
  });
});
