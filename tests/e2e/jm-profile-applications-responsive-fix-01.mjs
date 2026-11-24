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
const evidenceDir = resolve("docs/reports/assets/JM-PROFILE-APPLICATIONS-RESPONSIVE-FIX-01");
const widths = [1440, 1024, 980, 900, 768, 390];

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
  if (width <= 980 && state.navDisplay !== "none" && state.navPosition !== "static") {
    throw new Error(`${width}/${phase}: navigation is ${state.navPosition}, expected static`);
  }
  if (width > 980 && state.navDisplay !== "none" && state.navPosition !== "sticky") {
    throw new Error(`${width}/${phase}: desktop navigation is ${state.navPosition}, expected sticky`);
  }
  if (state.actionCount === 0) throw new Error(`${width}/${phase}: no application controls found`);
  return state;
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

const vite = startVite();
let browser;
try {
  await mkdir(evidenceDir, { recursive: true });
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of widths) results.push(await runWidth(browser, width));
  const navigation = await runNavigation(browser);
  console.log(JSON.stringify({ status: "PASS", results, navigation, evidenceDir }, null, 2));
} finally {
  await browser?.close();
  if (vite.pid) {
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* server already exited */ }
  }
}
