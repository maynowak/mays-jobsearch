// JM-CV-BUILDER-01C
// Standalone Chromium E2E for the local CV PDF export.
// All application API calls are intercepted; no provider, backend or AI request is made.
//
// Run: node tests/e2e/cv-builder-pdf.mjs

import { spawn, execFileSync } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-BUILDER-01C");
const port = 5206;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  fallbackModel: null,
  recommendedModel: null,
};

const LONG_DESCRIPTION = "React, TypeScript und Designsysteme. ".repeat(100);

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

async function prepareContext(browser, lang = "de") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: lang === "de" ? "de-DE" : "en-GB" });
  await context.addInitScript((lang) => localStorage.setItem("mj-lang", lang), lang);
  const page = await context.newPage();
  const consoleErrors = [];
  const apiRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(models),
    })
  );
  return { context, page, consoleErrors, apiRequests };
}

async function prepareAuthenticatedContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(
    ({ userKey, future }) => {
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
    { userKey: USER_KEY, future }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  const apiRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(models),
    })
  );
  return { context, page, consoleErrors, apiRequests };
}

async function openBuilder(page) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen" }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
}

function dialog(page) {
  return page.getByRole("dialog", { name: "Strukturierter Lebenslauf-Editor" });
}

async function openSection(page, title) {
  await dialog(page).locator("summary span").filter({ hasText: title }).first().click();
}

async function fillLongDraft(page) {
  const d = dialog(page);
  await openSection(page, "Persönliche Angaben");
  await d.getByLabel("Vollständiger Name").fill("Zoë Beispiel-Ćurić");
  await d.getByLabel("E-Mail").fill("zoe@example.invalid");
  await d.getByLabel("Telefon").fill("+49 30 123456");
  await d.getByLabel("Standort").fill("Berlin");

  await openSection(page, "Berufliches Kurzprofil");
  await d.getByLabel("Berufsbezeichnung").fill("Senior Frontend Entwicklerin");
  await d.getByLabel("Kurzprofil").fill(
    "Barrierefreie React-Anwendungen, Designsysteme und Cloud-Architektur für internationale Teams."
  );

  await openSection(page, "Berufserfahrung");
  for (const [index, company] of ["Beispiel GmbH", "Vorherige AG", "Erste Firma"].entries()) {
    await d.getByRole("button", { name: "+ Berufserfahrung hinzufügen" }).click();
    await d.getByLabel("Position").nth(index).fill(`Frontend Entwicklerin ${index + 1}`);
    await d.getByLabel("Arbeitgeber").nth(index).fill(company);
    await d.getByLabel("Beginn (Monat/Jahr)").nth(index).fill(index === 0 ? "2019-03" : `201${6 - index}-01`);
    if (index === 0) {
      await d.getByLabel("Aktuell laufend").nth(index).check();
    } else {
      await d.getByLabel("Ende (Monat/Jahr)").nth(index).fill(`201${9 - index}-12`);
    }
    await d.getByLabel("Tätigkeiten / Beschreibung").nth(index).fill(
      `${LONG_DESCRIPTION}\n\nBarrierefreie Komponenten, Designsysteme und Mentoring.`
    );
  }

  await openSection(page, "Ausbildung");
  await d.getByRole("button", { name: "+ Ausbildung hinzufügen" }).click();
  await d.getByLabel("Bildungseinrichtung").fill("Beispiel-Universität");
  await d.getByLabel("Abschluss").fill("B.Sc. Informatik");
  await d.getByLabel("Beginn (Monat/Jahr)").last().fill("2013-10");
  await d.getByLabel("Ende (Monat/Jahr)").last().fill("2017-09");

  await openSection(page, "Fähigkeiten");
  await d.getByLabel("Fähigkeiten").fill("React, TypeScript, Cloud Architecture, Barrierefreiheit");

  await openSection(page, "Projekte");
  await d.getByRole("button", { name: "+ Projekt hinzufügen" }).click();
  await d.getByLabel("Projektname").fill("Job Matcher");
  await d.getByLabel("Technologien").fill("React, Node.js, PostgreSQL");
  await d.getByLabel("Tätigkeiten / Beschreibung").last().fill("Strukturierte Jobsuche mit ATS-Unterstützung.");

  await openSection(page, "Zertifikate");
  await d.getByRole("button", { name: "+ Zertifikat hinzufügen" }).click();
  await d.getByLabel("Zertifikat").fill("AWS Cloud Practitioner");
  await d.getByLabel("Ausstellende Organisation").fill("Amazon");
  await d.getByLabel("Datum (Monat/Jahr)").fill("2023-05");

  await openSection(page, "Sprachen und Links");
  await d.getByRole("button", { name: "+ Sprache hinzufügen" }).click();
  await d.getByRole("textbox", { name: "Sprache", exact: true }).fill("Deutsch");
  await d.getByLabel("Kenntnisstand").selectOption("native");
  await d.getByRole("button", { name: "+ Link hinzufügen" }).click();
  await d.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill("Portfolio");
  await d.getByLabel("URL").fill("https://example.invalid/portfolio");
}

async function downloadPdf(
  page,
  templateLabel,
  targetPath,
  exportLabel = "Als PDF herunterladen",
  successLabel = "PDF wurde erstellt.",
  expectedFilename = "Lebenslauf-Zoe-Beispiel-Curic.pdf"
) {
  await page.getByRole("button", { name: templateLabel }).click();
  const exportButton = page.getByRole("button", { name: exportLabel });
  await exportButton.waitFor();
  if (!(await exportButton.isEnabled())) throw new Error(`export button disabled for ${templateLabel}`);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    exportButton.click(),
  ]);
  const filename = download.suggestedFilename();
  if (filename !== expectedFilename) {
    throw new Error(`unexpected download filename: ${filename}`);
  }
  const sourcePath = await download.path();
  if (!sourcePath) throw new Error("download path missing");
  await copyFile(sourcePath, targetPath);
  const info = execFileSync("pdfinfo", [targetPath], { encoding: "utf8" });
  const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
  if (!Number.isFinite(pages) || pages < 1) throw new Error(`invalid PDF page count: ${info}`);
  const text = execFileSync("pdftotext", ["-layout", targetPath, "-"], { encoding: "utf8" });
  const bytes = (await stat(targetPath)).size;
  await page.getByText(successLabel).waitFor();
  return { filename, pages, text, bytes };
}

function assertContent(label, result, expected) {
  const haystack = result.text.toLocaleLowerCase();
  for (const marker of expected) {
    if (!haystack.includes(marker.toLocaleLowerCase())) {
      throw new Error(`${label}: missing PDF text marker ${JSON.stringify(marker)}`);
    }
  }
  if (result.text.includes("\uFFFD")) throw new Error(`${label}: replacement character in PDF text`);
  if (result.text.includes("undefined")) throw new Error(`${label}: literal undefined in PDF text`);
}

function renderEvidence(pdfPath, slug, pages) {
  for (const pageNumber of [...new Set([1, pages])]) {
    const prefix = resolve(evidenceDir, `${slug}-page-${pageNumber}`);
    execFileSync("pdftoppm", [
      "-png",
      "-r",
      "110",
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      "-singlefile",
      pdfPath,
      prefix,
    ]);
  }
}

async function run(browser) {
  const { context, page, consoleErrors, apiRequests } = await prepareContext(browser);
  await mkdir(evidenceDir, { recursive: true });
  await openBuilder(page);
  await fillLongDraft(page);

  await page.screenshot({ path: resolve(evidenceDir, "desktop-1440-export-ready.png"), fullPage: false });

  const expected = [
    "Zoë Beispiel-Ćurić",
    "Senior Frontend Entwicklerin",
    "Berufliches Kurzprofil",
    "Berufserfahrung",
    "Ausbildung",
    "Fähigkeiten",
    "Projekte",
    "Zertifikate",
    "Sprachen",
    "Links",
    "Beispiel GmbH",
    "Vorherige AG",
    "Erste Firma",
    "AWS Cloud Practitioner",
    "Deutsch",
    "heute",
  ];

  const outputs = {};
  for (const [slug, label] of [["classic", "Klassisch"], ["modern", "Modern"], ["compact", "Kompakt"]]) {
    const pdfPath = resolve(evidenceDir, `JM-CV-BUILDER-01C-${slug}.pdf`);
    const result = await downloadPdf(page, label, pdfPath);
    assertContent(slug, result, expected);
    if (result.pages < 3) throw new Error(`${slug}: expected at least 3 pages, got ${result.pages}`);
    renderEvidence(pdfPath, slug, result.pages);
    outputs[slug] = { pages: result.pages, bytes: result.bytes, filename: result.filename };
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const exportButton = page.getByRole("button", { name: "Als PDF herunterladen" });
  await exportButton.scrollIntoViewIfNeeded();
  const mobileBox = await exportButton.boundingBox();
  if (!mobileBox || mobileBox.height < 44) throw new Error("mobile PDF export button is below 44px");
  await page.screenshot({ path: resolve(evidenceDir, "mobile-390-export-ready.png"), fullPage: false });
  const mobilePath = resolve(evidenceDir, "JM-CV-BUILDER-01C-mobile.pdf");
  const mobile = await downloadPdf(page, "Kompakt", mobilePath);
  assertContent("mobile-compact", mobile, expected);
  outputs.mobile = { pages: mobile.pages, bytes: mobile.bytes, filename: mobile.filename };

  await dialog(page).getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("heading", { name: "Ungespeicherte Änderungen" }).waitFor();
  await page.getByRole("button", { name: "Verwerfen und schließen" }).click();

  const cookies = await context.cookies();
  if (cookies.length > 0) throw new Error(`guest export created cookies: ${cookies.map((cookie) => cookie.name).join(",")}`);
  if (apiRequests.some((path) => path !== "/api/models")) {
    throw new Error(`unexpected API requests: ${apiRequests.join(", ")}`);
  }
  if (consoleErrors.length > 0) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);

  await context.close();
  return { status: "PASS", outputs, apiRequests, consoleErrors };
}

async function runEnglish(browser) {
  const { context, page, consoleErrors, apiRequests } = await prepareContext(browser, "en");
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Upload CV" }).click();
  await page.getByRole("button", { name: "Create CV" }).click();
  await page.getByRole("button", { name: "Create empty CV" }).click();
  await page.getByRole("heading", { name: "Structured CV editor" }).waitFor();
  const englishDialog = page.getByRole("dialog", { name: "Structured CV editor" });
  await englishDialog.locator("summary span").filter({ hasText: "Personal details" }).first().click();
  await englishDialog.getByLabel("Full name").fill("English User");
  await englishDialog.getByLabel("Email").fill("english@example.invalid");
  await englishDialog.locator("summary span").filter({ hasText: "Professional profile" }).first().click();
  await englishDialog.getByLabel("Professional title").fill("Engineer");
  await englishDialog.getByLabel("Short profile").fill("Accessible frontend systems and cloud architecture.");

  const englishPath = resolve(evidenceDir, "JM-CV-BUILDER-01C-en.pdf");
  const english = await downloadPdf(
    page,
    "Modern",
    englishPath,
    "Download as PDF",
    "PDF created.",
    "Lebenslauf-English-User.pdf"
  );
  assertContent("english-modern", english, ["English User", "Professional profile", "Engineer"]);
  if (apiRequests.some((path) => path !== "/api/models")) {
    throw new Error(`english: unexpected API requests: ${apiRequests.join(", ")}`);
  }
  if (consoleErrors.length > 0) throw new Error(`english console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { pages: english.pages, bytes: english.bytes, filename: english.filename };
}

async function runAuthenticated(browser) {
  const { context, page, consoleErrors, apiRequests } = await prepareAuthenticatedContext(browser);
  await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
  await page.waitForSelector(".dashboard-v2");
  await page.getByRole("button", { name: "Lebenslauf" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await openSection(page, "Persönliche Angaben");
  await dialog(page).getByLabel("Vollständiger Name").fill("Auth Nutzer");
  await dialog(page).getByLabel("E-Mail").fill("auth@example.invalid");

  const pdfPath = resolve(evidenceDir, "JM-CV-BUILDER-01C-authenticated.pdf");
  const result = await downloadPdf(
    page,
    "Klassisch",
    pdfPath,
    "Als PDF herunterladen",
    "PDF wurde erstellt.",
    "Lebenslauf-Auth-Nutzer.pdf"
  );
  assertContent("authenticated", result, ["Auth Nutzer", "auth@example.invalid"]);
  if (result.pages !== 1) throw new Error(`authenticated: expected one page, got ${result.pages}`);
  renderEvidence(pdfPath, "authenticated", result.pages);

  if (apiRequests.some((path) => path !== "/api/models")) {
    throw new Error(`authenticated: unexpected API requests: ${apiRequests.join(", ")}`);
  }
  if (consoleErrors.length > 0) throw new Error(`authenticated console errors: ${consoleErrors.join(" | ")}`);

  await context.close();
  return { pages: result.pages, bytes: result.bytes, filename: result.filename };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  browser = await playwright.chromium.launch();
  const guest = await run(browser);
  const english = await runEnglish(browser);
  const authenticated = await runAuthenticated(browser);
  console.log(JSON.stringify({ ...guest, english, authenticated }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
