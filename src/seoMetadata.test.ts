import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_ROUTES, HOME_URL } from "./lib/seoHead";

const root = process.cwd();
const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");
const appHtml = readFileSync(resolve(root, "app.html"), "utf8");
const robotsTxt = readFileSync(resolve(root, "public/robots.txt"), "utf8");
const sitemapXml = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");

interface VercelRewrite {
  source: string;
  destination: string;
}
interface VercelHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}
interface VercelConfig {
  functions?: Record<string, { maxDuration?: number }>;
  crons?: Array<{ path: string; schedule: string }>;
  redirects?: VercelRewrite[];
  rewrites?: VercelRewrite[];
  headers?: VercelHeaderRule[];
}

const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as VercelConfig;

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const indexDoc = parse(indexHtml);
const appDoc = parse(appHtml);

const content = (doc: Document, selector: string) =>
  doc.querySelector(selector)?.getAttribute("content") ?? null;

const EXPECTED_TITLE = "KI-gestützte Jobsuche & Job Matching | May's Job Matcher";
const EXPECTED_DESCRIPTION =
  "Finde passende Stellen mit individuellen Suchprofilen, KI-gestütztem Job Matching und Lebenslaufanalyse. Organisiere deine Jobsuche mit May's Job Matcher.";
const EXPECTED_IMAGE = "https://www.mays-job-matcher.app/job-matcher-next-step.webp";

describe("landing page SEO metadata (index.html)", () => {
  it("declares German as document language", () => {
    expect(indexDoc.documentElement.getAttribute("lang")).toBe("de");
  });

  it("sets title and meta description", () => {
    expect(indexDoc.title).toBe(EXPECTED_TITLE);
    expect(content(indexDoc, 'meta[name="description"]')).toBe(EXPECTED_DESCRIPTION);
  });

  it("allows indexing and sets the canonical landing URL", () => {
    expect(content(indexDoc, 'meta[name="robots"]')).toBe("index,follow,max-image-preview:large");
    expect(indexDoc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(HOME_URL);
  });

  it("provides Open Graph metadata", () => {
    expect(content(indexDoc, 'meta[property="og:type"]')).toBe("website");
    expect(content(indexDoc, 'meta[property="og:locale"]')).toBe("de_DE");
    expect(content(indexDoc, 'meta[property="og:site_name"]')).toBe("May's Job Matcher");
    expect(content(indexDoc, 'meta[property="og:title"]')).toBe(EXPECTED_TITLE);
    expect(content(indexDoc, 'meta[property="og:description"]')).toBe(EXPECTED_DESCRIPTION);
    expect(content(indexDoc, 'meta[property="og:url"]')).toBe(HOME_URL);
    expect(content(indexDoc, 'meta[property="og:image"]')).toBe(EXPECTED_IMAGE);
    expect(content(indexDoc, 'meta[property="og:image:width"]')).toBe("1536");
    expect(content(indexDoc, 'meta[property="og:image:height"]')).toBe("1024");
    expect(content(indexDoc, 'meta[property="og:image:alt"]')).toBeTruthy();
  });

  it("provides Twitter card metadata", () => {
    expect(content(indexDoc, 'meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(content(indexDoc, 'meta[name="twitter:title"]')).toBe(EXPECTED_TITLE);
    expect(content(indexDoc, 'meta[name="twitter:description"]')).toBe(EXPECTED_DESCRIPTION);
    expect(content(indexDoc, 'meta[name="twitter:image"]')).toBe(EXPECTED_IMAGE);
  });
});

describe("application shell (app.html)", () => {
  it("never carries the landing canonical or landing title", () => {
    expect(appDoc.querySelector('link[rel="canonical"]')).toBeNull();
    expect(appDoc.title).not.toBe(EXPECTED_TITLE);
    expect(content(appDoc, 'meta[property="og:url"]')).toBeNull();
  });

  it("declares noindex and nofollow", () => {
    const robots = content(appDoc, 'meta[name="robots"]') ?? "";
    expect(robots).toContain("noindex");
    expect(robots).toContain("nofollow");
  });

  it("keeps the German document language", () => {
    expect(appDoc.documentElement.getAttribute("lang")).toBe("de");
  });
});

describe("robots.txt and sitemap.xml", () => {
  it("allows crawling and references the canonical sitemap", () => {
    expect(robotsTxt).toMatch(/User-agent:\s*\*/i);
    expect(robotsTxt).toMatch(/Allow:\s*\//i);
    expect(robotsTxt).toContain("Disallow: /api/");
    expect(robotsTxt).toContain("Sitemap: https://www.mays-job-matcher.app/sitemap.xml");
  });

  it("contains only the released landing page", () => {
    expect(sitemapXml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemapXml.match(/<url>/g)).toHaveLength(1);
    expect(sitemapXml).toContain(`<loc>${HOME_URL}</loc>`);
    for (const route of APP_ROUTES) {
      expect(sitemapXml).not.toContain(`<loc>https://www.mays-job-matcher.app${route}</loc>`);
    }
  });
});

describe("vercel.json indexing protection", () => {
  const headerFor = (source: string) =>
    (vercel.headers ?? []).find((rule) => rule.source === source);

  it.each([...APP_ROUTES])("sends X-Robots-Tag noindex for %s", (route) => {
    const rule = headerFor(route);
    expect(rule, `missing headers entry for ${route}`).toBeDefined();
    const value = rule?.headers.find((header) => header.key === "X-Robots-Tag")?.value ?? "";
    expect(value).toContain("noindex");
  });

  it("protects the raw app shell and development previews", () => {
    expect(headerFor("/app.html")).toBeDefined();
    expect(headerFor("/dev/(.*)")).toBeDefined();
  });

  it("does not mark the landing page as noindex", () => {
    expect(headerFor("/")).toBeUndefined();
    expect(headerFor("/index.html")).toBeUndefined();
  });
});

describe("vercel.json routing and platform configuration", () => {
  const rewriteFor = (source: string) =>
    (vercel.rewrites ?? []).find((rewrite) => rewrite.source === source);

  it.each([...APP_ROUTES])("serves %s through the non-indexable app shell", (route) => {
    expect(rewriteFor(route)?.destination).toBe("/app.html");
  });

  it("preserves the pre-existing API rewrites", () => {
    const expected: Record<string, string> = {
      "/api/ris/applications": "/api/ris/router?__ris_applications=1",
      "/api/ris/consents": "/api/ris/router?__ris_consents=1",
      "/api/ris/cvs": "/api/ris/router?__ris_cvs=1",
      "/api/ris/cv-consents": "/api/ris/router?__ris_cv_consents=1",
      "/api/ris/search-profile-consents": "/api/ris/router?__ris_search_profile_consents=1",
      "/api/ris/search-profiles": "/api/ris/router?__ris_search_profiles=1",
      "/api/ris/erasure": "/api/ris/router?__ris_erasure=1",
    };
    for (const [source, destination] of Object.entries(expected)) {
      expect(rewriteFor(source)?.destination).toBe(destination);
    }
  });

  it("preserves function duration, cron, redirect and deployment settings", () => {
    expect(vercel.functions?.["api/**/*.mjs"]?.maxDuration).toBe(60);
    expect(vercel.crons).toContainEqual({ path: "/api/cron/digest", schedule: "0 7 * * *" });
    expect(vercel.redirects).toContainEqual({
      source: "/api/ris/router",
      destination: "/404",
      permanent: false,
    });
    expect(vercel).toHaveProperty("git.deploymentEnabled.main", true);
  });

  it("does not rewrite the homepage to the app shell", () => {
    expect(rewriteFor("/")).toBeUndefined();
    expect(rewriteFor("/index.html")).toBeUndefined();
  });
});

describe("route inventory drift guard", () => {
  const appSource = readFileSync(resolve(root, "src/App.tsx"), "utf8");
  const rootRouteSource = readFileSync(resolve(root, "src/rootRoute.ts"), "utf8");

  const routeLiterals = () => {
    const found = new Set<string>();
    const sources = `${appSource}\n${rootRouteSource}`;
    const patterns = [
      /window\.location\.pathname === "([^"]+)"/g,
      /\bpath === "([^"]+)"/g,
      /\bpathname === "([^"]+)"/g,
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(sources)) !== null) found.add(match[1]);
    }
    return [...found].filter((route) => route !== "/" && !route.startsWith("/dev/")).sort();
  };

  it("keeps the non-API rewrite list identical to APP_ROUTES", () => {
    const configured = (vercel.rewrites ?? [])
      .map((rewrite) => rewrite.source)
      .filter((source) => !source.startsWith("/api/"))
      .sort();
    expect(configured).toEqual([...APP_ROUTES].sort());
  });

  it("covers every route literal used by App.tsx and rootRoute.ts", () => {
    const literals = routeLiterals();
    expect(literals.length).toBeGreaterThan(0);
    for (const route of literals) {
      expect(APP_ROUTES, `route ${route} is missing from APP_ROUTES`).toContain(route);
    }
  });
});
