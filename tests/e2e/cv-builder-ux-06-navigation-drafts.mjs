// JM-CV-UX-06 — separate workspace tab close/return and direct-route close.
// Synthetic data only; no private PDF, no upload, no RIS writes.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import playwright from "playwright";

const port = 5233;
const base = `http://localhost:${port}`;
const evidenceDir = "/tmp/opencode/ux-06-e2e";
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

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

async function openEmptyEditor(page) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Vorhandenen Lebenslauf importieren" }).waitFor();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
}

async function openEditorPopup(context, page) {
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: /Editor in neuem Tab öffnen/ }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("networkidle");
  await popup.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  return popup;
}

async function closePrompt(popup) {
  const prompt = popup.getByRole("alertdialog", { name: "CV-Workspace schließen?" });
  await prompt.waitFor();
  return prompt;
}

async function fillFullName(page, value) {
  await page.locator("#cv-builder-personal summary").click();
  await page.getByLabel("Vollständiger Name").fill(value);
}

async function run() {
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "de-DE",
    });
    await context.addInitScript(() => {
      if (!localStorage.getItem("mj-lang")) localStorage.setItem("mj-lang", "de");
    });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const collectErrors = (target) => {
      target.on("pageerror", (error) => pageErrors.push(error.message));
      target.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
    };
    collectErrors(page);
    await mockApi(page);
    await openEmptyEditor(page);

    // 1. Clean X closes the script-opened workspace tab directly.
    const cleanPopup = await openEditorPopup(context, page);
    const cleanClose = cleanPopup.waitForEvent("close");
    await cleanPopup.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
    await cleanClose;
    if (!cleanPopup.isClosed()) throw new Error("clean X did not close the workspace tab");

    // Opening a workspace closes the source modal; re-open a clean source editor.
    await openEmptyEditor(page);

    // 2. Dirty X asks first; cancel preserves data, return transfers and closes.
    const returnPopup = await openEditorPopup(context, page);
    await fillFullName(returnPopup, "Nora UX-06 Return");
    const returnName = returnPopup.getByLabel("Vollständiger Name");
    await returnPopup.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
    let prompt = await closePrompt(returnPopup);
    await prompt.getByRole("button", { name: "Weiter bearbeiten" }).click();
    if ((await returnName.inputValue()) !== "Nora UX-06 Return") {
      throw new Error("cancel of close prompt lost workspace data");
    }
    await returnPopup.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
    prompt = await closePrompt(returnPopup);
    const returnClose = returnPopup.waitForEvent("close");
    await prompt.getByRole("button", { name: "Zum Hauptfenster zurück" }).click();
    await returnClose;
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("input")).some((input) =>
        input instanceof HTMLInputElement && input.value === "Nora UX-06 Return"
      )
    );

    // 3. A refused window.close keeps the tab and shows a manual instruction.
    const blockedPopup = await openEditorPopup(context, page);
    await fillFullName(blockedPopup, "Nora Close Blocked");
    await blockedPopup.evaluate(() => {
      Object.defineProperty(window, "close", { value: () => undefined, configurable: true });
    });
    await blockedPopup.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
    prompt = await closePrompt(blockedPopup);
    await prompt.getByRole("button", { name: "Zum Hauptfenster zurück" }).click();
    await blockedPopup
      .getByText("Rückgabe bestätigt. Der Browser konnte diesen Tab nicht automatisch schließen; bitte schließe ihn manuell.")
      .waitFor();
    if (blockedPopup.isClosed()) throw new Error("close-blocked popup closed unexpectedly");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("input")).some((input) =>
        input instanceof HTMLInputElement && input.value === "Nora Close Blocked"
      )
    );
    await blockedPopup.screenshot({ path: `${evidenceDir}/close-blocked.png`, fullPage: true });
    await blockedPopup.close();

    // 4. Missing main window: return is refused without discarding local data.
    const orphanPopup = await openEditorPopup(context, page);
    await fillFullName(orphanPopup, "Nora Orphan UX-06");
    await page.close();
    await orphanPopup.getByRole("button", { name: "Zum Hauptfenster zurück" }).click();
    await orphanPopup
      .getByText("Das Hauptfenster ist geschlossen. Bearbeite lokal weiter und exportiere die PDF.")
      .waitFor();
    if ((await orphanPopup.getByLabel("Vollständiger Name").inputValue()) !== "Nora Orphan UX-06") {
      throw new Error("missing main window discarded local workspace data");
    }
    await orphanPopup.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
    prompt = await closePrompt(orphanPopup);
    if ((await prompt.getByRole("button", { name: "Zum Hauptfenster zurück" }).count()) !== 0) {
      throw new Error("close prompt offered an impossible return without a main window");
    }
    await prompt.getByRole("button", { name: "Entwurf in Sitzungsliste übernehmen" }).click();
    await orphanPopup.getByRole("heading", { name: "CV-Workspace starten" }).waitFor();
    await orphanPopup.getByRole("button", { name: "Weiter bearbeiten" }).waitFor();
    await orphanPopup.close();

    // 5. Direct workspace: X asks, cancel keeps data, discard explicitly closes.
    const direct = await context.newPage();
    collectErrors(direct);
    await mockApi(direct);
    await direct.goto(`${base}/cv-builder/workspace`, { waitUntil: "networkidle" });
    await direct.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
    await direct.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    await fillFullName(direct, "Nora Direct UX-06");
    await direct.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
    prompt = await closePrompt(direct);
    await prompt.getByRole("button", { name: "Weiter bearbeiten" }).click();
    if ((await direct.getByLabel("Vollständiger Name").inputValue()) !== "Nora Direct UX-06") {
      throw new Error("direct workspace cancel lost data");
    }
    await direct.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
    prompt = await closePrompt(direct);
    await prompt.getByRole("button", { name: "Verwerfen und schließen" }).click();
    await direct.getByRole("heading", { name: "CV-Workspace starten" }).waitFor();
    await direct
      .getByText("Dieser Workspace wurde direkt geöffnet. Der Editor wurde geschlossen; Sitzungsprofile bleiben verfügbar.")
      .waitFor();
    await direct.screenshot({ path: `${evidenceDir}/direct-workspace-closed.png`, fullPage: true });
    await direct.close();

    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
    if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);

    console.log(JSON.stringify({
      status: "PASS",
      cleanClose: "closed",
      dirtyClose: "cancel-preserved; return-transferred; tab-closed",
      closeBlocked: "manual-instruction; data-transferred",
      missingMainWindow: "local-data-preserved; explicit-session-save",
      directWorkspace: "cancel-preserved; explicit-discard",
      pageErrors,
      consoleErrors,
    }, null, 2));
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
