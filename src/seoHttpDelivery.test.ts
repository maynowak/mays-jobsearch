// Local HTTP delivery check for the SEO configuration.
//
// This emulates the deployed behaviour of the `rewrites` and `headers` blocks in
// vercel.json against the real HTML/robots/sitemap files. It is NOT a substitute
// for verifying an actual Vercel preview deployment (see JM-MARKETING-01B), but
// it proves that the shipped response for a route carries the intended metadata
// and X-Robots-Tag header instead of relying on client-side DOM changes.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_ROUTES, HOME_URL } from "./lib/seoHead";

interface Rewrite {
  source: string;
  destination: string;
}
interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}
interface VercelConfig {
  rewrites?: Rewrite[];
  headers?: HeaderRule[];
}

const root = process.cwd();
const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as VercelConfig;

const matchesSource = (source: string, pathname: string) => {
  if (source.endsWith("/(.*)")) return pathname.startsWith(source.slice(0, -4));
  return source === pathname;
};

const resolveFile = (pathname: string) => {
  const rewrite = (config.rewrites ?? []).find((entry) => entry.source === pathname);
  const target = (rewrite?.destination ?? pathname).split("?")[0];
  if (target === "/") return { file: "index.html", type: "text/html; charset=utf-8" };
  if (target === "/index.html") return { file: "index.html", type: "text/html; charset=utf-8" };
  if (target === "/app.html") return { file: "app.html", type: "text/html; charset=utf-8" };
  if (target === "/robots.txt") return { file: "public/robots.txt", type: "text/plain; charset=utf-8" };
  if (target === "/sitemap.xml") return { file: "public/sitemap.xml", type: "application/xml; charset=utf-8" };
  return null;
};

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const resolvedFile = resolveFile(pathname);
    if (!resolvedFile) {
      response.statusCode = 404;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end("not found");
      return;
    }
    for (const rule of config.headers ?? []) {
      if (!matchesSource(rule.source, pathname)) continue;
      for (const header of rule.headers) response.setHeader(header.key, header.value);
    }
    response.statusCode = 200;
    response.setHeader("content-type", resolvedFile.type);
    response.end(readFileSync(resolve(root, resolvedFile.file)));
  });
  await new Promise<void>((resolveListening) => {
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
});

const get = (pathname: string) => fetch(`${baseUrl}${pathname}`);

describe("served landing page", () => {
  it("returns indexable metadata with the canonical URL", async () => {
    const response = await get("/");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(body).toContain('rel="canonical" href="https://www.mays-job-matcher.app/"');
    expect(body).toContain('name="robots" content="index,follow,max-image-preview:large"');
    expect(body).toContain('property="og:url" content="https://www.mays-job-matcher.app/"');
    expect(body).toContain(
      "<title>KI-gestützte Jobsuche &amp; Job Matching | May's Job Matcher</title>",
    );
  });
});

describe.each([...APP_ROUTES])("served private route %s", (route) => {
  it("returns no canonical and noindex at HTTP level", async () => {
    const response = await get(route);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(body).not.toContain('rel="canonical"');
    expect(body).not.toContain('property="og:url"');
    expect(body).toContain('name="robots" content="noindex,nofollow"');
  });
});

describe("technical SEO files", () => {
  it("serves robots.txt with a sitemap reference", async () => {
    const response = await get("/robots.txt");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain(`Sitemap: ${HOME_URL}sitemap.xml`);
  });

  it("serves a sitemap limited to the landing page", async () => {
    const response = await get("/sitemap.xml");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("xml");
    expect(body).toContain(`<loc>${HOME_URL}</loc>`);
    for (const route of APP_ROUTES) {
      expect(body).not.toContain(`<loc>https://www.mays-job-matcher.app${route}</loc>`);
    }
  });
});
