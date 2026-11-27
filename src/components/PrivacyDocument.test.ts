import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const markdown = readFileSync(resolve(root, "public/legal/datenschutz.md"), "utf8");
const html = readFileSync(resolve(root, "public/legal/datenschutz.html"), "utf8");
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));

// Legal routes served as static HTML (not via app.html rewrite)
const LEGAL_ROUTES = ["/datenschutz", "/impressum", "/datenschutzprinzipien"] as const;

describe("public privacy documents", () => {
  it("carry the consolidated version and date", () => {
    expect(markdown).toContain("Version 1.2 · Stand: 8. November 2026");
    expect(html).toContain("Version 1.2 · Stand: 8. November 2026");
  });

  it("do not publish internal review notes", () => {
    expect(markdown).not.toMatch(/REDAKTIONELLE FREIGABEPRÜFUNG/);
    expect(markdown).not.toMatch(/NICHT ALS WEBSITE-TEXT VERÖFFENTLICHEN/);
    expect(html).not.toMatch(/REDAKTIONELLE FREIGABEPRÜFUNG/);
    expect(html).not.toMatch(/NICHT ALS WEBSITE-TEXT VERÖFFENTLICHEN/);
  });

  it("cover the consolidated cross-repository sections", () => {
    expect(markdown).toContain("OPTIONALE DAUERHAFTE SPEICHERUNG VON BEWERBUNGEN");
    expect(markdown).toContain("BEWERBUNGSKENNZAHLEN");
    expect(markdown).toContain("EINWILLIGUNG, VERSIONIERUNG UND WIDERRUF");
    expect(html).toContain("BEWERBUNGSKENNZAHLEN");
  });

  it("renders semantic headings and paragraphs in the public HTML copy", () => {
    // The HTML uses DOCTYPE (lowercase) and the title format from the existing file
    expect(html).toContain("Datenschutzerklärung – May");
    expect(html).toContain("VERANTWORTLICHE STELLE");
    expect(html).toContain("<p>");
    expect(html).not.toContain("<pre>");
    expect(html).not.toMatch(/REDAKTIONELLE FREIGABEPRÜFUNG/);
  });

  // Legal pages are now served as indexable static HTML
  it("have indexable static HTML files in public/", () => {
    for (const route of LEGAL_ROUTES) {
      // Remove leading slash for path
      const path = `${route.replace(/^\//, "")}/index.html`;
      const fullPath = resolve(root, `public/${path}`);
      expect(existsSync(fullPath), `static HTML for ${route} should exist at ${fullPath}`).toBe(true);
    }
  });

  // Legal pages should NOT have rewrites in vercel.json - they're served as static files
  it("are served as static files, not SPA rewrites", () => {
    const sources = (vercel.rewrites ?? []).map((rewrite: { source: string }) => rewrite.source);
    for (const route of LEGAL_ROUTES) {
      expect(sources).not.toContain(route);
    }
  });

  // Legal pages should NOT have noindex headers - they're indexable
  it("are indexable (no noindex headers)", () => {
    const sources = (vercel.headers ?? []).map((rule: { source: string }) => rule.source);
    for (const route of LEGAL_ROUTES) {
      expect(sources).not.toContain(route);
    }
  });
});