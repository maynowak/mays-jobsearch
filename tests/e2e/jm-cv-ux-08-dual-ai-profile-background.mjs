// JM-CV-UX-08 — dual AI profile background.
// Synthetic visual check only; no auth, RIS, CV or consent operations.

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import playwright from "playwright";

const port = 5238;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/ux-08-e2e";
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
      const response = await fetch(`${base}/profil`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Vite did not start");
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
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/models") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
      }
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    });

    const results = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
      await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
      await page.locator(".container.layout-dashboard.layout-profile-command").waitFor();
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 0) throw new Error(`${width}px: horizontal overflow ${overflow}px`);
      const state = await page.evaluate(() => {
        const el = document.querySelector(".container.layout-dashboard.layout-profile-command");
        if (!el) return null;
        const before = getComputedStyle(el, "::before");
        const after = getComputedStyle(el, "::after");
        return {
          width: innerWidth,
          height: document.documentElement.scrollHeight,
          leftImage: before.backgroundImage,
          rightImage: after.backgroundImage,
          size: before.backgroundSize,
          transform: before.transform,
          center: getComputedStyle(el).backgroundImage,
        };
      });
      if (!state
        || !state.leftImage.includes("jm-profile-dual-left.webp")
        || !state.rightImage.includes("jm-profile-dual-right.webp")) {
        throw new Error(`${width}px: dual face motifs missing: ${JSON.stringify(state)}`);
      }
      if (state.size !== "cover" || state.transform !== "none") {
        throw new Error(`${width}px: unexpected face scaling: ${JSON.stringify(state)}`);
      }
      if (!state.center.includes("linear-gradient") || !state.center.includes("radial-gradient")) {
        throw new Error(`${width}px: soft center/color gradient missing: ${JSON.stringify(state)}`);
      }
      const path = `${evidenceDir}/profile-${width}.png`;
      await page.screenshot({ path, fullPage: true });
      const info = await stat(path);
      if (info.size <= 0) throw new Error(`${width}px: screenshot missing`);
      results.push({ ...state, screenshot: path, bytes: info.size });
    }
    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
    if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
    console.log(JSON.stringify({ status: "PASS", results }, null, 2));
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
