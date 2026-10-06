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

describe("TOP-MENU-02: Navbar Glass-Look nur auf der Suchmaske", () => {
  it("route matcher (/search) traegt die Glass-Klasse", () => {
    renderNavbar("matcher", "/search");
    const header = document.querySelector("header.navbar") as HTMLElement;
    expect(header.className).toContain("navbar-glass");
    // Die Pille sitzt auf .nav-inner, nicht auf der ganzen Leiste.
    expect(document.querySelector(".nav-inner")).toBeTruthy();
  });

  it("alle anderen Routen bleiben ohne Glass-Klasse", () => {
    const cases: Array<[NavbarRoute, string]> = [
      ["landing", "/"],
      ["impressum", "/impressum"],
      ["register", "/registrieren"],
      ["login", "/anmelden"],
    ];
    for (const [route, path] of cases) {
      cleanup();
      renderNavbar(route, path);
      const header = document.querySelector("header.navbar") as HTMLElement;
      expect(header.className, `${path} darf keine Glass-Klasse haben`).toBe("navbar");
    }
  });

  it("Element-Reihenfolge (User-Vorgabe): Brand | EN/DE | Suche | Benachrichtigungen | Login", () => {
    const links = navLinks("matcher", "/search");
    const nav = document.querySelector(".nav-inner") as HTMLElement;

    // Reihenfolge der direkten Kinder: Brand, EN/DE-Gruppe, Linkliste.
    const kids = [...nav.children].map((el) => el.className);
    expect(kids[0]).toContain("navbar-title");
    expect(kids[1]).toContain("nav-center");
    expect(kids[2]).toContain("nav-links");

    // Rechts: Suche zuerst, danach Benachrichtigungen, Login ganz rechts.
    expect(links.map((l) => l.text)).toEqual([
      "Suche",
      "Benachrichtigungen",
      "Login",
    ]);
    // Login bleibt ausserhalb des Link-Moduls (`.nav-login`).
    expect(document.querySelector(".nav-links .nav-login")).toBeTruthy();
  });

  it("Benachrichtigungen erscheint auf /search direkt nach dem Search-Link", () => {
    const links = navLinks("matcher", "/search");
    expect(links[0].text).toBe("Suche");
    expect(links[0].href).toBe("/search");
    expect(links[1].text).toBe("Benachrichtigungen");
    expect(links[1].href).toBe("/search#alerts");
    expect(links[2].text).toBe("Login");
    expect(links[2].href).toBe("/anmelden");
  });

  it("andere Routen zeigen Benachrichtigungen je nach Modul-Freigabe", () => {
    expect(navLinks("impressum", "/impressum").map((l) => l.text)).toEqual([
      "Suche",
      "Login",
    ]);
    expect(navLinks("register", "/registrieren").map((l) => l.text)).toEqual([
      "Suche",
      "Benachrichtigungen",
      "Login",
    ]);
    expect(navLinks("login", "/anmelden").map((l) => l.text)).toEqual([
      "Suche",
      "Benachrichtigungen",
      "Login",
    ]);
  });

  it("Brand und EN/DE-Switch sind vorhanden", () => {
    renderNavbar("matcher", "/search");
    expect(screen.getByText(/May.s Job Matcher/)).toBeTruthy();
    const center = document.querySelector(".nav-center") as HTMLElement;
    expect(within(center).getByRole("button", { name: "EN" })).toBeTruthy();
    expect(within(center).getByRole("button", { name: "DE" })).toBeTruthy();
  });
});
