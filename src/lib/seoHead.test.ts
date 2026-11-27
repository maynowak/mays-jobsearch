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

// Private app routes that should have noindex,follow via client-side SEO
const PRIVATE_ROUTES = [
  "/search",
  "/cv-builder/workspace",
  "/anmelden",
  "/auth/callback",
  "/email-bestaetigen",
  "/registrieren",
  "/landingspage2",
] as const;

// Legal pages are now served as static HTML - they don't need client-side SEO guards
const LEGAL_ROUTES = ["/datenschutz", "/datenschutzprinzipien", "/impressum"] as const;

describe("applyRouteSeoHead", () => {
  it("removes the landing canonical and applies noindex on private routes", () => {
    createHead(HOME_URL);

    applyRouteSeoHead("/profil");

    expect(canonicalLinks()).toHaveLength(0);
    expect(robotsContent()).toBe("noindex,nofollow");
  });

  it.each([...PRIVATE_ROUTES])("does not leave a canonical on private route %s", (pathname) => {
    createHead(HOME_URL);

    applyRouteSeoHead(pathname);

    expect(canonicalLinks()).toHaveLength(0);
    expect(robotsContent()).toContain("noindex");
  });

  it("does not modify legal pages (they are served as static HTML)", () => {
    // Legal pages are static HTML with their own meta tags, no client-side modification needed
    for (const pathname of LEGAL_ROUTES) {
      createHead(HOME_URL);

      applyRouteSeoHead(pathname);

      // Legal pages should keep their own index,follow meta (not changed by client-side script)
      expect(robotsContent()).toBe("index,follow");
    }
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