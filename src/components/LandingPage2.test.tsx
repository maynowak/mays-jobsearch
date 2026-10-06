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
    expect(within(bar).getByText("EN")).toBeTruthy();
    expect(within(bar).getByText("DE")).toBeTruthy();
    expect(within(bar).getByText("Login")).toBeTruthy();
  });

  it("TOP-MENU-01: Landingpage zeigt nur Suche, Benachrichtigungen ist ausgeblendet", () => {
    renderPage();
    const bar = document.querySelector(".lp2-bar") as HTMLElement;
    const nav = bar.querySelector(".lp2-nav") as HTMLElement;
    expect(nav).toBeTruthy();
    // Ohne Anmeldung führt der Alerts-Link dort nur auf die Suchmaske.
    expect(within(nav).queryByText("Benachrichtigungen")).toBeNull();
    const links = within(nav).getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/search");
  });

  it("Links führen zur Suchmaske (TOP-MENU-01: /search statt /search)", () => {
    renderPage();
    const els = screen.getAllByText("Zum Job-Matcher") as HTMLAnchorElement[];
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) expect(el.href).toContain("/search");
    const jobs = screen.getByText("Jobs finden →") as HTMLAnchorElement;
    expect(jobs.href).toContain("/search");
  });

  it("Match Pulse sitzt neben „mit KI\" (AI-MATCH-PULSE-01)", () => {
    window.localStorage.setItem("lp2-lang", "en");
    renderPage();
    const accent = screen.getByText("with AI");
    expect(accent).toBeTruthy();
    const pulse = document.querySelector(".mp") as HTMLElement;
    expect(pulse).toBeTruthy();
    expect(pulse.getAttribute("aria-hidden")).toBe("true");
    expect(pulse.querySelector(".mp-dot")).toBeTruthy();
    expect(pulse.querySelector(".mp-ring")).toBeTruthy();
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
