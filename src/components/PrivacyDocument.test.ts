import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const markdown = readFileSync(resolve(root, "public/legal/datenschutz.md"), "utf8");
const html = readFileSync(resolve(root, "public/legal/datenschutz.html"), "utf8");
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));

describe("public privacy documents", () => {
  it("carry the consolidated version and date", () => {
    expect(markdown).toContain("Version 1.1 · Stand: 7. November 2026");
    expect(html).toContain("Version 1.1 · Stand: 7. November 2026");
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

  it("have direct SPA rewrites for the privacy routes", () => {
    const sources = (vercel.rewrites ?? []).map((rewrite: { source: string }) => rewrite.source);
    expect(sources).toContain("/datenschutz");
    expect(sources).toContain("/datenschutzprinzipien");
  });
});
