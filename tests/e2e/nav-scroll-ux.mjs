// JM-NAV-SCROLL-UX-02
// Local Chromium E2E for direction-aware navigation and back-to-top.
// API calls are intercepted; no provider, AI or backend call is made.
//
// Run: node tests/e2e/nav-scroll-ux.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-NAV-SCROLL-UX-02");
const port = 5208;
const base = `http://localhost:${port}`;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const jobs = {
  jobs: Array.from({ length: 14 }, (_, index) => ({
    slug: `nav-job-${index + 1}`,
    title: `Fullstack Developer ${index + 1}`,
    company_name: `Beispiel GmbH ${index + 1}`,
    location: ["Berlin"],
    remote: index % 2 === 0,
    tags: ["React", "TypeScript", "AWS"],
    url: `https://example.invalid/jobs/${index + 1}`,
    source: ["arbeitnow"],
  })),
  meta: { totalFiltered: 14 },
};

const matches = {
  matches: jobs.jobs.map((job) => ({
    score: 90,
    why: "Guter fachlicher Fit.",
    prepare: "Frage nach dem Team.",
    job,
  })),
  meta: { evaluated: jobs.jobs.length },
};

function startVite() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", () => undefined);
  return child;
}

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/search`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

async function preparePage(browser, viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({
    viewport,
    locale: "de-DE",
    reducedMotion: reducedMotion === "reduce" ? "reduce" : "no-preference",
  });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const consoleErrors = [];
  const apiRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/jobs") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobs) });
    }
    if (path === "/api/match") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(matches) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  return { context, page, consoleErrors, apiRequests };
}

async function loadResults(page) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.fill("#skills", "AWS Fullstack");
  await page.getByRole("button", { name: "Meine Treffer finden" }).click();
  await page.getByText("14 Stellen gefunden").waitFor();
  await page.waitForTimeout(200);
}

async function navState(page) {
  return page.evaluate(() => {
    const nav = document.querySelector(".navbar");
    const back = document.querySelector(".back-to-top");
    return {
      className: nav?.className ?? "",
      hidden: Boolean(nav?.classList.contains("scrolled")),
      navBottom: nav?.getBoundingClientRect().bottom ?? 0,
      backToTop: Boolean(back),
      backHeight: back?.getBoundingClientRect().height ?? 0,
      y: window.scrollY,
      path: window.location.pathname,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

async function scrollTo(page, y) {
  await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
  await page.waitForTimeout(320);
}

async function runViewport(browser, width, height, screenshotName) {
  const { context, page, consoleErrors, apiRequests } = await preparePage(browser, { width, height });
  await loadResults(page);
  await scrollTo(page, 0);

  let state = await navState(page);
  if (state.hidden) throw new Error(`${screenshotName}: navbar hidden at top`);
  if (state.backToTop) throw new Error(`${screenshotName}: back-to-top visible at top ${JSON.stringify(state)}`);
  await page.screenshot({ path: resolve(evidenceDir, `${screenshotName}-nav-visible.png`), fullPage: false });

  await scrollTo(page, 1200);
  state = await navState(page);
  if (!state.hidden) throw new Error(`${screenshotName}: navbar did not hide after scrolling down`);
  if (!state.backToTop || state.backHeight < 44) throw new Error(`${screenshotName}: back-to-top missing or below 44px`);
  await page.screenshot({ path: resolve(evidenceDir, `${screenshotName}-nav-hidden.png`), fullPage: false });

  await scrollTo(page, 1180);
  state = await navState(page);
  if (state.hidden) throw new Error(`${screenshotName}: navbar did not reveal on 20px upward scroll`);

  await scrollTo(page, 0);
  state = await navState(page);
  if (state.hidden) throw new Error(`${screenshotName}: navbar hidden at top after restore`);

  if (width <= 767) {
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    await page.getByRole("dialog", { name: "Hauptnavigation" }).waitFor();
    await page.waitForTimeout(350);
    await page.screenshot({ path: resolve(evidenceDir, `${screenshotName}-menu-open.png`), fullPage: false });
    await scrollTo(page, 900);
    state = await navState(page);
    if (state.hidden) throw new Error(`${screenshotName}: navbar hid while menu was open`);
    if (!(await page.getByRole("dialog", { name: "Hauptnavigation" }).isVisible())) {
      throw new Error(`${screenshotName}: menu closed on scroll`);
    }
    await page.getByRole("button", { name: "Menü schließen" }).click();
    await page.getByRole("dialog", { name: "Hauptnavigation" }).waitFor({ state: "detached" });
  }

  await scrollTo(page, 1200);
  await page.getByRole("button", { name: "Nach oben" }).click();
  await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 2000 });
  state = await navState(page);
  if (state.path !== "/search") throw new Error(`${screenshotName}: back-to-top changed route`);
  if (!(await page.getByText("14 Stellen gefunden").isVisible())) {
    throw new Error(`${screenshotName}: search results lost after back-to-top`);
  }
  if (state.overflow > 0) throw new Error(`${screenshotName}: horizontal overflow ${state.overflow}px`);
  if (consoleErrors.length) throw new Error(`${screenshotName}: console errors ${consoleErrors.join(" | ")}`);
  if (apiRequests.some((path) => !["/api/models", "/api/jobs"].includes(path))) {
    throw new Error(`${screenshotName}: unexpected API requests ${apiRequests.join(", ")}`);
  }
  await context.close();
  return { width, consoleErrors };
}

async function runReducedMotion(browser) {
  const { context, page, consoleErrors } = await preparePage(browser, { width: 390, height: 844 }, "reduce");
  await loadResults(page);
  await scrollTo(page, 1200);
  const button = page.getByRole("button", { name: "Nach oben" });
  await button.click();
  await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 2000 });
  if (consoleErrors.length) throw new Error(`reduced-motion console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { reducedMotion: true };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch();
  const results = [];
  for (const [width, height, name] of [
    [1440, 1000, "desktop-1440"],
    [1024, 900, "desktop-1024"],
    [768, 900, "tablet-768"],
    [430, 900, "mobile-430"],
    [390, 844, "mobile-390"],
    [320, 800, "mobile-320"],
  ]) {
    results.push(await runViewport(browser, width, height, name));
  }
  const reduced = await runReducedMotion(browser);
  console.log(JSON.stringify({ status: "PASS", results, reduced }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
