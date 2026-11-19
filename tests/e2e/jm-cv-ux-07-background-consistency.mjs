// JM-CV-UX-07 — workspace view/background consistency and profile artwork.
// Synthetic UI only; no auth, RIS, consent or CV persistence operations.

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import playwright from "playwright";

const port = 5237;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/ux-07-e2e";
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
      const response = await fetch(`${base}/cv-builder/workspace`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Vite did not start");
}

async function mockApi(page) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function backgroundState(page, selector, pseudo) {
  return page.evaluate(({ selector, pseudo }) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const style = getComputedStyle(element, pseudo);
    return {
      backgroundImage: style.backgroundImage,
      backgroundPosition: style.backgroundPosition,
      backgroundSize: style.backgroundSize,
      backgroundAttachment: style.backgroundAttachment,
      position: style.position,
      transform: style.transform,
      opacity: style.opacity,
    };
  }, { selector, pseudo });
}

async function openEmptyEditor(page) {
  await page.goto(`${base}/cv-builder/workspace`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "CV-Workspace starten" }).waitFor();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
}

async function run() {
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "de-DE",
    });
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
    await mockApi(page);
    await openEmptyEditor(page);

    const normal = await backgroundState(page, ".cv-workspace-page", "::before");
    const normalPage = await backgroundState(page, ".cv-workspace-page", null);
    if (!normal || normal.position !== "fixed") {
      throw new Error(`workspace artwork is not viewport-stable: ${JSON.stringify(normal)}`);
    }
    if (!normalPage || !normalPage.backgroundAttachment.includes("fixed")) {
      throw new Error(`workspace gradient is not viewport-stable: ${JSON.stringify(normalPage)}`);
    }
    await page.screenshot({ path: `${evidenceDir}/workspace-editor-1440.png` });

    await page.getByRole("button", { name: "Ansicht wechseln" }).click();
    await page.waitForTimeout(200);
    const screenshotMode = await backgroundState(page, ".cv-workspace-page", "::before");
    const screenshotPage = await backgroundState(page, ".cv-workspace-page", null);
    if (JSON.stringify(screenshotMode) !== JSON.stringify(normal)) {
      throw new Error(`workspace artwork changed after view switch: ${JSON.stringify({ normal, screenshotMode })}`);
    }
    if (JSON.stringify(screenshotPage) !== JSON.stringify(normalPage)) {
      throw new Error("workspace gradient changed after view switch");
    }
    await page.screenshot({ path: `${evidenceDir}/workspace-screenshot-1440.png`, fullPage: true });

    await page.getByRole("button", { name: "Ansicht wechseln" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await assertNoOverflow(page, "workspace 390px");
    await page.screenshot({ path: `${evidenceDir}/workspace-390.png`, fullPage: true });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
    await page.locator(".container.layout-dashboard.layout-profile-command").waitFor();
    const profileArt = await backgroundState(page, ".container.layout-dashboard.layout-profile-command", "::before");
    const profileOverlay = await backgroundState(page, ".container.layout-dashboard.layout-profile-command", "::after");
    if (!profileArt || !profileArt.backgroundImage.includes("jm-profile-ai-face.webp")) {
      throw new Error(`profile artwork missing: ${JSON.stringify(profileArt)}`);
    }
    if (profileArt.transform === "none") {
      throw new Error("profile artwork is not mirrored");
    }
    if (!profileOverlay || !profileOverlay.backgroundImage.includes("linear-gradient")) {
      throw new Error(`profile contrast overlay missing: ${JSON.stringify(profileOverlay)}`);
    }
    await assertNoOverflow(page, "profile 1440px");
    await page.screenshot({ path: `${evidenceDir}/profile-1440.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await assertNoOverflow(page, "profile 390px");
    await page.screenshot({ path: `${evidenceDir}/profile-390.png`, fullPage: true });

    const shots = [
      "workspace-editor-1440.png",
      "workspace-screenshot-1440.png",
      "workspace-390.png",
      "profile-1440.png",
      "profile-390.png",
    ];
    for (const shot of shots) {
      const info = await stat(`${evidenceDir}/${shot}`);
      if (info.size <= 0) throw new Error(`missing screenshot ${shot}`);
    }
    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
    if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
    console.log(JSON.stringify({
      status: "PASS",
      workspaceBefore: normal,
      workspaceAfter: screenshotMode,
      profileArtwork: profileArt,
      profileOverlay,
      screenshots: shots.map((name) => `${evidenceDir}/${name}`),
    }, null, 2));
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
