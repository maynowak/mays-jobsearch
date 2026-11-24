// JM-PROFILE-VISUAL-11 — cyan card frames, brighter profile surface, silver header.
// Synthetic demo profile only; no auth/RIS/CV storage writes.

import { spawn } from 'node:child_process';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import playwright from 'playwright';
import sharp from 'sharp';

const port = 5244;
const base = `http://localhost:${port}`;
const route = `${base}/dev/dashboard-v2`;
const evidenceDir = "/tmp/opencode/profile-visual-11";
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
  await page.route("**/api/**", (routeHandler) => {
    const path = new URL(routeHandler.request().url()).pathname;
    if (path === "/api/models") {
      return routeHandler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    return routeHandler.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

function rgbIncludes(value, rgb) {
  return value.includes(rgb);
}

async function inspect(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".layout-profile-command");
    const header = root?.querySelector(".dashboard-v2__header");
    const nav = root?.querySelector(".dashboard-v2__navigation-card");
    const help = root?.querySelector(".may-help");
    const cards = Array.from(root?.querySelectorAll(
      ".dashboard-v2__main > .aurora-card, .applications-section, .dashboard-v2__cv-section, .storage-consent, .dashboard-v2__manual-profiles"
    ) ?? []).filter((node) => {
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    const cardStyles = cards.map((node) => {
      const style = getComputedStyle(node);
      return {
        className: node.className,
        borderTop: style.borderTopWidth,
        borderColor: style.borderTopColor,
        boxShadow: style.boxShadow,
        backgroundImage: style.backgroundImage,
      };
    });
    const globe = root?.querySelector(".dashboard-v2__header-globe");
    const waves = root?.querySelector(".dashboard-v2__header-waves");
    const activeNav = root?.querySelector(".aurora-sidebar-active .ui-dashboard-navigation__button");
    if (activeNav instanceof HTMLElement) activeNav.focus();
    const activeVisible = activeNav instanceof HTMLElement && activeNav.getBoundingClientRect().width > 0;
    const activeStyle = activeVisible ? getComputedStyle(activeNav) : null;
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      headerBackground: header ? getComputedStyle(header).backgroundImage : "",
      headerTitleColor: header?.querySelector("h1") ? getComputedStyle(header.querySelector("h1")).color : "",
      headerRect: header?.getBoundingClientRect().toJSON() ?? null,
      navBorder: nav ? getComputedStyle(nav).borderTopWidth : "",
      navBorderColor: nav ? getComputedStyle(nav).borderTopColor : "",
      helpBorder: help ? getComputedStyle(help).borderTopWidth : "",
      helpBorderColor: help ? getComputedStyle(help).borderTopColor : "",
      globeSrc: globe?.getAttribute("src") ?? "",
      wavesBackground: waves ? getComputedStyle(waves).backgroundImage : "",
      cardStyles,
      activeFocusOutline: activeStyle
        ? { style: activeStyle.outlineStyle, width: activeStyle.outlineWidth, color: activeStyle.outlineColor }
        : null,
      rootBackground: root ? getComputedStyle(root).backgroundImage : "",
    };
  });
}

function assertCommon(state, label) {
  if (state.overflow > 0) throw new Error(`${label}: horizontal overflow ${state.overflow}`);
  if (!state.headerBackground.includes("linear-gradient")) throw new Error(`${label}: header gradient missing`);
  if (!state.headerBackground.includes("rgba(241, 245, 249")) throw new Error(`${label}: silver header layer missing`);
  if (!state.rootBackground.includes("rgb(10, 58, 80)")) throw new Error(`${label}: brighter centre missing`);
  if (state.navBorder !== "1px") throw new Error(`${label}: navigation frame is not subdued (${state.navBorder})`);
  if (!rgbIncludes(state.navBorderColor, "34, 211, 238")) throw new Error(`${label}: navigation cyan missing`);
  if (state.helpBorder && Number.parseFloat(state.helpBorder) < 1.5) {
    throw new Error(`${label}: help frame width wrong (${state.helpBorder})`);
  }
  if (state.helpBorder && !rgbIncludes(state.helpBorderColor, "34, 211, 238")) {
    throw new Error(`${label}: help cyan missing`);
  }
  if (!state.globeSrc.includes("jm-profile-globe")) throw new Error(`${label}: globe asset changed`);
  if (!state.wavesBackground.includes("jm-profile-waves")) throw new Error(`${label}: waves asset changed`);
  if (!state.cardStyles.length) throw new Error(`${label}: no profile cards found`);
  for (const card of state.cardStyles) {
    if (Number.parseFloat(card.borderTop) < 1.5) {
      throw new Error(`${label}: card frame width ${card.borderTop} on ${card.className}`);
    }
    if (!rgbIncludes(card.borderColor, "34, 211, 238") && !rgbIncludes(card.borderColor, "165, 243, 252")) {
      throw new Error(`${label}: card cyan frame missing on ${card.className}`);
    }
    if (!card.boxShadow.includes("rgba(34, 211, 238")) {
      throw new Error(`${label}: card cyan glow missing on ${card.className}`);
    }
  }
}

async function saveWebp(page, path) {
  const png = `${path}.png`;
  await page.screenshot({ path: png, fullPage: true });
  await sharp(png).webp({ quality: 82 }).toFile(path);
  await unlink(png);
  const info = await stat(path);
  if (info.size <= 0) throw new Error(`missing screenshot ${path}`);
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
      assertCommon(state, `${width}px overview`);
      await saveWebp(page, resolve(evidenceDir, `profile-overview-${width}.webp`));
      results.push({ width, view: "overview", cards: state.cardStyles.length, overflow: state.overflow });
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Hilfe" }).click();
    await page.locator(".may-help").waitFor();
    await page.waitForTimeout(150);
    const helpState = await inspect(page);
    assertCommon(helpState, "1440px help");
    await saveWebp(page, resolve(evidenceDir, "profile-help-1440.webp"));
    results.push({ width: 1440, view: "help", cards: helpState.cardStyles.length, overflow: helpState.overflow });

    for (const [label, navName, selector, file] of [
      ["cv", "Lebenslauf", ".dashboard-v2__cv-section", "profile-cv-1440.webp"],
      ["applications", "Bewerbungen", ".applications-section", "profile-applications-1440.webp"],
      ["settings", "Einstellungen", ".storage-consent", "profile-settings-1440.webp"],
    ]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: navName }).click();
      await page.locator(selector).first().waitFor();
      await page.waitForTimeout(150);
      const state = await inspect(page);
      assertCommon(state, `1440px ${label}`);
      await saveWebp(page, resolve(evidenceDir, file));
      results.push({ width: 1440, view: label, cards: state.cardStyles.length, overflow: state.overflow });
    }

    const reducedContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "de-DE",
      reducedMotion: "reduce",
    });
    await reducedContext.addInitScript(() => localStorage.setItem("mj-lang", "de"));
    const reducedPage = await reducedContext.newPage();
    await mockApi(reducedPage);
    await reducedPage.goto(route, { waitUntil: "networkidle" });
    const reducedAnimation = await reducedPage.locator(".profile-particles span").first().evaluate(
      (node) => getComputedStyle(node).animationName
    );
    if (reducedAnimation !== "none") throw new Error(`reduced motion still animates: ${reducedAnimation}`);
    await saveWebp(reducedPage, resolve(evidenceDir, "profile-reduced-motion-1440.webp"));
    await reducedContext.close();

    console.log(JSON.stringify({ status: "PASS", results, reducedAnimation, evidenceDir }, null, 2));
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
