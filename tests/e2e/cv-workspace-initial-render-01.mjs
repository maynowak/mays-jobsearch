// JM-CV-WORKSPACE-INITIAL-RENDER-01 — diagnostic for the first tab open.
// Synthetic PDF and synthetic UI data only; no auth, RIS, upload or real CV.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import playwright from "playwright";

const port = 5251;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/cv-workspace-initial-render-01";
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};
const lines = [
  ["SYNTHETISCHER LEBENSLAUF", "Name: Test Person", "E-Mail: test@example.invalid", "PROFIL", "Cloud Solution Architect mit synthetischen Angaben.", "BERUFLICHER WERDEGANG", "2020-2024 Solution Architect, Beispiel GmbH"],
  ["TECHNICAL SKILLS", "AWS, Terraform, Kubernetes, TypeScript", "PROJEKTE", "2026 Cloud Plattform", "Synthetisches Projekt für die Workspace-Prüfung."],
  ["AUSBILDUNG", "B.Sc. Informatik, Hochschule Musterstadt", "WEITERBILDUNG", "AWS Solutions Architect - in Vorbereitung"],
];

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < lines.length; index += 1) {
    const page = pdf.addPage([595, 842]);
    let y = 790;
    for (const line of lines[index]) {
      page.drawText(line, { x: 45, y, size: 10, font });
      y -= 18;
    }
    page.drawText("Synthetisch - nur für Tests", { x: 45, y: 28, size: 8, font });
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

async function importPreview(page, pdf) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await page.locator(".cv-import-modal input[type=file]").setInputFiles({
    name: "synthetic-initial-render.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("heading", { name: "Lebenslauf analysiert" }).waitFor();
}

async function measure(popup, stage) {
  return popup.evaluate((stageName) => {
    const pageEl = document.querySelector(".cv-workspace-page");
    const main = document.querySelector(".cv-workspace-main");
    const box = document.querySelector(".cv-import-workspace__box") || document.querySelector(".cv-builder-fullpage__box");
    const before = pageEl ? getComputedStyle(pageEl, "::before") : null;
    const after = pageEl ? getComputedStyle(pageEl, "::after") : null;
    const r = pageEl?.getBoundingClientRect();
    const mainR = main?.getBoundingClientRect();
    const boxR = box?.getBoundingClientRect();
    return {
      stage: stageName,
      viewport: { width: innerWidth, height: innerHeight },
      overflow: document.documentElement.scrollWidth - innerWidth,
      page: r ? { top: r.top, left: r.left, width: r.width, height: r.height, scrollHeight: document.documentElement.scrollHeight } : null,
      main: mainR ? { top: mainR.top, width: mainR.width, height: mainR.height } : null,
      box: boxR ? { top: boxR.top, width: boxR.width, height: boxR.height } : null,
      before: before ? {
        width: before.width,
        height: before.height,
        backgroundSize: before.backgroundSize,
        backgroundPosition: before.backgroundPosition,
        opacity: before.opacity,
        maskImage: before.maskImage,
        display: before.display,
      } : null,
      after: after ? {
        width: after.width,
        height: after.height,
        backgroundSize: after.backgroundSize,
        backgroundPosition: after.backgroundPosition,
        opacity: after.opacity,
        maskImage: after.maskImage,
        display: after.display,
      } : null,
      images: performance.getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.includes("jm-cv-city") || name.includes("jm-cv-human")),
    };
  }, stage);
}

async function shot(popup, stage) {
  await popup.screenshot({ path: `${evidenceDir}/${stage}-viewport.png` });
  await popup.screenshot({ path: `${evidenceDir}/${stage}.png`, fullPage: true });
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
    await importPreview(source, pdf);

    const popupPromise = context.waitForEvent("page");
    await source.getByRole("button", { name: /In neuem Tab öffnen/ }).click();
    const popup = await popupPromise;
    const errors = [];
    popup.on("pageerror", (error) => errors.push(error.message));
    popup.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await popup.waitForLoadState("domcontentloaded");
    const stages = [];
    stages.push(await measure(popup, "01-domcontentloaded"));
    await shot(popup, "01-domcontentloaded");

    await popup.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
    await popup.waitForTimeout(50);
    stages.push(await measure(popup, "02-import-first-paint"));
    await shot(popup, "02-import-first-paint");

    await popup.evaluate(() => document.fonts.ready);
    await popup.evaluate(() => Promise.all(
      ["jm-cv-city.webp", "jm-cv-human.webp"].map((name) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ name, width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ name, error: true });
        img.src = Array.from(performance.getEntriesByType("resource")).find((e) => e.name.includes(name))?.name || `/${name}`;
      }))
    ));
    await popup.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    stages.push(await measure(popup, "03-fonts-images-two-raf"));
    await shot(popup, "03-fonts-images-two-raf");

    await popup.waitForTimeout(500);
    stages.push(await measure(popup, "04-after-500ms"));
    await shot(popup, "04-after-500ms");

    await popup.setViewportSize({ width: 1921, height: 1080 });
    await popup.waitForTimeout(100);
    await popup.setViewportSize({ width: 1920, height: 1080 });
    await popup.waitForTimeout(100);
    stages.push(await measure(popup, "05-after-resize"));
    await shot(popup, "05-after-resize");

    await popup.getByRole("button", { name: "Angaben übernehmen" }).click();
    await popup.getByRole("heading", { name: "Deine Importauswahl" }).waitFor();
    await popup.waitForTimeout(50);
    stages.push(await measure(popup, "06-import-summary"));
    await shot(popup, "06-import-summary");

    const viewportHeight = 1080;
    const backgroundSignatures = new Set();
    for (const stage of stages) {
      if (stage.overflow > 0) throw new Error(`${stage.stage}: horizontal overflow ${stage.overflow}`);
      if (Math.abs(Number.parseFloat(stage.before.height) - viewportHeight) > 1) {
        throw new Error(`${stage.stage}: city layer height ${stage.before.height}, expected ${viewportHeight}px`);
      }
      if (Math.abs(Number.parseFloat(stage.after.height) - viewportHeight) > 1) {
        throw new Error(`${stage.stage}: human layer height ${stage.after.height}, expected ${viewportHeight}px`);
      }
      backgroundSignatures.add(`${stage.before.backgroundSize}|${stage.before.backgroundPosition}|${stage.after.backgroundSize}|${stage.after.backgroundPosition}`);
    }
    if (backgroundSignatures.size !== 1) {
      throw new Error(`background geometry changed between stages: ${JSON.stringify([...backgroundSignatures])}`);
    }
    const importStage = stages.find((stage) => stage.stage === "02-import-first-paint");
    if (!importStage || importStage.page.height <= viewportHeight + 100) {
      throw new Error("import page did not grow beyond the viewport; regression fixture is ineffective");
    }
    if (errors.length > 0) throw new Error(`page/console errors: ${errors.slice(0, 3).join(" | ")}`);

    console.log(JSON.stringify({ status: "PASS", viewportHeight, stages, errors }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
  }
}

run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
