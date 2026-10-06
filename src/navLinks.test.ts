import { describe, expect, it } from "vitest";
import { NAV_LINKS, navLinksFor } from "./navLinks";
import type { NavRoute } from "./navLinks";

// TOP-MENU-01: Regression des zentralen Top-Menü-Link-Moduls.
const ALL_ROUTES: NavRoute[] = ["landing", "matcher", "impressum", "register", "login"];

describe("navLinks (TOP-MENU-01)", () => {
  it("hat stabile IDs, vollstaendige Hrefs und Zielrouten", () => {
    const ids = NAV_LINKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const link of NAV_LINKS) {
      expect(link.href.startsWith("/"), `${link.id} braucht absolute href`).toBe(true);
      expect(link.visibleOn.length, `${link.id} muss auf mindestens einer Route sichtbar sein`).toBeGreaterThan(0);
      // targetRoute ist der Pfad-Teil der href ohne Hash
      expect(link.href.split("#")[0]).toBe(link.targetRoute);
      // visibleOn darf nur bekannte Routen enthalten
      for (const route of link.visibleOn) expect(ALL_ROUTES).toContain(route);
    }
  });

  it("navLinksFor filtert pro Route", () => {
    expect(navLinksFor("landing").map((l) => l.id)).toEqual(["search"]);
    expect(navLinksFor("impressum").map((l) => l.id)).toEqual(["search"]);
    expect(navLinksFor("matcher").map((l) => l.id)).toEqual(["search", "alerts"]);
    expect(navLinksFor("register").map((l) => l.id)).toEqual(["search", "alerts"]);
    expect(navLinksFor("login").map((l) => l.id)).toEqual(["search", "alerts"]);
  });

  it("Suche ist auf allen Routen sichtbar und fuehrt nach /search", () => {
    for (const route of ALL_ROUTES) {
      const search = navLinksFor(route).find((l) => l.id === "search");
      expect(search, `search fehlt auf ${route}`).toBeTruthy();
      expect(search!.href).toBe("/search");
      expect(search!.inPage).toBe("top");
    }
  });

  it("Benachrichtigungen ist auf der Landingpage und dem Impressum ausgeblendet", () => {
    // User-Entscheidung TOP-MENU-01: ohne Anmeldung dort nicht nuetzlich.
    expect(navLinksFor("landing").some((l) => l.id === "alerts")).toBe(false);
    expect(navLinksFor("impressum").some((l) => l.id === "alerts")).toBe(false);
    // Auf der Suchmaske und bei der Registrierung bleibt der Link erhalten.
    expect(navLinksFor("matcher").some((l) => l.id === "alerts")).toBe(true);
    expect(navLinksFor("register").some((l) => l.id === "alerts")).toBe(true);
    expect(navLinksFor("login").some((l) => l.id === "alerts")).toBe(true);
  });

  it("kein Link verweist mehr auf die alte Route /top (TOP-MENU-01 Umbenennung)", () => {
    for (const link of NAV_LINKS) {
      expect(link.href).not.toContain("/top");
      expect(link.targetRoute).not.toBe("/top");
    }
    for (const route of ALL_ROUTES) {
      for (const link of navLinksFor(route)) expect(link.href).not.toContain("/top");
    }
  });
});
