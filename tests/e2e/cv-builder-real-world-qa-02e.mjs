// CV-BUILDER-REAL-WORLD-QA-02E — synthetic 3-page import and editor scroll E2E.
// No real CV data, RIS or AI calls.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/CV-BUILDER-REAL-WORLD-QA-02E");
const port = 5226;
const base = `http://localhost:${port}`;
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const longDescription = "Entwickelt sichere Cloud-Plattformen, eventgetriebene Systeme und automatisierte Deployments. ".repeat(6);
const pageLines = [
  [
    "Nora Beispiel",
    "nora.beispiel@example.invalid",
    "+49 170 1234567",
    "Berlin",
    "PROFIL",
    "Cloud Solution Architect",
    "Entwickelt sichere Cloud-Plattformen und eventgetriebene Systeme.",
    "ARCHITECTURE & CLOUD",
    "AWS, Azure, Terraform, Kubernetes",
    "SOFTWARE ARCHITECTURE",
    "Event-driven Architecture, API Design, Microservices",
    "TECHNICAL SKILLS",
    "Java, Spring Boot, TypeScript, PostgreSQL",
    "TECHNOLOGIES",
    "Docker, GitHub Actions, Linux",
  ],
  [
    "AKTUELLE PROJEKTE",
    "2026 – Projekt A",
    "Projektbeschreibung A",
    "2025 – Projekt B",
    "Projektbeschreibung B",
    "2024 – Projekt C",
    "Projektbeschreibung C",
    "WEITERBILDUNG & ZERTIFIKATSSTATUS",
    "AWS Solutions Architect – in preparation",
    "Azure Fundamentals – planned",
    "CERTIFICATIONS",
    "AWS Cloud Practitioner | Amazon Web Services | 2023",
  ],
  [
    "BERUFLICHER WERDEGANG",
    "2020–2024 | Solution Architect | Acme GmbH",
    longDescription,
    "2018–2020 | Software Engineer | Beta AG",
    "Backend-Entwicklung.",
    "AWS QA LAB – in progress",
    "Praktische Cloud-Übungen.",
    "AUSBILDUNG",
    "Technische Universität Berlin",
    "M.Sc. Informatik",
    "Okt 2014 – Sep 2016",
  ],
];

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageLines.length; index += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`NORA BEISPIEL | CLOUD ARCHITECT | Seite ${index + 1}`, { x: 45, y: 805, size: 8, font });
    let y = 775;
    for (const line of pageLines[index]) {
      page.drawText(line, { x: 45, y, size: 10, font, maxWidth: 505 });
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
    if (path === "/api/models") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  return { context, page, apiCalls, consoleErrors };
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`${name}: horizontal overflow ${overflow}px`);
}

async function importToEditor(page, pdfBytes) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await page.locator('.cv-import-modal input[type="file"]').setInputFiles({
    name: "realworld-3pages.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });
  await page.getByRole("heading", { name: "Lebenslauf analysiert" }).waitFor();
  const modal = page.locator(".cv-import-modal");
  if (!(await modal.getByText("Nora Beispiel").count())) throw new Error("name not recognised");
  if (!(await modal.getByText("Berlin").count())) throw new Error("location not recognised");
  if (!(await modal.getByText("AWS").count())) throw new Error("cloud skill not recognised");
  if (!(await modal.getByText("Zertifizierungsziel, kein erworbenes Zertifikat").count())) {
    throw new Error("certification goal reason missing");
  }
  await page.getByRole("button", { name: "Angaben übernehmen" }).click();
  await page.getByRole("heading", { name: "Deine Importauswahl" }).waitFor();
  const acknowledge = page.getByRole("checkbox", { name: /Ich lasse .* ungeprüfte Angaben vorerst aus/ });
  if (await acknowledge.count()) await acknowledge.check();
  await page.getByRole("button", { name: "Auswahl übernehmen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await assertNoOverflow(page, "editor");
}

async function runWidth(browser, width, pdfBytes) {
  const { context, page, apiCalls, consoleErrors } = await preparePage(browser, width);
  await importToEditor(page, pdfBytes);
  await page.screenshot({ path: resolve(evidenceDir, `editor-${width}.png`) });

  const editor = page.locator(".cv-builder-editor-pane");
  const preview = page.locator(".cv-builder-preview-pane");
  const editorDialog = page.getByRole("dialog", { name: "Strukturierter Lebenslauf-Editor" });
  await editor.getByText("Persönliche Angaben", { exact: true }).click();
  if ((await editorDialog.getByLabel("Vollständiger Name").inputValue()) !== "Nora Beispiel") throw new Error("personal name missing in editor");
  if ((await editorDialog.getByLabel("E-Mail").inputValue()) !== "nora.beispiel@example.invalid") throw new Error("email missing in editor");
  if ((await editorDialog.getByLabel("Standort").inputValue()) !== "Berlin") throw new Error("location missing in editor");
  if (width >= 1024) {
    const before = await preview.evaluate((element) => element.scrollTop);
    await editor.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.waitForTimeout(100);
    const editorScroll = await editor.evaluate((element) => element.scrollTop);
    const previewAfter = await preview.evaluate((element) => element.scrollTop);
    const modalScroll = await page.locator(".cv-builder-modal__box").evaluate((element) => element.scrollTop);
    const windowScroll = await page.evaluate(() => window.scrollY);
    if (editorScroll <= 0) throw new Error(`editor did not scroll at ${width}px`);
    if (previewAfter !== before) throw new Error(`preview scrolled with editor at ${width}px`);
    if (modalScroll !== 0 || windowScroll !== 0) throw new Error(`modal/window scrolled at ${width}px`);
    await preview.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.waitForTimeout(100);
    if ((await editor.evaluate((element) => element.scrollTop)) !== editorScroll) {
      throw new Error(`editor moved with preview at ${width}px`);
    }
    await page.screenshot({ path: resolve(evidenceDir, `scrolled-${width}.png`) });
  }
  if (apiCalls.some((path) => path !== "/api/models")) throw new Error(`unexpected API call: ${apiCalls.join(", ")}`);
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { width, personal: "PASS", scroll: width >= 1024 ? "independent" : "mobile-single" };
}

const pdfBytes = await makePdf();
const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of [320, 390, 430, 768, 1024, 1440]) results.push(await runWidth(browser, width, pdfBytes));
  await writeFile(resolve(evidenceDir, "results.json"), JSON.stringify({ status: "PASS", results }, null, 2));
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  if (browser) await browser.close();
  try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
}
