// JM-CV-DESIGN-01 — visual smoke for the Future Career workspace.
// Synthetic/demo UI only. No RIS, auth, upload or CV data is used.
import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import playwright from "playwright";

const port = 5241;
const base = `http://localhost:${port}`;
const out = "docs/reports/assets/JM-CV-DESIGN-02";
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
  for (let i = 0; i < 120; i += 1) {
    try {
      const r = await fetch(`${base}/cv-builder/workspace`);
      if (r.ok) return;
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

async function metrics(page) {
  return page.evaluate(() => {
    const pageEl = document.querySelector(".cv-workspace-page");
    const before = pageEl ? getComputedStyle(pageEl, "::before") : null;
    const after = pageEl ? getComputedStyle(pageEl, "::after") : null;
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      beforeDisplay: before?.display ?? null,
      afterDisplay: after?.display ?? null,
      beforeHasCity: (before?.backgroundImage ?? "").includes("jm-cv-city"),
      afterHasHuman: (after?.backgroundImage ?? "").includes("jm-cv-human"),
      glass: getComputedStyle(document.querySelector(".cv-builder-fullpage__box") || document.querySelector(".cv-workspace-start")).backgroundColor,
      animated: `${before?.animationName ?? ""},${after?.animationName ?? ""}`,
    };
  });
}

async function assertView(page, width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(200);
  const m = await metrics(page);
  if (m.overflow > 0) throw new Error(`${label} ${width}: horizontal overflow ${m.overflow}px`);
  if (width >= 1280 && (!m.beforeHasCity || !m.afterHasHuman)) {
    throw new Error(`${label} ${width}: side artwork not active ${JSON.stringify(m)}`);
  }
  if (width < 1200 && (m.beforeDisplay !== "none" || m.afterDisplay !== "none")) {
    throw new Error(`${label} ${width}: side artwork should be hidden on narrow screens`);
  }
  return { width, ...m };
}

async function run() {
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(out, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
    await context.addInitScript(() => { if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de"); });
    const page = await context.newPage();
    await mockApi(page);
    const api = [];
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) api.push(`${r.method()} ${new URL(r.url()).pathname}`); });

    await page.goto(`${base}/cv-builder/workspace`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "CV-Workspace starten" }).waitFor();
    const start1440 = await assertView(page, 1440, "start");
    await page.screenshot({ path: `${out}/workspace-start-1440.png`, fullPage: true });
    const start390 = await assertView(page, 390, "start");
    await page.screenshot({ path: `${out}/workspace-start-390.png`, fullPage: true });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
    await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    const editor1440 = await assertView(page, 1440, "editor");
    await page.screenshot({ path: `${out}/workspace-editor-1440.png`, fullPage: true });
    const editor390 = await assertView(page, 390, "editor");
    await page.screenshot({ path: `${out}/workspace-editor-390.png`, fullPage: true });

    const widths = [];
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      widths.push(await assertView(page, width, "matrix"));
    }
    for (const f of ["workspace-start-1440.png", "workspace-start-390.png", "workspace-editor-1440.png", "workspace-editor-390.png"]) {
      if (!(await stat(`${out}/${f}`)).size) throw new Error(`empty screenshot ${f}`);
    }
    console.log(JSON.stringify({
      status: "PASS",
      start1440,
      start390,
      editor1440,
      editor390,
      widths,
      apiCalls: [...new Set(api)],
      screenshots: `${out}/*.png`,
    }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
  }
}

run().catch((error) => { console.error(error); process.exit(1); });
