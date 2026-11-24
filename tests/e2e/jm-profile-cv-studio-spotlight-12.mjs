// JM-PROFILE-CV-STUDIO-SPOTLIGHT-12
// Local visual/browser check for the premium CV studio card, empty state,
// filled state and responsive behavior. Synthetic demo data only.
//
// Run: npm run test:e2e:cv-studio-spotlight-12

import { spawn } from "node:child_process";
import { mkdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "playwright";
import sharp from "sharp";

const port = 5255;
const base = `http://localhost:${port}`;
const route = `${base}/dev/dashboard-v2`;
const evidenceDir = resolve("docs/reports/assets/JM-PROFILE-CV-STUDIO-SPOTLIGHT-12");
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
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
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

async function saveWebp(page, path) {
  const png = `${path}.png`;
  await page.screenshot({ path: png, fullPage: true });
  await sharp(png).webp({ quality: 84 }).toFile(path);
  await unlink(png);
  if ((await stat(path)).size <= 0) throw new Error(`missing screenshot ${path}`);
}

async function openCvTab(page, width) {
  await page.goto(route, { waitUntil: "networkidle" });
  if (width <= 767) {
    await page.locator("#dashboard-section-select").selectOption("cv");
  } else {
    await page.getByRole("button", { name: "Lebenslauf" }).click();
  }
  await page.locator(".cv-builder-profiles").waitFor();
}

async function inspect(page, label) {
  const state = await page.evaluate(() => {
    const card = document.querySelector(".cv-builder-profiles");
    const cta = document.querySelector(".cv-builder-profiles__create");
    const empty = document.querySelector(".cv-builder-profiles__empty");
    const badge = document.querySelector(".cv-builder-profiles__studio-badge");
    const session = document.querySelector(".cv-builder-profiles__session");
    const docIcon = document.querySelector(".cv-builder-profiles__doc-icon");
    const list = document.querySelector(".cv-builder-profiles__list");
    const cardStyle = card ? getComputedStyle(card) : null;
    const ctaStyle = cta ? getComputedStyle(cta) : null;
    const emptyStyle = empty ? getComputedStyle(empty) : null;
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      card: cardStyle ? {
        borderTopWidth: cardStyle.borderTopWidth,
        borderTopColor: cardStyle.borderTopColor,
        borderStyle: cardStyle.borderTopStyle,
        backgroundImage: cardStyle.backgroundImage,
        boxShadow: cardStyle.boxShadow,
        borderRadius: cardStyle.borderRadius,
      } : null,
      cta: ctaStyle ? {
        backgroundImage: ctaStyle.backgroundImage,
        minHeight: ctaStyle.minHeight,
        color: ctaStyle.color,
      } : null,
      empty: emptyStyle ? {
        borderStyle: emptyStyle.borderTopStyle,
        borderRadius: emptyStyle.borderTopLeftRadius,
        backgroundImage: emptyStyle.backgroundImage,
      } : null,
      hasBadge: Boolean(badge),
      hasSession: Boolean(session),
      hasDocIcon: Boolean(docIcon),
      hasList: Boolean(list),
    };
  });
  if (state.overflow > 0) throw new Error(`${label}: overflow ${state.overflow}px`);
  if (!state.card) throw new Error(`${label}: studio card missing`);
  if (state.card.borderTopWidth !== "2px") {
    throw new Error(`${label}: studio border ${state.card.borderTopWidth}`);
  }
  if (!state.card.borderTopColor.includes("34, 211, 238")) {
    throw new Error(`${label}: studio cyan border missing ${state.card.borderTopColor}`);
  }
  if (!state.card.boxShadow.includes("34, 211, 238")) {
    throw new Error(`${label}: studio glow missing`);
  }
  if (!state.cta || Number.parseFloat(state.cta.minHeight) < 48) {
    throw new Error(`${label}: premium CTA missing or below 48px`);
  }
  if (!state.cta.backgroundImage.includes("linear-gradient")) {
    throw new Error(`${label}: premium CTA gradient missing`);
  }
  if (!state.hasBadge || !state.hasSession || !state.hasDocIcon) {
    throw new Error(`${label}: studio badge/session/document icon missing`);
  }
  if (state.empty && state.empty.borderStyle === "dashed") {
    throw new Error(`${label}: empty state still uses dashed border`);
  }
  return state;
}

async function runEmpty(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  await mockApi(page);
  await openCvTab(page, width);
  const state = await inspect(page, `${width}px empty`);
  if (state.hasList) throw new Error(`${width}: empty studio unexpectedly has a list`);
  await saveWebp(page, resolve(evidenceDir, `studio-empty-${width}.webp`));
  await context.close();
  return { width, state: "empty", overflow: state.overflow };
}

async function runFilled(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  await mockApi(page);
  await openCvTab(page, width);
  await page.getByRole("button", { name: /Neuen Lebenslauf gestalten/ }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
  await page.locator(".cv-builder-profiles__list").waitFor();
  const state = await inspect(page, `${width}px filled`);
  if (!state.hasList) throw new Error(`${width}: filled studio list missing`);
  await saveWebp(page, resolve(evidenceDir, `studio-filled-${width}.webp`));
  await context.close();
  return { width, state: "filled", overflow: state.overflow };
}

const vite = startVite();
let browser;
try {
  await mkdir(evidenceDir, { recursive: true });
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of widths) results.push(await runEmpty(browser, width));
  results.push(await runFilled(browser, 1440));
  results.push(await runFilled(browser, 390));
  console.log(JSON.stringify({ status: "PASS", results, evidenceDir }, null, 2));
} finally {
  await browser?.close();
  if (vite.pid) {
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* server already exited */ }
  }
}
