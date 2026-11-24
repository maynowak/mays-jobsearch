// JM-CV-IMPORT-NAVIGATOR-02 — fullpage import radar with synthetic data.
// No private CV, RIS, storage, auth or AI calls.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-IMPORT-NAVIGATOR-02");
const port = 5262;
const base = `http://localhost:${port}`;
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
};

function makePdf(candidateCount) {
  return (async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let y = 805;
    page.drawText("SYNTHETISCHER LEBENSLAUF · RADAR-TEST", { x: 45, y, size: 10, font });
    y -= 22;
    page.drawText("PROFIL", { x: 45, y, size: 10, font });
    y -= 16;
    page.drawText("Cloud Solution Architect · synthetische Testdaten", { x: 45, y, size: 9, font });
    y -= 22;
    page.drawText("UNBEKANNTER ABSCHNITT", { x: 45, y, size: 10, font });
    y -= 18;
    for (let index = 1; index <= candidateCount; index += 1) {
      page.drawText(`Unklare Angabe ${String(index).padStart(2, "0")} · ausschließlich zur Prüfung`, {
        x: 45,
        y,
        size: 9,
        font,
      });
      y -= 15;
      if (y < 45) throw new Error("PDF layout overflow");
    }
    page.drawText("Synthetisch · keine echten CV-Daten", { x: 45, y: 24, size: 8, font });
    return Buffer.from(await pdf.save());
  })();
}

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/search`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
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

async function importPdf(page, pdf) {
  await page.goto(`${base}/cv-builder/workspace`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "PDF importieren" }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await page.locator('.cv-import-workspace input[type="file"]').setInputFiles({
    name: "synthetic-import-navigator-02.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("heading", { name: "Lebenslauf analysiert" }).waitFor({ timeout: 30_000 });
  await page.locator(".cv-import-radar").waitFor();
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function radarSnapshot(page) {
  return page.evaluate(() => {
    const region = document.getElementById("cv-import-workspace");
    const rail = document.querySelector(".cv-import-radar .match-radar__rail");
    const regionTop = region ? region.getBoundingClientRect().top + scrollY : 0;
    const regionHeight = region?.offsetHeight ?? 1;
    const railHeight = rail?.clientHeight ?? 1;
    const usable = railHeight - 28;
    const targetFor = (id) => {
      if (id.startsWith("cv-import-candidate-")) {
        return document.getElementById(`cv-import-review-item-${id.replace("cv-import-candidate-", "")}`);
      }
      if (id === "cv-import-review") return document.getElementById("cv-import-review-title");
      if (id === "cv-import-overview") return document.getElementById("cv-import-overview");
      if (id === "cv-import-decision") return document.getElementById("cv-import-decision-panel");
      return document.getElementById(id);
    };
    const markers = Array.from(document.querySelectorAll(".cv-import-radar [data-radar-marker-id]")).map((node) => {
      const id = node.getAttribute("data-radar-marker-id");
      const target = targetFor(id);
      const rect = target?.getBoundingClientRect();
      return {
        id,
        top: Number.parseFloat(node.style.top),
        expected: rect ? 14 + ((rect.top + scrollY - regionTop) / regionHeight) * usable : null,
        status: node.getAttribute("data-navigator-status"),
        aria: node.getAttribute("aria-label"),
        className: node.className,
      };
    });
    return {
      regionTop,
      regionHeight,
      railHeight,
      markers,
      active: document.querySelector(".cv-import-radar [data-radar-marker-id].is-active")?.getAttribute("data-radar-marker-id") ?? null,
      scrollY,
    };
  });
}

async function run() {
  const pdf = await makePdf(35);
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
    await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await mockApi(page);
    await importPdf(page, pdf);

    const initialY = await page.evaluate(() => scrollY);
    if (initialY !== 0) throw new Error(`preview auto-scrolled on load: ${initialY}`);
    await assertNoOverflow(page, "preview 1440");
    const initial = await radarSnapshot(page);
    if (initial.markers.length < 12) throw new Error(`too few measured markers: ${initial.markers.length}`);
    const candidateMarkers = initial.markers.filter((marker) => marker.id.startsWith("cv-import-candidate-"));
    if (candidateMarkers.length !== 10) throw new Error(`expected 10 visible candidate markers, got ${candidateMarkers.length}`);
    for (const marker of initial.markers) {
      if (marker.expected === null || Math.abs(marker.top - marker.expected) > 2) {
        throw new Error(`marker ${marker.id} position ${marker.top} != ${marker.expected}`);
      }
      if (!marker.aria) throw new Error(`marker ${marker.id} has no aria-label`);
    }
    if (!initial.markers.some((marker) => marker.id === "cv-import-decision")) throw new Error("decision target missing");
    if (!initial.markers.some((marker) => marker.id === "cv-import-review")) throw new Error("review target missing");
    if (!candidateMarkers.some((marker) => marker.status === "pending" && marker.className.includes("--pending"))) {
      throw new Error("pending candidates are not visually marked");
    }
    if (!candidateMarkers.some((marker) => marker.aria.includes("Offen"))) {
      throw new Error("pending status is not conveyed by aria text");
    }
    await page.screenshot({ path: resolve(evidenceDir, "radar-1440.png") });

    await page.locator(".cv-import-radar .match-radar__rail").hover();
    await page.waitForTimeout(250);
    const labels = page.locator(".cv-import-radar .match-radar__label");
    const labelCount = await labels.count();
    if (labelCount < 1 || labelCount > 5) throw new Error(`hover labels ${labelCount}`);
    const labelBoxes = await labels.evaluateAll((nodes) =>
      nodes.map((node) => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height }))
        .sort((a, b) => a.top - b.top)
    );
    for (let index = 1; index < labelBoxes.length; index += 1) {
      if (labelBoxes[index].top < labelBoxes[index - 1].top + labelBoxes[index - 1].height - 1) {
        throw new Error("import radar labels overlap");
      }
    }
    if (!(await labels.evaluateAll((nodes) => nodes.some((node) => /Offen|Prüfen/.test(node.textContent ?? ""))))) {
      throw new Error("hover labels omit status text");
    }
    await page.screenshot({ path: resolve(evidenceDir, "radar-hover-1440.png") });

    const firstReviewItem = page.locator('[data-cv-import-candidate-index="0"]');
    await firstReviewItem.locator("select").selectOption("projects");
    await firstReviewItem.getByRole("button", { name: "Übernehmen", exact: true }).click();
    await page.waitForFunction(() => {
      const marker = document.querySelector('[data-radar-marker-id="cv-import-candidate-0"]');
      return marker?.getAttribute("data-navigator-status") === "completed";
    });
    const completedMarker = page.locator('[data-radar-marker-id="cv-import-candidate-0"]');
    if (!(await completedMarker.getAttribute("class"))?.includes("--completed")) {
      throw new Error("completed candidate marker is not visually marked");
    }
    if (!(await completedMarker.getAttribute("aria-label"))?.includes("Eingeschlossen")) {
      throw new Error("completed candidate status is not conveyed by aria text");
    }
    await page.screenshot({ path: resolve(evidenceDir, "radar-1440-status.png") });

    const keyboardMarker = page.locator('.cv-import-radar [data-radar-marker-id^="cv-import-candidate-"]').nth(1);
    const keyboardId = await keyboardMarker.getAttribute("data-radar-marker-id");
    await keyboardMarker.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    const keyboardActive = await page.evaluate(() =>
      document.querySelector(".cv-import-radar [data-radar-marker-id].is-active")?.getAttribute("data-radar-marker-id") ?? null
    );
    if (keyboardActive !== keyboardId) {
      throw new Error(`keyboard marker navigation ${keyboardId} -> ${keyboardActive}`);
    }

    const decisionMarker = page.locator('[data-radar-marker-id="cv-import-decision"]');
    await decisionMarker.click();
    await page.waitForFunction(() => {
      const panel = document.getElementById("cv-import-decision-panel");
      return Boolean(panel && panel.getBoundingClientRect().top >= 0 && panel.getBoundingClientRect().bottom <= innerHeight);
    }, { timeout: 4000 });
    if ((await page.evaluate(() => document.activeElement?.id)) !== "cv-import-decision-panel") {
      throw new Error("decision target did not receive focus");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(100);
    await assertNoOverflow(page, "mobile 390");
    await page.locator(".cv-import-radar .match-radar__mobile-toggle").click();
    await page.locator(".cv-import-radar .match-radar__panel").waitFor();
    const mobileEntries = await page.locator(".cv-import-radar .match-radar__panel button").count();
    const mobileCandidates = await page.locator('.cv-import-radar [data-navigator-panel-id^="cv-import-candidate-"]').count();
    if (mobileCandidates < 35) throw new Error(`mobile overview candidates ${mobileCandidates}`);
    const focusedTitles = await page.locator(".cv-import-radar .match-radar__panel button").evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean)
    );
    if (!focusedTitles.some((title) => /Prüfkandidat 12/.test(title ?? ""))) {
      throw new Error("mobile overview does not expose candidate 12");
    }
    await page.screenshot({ path: resolve(evidenceDir, "radar-390-panel.png") });
    await page.getByRole("button", { name: /Prüfkandidat 12/ }).click();
    await page.getByText("Seite 2 von").waitFor();
    await page.getByText("Die Navigation hat Prüfseite 2 geöffnet.").waitFor();
    if ((await page.evaluate(() => document.activeElement?.id)) !== "cv-import-review-item-11") {
      throw new Error("hidden candidate did not receive focus after navigation");
    }

    const statusFilter = page.getByLabel("Status");
    await statusFilter.selectOption("accepted");
    await page.locator(".cv-import-radar .match-radar__mobile-toggle").click();
    await page.locator(".cv-import-radar .match-radar__panel").waitFor();
    await page.locator('[data-navigator-panel-id="cv-import-candidate-1"]').click();
    await page.getByText("Die Navigation hat die Prüffilter zurückgesetzt").waitFor();
    if ((await statusFilter.inputValue()) !== "all") throw new Error("navigation did not reset the status filter");
    await page.getByText("Unklare Angabe 02").waitFor();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "📸 Screenshot-Ansicht" }).click();
    if ((await page.locator(".cv-import-radar").count()) !== 0) throw new Error("radar remains mounted in screenshot mode");
    await page.screenshot({ path: resolve(evidenceDir, "radar-1440-screenshot-mode.png") });
    await page.getByRole("button", { name: "Screenshot-Ansicht beenden" }).click();
    await page.locator(".cv-import-radar").waitFor();

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(200);
    await assertNoOverflow(page, "desktop 1920");
    await page.screenshot({ path: resolve(evidenceDir, "radar-1920.png"), fullPage: true });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.waitForTimeout(200);
    await assertNoOverflow(page, "tablet 768");
    await page.screenshot({ path: resolve(evidenceDir, "radar-768.png") });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await page.locator(".cv-import-radar .match-radar__mobile-toggle").click();
    await page.locator(".cv-import-radar .match-radar__panel").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".cv-import-radar .match-radar__panel").waitFor({ state: "detached" });
    const focusReturned = await page.evaluate(() =>
      document.activeElement?.classList.contains("match-radar__mobile-toggle") === true
    );
    if (!focusReturned) throw new Error("mobile Escape did not return focus");
    if (!(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))) {
      throw new Error("reduced motion emulation inactive");
    }

    if (errors.length > 0) throw new Error(`page/console errors: ${errors.slice(0, 3).join(" | ")}`);
    console.log(JSON.stringify({
      status: "PASS",
      markers: initial.markers.length,
      candidateMarkers: candidateMarkers.length,
      mobileEntries,
      mobileCandidates,
      initialY,
      evidenceDir,
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}

await run();
