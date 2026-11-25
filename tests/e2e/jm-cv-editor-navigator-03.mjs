// JM-CV-EDITOR-NAVIGATOR-03 — fullpage editor radar with synthetic data.
// No private CV, RIS, storage, auth or AI calls.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
// JM-CV-EDITOR-EXPANDED-VIEW-UX-01 extends this existing radar E2E with the
// independent expand/collapse view, marker re-measurement and state restore.
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-EDITOR-EXPANDED-VIEW-UX-01");
const port = 5263;
const base = `http://localhost:${port}`;
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
};

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

async function prepare(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const unexpected = [];
  const apiRequests = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) apiRequests.push(`${request.method()} ${path}`);
  });
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    unexpected.push(`${route.request().method()} ${path}`);
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  return { context, page, consoleErrors, pageErrors, unexpected, apiRequests };
}

async function openEditor(page) {
  await page.goto(`${base}/cv-builder/workspace`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator(".cv-editor-radar").waitFor();
}

async function noOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function triggerClear(page, label) {
  const result = await page.evaluate(() => {
    const trigger = document.querySelector(".cv-editor-radar .match-radar__mobile-toggle")?.getBoundingClientRect();
    const card = document.getElementById("cv-builder-editor-region")?.getBoundingClientRect();
    return trigger && card ? { bottom: trigger.bottom, top: card.top } : null;
  });
  if (!result || result.bottom > result.top + 1) {
    throw new Error(`${label}: trigger/card overlap ${JSON.stringify(result)}`);
  }
}

async function panelClearOfHands(page, label) {
  const overlap = await page.evaluate(() => {
    const panel = document.querySelector(".cv-editor-radar .match-radar__panel")?.getBoundingClientRect();
    const hands = document.querySelector(".cv-builder-scroll-hands")?.getBoundingClientRect();
    if (!panel || !hands) return null;
    return !(panel.right <= hands.left || panel.left >= hands.right || panel.bottom <= hands.top || panel.top >= hands.bottom);
  });
  if (overlap !== false) throw new Error(`${label}: panel/hands overlap ${overlap}`);
}

function marker(page, id) {
  return page.locator(`.cv-editor-radar [data-radar-marker-id="${id}"]`);
}

async function sectionStates(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".cv-builder-section"))
      .map((section) => (section instanceof HTMLDetailsElement ? section.open : false))
  );
}

async function assertAllSections(page, expected, label) {
  const states = await sectionStates(page);
  if (states.length < 8) throw new Error(`${label}: only ${states.length} sections`);
  if (!states.every((open) => open === expected)) {
    throw new Error(`${label}: section states ${states.join(",")} != ${expected}`);
  }
}

async function assertMarkerPositions(page, label) {
  const markers = await page.evaluate(() => {
    const region = document.getElementById("cv-builder-editor-region");
    const rail = document.querySelector(".cv-editor-radar .match-radar__rail");
    if (!region || !rail) return [];
    const regionTop = region.getBoundingClientRect().top + scrollY;
    const regionHeight = region.offsetHeight || 1;
    const usable = rail.clientHeight - 28;
    const targetFor = (id) => {
      if (id.startsWith("cv-builder-section-")) {
        return document.getElementById(`cv-builder-${id.replace("cv-builder-section-", "")}`);
      }
      if (id === "cv-builder-validation") return document.getElementById("cv-builder-validation-summary");
      if (id === "cv-builder-actions") return document.getElementById("cv-builder-actions");
      return null;
    };
    return Array.from(document.querySelectorAll(".cv-editor-radar [data-radar-marker-id]")).map((node) => {
      const id = node.getAttribute("data-radar-marker-id");
      const rect = targetFor(id)?.getBoundingClientRect();
      const top = Number.parseFloat(node.style.top);
      const expected = rect ? 14 + ((rect.top + scrollY - regionTop) / regionHeight) * usable : null;
      return { id, top, expected };
    });
  });
  if (markers.length < 9) throw new Error(`${label}: only ${markers.length} markers`);
  for (const entry of markers) {
    if (entry.expected === null || Math.abs(entry.top - entry.expected) > 2) {
      throw new Error(`${label}: marker ${entry.id} ${entry.top} != ${entry.expected}`);
    }
  }
}

async function run() {
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const { context, page, consoleErrors, pageErrors, unexpected, apiRequests } = await prepare(browser, 1440, 1000);
    try {
      await openEditor(page);
      if ((await page.evaluate(() => scrollY)) !== 0) throw new Error("editor auto-scrolled on load");
      await noOverflow(page, "desktop 1440");
      if ((await page.locator(".cv-editor-radar [data-radar-marker-id]").count()) < 9) {
        throw new Error("section/action markers missing");
      }
      if (!(await page.locator(".cv-builder-scroll-hands").count())) throw new Error("turbo hands missing");
      const railRect = await page.locator(".cv-editor-radar .match-radar__rail").evaluate((node) => node.getBoundingClientRect().toJSON());
      const handsRect = await page.locator(".cv-builder-scroll-hands").evaluate((node) => node.getBoundingClientRect().toJSON());
      if (railRect.right > handsRect.left) throw new Error("radar overlaps turbo hands");

      await assertAllSections(page, false, "initial 1440");
      const requestsBeforeLayout = apiRequests.length;
      await page.locator("#cv-builder-personal summary").click();
      const fullName = page.getByLabel("Vollständiger Name");
      await fullName.fill("Synthetic Expanded Editor");
      await page.getByRole("button", { name: "Modern" }).click();
      const previewBefore = await page.locator(".cv-builder-preview-pane").innerText();

      await page.getByRole("button", { name: "Alle Abschnitte aufklappen" }).click();
      await page.waitForTimeout(700);
      await assertAllSections(page, true, "expanded 1440");
      if ((await page.locator(".cv-editor-radar").count()) !== 1) throw new Error("expanded view removed the radar");
      if ((await page.locator(".cv-builder-scroll-hands").count()) !== 1) throw new Error("expanded view removed the turbo hands");
      if (await page.locator(".cv-builder-modal--screenshot").count()) throw new Error("expanding sections entered screenshot mode");
      if ((await page.getByRole("button", { name: "Alle Abschnitte einklappen" }).getAttribute("aria-pressed")) !== "true") {
        throw new Error("expand-all state missing");
      }
      if ((await page.getByRole("button", { name: "Modern" }).getAttribute("aria-pressed")) !== "true") {
        throw new Error("expand-all changed the selected template");
      }
      if ((await fullName.inputValue()) !== "Synthetic Expanded Editor") throw new Error("expand-all lost a form value");
      if ((await page.locator(".cv-builder-preview-pane").innerText()) !== previewBefore) {
        throw new Error("expand-all changed the live preview");
      }
      await assertMarkerPositions(page, "expanded 1440");
      await page.screenshot({ path: resolve(evidenceDir, "expanded-1440.png"), fullPage: true });

      await page.getByRole("button", { name: "Alle Abschnitte einklappen" }).click();
      await page.waitForTimeout(700);
      await assertAllSections(page, false, "collapsed 1440");
      if ((await page.locator(".cv-editor-radar").count()) !== 1) throw new Error("collapse removed the radar");
      if ((await fullName.inputValue()) !== "Synthetic Expanded Editor") throw new Error("collapse lost a form value");
      await assertMarkerPositions(page, "collapsed 1440");
      await page.screenshot({ path: resolve(evidenceDir, "collapsed-1440.png") });
      if (apiRequests.length !== requestsBeforeLayout) {
        throw new Error(`view toggles issued API requests: ${apiRequests.slice(requestsBeforeLayout).join(",")}`);
      }

      // Keyboard navigation must stop a running turbo-hand animation before
      // initiating the radar's own scroll. Scroll-hand ticks use scrollBy;
      // radar navigation uses scrollTo.
      await page.locator(".cv-builder-scroll-hand--down").hover();
      await page.waitForTimeout(500);
      const keyboardSection = await marker(page, "cv-builder-section-skills");
      await keyboardSection.focus();
      await page.evaluate(() => {
        window.__radarScrollByCount = 0;
        const original = window.scrollBy.bind(window);
        window.scrollBy = (...args) => {
          window.__radarScrollByCount += 1;
          return original(...args);
        };
      });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(350);
      const scrollByDuringRadar = await page.evaluate(() => window.__radarScrollByCount);
      if (scrollByDuringRadar !== 0) throw new Error(`turbo hands kept scrolling during radar navigation: ${scrollByDuringRadar}`);
      const keyboardActive = await page.locator('.cv-editor-radar [data-radar-marker-id].is-active').getAttribute("data-radar-marker-id");
      if (keyboardActive !== "cv-builder-section-skills") throw new Error(`keyboard active marker ${keyboardActive}`);
      await page.waitForTimeout(1_000);

      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(100);
      await page.locator(".cv-editor-radar .match-radar__rail").hover();
      await page.waitForTimeout(250);
      const labels = await page.locator(".cv-editor-radar .match-radar__label").count();
      if (labels < 1 || labels > 5) throw new Error(`hover labels ${labels}`);
      const labelBoxes = await page.locator(".cv-editor-radar .match-radar__label").evaluateAll((nodes) =>
        nodes.map((node) => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height })).sort((a, b) => a.top - b.top)
      );
      for (let index = 1; index < labelBoxes.length; index += 1) {
        if (labelBoxes[index].top < labelBoxes[index - 1].top + labelBoxes[index - 1].height - 1) {
          throw new Error("editor radar labels overlap");
        }
      }
      await page.screenshot({ path: resolve(evidenceDir, "radar-1440.png") });

      const activeBeforeWheel = await page.locator(".cv-editor-radar [data-radar-marker-id].is-active").getAttribute("data-radar-marker-id");
      await page.mouse.move(700, 500);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(500);
      const activeAfterWheel = await page.locator(".cv-editor-radar [data-radar-marker-id].is-active").getAttribute("data-radar-marker-id");
      if (!activeAfterWheel || activeAfterWheel === activeBeforeWheel) {
        throw new Error(`scroll active marker did not update: ${activeBeforeWheel} -> ${activeAfterWheel}`);
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(100);

      const experience = await marker(page, "cv-builder-section-experience");
      await experience.click();
      await page.waitForTimeout(500);
      if ((await page.locator("#cv-builder-experience details").getAttribute("open")) === null) {
        throw new Error("collapsed experience section did not open");
      }
      if ((await page.locator('.cv-editor-radar [data-radar-marker-id="cv-builder-section-experience"].is-active').count()) !== 1) {
        throw new Error("clicked section marker is not active");
      }

      await (await marker(page, "cv-builder-section-personal")).click();
      await page.locator("#cv-builder-personal details").waitFor();
      const email = page.getByLabel("E-Mail");
      await email.fill("invalid");
      await page.waitForFunction(() =>
        document.querySelector('.cv-editor-radar [data-radar-marker-id="cv-builder-section-personal"]')?.getAttribute("data-navigator-kind") === "error"
      );
      if (!(await marker(page, "cv-builder-validation").count())) throw new Error("validation marker missing");
      const personalMarker = await marker(page, "cv-builder-section-personal");
      if (!(await personalMarker.getAttribute("aria-label"))?.includes("1 Fehler")) throw new Error("error count missing from aria");
      if ((await page.locator('.cv-editor-radar [data-radar-marker-id="cv-builder-actions"]').getAttribute("data-navigator-status")) !== "warning") {
        throw new Error("actions are not marked blocked");
      }
      await page.screenshot({ path: resolve(evidenceDir, "radar-error-1440.png") });

      await page.getByRole("button", { name: "Alle Abschnitte aufklappen" }).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Alle Abschnitte einklappen" }).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Zum ersten Fehler" }).click();
      await page.waitForFunction(() =>
        document.querySelector("#cv-builder-personal details")?.hasAttribute("open") === true
      );
      await page.waitForFunction(() =>
        document.activeElement?.id === "cv-builder-field-personal-email"
      );

      await personalMarker.click();
      await page.waitForTimeout(500);
      const focusedField = await page.evaluate(() => document.activeElement?.id);
      if (focusedField !== "cv-builder-field-personal-email") throw new Error(`error field focus ${focusedField}`);
      if (!(await email.getAttribute("class"))?.includes("cv-builder-field--radar-highlight")) {
        throw new Error("error field not highlighted");
      }
      await page.screenshot({ path: resolve(evidenceDir, "radar-error-focus-1440.png") });

      await email.fill("valid@example.invalid");
      await page.waitForFunction(() => document.querySelector('.cv-editor-radar [data-radar-marker-id="cv-builder-validation"]') === null);
      if ((await marker(page, "cv-builder-section-personal").getAttribute("data-navigator-status")) !== "normal") {
        throw new Error("section error status did not clear");
      }
      if ((await page.locator('.cv-editor-radar [data-radar-marker-id="cv-builder-actions"]').getAttribute("data-navigator-status")) !== "completed") {
        throw new Error("actions did not become ready");
      }

      await page.getByRole("button", { name: "Alle Abschnitte aufklappen" }).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Ansicht wechseln" }).click();
      if ((await page.locator(".cv-editor-radar").count()) !== 0) throw new Error("radar remains in screenshot mode");
      if ((await page.locator(".cv-builder-scroll-hands").count()) !== 0) throw new Error("hands remain in screenshot mode");
      await assertAllSections(page, true, "screenshot expanded 1440");
      await page.screenshot({ path: resolve(evidenceDir, "radar-1440-screenshot-mode.png") });
      await page.getByRole("button", { name: "Ansicht wechseln" }).click();
      await page.locator(".cv-editor-radar").waitFor();
      await assertAllSections(page, true, "after screenshot expanded 1440");

      await page.getByRole("button", { name: "Alle Abschnitte einklappen" }).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Ansicht wechseln" }).click();
      await assertAllSections(page, true, "screenshot collapsed 1440");
      await page.getByRole("button", { name: "Ansicht wechseln" }).click();
      await page.locator(".cv-editor-radar").waitFor();
      await assertAllSections(page, false, "after screenshot collapsed 1440");

      await page.getByRole("button", { name: "⛶ Breite maximieren" }).click();
      await page.waitForTimeout(100);
      await noOverflow(page, "wide 1440");
      if ((await page.locator(".cv-editor-radar").count()) !== 1) throw new Error("radar missing in wide mode");
      await page.getByRole("button", { name: "↔ Normalbreite" }).click();

      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(150);
      await noOverflow(page, "desktop 1920");
      await page.screenshot({ path: resolve(evidenceDir, "radar-1920.png"), fullPage: true });

      await page.setViewportSize({ width: 768, height: 900 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(150);
      await noOverflow(page, "tablet 768");
      await triggerClear(page, "tablet 768");
      await page.locator(".cv-editor-radar .match-radar__mobile-toggle").click();
      await page.locator(".cv-editor-radar .match-radar__panel").waitFor();
      await panelClearOfHands(page, "tablet 768 panel");
      await page.screenshot({ path: resolve(evidenceDir, "radar-768-panel.png") });
      await page.keyboard.press("Escape");
      await page.locator(".cv-editor-radar .match-radar__panel").waitFor({ state: "detached" });
      await page.screenshot({ path: resolve(evidenceDir, "radar-768.png") });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(150);
      await noOverflow(page, "mobile 390");
      await triggerClear(page, "mobile 390");
      await page.locator(".cv-editor-radar .match-radar__mobile-toggle").click();
      await page.locator(".cv-editor-radar .match-radar__panel").waitFor();
      await panelClearOfHands(page, "mobile 390 panel");
      const sectionEntries = await page.locator('.cv-editor-radar [data-navigator-panel-id^="cv-builder-section-"]').count();
      if (sectionEntries !== 8) throw new Error(`mobile section entries ${sectionEntries}`);
      if (!(await page.locator('[data-navigator-panel-id="cv-builder-actions"]').count())) throw new Error("mobile action entry missing");
      await page.screenshot({ path: resolve(evidenceDir, "radar-390-panel.png") });
      await page.locator('[data-navigator-panel-id="cv-builder-section-personal"]').click();
      await page.waitForFunction(() => document.querySelector(".cv-builder-workspace")?.getAttribute("data-view") === "edit");

      await page.getByRole("button", { name: "Vorschau" }).click();
      await page.locator(".cv-editor-radar .match-radar__mobile-toggle").click();
      await page.locator('.cv-editor-radar [data-navigator-panel-id="cv-builder-section-skills"]').click();
      await page.waitForFunction(() => document.querySelector(".cv-builder-workspace")?.getAttribute("data-view") === "edit");
      await page.locator(".cv-editor-radar .match-radar__mobile-toggle").click();
      await page.keyboard.press("Escape");
      await page.locator(".cv-editor-radar .match-radar__panel").waitFor({ state: "detached" });
      const focusReturned = await page.evaluate(() =>
        document.activeElement?.classList.contains("match-radar__mobile-toggle") === true
      );
      if (!focusReturned) throw new Error("mobile Escape focus did not return");

      await page.evaluate(() => scrollTo(0, 0));
      await page.getByRole("button", { name: "Alle Abschnitte aufklappen" }).click();
      await page.waitForTimeout(500);
      await assertAllSections(page, true, "expanded 390");
      await noOverflow(page, "expanded 390");
      await page.screenshot({ path: resolve(evidenceDir, "expanded-390.png"), fullPage: true });
      await page.getByRole("button", { name: "Ansicht wechseln" }).click();
      if ((await page.locator(".cv-editor-radar").count()) !== 0) throw new Error("radar remains in mobile screenshot mode");
      await assertAllSections(page, true, "screenshot 390");
      await page.screenshot({ path: resolve(evidenceDir, "screenshot-mode-390.png") });
      await page.getByRole("button", { name: "Ansicht wechseln" }).click();
      await page.locator(".cv-editor-radar").waitFor();
      await assertAllSections(page, true, "after screenshot 390");

      await page.emulateMedia({ reducedMotion: "reduce" });
      if (!(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))) {
        throw new Error("reduced motion inactive");
      }

      if (consoleErrors.length || pageErrors.length) {
        throw new Error(`browser errors ${JSON.stringify({ consoleErrors, pageErrors })}`);
      }
      if (unexpected.length) throw new Error(`unexpected API ${JSON.stringify(unexpected)}`);
      console.log(JSON.stringify({
        status: "PASS",
        labels,
        sectionEntries,
        apiRequests: [...new Set(apiRequests)],
        evidenceDir,
      }, null, 2));
    } finally {
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
}

await run();
