// JM-SEARCH-UX-03
// Local Chromium E2E for the skills emphasis, search location and 5 km default.
// API and OpenPLZ calls are intercepted; no provider, AI or backend call is made.
//
// Run: node tests/e2e/search-ux-03.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-SEARCH-UX-03");
const port = 5207;
const base = `http://localhost:${port}`;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
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

async function preparePage(browser, viewport) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
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
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(models),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked" }),
    });
  });
  await page.route("**/openplzapi.org/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  );
  return { context, page, consoleErrors, apiRequests };
}

async function metrics(page) {
  return page.evaluate(() => {
    const skills = document.querySelector("#skills");
    const city = document.querySelector("#city");
    const radius = document.querySelector("#radius");
    const field = document.querySelector(".skills-field");
    const clear = document.querySelector(".skills-field .field-clear");
    const style = field ? getComputedStyle(field) : null;
    return {
      skillsHeight: skills?.getBoundingClientRect().height ?? 0,
      cityHeight: city?.getBoundingClientRect().height ?? 0,
      radiusHeight: radius?.getBoundingClientRect().height ?? 0,
      clearHeight: clear?.getBoundingClientRect().height ?? 0,
      borderLeftWidth: style ? Number.parseFloat(style.borderLeftWidth) : 0,
      borderLeftColor: style?.borderLeftColor ?? "",
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

async function runDesktop(browser) {
  const { context, page, consoleErrors, apiRequests } = await preparePage(browser, { width: 1440, height: 1000 });
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByText("Welche Fähigkeiten bringst du mit?").waitFor();
  await page.getByText("Gib deine Kenntnisse ein, z. B. Java, Python, AWS oder SQL.").waitFor();
  await page.getByLabel("Beispiele für Fähigkeiten").waitFor();
  await page.getByRole("button", { name: "Such-Einstellungen anzeigen" }).click();
  await page.getByLabel("Suchort (Stadt oder PLZ)").waitFor();
  await page.getByText(/Standardmäßig werden 5 km vorgeschlagen/).waitFor();

  await page.fill("#skills", "Spring Boot");
  const m = await metrics(page);
  if (m.skillsHeight < 44) throw new Error(`skills input below 44px: ${m.skillsHeight}`);
  if (m.clearHeight < 44) throw new Error(`skills clear control below 44px: ${m.clearHeight}`);
  if (m.borderLeftWidth < 3) throw new Error(`skills accent missing: ${m.borderLeftWidth}`);

  await page.locator("#skills").focus();
  await page.screenshot({ path: resolve(evidenceDir, "desktop-1440-skills-focus.png"), fullPage: false });
  await page.keyboard.press("Tab");
  const focusedClass = await page.evaluate(() => document.activeElement?.className ?? "");
  if (!String(focusedClass).includes("field-clear")) {
    throw new Error(`keyboard focus did not reach skills clear control: ${focusedClass}`);
  }

  await page.fill("#city", "Berlin");
  await page.locator("#city-suggestions").waitFor({ state: "visible" });
  await page.locator(".step-heading").click();
  await page.locator("#city-suggestions").waitFor({ state: "hidden" });
  // Evidence-only: keep the empty autocomplete popover from covering the radius
  // control in the static screenshots.
  await page.addStyleTag({ content: "#city-suggestions{display:none!important}" });
  const hideNav = await page.addStyleTag({ content: ".navbar{display:none!important}" });
  await page.waitForFunction(() => document.querySelector("#radius")?.value === "5");
  await page.getByText(/Standardmäßig werden 5 km vorgeschlagen/).waitFor();
  await page.locator(".search-card").screenshot({ path: resolve(evidenceDir, "desktop-1440-city-5km.png") });

  await page.selectOption("#radius", "10");
  await page.getByText(/Aktuell sind 10 km ausgewählt/).waitFor();
  await page.locator(".search-card").screenshot({ path: resolve(evidenceDir, "desktop-1440-city-10km.png") });

  await page.selectOption("#radius", "");
  await page.getByText(/Aktuell ist die Entfernung nicht begrenzt/).waitFor();

  for (const width of [1440, 1024, 768, 430, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const current = await metrics(page);
    if (current.overflow > 0) throw new Error(`${width}: horizontal overflow ${current.overflow}px`);
    if (current.cityHeight < 44) throw new Error(`${width}: city input below 44px`);
    if (current.radiusHeight < 44) throw new Error(`${width}: radius select below 44px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.selectOption("#radius", "5");
  await page.locator(".search-card").screenshot({ path: resolve(evidenceDir, "mobile-390-city-5km.png") });
  await hideNav.evaluate((style) => style.remove());

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByText("Which skills do you bring?").waitFor();
  await page.getByLabel("Search location (city or ZIP)").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const hideNavEn = await page.addStyleTag({ content: ".navbar{display:none!important}" });
  await page.locator(".search-card").screenshot({ path: resolve(evidenceDir, "mobile-390-en.png") });
  await hideNavEn.evaluate((style) => style.remove());

  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
  if (apiRequests.some((path) => path !== "/api/models")) {
    throw new Error(`unexpected API requests: ${apiRequests.join(", ")}`);
  }
  await context.close();
  return { metrics: m, consoleErrors, apiRequests };
}

async function runAutoClear(browser) {
  const { context, page, consoleErrors } = await preparePage(browser, { width: 390, height: 844 });
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Such-Einstellungen anzeigen" }).click();
  await page.fill("#city", "Berlin");
  await page.waitForFunction(() => document.querySelector("#radius")?.value === "5");
  await page.locator(".city-field .field-clear").click();
  await page.waitForFunction(() => document.querySelector("#radius")?.value === "");
  await page.getByText(/Standardmäßig werden 5 km vorgeschlagen/).waitFor();
  if (consoleErrors.length) throw new Error(`auto-clear console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { consoleErrors };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch();
  const desktop = await runDesktop(browser);
  const autoClear = await runAutoClear(browser);
  console.log(JSON.stringify({ status: "PASS", desktop, autoClear }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
