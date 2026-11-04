import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-MANAGEMENT-02B");
const port = 5209;
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
      const response = await fetch(`${base}/profil?tab=cv`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

async function preparePage(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    locale: "de-DE",
    acceptDownloads: true,
  });
  await context.addInitScript(
    ({ future, userKey }) => {
      localStorage.setItem("mj-lang", "de");
      sessionStorage.setItem(
        userKey,
        JSON.stringify({
          id_token: "e2e-id-token",
          session_state: null,
          access_token: "e2e-access-token",
          refresh_token: null,
          token_type: "Bearer",
          scope: "openid email profile",
          profile: { sub: "e2e-user", email: "e2e@example.invalid", name: "E2E User" },
          expires_at: future,
        })
      );
    },
    { future, userKey: USER_KEY }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  let coverLetterCalls = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (url.pathname === "/api/cover-letter") {
      coverLetterCalls += 1;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "not expected", code: "not_expected" }) });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });
  return { context, page, consoleErrors, getCoverLetterCalls: () => coverLetterCalls };
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  if (overflow) throw new Error(`${name}: horizontal overflow`);
}

async function openEditor(page, name) {
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
  await page.getByLabel("Vollständiger Name").fill(name);
}

async function saveAndClose(page) {
  await page.getByRole("button", { name: "Lebenslauf speichern" }).click();
  await page.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
  await page.locator(".cv-builder-modal").waitFor({ state: "detached" });
}

async function runViewport(browser, name, viewport) {
  const { context, page, consoleErrors, getCoverLetterCalls } = await preparePage(browser, viewport);
  await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
  await page.locator(".cv-builder-profiles").waitFor();

  await openEditor(page, "Alex Beispiel");
  await page.getByRole("button", { name: "Modern" }).click();
  await saveAndClose(page);
  await page.getByText("Lebenslauf 1").waitFor();
  await page.getByText("Modern").waitFor();

  await page.locator(".cv-builder-profiles__item").first()
    .getByRole("button", { name: "Duplizieren" }).click();
  await page.getByText("Lebenslauf 1 (Kopie)").waitFor();
  await page.locator(".cv-builder-profiles__item").filter({ hasText: "Lebenslauf 1 (Kopie)" })
    .getByRole("button", { name: "Umbenennen" }).click();
  await page.getByLabel("Name des Lebenslaufs").fill("AWS Cloud Engineer");
  await page.getByRole("button", { name: "Namen speichern" }).click();
  await page.getByText("AWS Cloud Engineer").waitFor();

  await page.getByRole("button", { name: /Neuen Lebenslauf erstellen/ }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.getByRole("button", { name: "Kompakt" }).click();
  await saveAndClose(page);
  await page.getByText("Lebenslauf 3").waitFor();
  await page.getByText("Kompakt").waitFor();

  if (name === "desktop-1440") {
    const downloadPromise = page.waitForEvent("download");
    await page.locator(".cv-builder-profiles__item").filter({ hasText: "Lebenslauf 1" })
      .getByRole("button", { name: "PDF herunterladen" }).click();
    const download = await downloadPromise;
    const fileName = download.suggestedFilename();
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      throw new Error(`${name}: unexpected PDF filename ${fileName}`);
    }
  }

  await page.locator(".cv-builder-profiles__item").filter({ hasText: "AWS Cloud Engineer" })
    .getByRole("button", { name: "Löschen" }).click();
  await page.getByText(/Nur dieser strukturierte Lebenslauf/).waitFor();
  await page.getByRole("button", { name: "Lebenslauf löschen" }).click();
  await page.getByText("AWS Cloud Engineer").waitFor({ state: "detached" });
  if (await page.locator(".cv-builder-profiles__item").count() !== 2) {
    throw new Error(`${name}: expected two CV profiles after delete`);
  }

  if (getCoverLetterCalls() !== 0) throw new Error(`${name}: unexpected cover-letter call`);
  await assertNoOverflow(page, name);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: resolve(evidenceDir, `${name}-profiles.png`),
    fullPage: false,
  });
  if (consoleErrors.length) {
    throw new Error(`${name}: console errors: ${consoleErrors.join(" | ")}`);
  }
  await context.close();
}

const child = startVite();
try {
  await waitForServer();
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    await runViewport(browser, "desktop-1440", { width: 1440, height: 1000 });
    await runViewport(browser, "desktop-1024", { width: 1024, height: 900 });
    await runViewport(browser, "tablet-768", { width: 768, height: 900 });
    await runViewport(browser, "mobile-430", { width: 430, height: 900 });
    await runViewport(browser, "mobile-390", { width: 390, height: 844 });
    await runViewport(browser, "mobile-320", { width: 320, height: 700 });
  } finally {
    await browser.close();
  }
} finally {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
