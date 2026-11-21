// JM-CV-IMPORT-UX-07 — fullpage decision navigation and premium action card.
// Synthetic PDF/UI data only; no private CV, RIS, auth or storage writes.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import playwright from "playwright";

const port = 5252;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/cv-import-ux-07";
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
    const page = pdf.addPage([595, 842]);
    let y = 790;
    page.drawText(`SYNTHETISCHER LEBENSLAUF · PRÜFSEITE ${pageIndex + 1}`, { x: 45, y, size: 10, font });
    y -= 24;
    page.drawText("PROFIL", { x: 45, y, size: 10, font });
    y -= 16;
    page.drawText("Cloud Solution Architect · synthetische Testdaten", { x: 45, y, size: 9, font });
    y -= 24;
    page.drawText("UNBEKANNTER ABSCHNITT", { x: 45, y, size: 10, font });
    y -= 18;
    for (let line = 0; line < 11; line += 1) {
      const number = pageIndex * 11 + line + 1;
      page.drawText(`Unklare Angabe ${String(number).padStart(2, "0")} · ausschließlich zur Prüfung`, {
        x: 45,
        y,
        size: 9,
        font,
      });
      y -= 17;
    }
    page.drawText("Synthetisch · keine echten CV-Daten", { x: 45, y: 28, size: 8, font });
  }
  return Buffer.from(await pdf.save());
}

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

async function importModal(page, pdf) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await page.locator(".cv-import-modal input[type=file]").setInputFiles({
    name: "synthetic-import-ux-07.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("heading", { name: "Lebenslauf analysiert" }).waitFor();
}

async function openWorkspace(context, source) {
  const popupPromise = context.waitForEvent("page");
  await source.getByRole("button", { name: /In neuem Tab öffnen/ }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("networkidle");
  await popup.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  return popup;
}

async function countPending(popup) {
  return popup.locator(".cv-import-decision-panel__count").innerText();
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function run() {
  const pdf = await makePdf();
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "de-DE" });
    await context.addInitScript(() => { if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de"); });
    const source = await context.newPage();
    await mockApi(source);
    await importModal(source, pdf);

    const popup = await openWorkspace(context, source);
    const errors = [];
    popup.on("pageerror", (error) => errors.push(error.message));
    popup.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await popup.locator(".cv-import-decision-panel").waitFor();

    const initialCount = Number.parseInt((await countPending(popup)).replace(/\D/g, ""), 10);
    if (!(initialCount >= 35)) throw new Error(`expected at least 35 pending items, got ${initialCount}`);
    const reviewPages = await popup.locator(".cv-import-review__pagination").innerText();
    if (!/Seite 1 von \d+/.test(reviewPages)) throw new Error(`review pagination missing: ${reviewPages}`);
    const pageCount = Number(reviewPages.match(/von (\d+)/)?.[1] ?? 0);
    if (pageCount < 4) throw new Error(`expected at least 4 review pages, got ${pageCount}`);
    await assertNoOverflow(popup, "initial 1920px");
    if ((await popup.evaluate(() => window.scrollY)) !== 0) throw new Error("workspace auto-scrolled on load");
    if ((await popup.locator(".cv-import-modal__actions").count()) !== 0) {
      throw new Error("fullpage preview still has the old action bar");
    }
    const panelPosition = await popup.locator(".cv-import-decision-panel").evaluate((node) => getComputedStyle(node).position);
    if (panelPosition !== "static") throw new Error(`decision panel is not in normal flow: ${panelPosition}`);

    await popup.screenshot({ path: `${evidenceDir}/01-fullpage-import-1920.png`, fullPage: true });

    const responsivePanels = [];
    for (const width of [1440, 768, 390]) {
      await popup.setViewportSize({ width, height: 900 });
      await popup.waitForTimeout(120);
      await assertNoOverflow(popup, `responsive ${width}px`);
      const panelInfo = await popup.locator(".cv-import-decision-panel").evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          text: node.textContent?.replace(/\s+/g, " ").trim(),
          buttons: node.querySelectorAll("button").length,
          overflow: getComputedStyle(node).overflow,
        };
      });
      if (!panelInfo.text?.includes("DEINE IMPORTENTSCHEIDUNG") || panelInfo.buttons < 4) {
        throw new Error(`responsive ${width}px: decision panel content missing ${JSON.stringify(panelInfo)}`);
      }
      responsivePanels.push({ width, ...panelInfo });
      await popup.screenshot({ path: `${evidenceDir}/02-responsive-${width}.png`, fullPage: true });
    }
    await popup.setViewportSize({ width: 1920, height: 1080 });
    await popup.waitForTimeout(120);

    const beforeJumpY = await popup.evaluate(() => window.scrollY);
    const jump = popup.getByRole("button", { name: /Auswahl getroffen.*Zu den Importaktionen/ });
    await jump.focus();
    await popup.keyboard.press("Enter");
    await popup.waitForFunction(() => {
      const panel = document.getElementById("cv-import-decision-panel");
      if (!panel) return false;
      const rect = panel.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }, { timeout: 3000 });
    const afterJumpY = await popup.evaluate(() => window.scrollY);
    if (afterJumpY <= beforeJumpY + 200) throw new Error(`decision jump did not reach the panel: ${beforeJumpY} -> ${afterJumpY}`);
    if ((await popup.evaluate(() => document.activeElement?.id)) !== "cv-import-decision-panel") {
      throw new Error("decision panel did not receive focus");
    }
    if ((await popup.getByRole("heading", { name: "Deine Importauswahl" }).count()) !== 0) {
      throw new Error("decision jump unexpectedly opened the summary");
    }
    const afterJumpCount = Number.parseInt((await countPending(popup)).replace(/\D/g, ""), 10);
    if (afterJumpCount !== initialCount) {
      throw new Error(`decision jump changed the pending decisions: ${initialCount} -> ${afterJumpCount}`);
    }
    await popup.screenshot({ path: `${evidenceDir}/03-decision-panel-focus-1920.png` });

    await popup.getByRole("button", { name: "↑ Zurück zur Prüfung" }).click();
    await popup.waitForTimeout(250);
    if ((await popup.evaluate(() => document.activeElement?.id)) !== "cv-import-review-title") {
      throw new Error("review title did not receive focus");
    }
    if ((await popup.getByRole("heading", { name: "Deine Importauswahl" }).count()) !== 0) {
      throw new Error("back-to-review unexpectedly opened the summary");
    }

    const firstPending = popup.locator(".cv-import-review__item.is-pending").first();
    await firstPending.locator("select").selectOption("projects");
    await firstPending.getByRole("button", { name: "Übernehmen", exact: true }).click();
    await popup.waitForTimeout(50);
    if ((await popup.locator(".cv-import-review__item.is-accepted").count()) < 1) {
      throw new Error("accepting a pending item did not preserve the decision");
    }
    const afterDecisionCount = Number.parseInt((await countPending(popup)).replace(/\D/g, ""), 10);
    if (afterDecisionCount !== initialCount - 1) {
      throw new Error(`pending count did not update: ${initialCount} -> ${afterDecisionCount}`);
    }
    await popup.getByRole("button", { name: "Weiter" }).click();
    if (!/Seite 2 von/.test(await popup.locator(".cv-import-review__pagination").innerText())) {
      throw new Error("existing pagination did not advance");
    }
    await popup.getByRole("button", { name: "Zurück", exact: true }).click();
    await popup.emulateMedia({ reducedMotion: "reduce" });
    if (!(await popup.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches))) {
      throw new Error("reduced-motion emulation is not active");
    }
    await popup.getByRole("button", { name: /Auswahl getroffen.*Zu den Importaktionen/ }).click();
    await popup.waitForFunction(() => {
      const panel = document.getElementById("cv-import-decision-panel");
      if (!panel) return false;
      const rect = panel.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }, { timeout: 3000 });
    if (!(await popup.locator(".cv-import-decision-panel").isVisible())) {
      throw new Error("decision panel is not visible after the second jump");
    }

    await popup.locator(".cv-import-decision-panel__primary").click();
    await popup.getByRole("heading", { name: "Deine Importauswahl" }).waitFor();
    await popup.screenshot({ path: `${evidenceDir}/04-import-summary-1920.png` });
    const acknowledge = popup.getByRole("checkbox", { name: /Ich lasse .* ungeprüfte Angaben/ });
    if (await acknowledge.count()) await acknowledge.check();
    await popup.getByRole("button", { name: "Auswahl übernehmen", exact: true }).click();
    await popup.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();

    if (errors.length > 0) throw new Error(`page/console errors: ${errors.slice(0, 3).join(" | ")}`);
    console.log(JSON.stringify({
      status: "PASS",
      initialCount,
      afterDecisionCount,
      pageCount,
      beforeJumpY,
      afterJumpY,
      responsivePanels,
      screenshots: `${evidenceDir}/*.png`,
    }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
  }
}

run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
