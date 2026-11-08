// MAYS-P3-FINAL: local Chromium E2E for the opt-in account-erasure UI.
// Synthetic OIDC session + mocked RIS BFF. NO real account/RIS/AWS data is
// deleted and no real deletion endpoint is called.
//
// Run: node tests/e2e/account-erasure.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/MAYS-P3-FINAL");
const port = 5220;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;

function startVite() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      VITE_RIS_CONSENT_UI_ENABLED: "true",
      VITE_RIS_ACCOUNT_ERASURE_ENABLED: "true",
    },
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
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Vite did not become ready");
}

async function preparePage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(({ userKey, future }) => {
    localStorage.setItem("mj-lang", "de");
    sessionStorage.setItem(userKey, JSON.stringify({
      id_token: "e2e-id-token",
      session_state: null,
      access_token: "e2e-access-token",
      refresh_token: null,
      token_type: "Bearer",
      scope: "openid email profile",
      profile: {
        iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
        sub: "e2e-erasure-sub",
        email: "erasure@example.invalid",
        name: "Erasure E2E",
      },
      expires_at: future,
    }));
  }, { userKey: USER_KEY, future });
  const page = await context.newPage();
  let erasureCalls = 0;
  page.on("console", (message) => {
    if (message.type() === "error") throw new Error(`console error: ${message.text()}`);
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        models: [{ id: "mock-model", name: "Mock Model" }], defaultModel: "mock-model",
        recommendedModel: null, fallbackModel: null,
      }) });
    }
    if (path === "/api/ris/consents") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        consent: null, noticeVersion: null, noticeState: null, noticeApproved: false,
        acceptedForNewGrant: false, grantAllowed: false, noticeReason: "mock",
        textVersion: null, textHash: null, textState: null, textMapped: false,
        textApproved: false, textReason: null, specialCategoriesConsent: false,
        specialCategories: [], externalTextVersion: null, externalTextSha256: null,
      }) });
    }
    if (path === "/api/ris/erasure") {
      erasureCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        userId: "e2e-erasure-sub", tenantId: "t1", complete: true,
        credentialsRevoked: 1, profilesRevoked: 1, workCancelled: 0,
        applicationsDeleted: 2, searchProfilesDeleted: 3, documentsDeleted: 0,
        profileDeleted: true,
        steps: [
          { step: "erase-partner-search-profiles", ok: true, affected: 3 },
          { step: "delete-documents", ok: true, affected: 0 },
        ],
      }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  return { context, page, getErasureCalls: () => erasureCalls };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch();
  const { context, page, getErasureCalls } = await preparePage(browser);

  await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.getByRole("heading", { name: "Datenschutz & Datenspeicherung" }).waitFor();
  await page.getByRole("heading", { name: "Konto und RIS-Daten löschen" }).waitFor();
  if (getErasureCalls() !== 0) throw new Error("erasure called before confirmation");

  const button = page.getByRole("button", { name: "Konto endgültig löschen" });
  if (!(await button.isDisabled())) throw new Error("delete button must start disabled");
  await page.getByLabel("Zur Bestätigung LÖSCHEN eingeben").fill("LÖSCHEN");
  if (await button.isDisabled()) throw new Error("delete button must enable after confirmation");
  await button.click();
  await page.getByText("Der RIS-Löschvorgang wurde abgeschlossen.").waitFor({ timeout: 10000 });
  await page.getByText(/searchProfiles=3/).waitFor({ timeout: 10000 });
  if (getErasureCalls() !== 1) throw new Error(`expected one mocked erasure call, got ${getErasureCalls()}`);
  await page.screenshot({ path: resolve(evidenceDir, "account-erasure-ui.png"), fullPage: true });
  console.log(JSON.stringify({ status: "PASS", erasureCalls: getErasureCalls(), evidence: "docs/reports/assets/MAYS-P3-FINAL/account-erasure-ui.png" }, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
}
