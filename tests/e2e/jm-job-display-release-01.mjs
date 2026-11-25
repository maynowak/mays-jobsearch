// JM-SECURITY-CODEQL-RELEASE-01
// Deterministic job search/detail rendering E2E with mocked sources.
// Verifies complete text, paragraph/list/table structure, entities, URLs and
// the absence of executable HTML after the HTML-text security changes.
//
// Run: node tests/e2e/jm-job-display-release-01.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "playwright";

const port = 5291;
const base = `http://localhost:${port}`;
const evidenceDir = process.env.JM_DISPLAY_EVIDENCE_DIR
  ? resolve(process.env.JM_DISPLAY_EVIDENCE_DIR)
  : "/tmp/opencode/jm-job-display-release-01";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const richDescription =
  "<p>Größe &amp; Überblick: Wir suchen eine Entwicklerin oder einen Entwickler.</p>" +
  "<h3>Aufgaben</h3><ul><li>Betrieb von Kubernetes</li><li>Aufbau von Observability</li></ul>" +
  "<h3>Anforderungen</h3><ul><li>AWS &amp; Terraform</li><li>Erfahrung mit TypeScript</li></ul>" +
  "<p>Gehalt &lt; 80k.</p>" +
  "<p>Mathe: &le; &ge; &infin; &Omega; &alpha;.</p>" +
  "<p>Doppelt: &amp;lt;strong&amp;gt;Java&amp;lt;/strong&amp;gt;</p>" +
  "<table><tr><th>Anforderung</th><th>Level</th></tr><tr><td>Playwright</td><td>Gut</td></tr></table>" +
  '<p>Link: <a href="https://example.com/jobs?a=1&copy=2">example.com</a></p>' +
  "<script>window.__xss = 1;</script>" +
  '<img src="x" onerror="window.__xss = 2;">' +
  "<style>.x{color:red}</style>";

function makeJob(index, extra = {}) {
  return {
    slug: `release-job-${index}`,
    title: index === 6 ? "Security Engineer (m/w/d)" : `Release Role ${index}`,
    company_name: index === 6 ? "Müller & Söhne GmbH" : `Release GmbH ${index}`,
    location: ["Berlin"],
    remote: false,
    tags: ["React", "TypeScript"],
    url: `https://example.invalid/jobs/${index}`,
    source: ["arbeitnow"],
    ...extra,
  };
}

const jobs = [
  makeJob(1), makeJob(2), makeJob(3), makeJob(4), makeJob(5),
  makeJob(6, { description: richDescription, language: "de" }),
];
const matches = jobs.slice(0, 5).map((job) => ({
  score: 92,
  why: "Guter fachlicher Fit.",
  prepare: "Frage nach dem Team.",
  job,
}));

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/search`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not start");
}

async function preparePage(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const calls = { jobs: 0, match: 0, details: 0, unexpected: [], consoleErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") calls.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => calls.consoleErrors.push(String(error)));
  await page.route("**/api/**", (handler) => {
    const url = new URL(handler.request().url());
    const path = url.pathname;
    // Vite serves shared ESM helpers from api/_lib/ in dev; let those through.
    if (path.startsWith("/api/_lib/")) return handler.continue();
    if (path === "/api/models") {
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/jobs") {
      calls.jobs += 1;
      return handler.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs, meta: { totalFiltered: jobs.length, sources: {} } }),
      });
    }
    if (path === "/api/match") {
      calls.match += 1;
      return handler.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ matches, meta: { evaluated: matches.length } }),
      });
    }
    if (path === "/api/job-details") {
      calls.details += 1;
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: {} }) });
    }
    calls.unexpected.push(`${handler.request().method()} ${path}`);
    return handler.continue();
  });
  return { context, page, calls };
}

async function runSearch(page) {
  await page.getByLabel("Skills").fill("React, TypeScript");
  await page.getByRole("button", { name: "Meine Treffer finden" }).click();
  await page.locator(".remaining-card").first().waitFor();
  await page.getByRole("button", { name: /Mit KI bewerten/ }).click();
  await page.locator(".match-card").first().waitFor({ timeout: 20000 });
}

async function check(browser, width) {
  const { context, page, calls } = await preparePage(browser, width);
  try {
    await page.goto(`${base}/search`, { waitUntil: "networkidle" });
    await runSearch(page);
    const matchCards = await page.locator(".match-card").count();
    if (matchCards !== 5) throw new Error(`expected 5 match cards, got ${matchCards}`);
    const toggle = page.locator(".results-remaining-toggle");
    await toggle.click();
    const card = page.locator(".remaining-card").last();
    await card.waitFor();

    const header = await card.innerText();
    for (const expected of ["Security Engineer (m/w/d)", "Müller & Söhne GmbH", "Berlin"]) {
      if (!header.includes(expected)) throw new Error(`missing card header text: ${expected}`);
    }

    const html = card.locator(".html-content").first();
    await html.waitFor();
    const text = await html.innerText();
    const required = [
      "Größe & Überblick",
      "Betrieb von Kubernetes",
      "Aufbau von Observability",
      "AWS & Terraform",
      "Erfahrung mit TypeScript",
      "Gehalt < 80k.",
      "Mathe: ≤ ≥ ∞ Ω α.",
      "Java",
      "Playwright",
      "example.com",
    ];
    for (const expected of required) {
      if (!text.includes(expected)) throw new Error(`missing description text: ${expected}`);
    }
    for (const forbidden of ["&lt;", "&amp;lt;", "&nbsp;", "</p>", "<script", ".x{color:red}", "alert(1)"]) {
      if (text.includes(forbidden)) throw new Error(`raw markup leaked into text: ${forbidden}`);
    }

    const dom = await page.evaluate(() => {
      const root = document.querySelector(".remaining-card .html-content");
      const link = root?.querySelector("a");
      return {
        scripts: root?.querySelectorAll("script").length ?? -1,
        styles: root?.querySelectorAll("style").length ?? -1,
        onerrorNodes: root?.querySelectorAll("[onerror]").length ?? -1,
        javascriptLinks: root?.querySelectorAll('a[href^="javascript:"]').length ?? -1,
        paragraphs: root?.querySelectorAll("p").length ?? 0,
        lists: root?.querySelectorAll("ul li").length ?? 0,
        tables: root?.querySelectorAll("table").length ?? 0,
        strong: root?.querySelectorAll("strong").length ?? 0,
        href: link?.getAttribute("href") ?? "",
        xss: window.__xss ?? 0,
        overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      };
    });
    if (dom.scripts || dom.styles || dom.onerrorNodes || dom.javascriptLinks || dom.xss) {
      throw new Error(`unsafe DOM survived: ${JSON.stringify(dom)}`);
    }
    if (dom.paragraphs < 4 || dom.lists < 4 || dom.tables < 1 || dom.strong < 1) {
      throw new Error(`structure lost: ${JSON.stringify(dom)}`);
    }
    if (!dom.href.includes("copy=2")) throw new Error(`link query changed: ${dom.href}`);
    if (width === 390 && dom.overflow > 0) throw new Error(`mobile overflow: ${dom.overflow}px`);
    if (calls.unexpected.length) throw new Error(`unexpected API calls: ${calls.unexpected.join(", ")}`);
    if (calls.consoleErrors.length) throw new Error(`console errors: ${calls.consoleErrors.join(" | ")}`);
    if (calls.details !== 0) throw new Error(`unexpected job-details call for non-AA source: ${calls.details}`);

    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: resolve(evidenceDir, `job-display-${width}.png`), fullPage: true });
    return { width, matchCards, calls: { jobs: calls.jobs, match: calls.match }, dom, textLength: text.length };
  } finally {
    await context.close();
  }
}

const server = startVite();
try {
  await waitForServer();
  const browser = await playwright.chromium.launch();
  try {
    const desktop = await check(browser, 1440);
    const mobile = await check(browser, 390);
    console.log(JSON.stringify({ status: "PASS", desktop, mobile, evidenceDir }, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* ignore */ }
}
