// CV-BUILDER-WORKFLOW-02A — save status, completion actions, profile notice and help.
// Synthetic session and mocked models only. No real user data/RIS calls.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/CV-BUILDER-WORKFLOW-02A");
const port = 5220;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

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

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/search`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

async function preparePage(browser, viewport, authenticated) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(
    ({ authenticated: isAuth, future: expiry, userKey }) => {
      localStorage.setItem("mj-lang", "de");
      if (!isAuth) {
        sessionStorage.removeItem(userKey);
        return;
      }
      sessionStorage.setItem(userKey, JSON.stringify({
        id_token: "e2e-id-token",
        session_state: null,
        access_token: "e2e-access-token",
        refresh_token: null,
        token_type: "Bearer",
        scope: "openid email profile",
        profile: {
          iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
          sub: "e2e-workflow-02a",
          email: "workflow@example.invalid",
          name: "E2E Workflow",
        },
        expires_at: expiry,
      }));
    },
    { authenticated, future, userKey: USER_KEY }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  const apiCalls = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    apiCalls.push(path);
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  return { context, page, consoleErrors, apiCalls };
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`${name}: horizontal overflow ${overflow}px`);
}

async function runBuilder(browser, width) {
  const { context, page, consoleErrors, apiCalls } = await preparePage(browser, { width, height: 900 }, false);
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
  await page.locator(".cv-builder-modal").getByLabel("Vollständiger Name").fill("E2E Workflow");
  await page.getByRole("button", { name: "Lebenslauf speichern" }).click();
  await page.getByText("Dein Lebenslauf wurde in dieser Sitzung gespeichert.").first().waitFor();
  await assertNoOverflow(page, `builder-${width}`);
  await page.locator(".cv-builder-save-success").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(evidenceDir, `builder-saved-${width}.png`) });
  if (!(await page.getByRole("button", { name: "Zur Lebenslaufübersicht" }).isVisible())) {
    throw new Error("completion action missing");
  }
  if (!(await page.getByRole("button", { name: "Weiter bearbeiten" }).isVisible())) {
    throw new Error("continue action missing");
  }
  if (!(await page.getByRole("button", { name: "Als PDF herunterladen" }).first().isVisible())) {
    throw new Error("PDF completion action missing");
  }
  await page.getByRole("button", { name: "Zur Lebenslaufübersicht" }).click();
  await page.locator(".cv-builder-modal").waitFor({ state: "detached" });
  if (apiCalls.some((path) => path !== "/api/models")) {
    throw new Error(`unexpected API call: ${apiCalls.join(", ")}`);
  }
  if (consoleErrors.length) throw new Error(`builder console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { width, source: "builder" };
}

async function runUnsaved(browser) {
  const { context, page, consoleErrors } = await preparePage(browser, { width: 390, height: 844 }, false);
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
  await page.locator(".cv-builder-modal").getByLabel("Vollständiger Name").fill("Ungespeichert");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("heading", { name: "Ungespeicherte Änderungen" }).waitFor();
  await page.screenshot({ path: resolve(evidenceDir, "builder-unsaved-390.png") });
  for (const name of ["Speichern und schließen", "Verwerfen und schließen", "Weiter bearbeiten"]) {
    if (!(await page.getByRole("button", { name }).isVisible())) throw new Error(`missing ${name}`);
  }
  await page.getByRole("button", { name: "Weiter bearbeiten" }).click();
  if (consoleErrors.length) throw new Error(`unsaved console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { width: 390, source: "unsaved" };
}

async function runProfile(browser, width) {
  const { context, page, consoleErrors } = await preparePage(browser, { width, height: 900 }, true);
  await page.goto(`${base}/profil?tab=profile`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Mays Job Matcher wird weiterentwickelt" }).waitFor();
  await page.screenshot({ path: resolve(evidenceDir, `profile-development-${width}.png`) });
  await page.getByRole("button", { name: "Hilfe" }).click();
  await page.getByRole("heading", { name: "Hilfe zu diesem Bereich" }).waitFor();
  await assertNoOverflow(page, `profile-${width}`);
  await page.screenshot({ path: resolve(evidenceDir, `profile-help-${width}.png`) });
  if (consoleErrors.length) throw new Error(`profile console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { width, source: "profile" };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of [320, 390, 430, 768, 1024, 1440]) {
    results.push(await runBuilder(browser, width));
    results.push(await runProfile(browser, width));
  }
  results.push(await runUnsaved(browser));
  await writeFile(resolve(evidenceDir, "results.json"), JSON.stringify({ status: "PASS", results }, null, 2));
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
