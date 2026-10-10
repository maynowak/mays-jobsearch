import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import Navbar from "./Navbar";
import type { NavbarRoute } from "./Navbar";
import { LangProvider } from "../i18n";

function renderNavbar(route: NavbarRoute, path = "/search") {
  window.history.pushState({}, "", path);
  return render(
    <LangProvider>
      <Navbar route={route} />
    </LangProvider>
  );
}

const navLinks = (route: NavbarRoute, path?: string) => {
  cleanup();
  renderNavbar(route, path);
  const nav = document.querySelector(".nav-links") as HTMLElement;
  return within(nav)
    .getAllByRole("link")
    .map((a) => ({ text: (a.textContent || "").trim(), href: a.getAttribute("href") }));
};

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("TOP-MENU-02: Navbar Glass-Look auf Suchmaske und Auth-Seiten", () => {
  it("route matcher (/search) traegt die Glass-Klasse", () => {
    renderNavbar("matcher", "/search");
    const header = document.querySelector("header.navbar") as HTMLElement;
    expect(header.className).toContain("navbar-glass");
    // Die Pille sitzt auf .nav-inner, nicht auf der ganzen Leiste.
    expect(document.querySelector(".nav-inner")).toBeTruthy();
  });

  it("Auth-Routen register/login tragen Glass-Klasse", () => {
    for (const route of ["register", "login"] as const) {
      cleanup();
      renderNavbar(route, route === "register" ? "/registrieren" : "/anmelden");
      const header = document.querySelector("header.navbar") as HTMLElement;
      expect(header.className).toContain("navbar-glass");
    }
  });

  it("alle anderen Routen bleiben ohne Glass-Klasse", () => {
    const cases: Array<[NavbarRoute, string]> = [
      ["landing", "/"],
      ["impressum", "/impressum"],
    ];
    for (const [route, path] of cases) {
      cleanup();
      renderNavbar(route, path);
      const header = document.querySelector("header.navbar") as HTMLElement;
      expect(header.className, `${path} darf keine Glass-Klasse haben`).toBe("navbar");
    }
  });

  it("Element-Reihenfolge (User-Vorgabe): Brand | EN/DE | Suche | Benachrichtigungen | Login", () => {
    renderNavbar("matcher", "/search");
    const nav = document.querySelector(".nav-inner") as HTMLElement;

    // Reihenfolge der direkten Kinder: Brand, EN/DE, rechte Gruppe.
    const kids = [...nav.children].map((el) => el.className);
    expect(kids[0]).toContain("navbar-title");
    expect(kids[1]).toContain("nav-lang");
    expect(kids[2]).toContain("nav-right");

    // Rechte Gruppe enthält Links und Login.
    const right = document.querySelector(".nav-right") as HTMLElement;
    expect(right.querySelector(".nav-links")).toBeTruthy();
    expect(right.querySelector(".nav-login")).toBeTruthy();

    // Nav-Links enthalten nur Suche und Benachrichtigungen (Login separat).
    const links = within(document.querySelector(".nav-links") as HTMLElement)
      .getAllByRole("link")
      .map((a) => (a.textContent || "").trim());
    expect(links).toEqual(["Suche", "Benachrichtigungen"]);
  });

  it("Benachrichtigungen erscheint auf /search direkt nach dem Search-Link", () => {
    renderNavbar("matcher", "/search");
    const linkNodes = within(document.querySelector(".nav-links") as HTMLElement)
      .getAllByRole("link")
      .map((a) => ({ text: (a.textContent || "").trim(), href: a.getAttribute("href") }));
    expect(linkNodes[0].text).toBe("Suche");
    expect(linkNodes[0].href).toBe("/search");
    expect(linkNodes[1].text).toBe("Benachrichtigungen");
    expect(linkNodes[1].href).toBe("/search#alerts");

    const login = document.querySelector(".nav-login") as HTMLAnchorElement;
    expect(login?.textContent?.trim()).toBe("Login");
    expect(login?.getAttribute("href")).toBe("/anmelden");
  });

  it("andere Routen zeigen Benachrichtigungen je nach Modul-Freigabe", () => {
    expect(navLinks("impressum", "/impressum").map((l) => l.text)).toEqual([
      "Suche",
      "Login",
    ]);
    // Glass Mode: Login ist außerhalb von .nav-links, daher nur Suche + Benachrichtigungen
    expect(navLinks("register", "/registrieren").map((l) => l.text)).toEqual([
      "Suche",
      "Benachrichtigungen",
    ]);
    expect(navLinks("login", "/anmelden").map((l) => l.text)).toEqual([
      "Suche",
      "Benachrichtigungen",
    ]);
  });

  it("Brand und EN/DE-Switch sind vorhanden", () => {
    renderNavbar("matcher", "/search");
    expect(screen.getByText(/May.s Job Matcher/)).toBeTruthy();
    const lang = document.querySelector(".nav-lang") as HTMLElement;
    expect(within(lang).getByRole("button", { name: "EN" })).toBeTruthy();
    expect(within(lang).getByRole("button", { name: "DE" })).toBeTruthy();
  });
});
