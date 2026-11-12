// CV-BUILDER-03A — full-page workspace, tab handoff and screenshot view.
// Synthetic data only; no private PDF, no upload, no RIS writes.

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import playwright from "playwright";

const port = 5231;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/03a-e2e";
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};
const lines = [
  ["NORA BEISPIEL", "nora.beispiel@example.invalid", "+49 170 1234567", "Berlin", "PROFIL", "Cloud Solution Architect", "Entwickelt sichere Cloud-Plattformen und eventgetriebene Systeme.", "ARCHITECTURE & CLOUD", "AWS, Azure, Terraform, Kubernetes", "SOFTWARE ARCHITECTURE", "Event-driven Architecture, API Design, Microservices", "TECHNICAL SKILLS", "Java, Spring Boot, TypeScript, PostgreSQL", "TECHNOLOGIES", "Docker, GitHub Actions, Linux"],
  ["AKTUELLE PROJEKTE", "2026 – Projekt Cloud", "AWS-based platform: registry, discovery and asynchronous work processing.", "Cognito, Lambda, SQS, Terraform.", "2025 – Projekt Web", "Browser-based matching frontend.", "React, TypeScript, Vercel.", "2024 – Projekt AI", "LLM integration and application generation.", "OpenRouter, EdenAI.", "WEITERBILDUNG & ZERTIFIKATSSTATUS", "AWS Solutions Architect – in preparation", "Azure Fundamentals – planned", "UNBEKANNTER ABSCHNITT", "Diese synthetische Angabe bleibt zur Prüfung."],
  ["BERUFLICHER WERDEGANG", "2020–2024 | Solution Architect | Acme GmbH", "Entwickelt sichere Cloud-Plattformen und eventgetriebene Systeme.", "2018–2020 | Software Engineer | Beta AG", "Backend-Entwicklung.", "AUSBILDUNG", "Bachelor of Science (B.Sc.) – Computer Science", "Hochschule Musterstadt", "Industrial Mechanic – Vocational Qualification", "Completed vocational training.", "PROFESSIONAL DEVELOPMENT", "2026 | Cloud Training", "AWS, Terraform and Docker exercises."],
];

async function makePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < lines.length; index += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`NORA BEISPIEL | CLOUD ARCHITECT | Seite ${index + 1}`, { x: 45, y: 805, size: 8, font });
    let y = 775;
    for (const line of lines[index]) {
      page.drawText(line, { x: 45, y, size: 10, font, maxWidth: 505 });
      y -= 16;
    }
    page.drawText("Vertraulich – nur für Bewerbungszwecke", { x: 45, y: 28, size: 8, font });
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

async function mockApi(page) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

async function importPreview(page, pdf, selector = ".cv-import-modal") {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await page.locator(`${selector} input[type="file"]`).setInputFiles({
    name: "synthetic-03a.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("heading", { name: "Lebenslauf analysiert" }).waitFor();
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function run() {
  const pdf = await makePdf();
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE", acceptDownloads: true });
    await context.addInitScript(() => { if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de"); });
    const page = await context.newPage();
    const apiCalls = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/")) apiCalls.push(`${request.method()} ${url.pathname}`);
    });
    await mockApi(page);
    await importPreview(page, pdf);
    const sourceSkillCount = await page.locator(".cv-import-skills__count").innerText();
    await page.locator('.cv-import-skills__list input[type="checkbox"]').first().uncheck();
    const selectedSkillCount = await page.locator(".cv-import-skills__count").innerText();

    const popupPromise = context.waitForEvent("page");
    await page.getByRole("button", { name: /In neuem Tab öffnen/ }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("networkidle");
    await popup.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
    if ((await popup.locator(".cv-import-workspace").count()) !== 1) throw new Error("full-page import layout missing");
    if ((await popup.locator(".modal.cv-import-modal").count()) !== 0) throw new Error("import is still a modal");
    if ((await page.locator(".cv-import-modal").count()) !== 0) throw new Error("source dialog closed before acceptance");
    if ((await popup.locator(".cv-import-skills__count").innerText()) !== selectedSkillCount) {
      throw new Error("skill selection was not preserved in new tab");
    }
    if (sourceSkillCount === selectedSkillCount) throw new Error("skill fixture did not change selection");

    await popup.getByRole("button", { name: "Angaben übernehmen" }).click();
    await popup.getByRole("heading", { name: "Deine Importauswahl" }).waitFor();
    const acknowledge = popup.getByRole("checkbox", { name: /Ich lasse .* ungeprüfte Angaben vorerst aus/ });
    if (await acknowledge.count()) await acknowledge.check();
    await popup.getByRole("button", { name: "Auswahl übernehmen" }).click();
    await popup.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    if ((await popup.locator(".cv-builder-fullpage").count()) !== 1) throw new Error("full-page editor missing");
    if ((await popup.locator(".modal.cv-builder-modal").count()) !== 0) throw new Error("editor is still a modal");
    if ((await popup.evaluate(() => getComputedStyle(document.body).overflow)) === "hidden") {
      throw new Error("body scroll is locked in workspace");
    }
    await popup.locator("#cv-builder-personal summary").click();
    const nameField = popup.getByLabel("Vollständiger Name");
    await nameField.fill("Nora Beispiel 03A");
    const beforeScreenshot = await nameField.inputValue();
    const beforeOpen = await popup.locator(".cv-builder-section[open]").count();
    await popup.getByRole("button", { name: /Screenshot-Ansicht/ }).click();
    const afterOpen = await popup.locator(".cv-builder-section[open]").count();
    if (afterOpen <= beforeOpen) throw new Error("screenshot mode did not expand all sections");

    const viewportResults = [];
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await popup.setViewportSize({ width, height: 900 });
      await popup.waitForTimeout(150);
      await assertNoOverflow(popup, `screenshot ${width}px`);
      const metrics = await popup.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight,
        editorOverflow: getComputedStyle(document.querySelector(".cv-builder-editor-pane")).overflowY,
        previewOverflow: getComputedStyle(document.querySelector(".cv-builder-preview-pane")).overflowY,
      }));
      if (metrics.scrollHeight <= metrics.innerHeight) throw new Error(`page not scrollable at ${width}px`);
      if (metrics.editorOverflow !== "visible" || metrics.previewOverflow !== "visible") {
        throw new Error(`inner scroll remains at ${width}px: ${JSON.stringify(metrics)}`);
      }
      viewportResults.push({ width, ...metrics });
    }
    await popup.setViewportSize({ width: 1440, height: 900 });
    await popup.screenshot({ path: `${evidenceDir}/workspace-1440-fullpage.png`, fullPage: true });
    const screenshotStat = await stat(`${evidenceDir}/workspace-1440-fullpage.png`);
    if (screenshotStat.size <= 0) throw new Error("full-page screenshot missing");
    await popup.getByRole("button", { name: /Screenshot-Ansicht beenden/ }).click();
    if ((await nameField.inputValue()) !== beforeScreenshot) throw new Error("screenshot mode changed CV data");
    if ((await popup.locator(".cv-builder-section[open]").count()) !== beforeOpen) throw new Error("section state was not restored");

    await popup.getByRole("button", { name: "Lebenslauf speichern" }).click();
    await popup.getByText("In dieser Sitzung gespeichert", { exact: true }).waitFor();
    await popup.getByRole("button", { name: "Änderungen übernehmen & zurück" }).click();
    await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    if ((await page.getByLabel("Vollständiger Name").inputValue()) !== "Nora Beispiel 03A") {
      throw new Error("workspace return did not reach the source editor");
    }

    const editorPopupPromise = context.waitForEvent("page");
    await page.getByRole("button", { name: /Editor in neuem Tab öffnen/ }).click();
    const editorPopup = await editorPopupPromise;
    await editorPopup.waitForLoadState("networkidle");
    await editorPopup.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    await editorPopup.locator("#cv-builder-personal summary").click();
    if ((await editorPopup.getByLabel("Vollständiger Name").inputValue()) !== "Nora Beispiel 03A") {
      throw new Error("editor handoff did not copy the profile");
    }
    await editorPopup.getByLabel("Vollständiger Name").fill("Nora Beispiel 03A Tab");
    await editorPopup.getByRole("button", { name: "Lebenslauf speichern" }).click();
    await editorPopup.getByText("In dieser Sitzung gespeichert", { exact: true }).waitFor();
    await editorPopup.getByRole("button", { name: "Änderungen übernehmen & zurück" }).click();
    await page.waitForFunction(() => document.body.innerText.includes("Nora Beispiel 03A Tab"));
    await page.locator("#cv-builder-personal summary").click();
    if ((await page.getByLabel("Vollständiger Name").inputValue()) !== "Nora Beispiel 03A Tab") {
      throw new Error("editor handoff return did not update the source form");
    }

    // The editor workspace still has baseVersion 1. After the source was
    // updated to version 2, a second return must be rejected, not overwrite.
    await editorPopup.getByLabel("Vollständiger Name").fill("Nora Conflict Attempt");
    await editorPopup.getByRole("button", { name: "Änderungen übernehmen & zurück" }).click();
    await editorPopup.getByText("Der Lebenslauf wurde im Hauptfenster geändert. Die Workspace-Änderungen wurden nicht übernommen. Prüfe die Versionen vor dem erneuten Speichern.").waitFor();
    if ((await page.getByLabel("Vollständiger Name").inputValue()) !== "Nora Beispiel 03A Tab") {
      throw new Error("stale editor return overwrote the source profile");
    }

    const direct = await context.newPage();
    await direct.goto(`${base}/cv-builder/workspace`, { waitUntil: "networkidle" });
    await direct.getByRole("heading", { name: "CV-Workspace starten" }).waitFor();
    if ((await direct.locator(".modal.cv-builder-modal").count()) !== 0) throw new Error("direct route is modal");
    await assertNoOverflow(direct, "direct 1440px");
    await direct.getByRole("button", { name: "EN", exact: true }).click();
    await direct.getByRole("heading", { name: "Start a CV workspace" }).waitFor();
    if ((await direct.evaluate(() => document.documentElement.lang)) !== "en") throw new Error("workspace EN missing");

    const blocked = await context.newPage();
    await blocked.addInitScript(() => localStorage.setItem("mj-lang", "de"));
    await mockApi(blocked);
    await importPreview(blocked, pdf);
    await blocked.locator('.cv-import-skills__list input[type="checkbox"]').first().uncheck();
    const blockedSkillCount = await blocked.locator(".cv-import-skills__count").innerText();
    await blocked.evaluate(() => { window.open = () => null; });
    await blocked.getByRole("button", { name: /In neuem Tab öffnen/ }).click();
    await blocked.getByText("Der Browser hat den neuen Tab blockiert. Erlaube Pop-ups und versuche es erneut.").waitFor();
    if ((await blocked.locator(".cv-import-modal").count()) !== 1) throw new Error("blocked handoff lost the import review");
    if ((await blocked.locator(".cv-import-skills__count").innerText()) !== blockedSkillCount) throw new Error("blocked handoff lost skill selection");

    const timeoutPage = await context.newPage();
    await timeoutPage.addInitScript(() => localStorage.setItem("mj-lang", "de"));
    await mockApi(timeoutPage);
    await importPreview(timeoutPage, pdf);
    await timeoutPage.evaluate(() => {
      const original = window.open.bind(window);
      window.open = (url, target, features) => original("/__workspace_never_ready__", target, features);
    });
    await timeoutPage.getByRole("button", { name: /In neuem Tab öffnen/ }).click();
    await timeoutPage.getByText("Der neue Tab hat die Übergabe nicht bestätigt. Deine Importprüfung bleibt verfügbar.").waitFor({ timeout: 25000 });
    if ((await timeoutPage.locator(".cv-import-modal").count()) !== 1) throw new Error("timed-out handoff lost the import review");
    await timeoutPage.close();

    const closing = await context.newPage();
    await closing.addInitScript(() => localStorage.setItem("mj-lang", "de"));
    await mockApi(closing);
    await importPreview(closing, pdf);
    const closingPopupPromise = context.waitForEvent("page");
    await closing.getByRole("button", { name: /In neuem Tab öffnen/ }).click();
    const closingPopup = await closingPopupPromise;
    await closingPopup.close();
    await closing.waitForTimeout(1200);
    if ((await closing.locator(".cv-import-modal").count()) !== 1) throw new Error("closed handoff lost the import review");
    await blocked.close();
    await closing.close();

    const orphanPopupPromise = context.waitForEvent("page");
    await page.getByRole("button", { name: /Editor in neuem Tab öffnen/ }).click();
    const orphanPopup = await orphanPopupPromise;
    await orphanPopup.waitForLoadState("networkidle");
    await orphanPopup.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    const orphanName = await orphanPopup.getByLabel("Vollständiger Name").inputValue();
    await page.close();
    await orphanPopup.getByRole("button", { name: "Änderungen übernehmen & zurück" }).click();
    await orphanPopup.getByText("Das Hauptfenster ist geschlossen. Bearbeite lokal weiter und exportiere die PDF.").waitFor();
    if ((await orphanPopup.getByLabel("Vollständiger Name").inputValue()) !== orphanName) throw new Error("closed source changed local workspace data");

    if (apiCalls.some((entry) => !entry.startsWith("GET "))) throw new Error(`non-GET API: ${apiCalls.join(", ")}`);
    if (apiCalls.some((entry) => entry.includes("/api/ris/"))) throw new Error(`RIS API call: ${apiCalls.join(", ")}`);

    const result = {
      status: "PASS",
      handoff: { sourceSkillCount, selectedSkillCount, popupSkillCount: selectedSkillCount },
      screenshot: { beforeOpen, afterOpen, viewportResults, screenshotBytes: screenshotStat.size },
      return: "PASS",
      conflict: "PASS",
      editorHandoff: "PASS",
      directRoute: "PASS",
      popupBlocker: "PASS",
      timeoutHandoff: "review-preserved",
      closedHandoff: "review-preserved",
      closedSource: "local-data-preserved",
      apiCalls,
    };
    console.log(JSON.stringify(result, null, 2));
    await context.close();
  } finally {
    if (browser) await browser.close();
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
