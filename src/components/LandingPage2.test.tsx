import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, act } from "@testing-library/react";
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

describe("LandingPage2 (HERO-COMPOSITION-02)", () => {
  it("Hero-Textstruktur exakt nach Spec (EN)", () => {
    window.localStorage.setItem("lp2-lang", "en");
    renderPage();
    expect(screen.getByText("MAY'S JOB MATCHER")).toBeTruthy();
    expect(screen.getByText("Your next career move")).toBeTruthy();
    expect(screen.getByText("with AI")).toBeTruthy();
    expect(screen.getByText(/Job postings from multiple sources,/)).toBeTruthy();
    expect(screen.getByText(/personally matched to you/)).toBeTruthy();
    expect(screen.getByText("Find jobs →")).toBeTruthy();
    expect(screen.getByText("Learn more")).toBeTruthy();
  });

  it("keine dritte Headline-Zeile, keine Hero-Card", () => {
    window.localStorage.setItem("lp2-lang", "en");
    renderPage();
    expect(screen.queryByText(/die zu dir passen/)).toBeNull();
    expect(screen.queryByText(/that truly fit you/)).toBeNull();
    expect(screen.queryByText(/PROTOTYPE/)).toBeNull();
  });

  it("Hero-Schichten: Background, Overlay, JobStreamLayer mit Stream, Content", () => {
    renderPage();
    const hero = screen.getByLabelText("Visuelle Bühne");
    expect(within(hero).getByRole("img", { name: /Futuristische Stadt/i })).toBeTruthy();
    expect(hero.querySelector(".lp2-background")).toBeTruthy();
    expect(hero.querySelector(".lp2-overlay")).toBeTruthy();
    const stream = hero.querySelector(".job-stream-layer") as HTMLElement;
    expect(stream).toBeTruthy();
    expect(stream.getAttribute("aria-hidden")).toBe("true");
    // Phase B: Stream lebt im Layer (Dummy-Noten, keine API)
    expect(stream.querySelector(".js-stream")).toBeTruthy();
    expect(hero.querySelector(".lp2-hero-content")).toBeTruthy();
  });

  it("Hintergrundbild Abendlicht2 ist eingebunden", () => {
    renderPage();
    const bg = document.querySelector(".lp2-background") as HTMLElement;
    expect(bg.style.backgroundImage).toContain("Futuristische_Stadt_im_blauen_Abendlicht2");
  });

  it("Glass-Navigation: Brand, Links, EN/DE, Login (DE-Default)", () => {
    renderPage();
    const bar = document.querySelector(".lp2-bar") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(within(bar).getByText("May's Job Matcher")).toBeTruthy();
    expect(within(bar).getByText("Suche")).toBeTruthy();
    expect(within(bar).getByText("Benachrichtigungen")).toBeTruthy();
    expect(within(bar).getByText("EN")).toBeTruthy();
    expect(within(bar).getByText("DE")).toBeTruthy();
    expect(within(bar).getByText("Login")).toBeTruthy();
  });

  it("Links führen zu Bestand-Routen (kein Umbau der App-Navigation)", () => {
    renderPage();
    const els = screen.getAllByText("Zum Job-Matcher") as HTMLAnchorElement[];
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) expect(el.href).toContain("/top");
    const jobs = screen.getByText("Jobs finden →") as HTMLAnchorElement;
    expect(jobs.href).toContain("/top");
  });

  it("Phase A: Opening-Layer vorhanden, Stream startet erst nach Timeout", () => {
    vi.useFakeTimers();
    try {
      renderPage();
      expect(document.querySelector(".hero-opening-layer")).toBeTruthy();
      expect(document.querySelector(".hero-opening-dot")).toBeTruthy();
      expect(document.querySelector(".job-stream-layer.is-live")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(document.querySelector(".job-stream-layer.is-live")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("EN/DE-Schalter wechselt die Sprache und merkt sie sich", () => {
    renderPage();
    fireEvent.click(screen.getByText("EN"));
    expect(screen.getByText("Find jobs →")).toBeTruthy();
    expect(screen.getByText("Search")).toBeTruthy();
    expect(window.localStorage.getItem("lp2-lang")).toBe("en");
    fireEvent.click(screen.getByText("DE"));
    expect(screen.getByText("Jobs finden →")).toBeTruthy();
    expect(screen.getByText("Suche")).toBeTruthy();
    expect(window.localStorage.getItem("lp2-lang")).toBe("de");
  });
});
