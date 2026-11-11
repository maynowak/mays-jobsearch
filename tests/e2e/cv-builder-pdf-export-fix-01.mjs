// CV-BUILDER-PDF-EXPORT-FIX-01 — actual browser PDF download.
// Synthetic four-page input CV; no real user data, RIS or AI calls.

import { spawn, execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/CV-BUILDER-PDF-EXPORT-FIX-01");
const port = 5224;
const base = `http://localhost:${port}`;
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const pageLines = [
  [
    "Zoë Beispiel",
    "E-Mail: zoe@example.invalid",
    "PROFIL",
    "Cloud Architektin",
    "KERNKOMPETENZEN – ATS-SUCHBEGRIFFE",
    "AWS, Terraform, TypeScript",
  ],
  [
    "AKTUELLE ARCHITEKTUR- UND SOFTWAREPROJEKTE",
    "2026 – Projekt A",
    "Projektbeschreibung A – synthetische Architektur und Umsetzung.",
    "Projektbeschreibung A – Cloud-Integration, Tests und Dokumentation.",
    "Projektbeschreibung A – Betrieb, Monitoring und Übergabe.",
    "Projektbeschreibung A – Barrierefreiheit und Performance.",
    "Projektbeschreibung A – Datenmodell und Schnittstellen.",
    "Projektbeschreibung A – Sicherheit und Berechtigungen.",
    "Projektbeschreibung A – Deployment und Automatisierung.",
    "Projektbeschreibung A – Abschluss und Review.",
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
    "2020–2026 | Architektin | Beispiel GmbH",
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

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`${name}: horizontal overflow ${overflow}px`);
}

async function openImportedEditor(page, pdfBytes) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  const input = page.locator('.cv-import-modal input[type="file"]');
  await input.setInputFiles({ name: "vierseitig.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await page.getByText("Wir haben folgende Angaben in deinem Lebenslauf gefunden.").waitFor();
  await page.getByRole("button", { name: "Angaben übernehmen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
}

function pdfText(path) {
  return execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8" });
}

function pdfPages(path) {
  const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
  if (!Number.isFinite(pages) || pages < 1) throw new Error(`invalid PDF page count: ${info}`);
  return pages;
}

async function downloadPdf(page, label, targetPath, minPages = 2) {
  await page.getByRole("button", { name: label }).click();
  const exportButton = page.getByRole("button", { name: "Als PDF herunterladen" }).first();
  await exportButton.waitFor();
  if (!(await exportButton.isEnabled())) throw new Error(`export button disabled for ${label}`);
  await exportButton.scrollIntoViewIfNeeded();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    exportButton.click(),
  ]);
  if (download.suggestedFilename() !== "Lebenslauf-Zoe-Beispiel.pdf") {
    throw new Error(`unexpected filename: ${download.suggestedFilename()}`);
  }
  const sourcePath = await download.path();
  if (!sourcePath) throw new Error("download path missing");
  await copyFile(sourcePath, targetPath);
  const head = await readFile(targetPath);
  if (head.subarray(0, 4).toString() !== "%PDF") throw new Error("download is not a PDF");
  const pages = pdfPages(targetPath);
  const text = pdfText(targetPath);
  if (text.includes("\uFFFD")) throw new Error("replacement character in PDF text");
  for (const marker of [
    "Zoë Beispiel",
    "Berufserfahrung",
    "Ausbildung",
    "Fähigkeiten",
    "Projekte",
    "AWS QA LABS",
    "2026 – Projekt A",
    "Freelance Software Developer",
    "Deutsch",
  ]) {
    if (!text.toLocaleLowerCase().includes(marker.toLocaleLowerCase())) {
      throw new Error(`missing PDF text marker: ${marker}`);
    }
  }
  if (pages < minPages) throw new Error(`expected at least ${minPages} PDF pages, got ${pages}`);
  return { pages, bytes: (await stat(targetPath)).size, filename: download.suggestedFilename(), text };
}

async function runWidth(browser, width, pdfBytes) {
  const { context, page, apiCalls, consoleErrors } = await preparePage(browser, width);
  await openImportedEditor(page, pdfBytes);
  const exportButton = page.getByRole("button", { name: "Als PDF herunterladen" }).first();
  if (!(await exportButton.isEnabled())) throw new Error(`export disabled at ${width}px`);
  if (!(await page.getByText(/0 Validierungshinweise/).count())) {
    throw new Error(`unexpected validation errors at ${width}px`);
  }
  await assertNoOverflow(page, `editor-${width}`);
  await page.screenshot({ path: resolve(evidenceDir, `editor-${width}.png`) });

  const slug = `export-${width}`;
  const result = await downloadPdf(page, "Klassisch", resolve(evidenceDir, `${slug}.pdf`));
  await page.getByText("PDF wurde erstellt.").waitFor();
  if (apiCalls.some((path) => path !== "/api/models")) {
    throw new Error(`unexpected API call: ${apiCalls.join(", ")}`);
  }
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { width, pages: result.pages, bytes: result.bytes, filename: result.filename };
}

async function runTemplates(browser, pdfBytes) {
  const { context, page } = await preparePage(browser, 1440);
  await openImportedEditor(page, pdfBytes);
  const results = {};
  for (const [label, slug] of [["Klassisch", "classic"], ["Modern", "modern"], ["Kompakt", "compact"]]) {
    const result = await downloadPdf(page, label, resolve(evidenceDir, `template-${slug}.pdf`), slug === "compact" ? 1 : 2);
    results[slug] = { pages: result.pages, bytes: result.bytes, filename: result.filename };
  }
  await context.close();
  return results;
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
  const templates = await runTemplates(browser, pdfBytes);
  await writeFile(resolve(evidenceDir, "results.json"), JSON.stringify({ status: "PASS", results, templates }, null, 2));
  console.log(JSON.stringify({ status: "PASS", results, templates }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
