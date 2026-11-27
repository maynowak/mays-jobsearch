// JM-DEMO-01 — ANONYMOUS DEMO E2E
// Local Chromium E2E for the one-click demo mode.
//
// The test runs against a local Vite dev server, uses a synthetic browser
// context (no Cognito login, no real user data) and asserts that no write
// requests are sent to the RIS/BFF endpoints while the demo is active.
//
// Run: npm run test:e2e:demo

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-DEMO-01");
const port = 5219;
const externalBase = process.env.BASE_URL?.replace(/\/$/, "");
const base = externalBase || `http://localhost:${port}`;

const DEMO_KEY = "mj-demo-mode-open";
const MAY_HELP_KEY = "mj-may-help-open";
const DEMO_SKILLS = "Java, Python, AWS, Terraform, Docker, React, TypeScript";

function startVite() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", () => undefined);
  return child;
}

async function waitForServer(timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`PASS ${message}`);
}

async function waitForText(page, text, timeout = 15000) {
  await page.waitForFunction(
    (needle) => document.body.innerText.includes(needle),
    text,
    { timeout }
  );
}

async function run() {
  const vite = externalBase ? null : startVite();
  let browser;
  const writeRequests = [];

  try {
    await waitForServer();
    browser = await playwright.chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    page.on("request", (request) => {
      const method = request.method();
      const url = request.url();
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && url.includes("/api/")) {
        writeRequests.push(`${method} ${url}`);
      }
    });

    // 1) Landing page opens.
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1");
    assert(true, "Landingpage geöffnet");

    // 2) Click the visible demo CTA.
    const demoCta = page.locator("text=Demo ausprobieren").first();
    await demoCta.waitFor({ state: "visible" });
    await demoCta.click();

    // 3) /profil opens without authentication.
    await page.waitForURL(/\/profil(\?|$)/, { timeout: 15000 });
    assert(new URL(page.url()).pathname === "/profil", "/profil ohne Anmeldung geöffnet");

    // 4) Synthetic profile and demo labelling are visible.
    await waitForText(page, DEMO_SKILLS);
    await waitForText(page, "Demo-Modus");
    await waitForText(page, "Alle personenbezogenen Angaben sind fiktiv");
    assert(true, "Synthetisches Profil und Demo-Hinweis sichtbar");

    const storage = await page.evaluate(
      ([demoKey, mayHelpKey]) => ({
        demo: localStorage.getItem(demoKey),
        mayHelp: localStorage.getItem(mayHelpKey),
      }),
      [DEMO_KEY, MAY_HELP_KEY]
    );
    assert(storage.demo === "true", "Demo-Status ist im eigenen Schlüssel gespeichert");
    assert(storage.mayHelp !== "true", "May-Hilfe bleibt geschlossen und getrennt vom Demo-Status");

    // 5) Demo CV, ATS/search profile and applications areas are reachable.
    for (const label of ["Lebenslauf", "Bewerbungen", "Job-Präferenzen"]) {
      const button = page.getByRole("button", { name: new RegExp(label) }).first();
      assert(await button.isEnabled(), `Demo-Bereich erreichbar: ${label}`);
    }

    // 6) Reload keeps the demo active.
    await page.reload({ waitUntil: "networkidle" });
    await waitForText(page, DEMO_SKILLS);
    assert(new URL(page.url()).pathname === "/profil", "Reload bleibt im Demo-Profil");

    // Evidence: desktop demo profile.
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: resolve(evidenceDir, "demo-desktop.png"), fullPage: true });

    // Mobile evidence.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    await waitForText(page, DEMO_SKILLS);
    await page.screenshot({ path: resolve(evidenceDir, "demo-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // 6b) English labels are correct and direct entry via the demo key works.
    const enContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await enContext.addInitScript(() => {
      localStorage.setItem("mj-lang", "en");
      localStorage.setItem("mj-demo-mode-open", "true");
    });
    const enPage = await enContext.newPage();
    await enPage.goto(`${base}/profil`, { waitUntil: "networkidle" });
    await waitForText(enPage, "Demo mode");
    await waitForText(enPage, "All personal data shown here is fictitious.");
    await waitForText(enPage, "Exit demo");
    assert(true, "Englische Demo-Beschriftung korrekt");
    await enContext.close();

    // 7) Exit the demo.
    await page.reload({ waitUntil: "networkidle" });
    await waitForText(page, "Demo beenden");
    await page.getByRole("button", { name: "Demo beenden" }).click();
    await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 15000 });

    // 8) Demo data is gone and the demo key was removed.
    const afterExit = await page.evaluate(
      ([demoKey, skills]) => ({
        demo: localStorage.getItem(demoKey),
        hasDemoSkills: document.body.innerText.includes(skills),
      }),
      [DEMO_KEY, DEMO_SKILLS]
    );
    assert(afterExit.demo === null, "Demo-Status wurde beim Beenden entfernt");
    assert(!afterExit.hasDemoSkills, "Nach dem Beenden erscheinen keine Demodaten mehr");

    // 8b) A direct revisit of /profil stays in the normal anonymous view.
    await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
    await waitForText(page, "Du bist nicht angemeldet");
    const revisit = await page.evaluate((skills) => document.body.innerText.includes(skills), DEMO_SKILLS);
    assert(!revisit, "Erneuter /profil-Aufruf zeigt keine Demodaten mehr");

    // 9) No RIS/BFF write requests were triggered by the demo.
    assert(writeRequests.length === 0, "Keine RIS-/BFF-Schreibrequests im Demo-Modus");

    await context.close();
    console.log("\nJM-DEMO-01 E2E: ALL CHECKS PASSED");
  } finally {
    if (browser) await browser.close();
    if (vite) {
      try {
        process.kill(-vite.pid, "SIGTERM");
      } catch {
        /* already stopped */
      }
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
