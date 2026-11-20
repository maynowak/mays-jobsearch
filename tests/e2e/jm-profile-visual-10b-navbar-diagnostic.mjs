// JM-PROFILE-VISUAL-10B — navbar position diagnostic.
// Read-only UI check; no API writes, auth or RIS operations.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import playwright from "playwright";

const port = 5243;
const base = `http://localhost:${port}`;
const route = `${base}/dev/dashboard-v2`;
const evidenceDir = "/tmp/opencode/profile-visual-10b";
const widths = [1920, 1440, 768, 390];
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(route);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Vite did not start");
}

async function mockApi(page) {
  await page.route("**/api/**", (handler) => {
    const path = new URL(handler.request().url()).pathname;
    if (path === "/api/models") {
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    return handler.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const navbar = document.querySelector(".navbar");
    const card = document.querySelector(".dashboard-v2__profile-card");
    const sidebar = document.querySelector(".dashboard-v2__navigation-card");
    const navRect = navbar?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    const sideRect = sidebar?.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      navbarTop: navRect?.top ?? null,
      navbarBottom: navRect?.bottom ?? null,
      navbarPosition: navbar ? getComputedStyle(navbar).position : null,
      navbarCssTop: navbar ? getComputedStyle(navbar).top : null,
      scrolledClass: navbar?.classList.contains("scrolled") ?? false,
      navbarHeight: navbar ? getComputedStyle(navbar).getPropertyValue("--navbar-height").trim() : null,
      cardTop: cardRect?.top ?? null,
      cardBottom: cardRect?.bottom ?? null,
      sidebarTop: sideRect?.top ?? null,
      overflow: document.documentElement.scrollWidth - innerWidth,
      applications: Boolean(document.querySelector(".dashboard-v2--applications")),
    };
  });
}

async function scrollDown(page) {
  await page.mouse.move(700, 600);
  for (let step = 0; step < 4; step += 1) {
    await page.mouse.wheel(0, 180);
    await page.waitForTimeout(120);
  }
}

async function inspectChromium(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(() => {
    if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de");
  });
  const page = await context.newPage();
  await mockApi(page);
  const widthsResult = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    await page.goto(route, { waitUntil: "networkidle" });
    await page.locator(".navbar").waitFor();
    await page.waitForTimeout(250);
    const top = await measure(page);
    await page.screenshot({ path: `${evidenceDir}/chromium-${width}-top-viewport.png`, fullPage: false });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${evidenceDir}/chromium-${width}-top-fullpage.png`, fullPage: true });

    await scrollDown(page);
    await page.waitForTimeout(400);
    const down = await measure(page);
    await page.screenshot({ path: `${evidenceDir}/chromium-${width}-scrolled-viewport.png`, fullPage: false });
    await page.screenshot({ path: `${evidenceDir}/chromium-${width}-scrolled-fullpage-artifact.png`, fullPage: true });
    const afterScrolledFullpage = await measure(page);

    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(400);
    const up = await measure(page);
    await page.screenshot({ path: `${evidenceDir}/chromium-${width}-up-viewport.png`, fullPage: false });

    let applications = null;
    if (width >= 768) {
      const button = page.getByRole("button", { name: "Bewerbungen" }).first();
      if (await button.count()) {
        await button.click();
        await page.waitForTimeout(300);
        applications = await measure(page);
        await page.screenshot({ path: `${evidenceDir}/chromium-${width}-applications-viewport.png`, fullPage: false });
        await page.getByRole("button", { name: "Übersicht" }).first().click();
        await page.waitForTimeout(200);
      }
    }

    widthsResult.push({ width, top, down, afterScrolledFullpage, up, applications });
  }
  await context.close();
  return { browser: "chromium", status: "PASS", widths: widthsResult };
}

async function main() {
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const chromium = await inspectChromium(browser);
    let firefox;
    try {
      const firefoxBrowser = await playwright.firefox.launch({ headless: true });
      const context = await firefoxBrowser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
      const page = await context.newPage();
      await mockApi(page);
      await page.goto(route, { waitUntil: "networkidle" });
      await page.locator(".navbar").waitFor();
      const top = await measure(page);
      await scrollDown(page);
      await page.waitForTimeout(400);
      const down = await measure(page);
      await page.screenshot({ path: `${evidenceDir}/firefox-1440-scrolled-viewport.png`, fullPage: false });
      await firefoxBrowser.close();
      firefox = { status: "PASS", top, down };
    } catch (error) {
      firefox = { status: "UNAVAILABLE", error: String(error.message ?? error) };
    }
    console.log(JSON.stringify({ status: "DIAGNOSTIC", chromium, firefox }, null, 2));
  } finally {
    await browser?.close();
    if (vite.pid) {
      try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
