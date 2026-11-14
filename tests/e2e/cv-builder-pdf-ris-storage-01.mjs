// JM-CV-BUILDER-PDF-RIS-STORAGE-01 — local mock-BFF E2E.
// Synthetic OIDC session and mocked RIS CV storage only; no real RIS/AWS call.
//
// Run: node tests/e2e/cv-builder-pdf-ris-storage-01.mjs

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const port = 5231;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-14T10:00:00.000Z";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const consent = {
  purpose: "cv-storage",
  status: "GRANTED",
  noticeVersion: "cv-storage/1.0",
  grantedAt: now,
  withdrawnAt: null,
  version: 1,
  specialCategoriesConsent: true,
  specialCategories: [],
  externalTextVersion: "cv-storage-consent-2026-11-08-v1",
  externalTextSha256: "synthetic",
};

const savedCv = {
  cvId: "cv-builder-e2e",
  filename: "Lebenslauf-Alex-Beispiel.pdf",
  contentType: "application/pdf",
  processingStatus: "ready",
  sizeBytes: 1024,
  createdAt: now,
  updatedAt: now,
  version: 1,
};

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, VITE_RIS_CV_STORAGE_ENABLED: "true" },
  });
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

async function preparePage(browser) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, locale: "de-DE" });
  await context.addInitScript(
    ({ userKey, expiry }) => {
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
          sub: "e2e-pdf-storage",
          email: "pdf-storage@example.invalid",
          name: "PDF Storage E2E",
        },
        expires_at: expiry,
      }));
    },
    { userKey: USER_KEY, expiry: future }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  const writes = [];
  let completed = false;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/ris/cv-consents" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent,
          noticeVersion: "cv-storage/1.0",
          noticeState: "APPROVED",
          noticeApproved: true,
          acceptedForNewGrant: true,
          grantAllowed: true,
          textVersion: consent.externalTextVersion,
          textHash: consent.externalTextSha256,
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textReason: null,
          specialCategoriesConsent: true,
          specialCategories: [],
          externalTextVersion: consent.externalTextVersion,
          externalTextSha256: consent.externalTextSha256,
        }),
      });
    }
    if (path === "/api/ris/cvs" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: completed ? [savedCv] : [], nextCursor: null }),
      });
    }
    if (path === "/api/ris/cvs" && method === "POST") {
      const action = url.searchParams.get("action");
      if (action === "upload") {
        writes.push("POST /api/ris/cvs?action=upload");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            cvId: savedCv.cvId,
            documentId: "doc-e2e",
            uploadUrl: "https://upload.invalid/cv-builder.pdf",
            expiresAt: now,
            requiredHeaders: {},
          }),
        });
      }
      if (action === "complete") {
        writes.push("POST /api/ris/cvs?action=complete");
        completed = true;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedCv) });
      }
      writes.push("POST /api/ris/cvs");
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ...savedCv, processingStatus: "pending" }),
      });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  await page.route("https://upload.invalid/cv-builder.pdf", (route) => {
    writes.push("PUT upload.invalid");
    return route.fulfill({ status: 200 });
  });
  return { context, page, consoleErrors, writes };
}

async function main() {
  const vite = startVite();
  const browser = await playwright.chromium.launch();
  try {
    await waitForServer();
    const { context, page, consoleErrors, writes } = await preparePage(browser);
    await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
    await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
    await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
    await page.locator(".cv-builder-modal").getByLabel("Vollständiger Name").fill("Alex Beispiel");
    await page.getByRole("button", { name: "In RIS speichern" }).click();
    await page.getByText("PDF wurde in RIS gespeichert.").waitFor();
    if (writes.filter((entry) => entry === "POST /api/ris/cvs").length !== 1) {
      throw new Error(`unexpected create count: ${JSON.stringify(writes)}`);
    }
    if (!writes.includes("POST /api/ris/cvs?action=upload") ||
        !writes.includes("POST /api/ris/cvs?action=complete") ||
        !writes.includes("PUT upload.invalid")) {
      throw new Error(`upload flow incomplete: ${JSON.stringify(writes)}`);
    }
    if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
    await context.close();
    console.log("JM-CV-BUILDER-PDF-RIS-STORAGE-01 mock E2E PASS");
  } finally {
    await browser.close();
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
