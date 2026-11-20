// JM-PROFILE-VISUAL-09 — profile header, card edges and particle layer.
// Synthetic demo profile only; no auth/RIS/CV writes.

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import playwright from "playwright";

const port = 5242;
const base = `http://localhost:${port}`;
const route = `${base}/dev/dashboard-v2`;
const evidenceDir = "/tmp/opencode/profile-visual-10";
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
  await page.route("**/api/**", (routeHandler) => {
    const path = new URL(routeHandler.request().url()).pathname;
    if (path === "/api/models") {
      return routeHandler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    return routeHandler.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

async function inspect(page) {
  return page.evaluate(() => {
    const particles = Array.from(document.querySelectorAll(".profile-particles span"));
    const visible = particles.filter((node) => getComputedStyle(node).display !== "none");
    const layer = document.querySelector(".profile-particles");
    const header = document.querySelector(".dashboard-v2__header");
    const card = document.querySelector(".dashboard-v2__profile-card");
    return {
      particleCount: particles.length,
      visibleParticles: visible.length,
      pointerEvents: layer ? getComputedStyle(layer).pointerEvents : null,
      ariaHidden: layer?.getAttribute("aria-hidden"),
      particleAnimation: particles[0] ? getComputedStyle(particles[0]).animationName : null,
      particleDuration: particles[0] ? getComputedStyle(particles[0]).animationDuration : null,
      particleOpacity: particles[0] ? Number(particles[0].style.getPropertyValue("--opacity")) : null,
      particleColor: particles[0] ? getComputedStyle(particles[0]).backgroundColor : null,
      headerColor: header ? getComputedStyle(header.querySelector("h1")).color : null,
      headerBackground: header ? getComputedStyle(header).backgroundImage : null,
      cardBackground: card ? getComputedStyle(card).backgroundImage : null,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function run() {
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
    await context.addInitScript(() => {
      if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de");
    });
    const page = await context.newPage();
    await mockApi(page);
    const results = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
      await page.goto(route, { waitUntil: "networkidle" });
      await page.locator(".dashboard-v2__header").waitFor();
      await page.waitForTimeout(250);
      const state = await inspect(page);
      if (state.particleCount !== 16) throw new Error(`${width}px: expected 16 particles, got ${state.particleCount}`);
      if (state.ariaHidden !== "true") throw new Error(`${width}px: particles are not aria-hidden`);
      if (state.pointerEvents !== "none") throw new Error(`${width}px: particles can intercept pointers`);
      if (state.overflow > 0) throw new Error(`${width}px: horizontal overflow ${state.overflow}`);
      if (!state.headerBackground?.includes("linear-gradient")) throw new Error(`${width}px: header is not 3D glass`);
      if (!state.cardBackground?.includes("linear-gradient")) throw new Error(`${width}px: card edges missing`);
      if (!(state.particleOpacity >= 0.6 && state.particleOpacity <= 0.9)) {
        throw new Error(`${width}px: particle opacity out of range: ${state.particleOpacity}`);
      }
      const duration = Number.parseFloat(state.particleDuration);
      if (!(duration >= 14 && duration <= 22)) {
        throw new Error(`${width}px: particle duration out of range: ${state.particleDuration}`);
      }
      const expectedVisible = width <= 767 ? 8 : 16;
      if (state.visibleParticles !== expectedVisible) {
        throw new Error(`${width}px: expected ${expectedVisible} visible particles, got ${state.visibleParticles}`);
      }
      const screenshot = `${evidenceDir}/profile-${width}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      const info = await stat(screenshot);
      if (info.size <= 0) throw new Error(`${width}px: screenshot missing`);
      results.push({ ...state, width, screenshot });
    }

    const reducedContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "de-DE",
      reducedMotion: "reduce",
    });
    await reducedContext.addInitScript(() => {
      if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de");
    });
    const reducedPage = await reducedContext.newPage();
    await mockApi(reducedPage);
    await reducedPage.goto(route, { waitUntil: "networkidle" });
    await reducedPage.locator(".dashboard-v2__header").waitFor();
    const reducedAnimation = await reducedPage.locator(".profile-particles span").first().evaluate(
      (node) => getComputedStyle(node).animationName
    );
    if (reducedAnimation !== "none") throw new Error(`reduced motion still animates: ${reducedAnimation}`);
    await reducedPage.screenshot({ path: `${evidenceDir}/profile-reduced-motion-1440.png`, fullPage: true });
    await reducedContext.close();

    console.log(JSON.stringify({ status: "PASS", results, reducedAnimation }, null, 2));
  } finally {
    await browser?.close();
    if (vite.pid) {
      try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
    }
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
