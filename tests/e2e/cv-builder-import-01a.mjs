// CV-BUILDER-IMPORT-01A — local PDF and RIS CV import E2E.
// Synthetic PDFs, synthetic OIDC session and mocked RIS responses only.
//
// Run: npm run test:e2e:cv-builder-import

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/CV-BUILDER-IMPORT-01B");
const port = 5218;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-10T13:00:00.000Z";

const cvText = `Max Mustermann
E-Mail: max@example.com
Telefon: +49 170 1234567
Ort: Berlin

Profil
Senior Frontend Engineer
Entwickelt barrierefreie React-Anwendungen.

Berufserfahrung
Acme GmbH
Senior Frontend Engineer
Jan 2020 - Present
- React und TypeScript
- Barrierefreie Komponenten

Ausbildung
Technische Universitaet Berlin
M.Sc. Informatik
Okt 2014 - Sep 2016

Faehigkeiten
React, TypeScript, Node.js, AWS

Projekte
Job Matcher
Barrierefreie Suchoberflaeche.
Technologien: React, TypeScript

Sprachen
Deutsch (Muttersprache)
Englisch (fliessend)

Links
https://github.com/max
https://www.linkedin.com/in/max`;

async function makePdf(text) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const line of text.split("\n")) {
    if (line) page.drawText(line, { x: 45, y, size: 10, font });
    y -= 15;
    if (y < 40) break;
  }
  return Buffer.from(await pdf.save());
}

const pdfBytes = await makePdf(cvText);

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const cv = {
  cvId: "cv-1",
  filename: "RIS-Lebenslauf_2026.pdf",
  contentType: "application/pdf",
  processingStatus: "ready",
  sizeBytes: pdfBytes.length,
  createdAt: now,
  updatedAt: now,
  version: 1,
};

const cvConsent = {
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

function startVite() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, VITE_RIS_CV_STORAGE_ENABLED: "true" },
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
  const context = await browser.newContext({ viewport, locale: "de-DE", acceptDownloads: true });
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
          sub: "e2e-cv-import",
          email: "import@example.invalid",
          name: "E2E Import",
        },
        expires_at: expiry,
      }));
    },
    { authenticated, future, userKey: USER_KEY }
  );
  const page = await context.newPage();
  const risWrites = [];
  const unexpected = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path.startsWith("/api/ris/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      risWrites.push(`${method} ${path}`);
    }
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/ris/cvs" && method === "GET" && url.searchParams.get("action") === "document") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ downloadUrl: "https://download.invalid/ris-cv.pdf" }),
      });
    }
    if (path === "/api/ris/cvs" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [cv], nextCursor: null }),
      });
    }
    if (path === "/api/ris/cv-consents" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent: cvConsent,
          noticeVersion: "cv-storage/1.0",
          noticeState: "APPROVED",
          noticeApproved: true,
          acceptedForNewGrant: true,
          grantAllowed: true,
          textVersion: cvConsent.externalTextVersion,
          textHash: cvConsent.externalTextSha256,
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textReason: null,
          specialCategoriesConsent: true,
          specialCategories: [],
          externalTextVersion: cvConsent.externalTextVersion,
          externalTextSha256: cvConsent.externalTextSha256,
        }),
      });
    }
    if (path === "/api/profile" || path === "/api/ats" || path === "/api/match" || path === "/api/cover-letter") {
      unexpected.push(`${method} ${path}`);
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "unexpected" }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  await page.route("https://download.invalid/ris-cv.pdf", (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: pdfBytes })
  );
  return { context, page, risWrites, unexpected };
}

async function openImport(page, authenticated) {
  if (authenticated) {
    await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  } else {
    await page.goto(`${base}/search`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
    await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  }
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await assertNoOverflow(page, "source");
  await page.screenshot({ path: resolve(evidenceDir, `source-${page.viewportSize()?.width ?? 0}.png`) });
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`${name}: horizontal overflow ${overflow}px`);
}

async function finishPreview(page) {
  await page.getByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.").waitFor();
  await assertNoOverflow(page, "preview");
  await page.getByRole("button", { name: "Angaben übernehmen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
  await page.locator(".cv-builder-modal").getByLabel("Vollständiger Name").waitFor();
}

async function runLocal(browser, width) {
  const { context, page, risWrites, unexpected } = await preparePage(browser, { width, height: 900 }, false);
  await openImport(page, false);
  const input = page.locator('.cv-import-modal input[type="file"]');
  await input.setInputFiles({ name: "lebenslauf.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await page.getByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.").waitFor();
  await page.screenshot({ path: resolve(evidenceDir, `preview-${width}.png`) });
  await finishPreview(page);
  if ((await page.locator(".cv-builder-modal").getByLabel("Vollständiger Name").inputValue()) !== "Max Mustermann") {
    throw new Error("local import did not prefill the name");
  }
  if ((await page.locator(".cv-builder-modal").getByLabel("E-Mail").inputValue()) !== "max@example.com") {
    throw new Error("local import did not prefill the email");
  }
  await page.locator(".cv-builder-modal").getByLabel("Vollständiger Name").fill("Max Import");
  await assertNoOverflow(page, "editor");
  await page.screenshot({ path: resolve(evidenceDir, `editor-${width}.png`) });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Als PDF herunterladen" }).click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().toLowerCase().endsWith(".pdf")) {
    throw new Error("imported draft did not export as PDF");
  }
  if (risWrites.length || unexpected.length) throw new Error(`unexpected calls: ${risWrites.concat(unexpected).join(", ")}`);
  await context.close();
  return { width, source: "local", download: download.suggestedFilename() };
}

async function runRis(browser, width) {
  const { context, page, risWrites, unexpected } = await preparePage(browser, { width, height: 900 }, true);
  await openImport(page, true);
  await page.getByRole("select").selectOption({ label: "RIS-Lebenslauf_2026.pdf" }).catch(async () => {
    await page.locator(".cv-import-ris select").selectOption("cv-1");
  });
  await page.getByRole("button", { name: "Diesen Lebenslauf importieren" }).click();
  await finishPreview(page);
  if ((await page.locator(".cv-builder-modal").getByLabel("Vollständiger Name").inputValue()) !== "Max Mustermann") {
    throw new Error("RIS import did not prefill the name");
  }
  if (risWrites.length || unexpected.length) throw new Error(`unexpected calls: ${risWrites.concat(unexpected).join(", ")}`);
  await context.close();
  return { width, source: "ris" };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of [320, 390, 430, 768, 1024, 1440]) {
    results.push(await runLocal(browser, width));
    results.push(await runRis(browser, width));
  }
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
