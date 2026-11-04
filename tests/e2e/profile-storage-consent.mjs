// JM-PROFILE-STORAGE-CONSENT-01
// Local Chromium E2E for the preparation-only privacy/storage area.
// No Cognito/RIS/AWS mutation is performed; OIDC session data is synthetic.
//
// Run: node tests/e2e/profile-storage-consent.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-PROFILE-STORAGE-CONSENT-01");
const port = 5210;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
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
      const response = await fetch(`${base}/profil`);
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
    ({ key, future, userKey, authenticated }) => {
      localStorage.setItem("mj-lang", "de");
      if (authenticated) {
        sessionStorage.setItem(
          userKey,
          JSON.stringify({
            id_token: "e2e-id-token",
            session_state: null,
            access_token: "e2e-access-token",
            refresh_token: null,
            token_type: "Bearer",
            scope: "openid email profile",
            profile: {
              iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
              sub: "e2e-storage-sub",
              email: "storage@example.invalid",
              name: "Storage E2E",
            },
            expires_at: future,
          })
        );
      }
      void key;
    },
    { key: USER_KEY, future, userKey: USER_KEY, authenticated }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  return { context, page, consoleErrors };
}

async function runAuthenticated(browser, width, height, name) {
  const { context, page, consoleErrors } = await preparePage(browser, { width, height }, true);
  await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
  await page.getByText(/wird vorbereitet und ist derzeit noch nicht verfügbar/).waitFor();
  await page.screenshot({ path: resolve(evidenceDir, `${name}-profile-notice.png`), fullPage: false });
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.getByRole("heading", { name: "Datenschutz & Datenspeicherung" }).waitFor();
  await page.getByText(/Die dauerhafte Speicherung deiner Bewerbungsunterlagen wird vorbereitet/).waitFor();
  await page.getByText(/Identität über das angemeldete Konto verifiziert/).waitFor();
  if ((await page.locator(".storage-consent input[type=checkbox]").count()) !== 0) {
    throw new Error(`${name}: active consent checkbox must not exist`);
  }
  for (const label of [
    "Speicherfreigaben anzeigen",
    "Gespeicherte Daten exportieren",
    "Löschung beantragen",
    "Einwilligung widerrufen",
  ]) {
    if (!(await page.getByRole("button", { name: label }).isDisabled())) {
      throw new Error(`${name}: ${label} must be disabled`);
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`${name}: horizontal overflow ${overflow}px`);
  const hideChrome = await page.addStyleTag({ content: ".navbar,.back-to-top{display:none!important}" });
  await page.locator(".storage-consent").screenshot({ path: resolve(evidenceDir, `${name}-privacy-storage.png`) });
  await hideChrome.evaluate((style) => style.remove());
  if (consoleErrors.length) throw new Error(`${name}: console errors ${consoleErrors.join(" | ")}`);
  await context.close();
  return { name, overflow, consoleErrors };
}


async function runResponsive(browser) {
  const results = [];
  for (const width of [1024, 768, 430, 320]) {
    const { context, page, consoleErrors } = await preparePage(browser, { width, height: 900 }, true);
    await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Einstellungen" }).click();
    await page.getByRole("heading", { name: "Datenschutz & Datenspeicherung" }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error(`responsive ${width}: overflow ${overflow}px`);
    const action = page.getByRole("button", { name: "Speicherfreigaben anzeigen" });
    const box = await action.boundingBox();
    if (!box || box.height < 44) throw new Error(`responsive ${width}: action below 44px`);
    if (consoleErrors.length) throw new Error(`responsive ${width}: console errors ${consoleErrors.join(" | ")}`);
    results.push({ width, overflow });
    await context.close();
  }
  return results;
}

async function runGuest(browser) {
  const { context, page, consoleErrors } = await preparePage(browser, { width: 390, height: 844 }, false);
  await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
  await page.getByText("Du bist nicht angemeldet.").waitFor();
  if ((await page.locator(".storage-consent").count()) !== 0) {
    throw new Error("guest profile must not expose storage consent");
  }
  if (consoleErrors.length) throw new Error(`guest console errors ${consoleErrors.join(" | ")}`);
  await context.close();
  return { guest: true, consoleErrors };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch();
  const desktop = await runAuthenticated(browser, 1440, 1000, "desktop-1440");
  const mobile = await runAuthenticated(browser, 390, 844, "mobile-390");
  const guest = await runGuest(browser);
  const responsive = await runResponsive(browser);
  console.log(JSON.stringify({ status: "PASS", desktop, mobile, guest, responsive }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
