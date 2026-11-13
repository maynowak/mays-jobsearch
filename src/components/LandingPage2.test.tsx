import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, act } from "@testing-library/react";
import { LangProvider } from "../i18n";
import LandingPage2 from "./LandingPage2";

// Mock react-oidc-context for LandingPage2 tests
vi.mock("react-oidc-context", () => ({
  useAuth: () => ({
    isLoading: false,
    error: undefined,
    isAuthenticated: false,
    user: undefined,
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.setItem("mj-lang", "de");
});

function renderPage() {
  return render(
    <LangProvider>
      <LandingPage2 />
    </LangProvider>
  );
}

describe("LandingPage2 (JM-MARKETING-02 positioning)", () => {
  it("zeigt die deutsche Positionierung und beide CTAs", () => {
    renderPage();
    expect(screen.getByText("MAY'S JOB MATCHER")).toBeTruthy();
    expect(screen.getByText("Finde Jobs,")).toBeTruthy();
    expect(screen.getByText("die wirklich zu dir passen.")).toBeTruthy();
    expect(
      screen.getByText(/Entdecke Stellen aus mehreren Quellen, definiere eigene Suchprofile/)
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Jetzt passende Jobs finden" })).toBeTruthy();
    expect(screen.getAllByText("So funktioniert's").length).toBeGreaterThanOrEqual(2);
  });

  it("zeigt die englische Positionierung und beide CTAs", () => {
    window.localStorage.setItem("mj-lang", "en");
    renderPage();
    expect(screen.getByText("Find jobs")).toBeTruthy();
    expect(screen.getByText("that really fit you.")).toBeTruthy();
    expect(
      screen.getByText(/Discover jobs from multiple sources, define your own search profiles/)
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Find matching jobs now" })).toBeTruthy();
    expect(screen.getAllByText("How it works").length).toBeGreaterThanOrEqual(2);
  });

  it("führt den primären CTA direkt zur Suche und den sekundären zum Erklärungsabschnitt", () => {
    renderPage();
    const primary = screen.getByRole("link", { name: "Jetzt passende Jobs finden" });
    const secondary = screen.getByRole("link", { name: "So funktioniert's" });
    expect(primary.getAttribute("href")).toBe("/search");
    expect(secondary.getAttribute("href")).toBe("#lp2-how");
    expect(document.querySelector("#lp2-how")).toBeTruthy();
  });

  it("hat eine klare Überschriftenhierarchie und benannte Abschnitte", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: "So funktioniert's" })
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Mehr als eine Jobsuche" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Gut zu wissen" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Bereit für deinen nächsten Karriereschritt?" })
    ).toBeTruthy();
    const how = document.querySelector("#lp2-how") as HTMLElement;
    expect(how.getAttribute("aria-labelledby")).toBe("lp2-how-title");
    expect(document.querySelector("#lp2-how-title")).toBeTruthy();
  });

  it("erklärt den Ablauf in vier nachvollziehbaren Schritten", () => {
    renderPage();
    const how = document.querySelector("#lp2-how") as HTMLElement;
    const items = within(how).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(how).getByText("Suchprofil festlegen")).toBeTruthy();
    expect(within(how).getByText("Stellen entdecken")).toBeTruthy();
    expect(within(how).getByText("Passung vergleichen")).toBeTruthy();
    expect(within(how).getByText("Bewerbung organisieren")).toBeTruthy();
  });

  it("zeigt vier Produktvorteile ohne unbelegte Quellen- oder Garantieaussagen", () => {
    renderPage();
    const benefits = document.querySelector("#lp2-benefits") as HTMLElement;
    expect(within(benefits).getAllByRole("article")).toHaveLength(4);
    expect(within(benefits).getByText("Stellensuche")).toBeTruthy();
    expect(within(benefits).getByText("Individuelle Suchprofile")).toBeTruthy();
    expect(within(benefits).getByText("KI-Matching")).toBeTruthy();
    expect(within(benefits).getByText("Bewerbungsorganisation")).toBeTruthy();
    expect(benefits.textContent).toContain("verfügbaren Job-Quellen");
    for (const forbidden of ["Theirstack", "JobsPipe", "garantiert", "alle Jobbörsen", "unbegrenzt"]) {
      expect(benefits.textContent?.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("erklärt Verfügbarkeit und Datenschutzgrenzen transparent", () => {
    renderPage();
    const text = document.body.textContent ?? "";
    expect(text).toContain("Ohne Anmeldung starten");
    expect(text).toContain("Konto und eine separate Einwilligung");
    expect(text).toContain("PDF wird lokal im Browser gelesen");
    expect(text).toContain("an einen KI-Dienst übermittelt");
    expect(text).toContain("standardmäßig in der aktuellen Sitzung");
    expect(text.toLowerCase()).not.toContain("vollständig anonym");
  });

  it("bietet einen abschließenden Conversion-CTA ohne Registrierungsbarriere", () => {
    renderPage();
    const finalCta = document.querySelector(".lp2-final-cta") as HTMLElement;
    expect(finalCta).toBeTruthy();
    expect(
      within(finalCta).getByRole("heading", {
        level: 2,
        name: "Bereit für deinen nächsten Karriereschritt?",
      })
    ).toBeTruthy();
    expect(
      within(finalCta).getByText(
        "Entdecke passende Stellen und starte deine persönliche Jobsuche."
      )
    ).toBeTruthy();
    const button = within(finalCta).getByRole("link", { name: "Jetzt Jobs finden" });
    expect(button.getAttribute("href")).toBe("/search");
  });

  it("keine dritte Headline-Zeile und keine Hero-Card", () => {
    window.localStorage.setItem("mj-lang", "en");
    renderPage();
    expect(screen.queryByText(/PROTOTYPE/)).toBeNull();
    expect(document.querySelector(".lp2-hero-content .lp2-card")).toBeNull();
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
    expect(stream.querySelector(".js-stream")).toBeTruthy();
    expect(hero.querySelector(".lp2-hero-content")).toBeTruthy();
  });

  it("Hintergrundbild Abendlicht2 ist eingebunden", () => {
    renderPage();
    const bg = document.querySelector(".lp2-background") as HTMLElement;
    expect(bg.style.backgroundImage).toContain("Futuristische_Stadt_im_blauen_Abendlicht2");
  });

  it("Glass-Navigation: Brand, Link, EN/DE, Login (DE-Default)", () => {
    renderPage();
    const bar = document.querySelector(".nav-inner") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(within(bar).getByText("May’s Job Matcher")).toBeTruthy();
    expect(within(bar).getByText("Suche")).toBeTruthy();
    expect(within(bar).getByText("EN")).toBeTruthy();
    expect(within(bar).getByText("DE")).toBeTruthy();
    expect(within(bar).getByText("Anmelden")).toBeTruthy();
  });

  it("Login ist ein klickbarer Link auf /anmelden", () => {
    renderPage();
    const login = screen.getByRole("link", { name: "Anmelden" });
    expect(login.getAttribute("href")).toBe("/anmelden");
    expect(document.querySelector('button[aria-disabled="true"].lp2-login')).toBeNull();
  });

  it("Landingpage zeigt nur Suche, Benachrichtigungen ist ausgeblendet", () => {
    renderPage();
    const bar = document.querySelector(".nav-inner") as HTMLElement;
    const nav = bar.querySelector(".nav-links") as HTMLElement;
    expect(nav).toBeTruthy();
    expect(within(nav).queryByText("Benachrichtigungen")).toBeNull();
    const links = within(nav).getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/search");
  });

  it("rendert den gemeinsamen Footer genau einmal mit Legal-Links", () => {
    renderPage();
    expect(document.querySelectorAll("footer.footer")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum");
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/datenschutz");
    expect(screen.getByRole("link", { name: "Datenschutzprinzipien" })).toHaveAttribute(
      "href",
      "/datenschutzprinzipien"
    );
  });

  it("Match Pulse sitzt neben der zweiten Headline-Zeile und ist übersetzt", () => {
    renderPage();
    const pulse = document.querySelector(".mp") as HTMLElement;
    expect(pulse).toBeTruthy();
    expect(pulse.getAttribute("aria-label")).toBe(
      "KI-Puls auslösen und Job-Stream aktualisieren"
    );
    expect(pulse.querySelector(".mp-dot")).toBeTruthy();
    expect(pulse.querySelector(".mp-ring")).toBeTruthy();

    cleanup();
    window.localStorage.setItem("mj-lang", "en");
    renderPage();
    expect(screen.getByRole("button", { name: "Trigger AI pulse and refresh job stream" })).toBeTruthy();
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
    expect(screen.getByText("Find jobs")).toBeTruthy();
    expect(screen.getByText("How it works", { selector: "h2" })).toBeTruthy();
    expect(screen.getByText("Ready for your next career move?", { selector: "h2" })).toBeTruthy();
    expect(window.localStorage.getItem("mj-lang")).toBe("en");
    fireEvent.click(screen.getByText("DE"));
    expect(screen.getByText("Finde Jobs,")).toBeTruthy();
    expect(screen.getByText("So funktioniert's", { selector: "h2" })).toBeTruthy();
    expect(screen.getByText("Bereit für deinen nächsten Karriereschritt?", { selector: "h2" })).toBeTruthy();
    expect(window.localStorage.getItem("mj-lang")).toBe("de");
  });
});
