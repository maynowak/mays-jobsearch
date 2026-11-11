// CV-BUILDER-IMPORT-UX-02D — guided import review E2E.
// Synthetic 6-page input only. No real user data, RIS or AI calls.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/CV-BUILDER-IMPORT-UX-02D");
const port = 5225;
const base = `http://localhost:${port}`;
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const basePages = [
  [
    "May Mustermann",
    "E-Mail: may@example.invalid",
    "PROFIL",
    "Cloud Architekt",
    "KERNKOMPETENZEN – ATS-SUCHBEGRIFFE",
    "AWS, Terraform, TypeScript",
  ],
  [
    "AKTUELLE ARCHITEKTUR- UND SOFTWAREPROJEKTE",
    "2026 – Projekt A",
    "Projektbeschreibung A",
    "2026 – Projekt B",
    "Projektbeschreibung B",
    "2026 – Projekt C",
    "Projektbeschreibung C",
    "2026 – Projekt D",
    "Projektbeschreibung D",
    "AWS QA LABS – PRAXISORIENTIERTE CLOUD-QUALIFIZIERUNG (2026)",
    "Praktische Übungen",
  ],
  [
    "WEITERBILDUNG & ZERTIFIKATSSTATUS",
    "Zertifizierungsziel AWS",
    "BERUFLICHER WERDEGANG – LANGE TIMELINE",
    "2020–2026 | Architekt | Beispiel GmbH",
    "BERUFLICHER WERDEGANG – FORTSETZUNG",
    "2012–10/2019 | Freelance Software Developer | Enterprise Projects",
    "• Projekt im Kundenauftrag",
    "2008–2009 | Additional Enterprise Projects",
  ],
  [
    "AUSBILDUNG, SPRACHEN & WEITERE QUALIFIKATIONEN",
    "Technische Universität Berlin",
    "M.Sc. Informatik",
    "Okt 2014 – Sep 2016",
    "Deutsch (Muttersprache)",
    "ATS- UND VERÖFFENTLICHUNGSHINWEISE",
    "Dieses Dokument ist ein Bewerbungsprofil.",
  ],
];

const reviewLines = Array.from({ length: 55 }, (_, index) => `Prüfzeile ${index + 1}`);
const pageLines = [
  ...basePages,
  ["SONSTIGES", ...reviewLines.slice(0, 30)],
  reviewLines.slice(30),
];

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageLines.length; index += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`MAY MUSTERMANN | ATS-PROFIL | 13.10.2026 Seite ${index + 1}`, {
      x: 45,
      y: 805,
      size: 8,
      font,
    });
    let y = 775;
    for (const line of pageLines[index]) {
      page.drawText(line, { x: 45, y, size: 10, font });
      y -= 16;
    }
    page.drawText("Vertraulich – nur für Bewerbungszwecke", { x: 45, y: 28, size: 8, font });
  }
  return Buffer.from(await pdf.save());
}

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

async function preparePage(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const apiCalls = [];
  const consoleErrors = [];
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
  return { context, page, apiCalls, consoleErrors };
}

async function importPdf(page, pdfBytes) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  const input = page.locator('.cv-import-modal input[type="file"]');
  await input.setInputFiles({ name: "sechsseitig.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await page.getByRole("heading", { name: "Lebenslauf analysiert" }).waitFor();
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`${name}: horizontal overflow ${overflow}px`);
}

async function runWidth(browser, width, pdfBytes) {
  const { context, page, apiCalls, consoleErrors } = await preparePage(browser, width);
  await importPdf(page, pdfBytes);
  const modal = page.locator(".cv-import-modal");
  if (!(await page.getByText("Prüfliste").count())) throw new Error("review list missing");
  if ((await page.locator(".cv-import-review__item").count()) !== 10) throw new Error("expected 10 review items");
  if (!(await page.getByText("Seite 1 von 6").count())) throw new Error("pagination missing");
  await assertNoOverflow(page, `preview-${width}`);
  await page.screenshot({ path: resolve(evidenceDir, `preview-${width}.png`) });

  if (width === 390) {
    await page.getByRole("button", { name: "Bearbeiten" }).first().click();
    await page.getByRole("textbox", { name: "Korrigierter Text" }).fill("Korrigierte Prüfzeile");
    await page.getByRole("button", { name: "Korrektur übernehmen" }).click();
    await page.getByRole("combobox", { name: /Zuordnen zu/ }).first().selectOption("projects");
    await page.getByRole("button", { name: "Übernehmen" }).first().click();
    await page.getByLabel("Status").selectOption("accepted");
    if (!(await page.getByText("Korrigierte Prüfzeile").count())) throw new Error("correction missing after filter");
    await page.getByLabel("Status").selectOption("all");
    await page.getByRole("button", { name: "Weiter" }).click();
    if (!(await page.getByText("Seite 2 von 6").count())) throw new Error("page 2 missing");
    const pagination = page.getByRole("navigation", { name: "Prüfseiten" });
    await pagination.getByRole("button", { name: "Zurück" }).click();
    if (!(await page.getByText("Korrigierte Prüfzeile").count())) throw new Error("decision lost after page change");

    await page.getByRole("button", { name: "Angaben übernehmen" }).click();
    await page.getByRole("heading", { name: "Deine Importauswahl" }).waitFor();
    await page.screenshot({ path: resolve(evidenceDir, "summary-390.png") });
    const acknowledge = page.getByRole("checkbox", { name: /Ich lasse .* ungeprüfte Angaben vorerst aus/ });
    if (await acknowledge.count()) await acknowledge.check();
    await page.getByRole("button", { name: "Auswahl übernehmen" }).click();
    await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    await page.screenshot({ path: resolve(evidenceDir, "editor-390.png") });
  }

  if (apiCalls.some((path) => path !== "/api/models")) throw new Error(`unexpected API call: ${apiCalls.join(", ")}`);
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { width, reviewItems: 10, pagination: "1/6" };
}

const pdfBytes = await makePdf();
const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of [320, 390, 430, 768, 1024, 1440]) {
    results.push(await runWidth(browser, width, pdfBytes));
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
