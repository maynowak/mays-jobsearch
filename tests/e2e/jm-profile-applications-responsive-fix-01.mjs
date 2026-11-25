// JM-PROFILE-APPLICATIONS-RESPONSIVE-FIX-01
// Responsive overlap check for Profile -> Applications. Synthetic demo route,
// no auth or RIS calls.
//
// Run: npm run test:e2e:profile-applications-responsive-fix-01

import { spawn } from "node:child_process";
import { mkdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "playwright";
import sharp from "sharp";

const port = 5258;
const base = `http://localhost:${port}`;
const route = `${base}/dev/dashboard-v2`;
// JM-PROFILE-LAYOUT-CONSISTENCY-13 extends this existing responsive check:
// the shell, header and sidebar must stay identical across every profile tab.
const evidenceDir = resolve("docs/reports/assets/JM-PROFILE-LAYOUT-CONSISTENCY-13");
const widths = [320, 390, 768, 900, 980, 1024, 1440, 1920];
const TAB_LABELS = [
  ["overview", "Übersicht"],
  ["profile", "Mein Profil"],
  ["cv", "Lebenslauf"],
  ["applications", "Bewerbungen"],
  ["preferences", "Job-Präferenzen"],
  ["settings", "Einstellungen"],
];

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

async function saveWebp(page, name) {
  const path = resolve(evidenceDir, `${name}.webp`);
  const png = `${path}.png`;
  await page.screenshot({ path: png, fullPage: false });
  await sharp(png).webp({ quality: 82 }).toFile(path);
  await unlink(png);
  if ((await stat(path)).size <= 0) throw new Error(`missing screenshot ${name}`);
}

async function openApplications(page, width) {
  await page.goto(route, { waitUntil: "networkidle" });
  const sidebarButton = page.getByRole("button", { name: "Bewerbungen" });
  const mobileSelect = page.locator("#dashboard-section-select");
  if (await sidebarButton.isVisible().catch(() => false)) {
    await sidebarButton.click();
  } else if (await mobileSelect.isVisible().catch(() => false)) {
    await mobileSelect.selectOption("applications");
  } else {
    throw new Error("no applications navigation control is visible");
  }
  await page.locator(".dashboard-v2--applications").waitFor();
  await page.locator(".applications-section").waitFor();
}

async function inspect(page) {
  return page.evaluate(() => {
    const nav = document.querySelector(".dashboard-v2__navigation-card");
    const section = document.querySelector(".applications-section");
    const layout = document.querySelector(".dashboard-v2__layout");
    const navStyle = nav ? getComputedStyle(nav) : null;
    const navRect = nav?.getBoundingClientRect();
    const sectionRect = section?.getBoundingClientRect();
    const intersects = Boolean(
      navRect && sectionRect &&
      navRect.width > 0 && navRect.height > 0 &&
      sectionRect.width > 0 && sectionRect.height > 0 &&
      navRect.left < sectionRect.right &&
      navRect.right > sectionRect.left &&
      navRect.top < sectionRect.bottom &&
      navRect.bottom > sectionRect.top
    );
    return {
      navDisplay: navStyle?.display ?? "none",
      navPosition: navStyle?.position ?? "none",
      navTop: navStyle?.top ?? "none",
      navRect: navRect ? { top: navRect.top, bottom: navRect.bottom, left: navRect.left, right: navRect.right } : null,
      sectionRect: sectionRect ? { top: sectionRect.top, bottom: sectionRect.bottom, left: sectionRect.left, right: sectionRect.right } : null,
      intersects,
      layoutColumns: layout ? getComputedStyle(layout).gridTemplateColumns : "",
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      actionCount: document.querySelectorAll(".applications-section button, .applications-section select").length,
    };
  });
}

async function assertState(page, width, phase) {
  const state = await inspect(page);
  if (state.overflow > 0) throw new Error(`${width}/${phase}: horizontal overflow ${state.overflow}px`);
  if (state.navDisplay !== "none" && state.intersects) {
    throw new Error(`${width}/${phase}: navigation overlaps applications content`);
  }
  if (width <= 767 && state.navDisplay !== "none") {
    throw new Error(`${width}/${phase}: navigation must use the mobile switcher below 768px`);
  }
  if (width > 767 && state.navDisplay !== "none" && state.navPosition !== "sticky") {
    throw new Error(`${width}/${phase}: navigation is ${state.navPosition}, expected sticky`);
  }
  if (state.actionCount === 0) throw new Error(`${width}/${phase}: no application controls found`);
  return state;
}

async function openTab(page, tab, label) {
  const sidebarButton = page.getByRole("button", { name: label, exact: true }).first();
  if (await sidebarButton.isVisible().catch(() => false)) {
    await sidebarButton.click();
  } else {
    await page.locator("#dashboard-section-select").selectOption(tab);
  }
  await page.waitForTimeout(500);
}

async function measureShell(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Math.round(box.left),
        top: Math.round(box.top),
        width: Math.round(box.width),
      };
    };
    const nav = document.querySelector(".dashboard-v2__navigation-card");
    return {
      header: rect(".dashboard-v2__header"),
      shell: rect(".dashboard-v2"),
      nav: rect(".dashboard-v2__navigation-card"),
      navDisplay: nav ? getComputedStyle(nav).display : "none",
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

function sameRect(a, b) {
  return Boolean(a && b && a.left === b.left && a.top === b.top && a.width === b.width);
}

async function assertShellConsistency(page, width) {
  await page.goto(route, { waitUntil: "networkidle" });
  const rows = [];
  for (const [tab, label] of TAB_LABELS) {
    await openTab(page, tab, label);
    rows.push({ tab, ...(await measureShell(page)) });
  }
  const base = rows[0];
  for (const row of rows) {
    if (row.overflow > 0) throw new Error(`${width}/${row.tab}: horizontal overflow ${row.overflow}px`);
    if (!sameRect(row.header, base.header)) {
      throw new Error(`${width}/${row.tab}: profile header moved (${JSON.stringify(row.header)} vs ${JSON.stringify(base.header)})`);
    }
    if (width > 767 && (!sameRect(row.nav, base.nav) || row.navDisplay !== base.navDisplay)) {
      throw new Error(`${width}/${row.tab}: sidebar moved or resized (${JSON.stringify(row.nav)} vs ${JSON.stringify(base.nav)})`);
    }
  }
  return rows.map(({ tab, header, nav, navDisplay }) => ({ tab, header, nav, navDisplay }));
}

async function runWidth(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/**", (routeHandler) => {
    const path = new URL(routeHandler.request().url()).pathname;
    if (path === "/api/models") {
      return routeHandler.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [{ id: "mock-model", name: "Mock Model" }],
          defaultModel: "mock-model",
          recommendedModel: null,
          fallbackModel: null,
        }),
      });
    }
    return routeHandler.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  try {
    const shell = await assertShellConsistency(page, width);
    await openApplications(page, width);
    const top = await assertState(page, width, "top");
    await saveWebp(page, `applications-${width}-top`);

    const maxScroll = Math.max(0, top.scrollHeight - 1000);
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(1, Math.round(maxScroll / 2)));
    await page.waitForTimeout(200);
    const middle = await assertState(page, width, "middle");
    await saveWebp(page, `applications-${width}-middle`);

    await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
    await page.waitForTimeout(200);
    const bottom = await assertState(page, width, "bottom");
    await saveWebp(page, `applications-${width}-bottom`);

    if (errors.length) throw new Error(`${width}: console errors ${errors.join(" | ")}`);
    return {
      width,
      navPosition: top.navPosition,
      navDisplay: top.navDisplay,
      layoutColumns: top.layoutColumns,
      shell,
      scrollHeight: top.scrollHeight,
      middleScrollY: middle.scrollY,
      bottomScrollY: bottom.scrollY,
      overflow: Math.max(top.overflow, middle.overflow, bottom.overflow),
    };
  } finally {
    await context.close();
  }
}

async function runNavigation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  try {
    await openApplications(page, 1440);
    await page.getByRole("button", { name: "Einstellungen" }).click();
    await page.getByRole("heading", { name: "Datenschutz & Datenspeicherung" }).waitFor();
    await page.getByRole("button", { name: "Bewerbungen" }).click();
    await page.locator(".dashboard-v2--applications").waitFor();
    return { desktopNavigation: "PASS" };
  } finally {
    await context.close();
  }
}

async function runKeyboardAndMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await page.goto(route, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const before = await measureShell(page);
    const applicationsButton = page.getByRole("button", { name: "Bewerbungen", exact: true }).first();
    await applicationsButton.focus();
    await page.keyboard.press("Enter");
    await page.locator(".dashboard-v2--applications").waitFor();
    await page.waitForTimeout(400);
    const after = await measureShell(page);
    if (!sameRect(before.header, after.header) || !sameRect(before.nav, after.nav)) {
      throw new Error("keyboard tab switch moved the profile header or sidebar");
    }
    if ((await applicationsButton.getAttribute("aria-current")) !== "page") {
      throw new Error("keyboard tab switch lost aria-current");
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    if (!(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))) {
      throw new Error("reduced-motion emulation is not active");
    }
    const settingsButton = page.getByRole("button", { name: "Einstellungen", exact: true }).first();
    await settingsButton.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Datenschutz & Datenspeicherung" }).waitFor();
    await page.waitForTimeout(300);
    const reduced = await measureShell(page);
    if (!sameRect(before.header, reduced.header) || !sameRect(before.nav, reduced.nav)) {
      throw new Error("reduced-motion tab switch moved the profile header or sidebar");
    }
    if (errors.length) throw new Error(`keyboard run console errors: ${errors.join(" | ")}`);
    return { keyboardTabSwitch: "PASS", ariaCurrent: "PASS", reducedMotion: "PASS" };
  } finally {
    await context.close();
  }
}

const vite = startVite();
let browser;
try {
  await mkdir(evidenceDir, { recursive: true });
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of widths) results.push(await runWidth(browser, width));
  const navigation = await runNavigation(browser);
  const accessibility = await runKeyboardAndMotion(browser);
  console.log(JSON.stringify({ status: "PASS", results, navigation, accessibility, evidenceDir }, null, 2));
} finally {
  await browser?.close();
  if (vite.pid) {
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* server already exited */ }
  }
}
