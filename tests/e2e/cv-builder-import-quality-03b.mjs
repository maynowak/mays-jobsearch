// CV-BUILDER-03B — synthetic ATS-style 71-skill import, review backlog and handoff.
// Synthetic data only; no private PDFs, uploads or RIS writes.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import playwright from "playwright";

const port = 5232;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/03b-e2e";
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};
const skills = Array.from({ length: 71 }, (_, index) => `Synthetic Skill ${String(index + 1).padStart(2, "0")}`);
const reviewLines = Array.from({ length: 34 }, (_, index) => `Offene synthetische Angabe ${String(index + 1).padStart(2, "0")}`);

function pageLines() {
  return [
    [
      "NORA BEISPIEL",
      "SENIOR SOFTWARE ARCHITECT",
      "Berlin · Deutschland · +49 170 1234567",
      "nora.beispiel@example.invalid",
      "PROFIL",
      "Synthetic profile summary for import quality verification.",
      "ARCHITECTURE & CLOUD",
      skills.slice(0, 18).join(", "),
      skills.slice(18, 36).join(", "),
      skills.slice(36, 54).join(", "),
      `${skills.slice(54, 71).join(", ")}, AWS, Terraform`,
    ],
    [
      "BERUFSERFAHRUNG",
      "Januar 2020 – Dezember 2021",
      "Senior Engineer",
      "Acme GmbH",
      "Synthetic description.",
      "2022 – 2024 | Developer | Beta AG",
      "Synthetic description.",
      "Senior Engineer | Gamma GmbH | 03/2021",
      "Synthetic description.",
      "PROJEKTE",
      "2026 – Projekt Cloud",
      "Cognito, Lambda, SQS, Terraform.",
      "2025 – Projekt Web",
      "React, TypeScript, Vercel.",
      "2024 – Projekt AI",
      "OpenRouter, EdenAI.",
      "AUSBILDUNG",
      "B.Sc. Computer Science – Hochschule Musterstadt",
    ],
    [
      "UNBEKANNTER ABSCHNITT",
      ...reviewLines,
    ],
  ];
}

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lines of pageLines()) {
    const page = pdf.addPage([595, 842]);
    page.drawText("NORA BEISPIEL · SYNTHETIC CV", { x: 45, y: 805, size: 8, font });
    let y = 775;
    for (const line of lines) {
      page.drawText(line, { x: 45, y, size: line.length > 70 ? 7 : 10, font, maxWidth: 505 });
      y -= 16;
    }
  }
  return Buffer.from(await pdf.save());
}

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/search`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Vite did not start");
}

const pdf = await makePdf();
const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const apiCalls = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiCalls.push(`${request.method()} ${url.pathname}`);
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await page.locator('.cv-import-modal input[type="file"]').setInputFiles({ name: "synthetic-71.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByRole("heading", { name: "Lebenslauf analysiert" }).waitFor();
  if (!(await page.getByText("0 von 71 ausgewählt").count())) throw new Error("safe zero-selected skill state missing");
  if (!(await page.getByText(/keine ausgewählt/).count())) throw new Error("zero-skill warning missing");

  const checkboxes = page.locator('.cv-import-skills__list input[type="checkbox"]');
  const total = await checkboxes.count();
  if (total !== 71) throw new Error(`expected 71 skill checkboxes, got ${total}`);
  await page.getByRole("button", { name: "Alle auswählen" }).click();
  for (let index = 58; index < 71; index += 1) await checkboxes.nth(index).uncheck();
  if (!(await page.getByText("58 von 71 ausgewählt").count())) throw new Error("58 selected count missing");

  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: /In neuem Tab öffnen/ }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("networkidle");
  await popup.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  if (!(await popup.getByText("58 von 71 ausgewählt").count())) throw new Error("skill selection lost across handoff");
  await popup.getByRole("button", { name: "Angaben übernehmen" }).click();
  await popup.getByRole("heading", { name: "Deine Importauswahl" }).waitFor();
  const ack = popup.getByRole("checkbox", { name: /Ich lasse .* ungeprüfte Angaben vorerst aus/ });
  if (await ack.count()) await ack.check();
  await popup.getByRole("button", { name: "Auswahl übernehmen" }).click();
  await popup.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  if (!(await popup.getByText("Importprüfung fortsetzen").count())) throw new Error("review backlog missing in editor");
  const skillsAfterApply = await popup.locator("#cv-builder-skills textarea").inputValue();
  if (skillsAfterApply.split(/[\n,]/).map((value) => value.trim()).filter(Boolean).length !== 58) throw new Error("58 skills were not preserved in editor");
  await popup.getByRole("button", { name: "Änderungen übernehmen & zurück" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  if (!(await page.getByText("Importprüfung fortsetzen").count())) throw new Error("review backlog missing after return");
  const returnedSkills = await page.locator("#cv-builder-skills textarea").inputValue();
  if (returnedSkills.split(/[\n,]/).map((value) => value.trim()).filter(Boolean).length !== 58) throw new Error("skills lost after return");

  if (apiCalls.some((entry) => !entry.startsWith("GET "))) throw new Error(`non-GET API: ${apiCalls.join(", ")}`);
  if (apiCalls.some((entry) => entry.includes("/api/ris/"))) throw new Error(`RIS API: ${apiCalls.join(", ")}`);
  console.log(JSON.stringify({ status: "PASS", totalSkills: total, selected: 58, review: reviewLines.length, backlog: "preserved", return: "preserved", apiCalls }, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
}
