import { describe, expect, it } from "vitest";
import { HOME_URL, applyRouteSeoHead } from "./seoHead";

const createHead = (canonicalHref?: string) => {
  document.head.innerHTML = "";
  const robots = document.createElement("meta");
  robots.setAttribute("name", "robots");
  robots.setAttribute("content", "index,follow");
  document.head.appendChild(robots);
  if (canonicalHref) {
    const canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", canonicalHref);
    document.head.appendChild(canonical);
  }
};

const canonicalLinks = () => document.head.querySelectorAll('link[rel="canonical"]');
const robotsContent = () =>
  document.head.querySelector('meta[name="robots"]')?.getAttribute("content");

describe("applyRouteSeoHead", () => {
  it("removes the landing canonical and applies noindex on private routes", () => {
    createHead(HOME_URL);

    applyRouteSeoHead("/profil");

    expect(canonicalLinks()).toHaveLength(0);
    expect(robotsContent()).toBe("noindex,nofollow");
  });

  it.each([
    "/search",
    "/cv-builder/workspace",
    "/anmelden",
    "/auth/callback",
    "/email-bestaetigen",
    "/registrieren",
    "/datenschutz",
    "/datenschutzprinzipien",
    "/impressum",
    "/landingspage2",
  ])("does not leave a canonical on %s", (pathname) => {
    createHead(HOME_URL);

    applyRouteSeoHead(pathname);

    expect(canonicalLinks()).toHaveLength(0);
    expect(robotsContent()).toContain("noindex");
  });

  it("restores canonical and index directives on the landing page", () => {
    createHead();

    applyRouteSeoHead("/");

    expect(canonicalLinks()).toHaveLength(1);
    expect(canonicalLinks()[0].getAttribute("href")).toBe(HOME_URL);
    expect(robotsContent()).toBe("index,follow,max-image-preview:large");
  });

  it("treats /index.html as the landing page", () => {
    createHead("https://example.invalid/");

    applyRouteSeoHead("/index.html");

    expect(canonicalLinks()).toHaveLength(1);
    expect(canonicalLinks()[0].getAttribute("href")).toBe(HOME_URL);
    expect(robotsContent()).toBe("index,follow,max-image-preview:large");
  });

  it("is idempotent and repairs a wrong canonical", () => {
    createHead("https://example.invalid/");

    applyRouteSeoHead("/");
    applyRouteSeoHead("/");

    expect(canonicalLinks()).toHaveLength(1);
    expect(canonicalLinks()[0].getAttribute("href")).toBe(HOME_URL);
  });

  it("creates a robots meta tag when the document has none", () => {
    document.head.innerHTML = "";

    applyRouteSeoHead("/search");

    expect(robotsContent()).toBe("noindex,nofollow");
  });
});
