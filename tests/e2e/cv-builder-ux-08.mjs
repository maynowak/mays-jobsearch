// JM-CV-BUILDER-UX-08 — wide workspace and dual scroll hands.
// Synthetic empty CV data only; no private PDF, RIS, auth or storage writes.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import playwright from "playwright";

const port = 5253;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/cv-builder-ux-08";
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/search`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
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

async function openLongEditor(page) {
  await page.goto(`${base}/cv-builder/workspace`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "CV-Workspace starten" }).waitFor();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator("#cv-builder-personal summary span").first().click();
  await page.getByLabel("Vollständiger Name").fill("Synthetischer Scroll-Test");
  await page.evaluate(() => {
    const details = document.querySelector("#cv-builder-experience details");
    if (details) details.open = true;
  });
  for (let index = 0; index < 6; index += 1) {
    await page.getByRole("button", { name: /Berufserfahrung hinzufügen/ }).click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function scrollY(page) {
  return page.evaluate(() => window.scrollY);
}

async function waitForStableScroll(page, timeout = 10000) {
  let last = await scrollY(page);
  let stable = 0;
  const started = Date.now();
  while (Date.now() - started < timeout) {
    await page.waitForTimeout(120);
    const next = await scrollY(page);
    if (Math.abs(next - last) < 1) stable += 1;
    else stable = 0;
    last = next;
    if (stable >= 3) return next;
  }
  throw new Error(`scroll did not stabilize at ${last}`);
}

async function footerVisible(page) {
  return page.evaluate(() => {
    const footer = document.querySelector(".cv-builder-footer > .cv-builder-footer__actions");
    if (!footer) return false;
    const rect = footer.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight && rect.height > 0;
  });
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function assertHandsDoNotCoverEditor(page, label) {
  const metrics = await page.evaluate(() => {
    const hands = document.querySelector(".cv-builder-scroll-hands");
    const box = document.querySelector(".cv-builder-fullpage__box");
    if (!hands || !box) return null;
    const handRect = hands.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    return { handLeft: handRect.left, boxRight: boxRect.right, handWidth: handRect.width };
  });
  if (!metrics) throw new Error(`${label}: scroll hands or editor missing`);
  if (metrics.handLeft < metrics.boxRight - 1) {
    throw new Error(`${label}: scroll hands overlap the editor ${JSON.stringify(metrics)}`);
  }
}

async function run() {
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true, args: ["--disable-gpu"] });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "de-DE" });
    await context.addInitScript(() => {
      if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de");
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await mockApi(page);
    await openLongEditor(page);

    const workspaceFooter = page.locator("footer.footer");
    if ((await workspaceFooter.count()) !== 1) throw new Error("shared workspace footer missing or duplicated");
    if ((await workspaceFooter.locator('a[href="/impressum"]').count()) !== 1) {
      throw new Error("workspace footer imprint link is wrong");
    }
    if ((await workspaceFooter.locator('a[href="/datenschutz"]').count()) !== 1) {
      throw new Error("workspace footer privacy link is wrong");
    }
    if ((await workspaceFooter.locator('a[href="/datenschutzprinzipien"]').count()) !== 1) {
      throw new Error("workspace footer principles link is wrong");
    }
    const footerStyle = await workspaceFooter.evaluate((node) => {
      const style = getComputedStyle(node);
      const footerRect = node.getBoundingClientRect();
      const boxRect = document.querySelector(".cv-builder-fullpage__box")?.getBoundingClientRect();
      return {
        position: style.position,
        top: footerRect.top,
        boxBottom: boxRect?.bottom ?? null,
      };
    });
    if (footerStyle.position === "fixed" || footerStyle.position === "sticky") {
      throw new Error(`workspace footer must not be ${footerStyle.position}`);
    }
    if (footerStyle.boxBottom !== null && footerStyle.top < footerStyle.boxBottom - 1) {
      throw new Error("workspace footer is not after the editor");
    }

    const main = page.locator(".cv-workspace-main");
    const box = page.locator(".cv-builder-fullpage__box");
    const normalWidth = (await box.boundingBox())?.width ?? 0;
    const normalMainWidth = (await main.boundingBox())?.width ?? 0;
    await page.screenshot({ path: `${evidenceDir}/00-normal-1920.png` });
    await page.getByRole("button", { name: "⛶ Breite maximieren" }).click();
    const wideWidth = (await box.boundingBox())?.width ?? 0;
    const wideMainWidth = (await main.boundingBox())?.width ?? 0;
    if (!(wideWidth > normalWidth + 100) || !(wideMainWidth > normalMainWidth + 100)) {
      throw new Error(`maximize did not widen workspace: ${normalMainWidth}/${normalWidth} -> ${wideMainWidth}/${wideWidth}`);
    }
    if ((await page.getByLabel("Vollständiger Name").inputValue()) !== "Synthetischer Scroll-Test") {
      throw new Error("maximize changed CV data");
    }
    await assertNoOverflow(page, "maximized 1920px");
    await assertHandsDoNotCoverEditor(page, "maximized 1920px");
    await page.screenshot({ path: `${evidenceDir}/01-wide-1920.png` });
    await page.getByRole("button", { name: "↔ Normalbreite" }).click();
    const restoredWidth = (await box.boundingBox())?.width ?? 0;
    if (Math.abs(restoredWidth - normalWidth) > 2) throw new Error(`normal width was not restored: ${restoredWidth}`);
    if ((await page.getByLabel("Vollständiger Name").inputValue()) !== "Synthetischer Scroll-Test") {
      throw new Error("normal width changed CV data");
    }

    const hands = page.locator(".cv-builder-scroll-hands");
    const down = page.locator(".cv-builder-scroll-hand--down");
    const up = page.locator(".cv-builder-scroll-hand--up");
    if (!(await hands.isVisible())) throw new Error("scroll hands are missing");
    if ((await page.locator(".cv-builder-footer > .cv-builder-footer__actions").count()) !== 1) {
      throw new Error("footer action target is missing");
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await down.hover();
    await page.waitForTimeout(520);
    const downStart = await scrollY(page);
    if (downStart <= 0) throw new Error("turbo down did not start after hover delay");
    await page.waitForTimeout(750);
    const downAccelerated = await scrollY(page);
    if (downAccelerated <= downStart) throw new Error(`turbo down did not accelerate: ${downStart} -> ${downAccelerated}`);
    await page.waitForFunction(() => {
      const footer = document.querySelector(".cv-builder-footer > .cv-builder-footer__actions");
      if (!footer) return false;
      const rect = footer.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }, { timeout: 10000 });
    await waitForStableScroll(page);
    if (!(await footerVisible(page))) throw new Error("footer actions are not fully visible after turbo down");
    await page.screenshot({ path: `${evidenceDir}/04-turbo-footer-1920.png` });
    const footerStop = await scrollY(page);
    await page.waitForTimeout(400);
    if (Math.abs((await scrollY(page)) - footerStop) > 2) throw new Error("turbo down did not stop at the footer");

    await workspaceFooter.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    if (!(await workspaceFooter.isVisible())) throw new Error("workspace legal footer is not visible at the document end");
    await page.screenshot({ path: `${evidenceDir}/05-workspace-footer-1920.png` });

    await up.hover();
    await page.waitForFunction(() => {
      const title = document.getElementById("cv-builder-title");
      if (!title) return false;
      const top = title.getBoundingClientRect().top;
      return top >= 0 && top <= 40;
    }, { timeout: 10000 });
    await page.waitForTimeout(250);

    await down.hover();
    await page.waitForTimeout(700);
    const beforeLeave = await scrollY(page);
    await page.mouse.move(20, 20);
    await page.waitForTimeout(450);
    if (Math.abs((await scrollY(page)) - beforeLeave) > 3) throw new Error("turbo down did not stop on mouseleave");

    await page.evaluate(() => window.scrollTo(0, 0));
    await down.hover();
    await page.waitForTimeout(700);
    await page.keyboard.press("Escape");
    const beforeEscape = await scrollY(page);
    await page.waitForTimeout(450);
    if (Math.abs((await scrollY(page)) - beforeEscape) > 3) throw new Error("turbo down did not stop on Escape");
    await page.mouse.move(20, 20);

    await page.evaluate(() => window.scrollTo(0, 0));
    await down.hover();
    await page.waitForTimeout(700);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(120);
    const beforeManual = await scrollY(page);
    await page.waitForTimeout(500);
    if (Math.abs((await scrollY(page)) - beforeManual) > 3) throw new Error("turbo down did not stop on manual wheel");
    await page.waitForTimeout(700);
    if (Math.abs((await scrollY(page)) - beforeManual) > 3) {
      throw new Error("automatic scroll restarted while pointer was still over the hand");
    }
    await page.mouse.move(20, 20);

    await down.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => {
      const footer = document.querySelector(".cv-builder-footer > .cv-builder-footer__actions");
      if (!footer) return false;
      const rect = footer.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }, { timeout: 10000 });
    if (!(await footerVisible(page))) throw new Error("click down did not reach the footer");
    await page.locator(".cv-builder-scroll-hand--up").click();
    await page.waitForFunction(() => {
      const title = document.getElementById("cv-builder-title");
      if (!title) return false;
      const top = title.getBoundingClientRect().top;
      return top >= 0 && top <= 40;
    }, { timeout: 10000 });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await down.hover();
    await page.waitForTimeout(700);
    const reducedTitleTop = await page.evaluate(() => document.getElementById("cv-builder-title")?.getBoundingClientRect().top ?? 999);
    if (reducedTitleTop < 0 || reducedTitleTop > 40) {
      throw new Error(`hover animation ran under reduced motion: title top ${reducedTitleTop}`);
    }
    await down.click();
    await page.waitForFunction(() => {
      const footer = document.querySelector(".cv-builder-footer > .cv-builder-footer__actions");
      if (!footer) return false;
      const rect = footer.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }, { timeout: 5000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator(".cv-builder-scroll-hand--up").click();
    await page.waitForFunction(() => {
      const title = document.getElementById("cv-builder-title");
      if (!title) return false;
      const top = title.getBoundingClientRect().top;
      return top >= 0 && top <= 40;
    }, { timeout: 5000 });

    const screenshotToggle = page.locator(".cv-builder-screenshot-toggle");
    await screenshotToggle.click();
    if ((await page.locator(".cv-builder-scroll-hands").count()) !== 0) {
      throw new Error("scroll hands are visible in screenshot view");
    }
    if ((await page.getByRole("button", { name: "↔ Normalbreite" }).count()) !== 0) {
      throw new Error("maximize button is visible in screenshot view");
    }
    await page.screenshot({ path: `${evidenceDir}/02-screenshot-view-1920.png`, fullPage: true });
    await screenshotToggle.click();
    if (!(await hands.isVisible())) throw new Error("scroll hands did not return from screenshot view");
    if (await page.getByRole("button", { name: "⛶ Breite maximieren" }).isVisible() === false) {
      throw new Error("maximize button did not return from screenshot view");
    }

    const responsive = [];
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(160);
      await assertNoOverflow(page, `responsive ${width}px`);
      await assertHandsDoNotCoverEditor(page, `responsive ${width}px`);
      responsive.push({
        width,
        scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight),
        hands: await page.locator(".cv-builder-scroll-hands").boundingBox(),
        box: await box.boundingBox(),
      });
      await page.screenshot({ path: `${evidenceDir}/03-responsive-${width}.png` });
    }
    await page.setViewportSize({ width: 1920, height: 1080 });

    if (errors.length > 0) throw new Error(`page/console errors: ${errors.slice(0, 3).join(" | ")}`);
    console.log(JSON.stringify({
      status: "PASS",
      width: { normalMainWidth, normalWidth, wideMainWidth, wideWidth, restoredWidth },
      down: { downStart, downAccelerated, footerStop },
      responsive,
      screenshots: `${evidenceDir}/*.png`,
    }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
  }
}

run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
