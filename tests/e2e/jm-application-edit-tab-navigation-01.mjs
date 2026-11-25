// JM-APPLICATION-EDIT-TAB-NAVIGATION-01 — synthetic remote repository E2E.
// All RIS BFF responses are mocked; no real RIS, AI or user data is accessed.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "playwright";

const port = 5264;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const models = { models: [{ id: "mock-model", name: "Mock Model" }], defaultModel: "mock-model", recommendedModel: null, fallbackModel: null };
const now = "2026-11-25T10:00:00.000Z";

function appFixture(id, title) {
  return {
    schemaVersion: 1,
    applicationId: id,
    ownerId: "synthetic-editor-tab-user",
    job: {
      jobId: `manual:${id}`,
      title,
      companyName: "OpenCode Synthetic QA",
      location: [],
      source: ["manual"],
      originalUrl: "",
      jobOrigin: "manual",
    },
    documents: {
      coverLetterDraft: "Vorhandenes synthetisches Anschreiben.",
      coverLetterVersions: [{
        versionId: `version-${id}`,
        jobId: `manual:${id}`,
        createdAt: now,
        content: "Synthetische ältere Version — unverändert.",
        source: "manual",
      }],
      documentStatus: "draft",
    },
    status: "draft",
    statusHistory: [{ at: now, from: null, to: "draft" }],
    history: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    applicationChannel: "email",
    applicationDate: "2026-11-20T00:00:00.000Z",
    contact: { name: "Synthetic Contact", email: "contact@example.invalid", phone: "+49 30 000000" },
    notes: "Bestehende synthetische Notiz.",
    salary: { expectation: { amount: 50000, currency: "EUR", period: "year" }, offer: null },
  };
}

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, VITE_RIS_APPLICATION_STORAGE_ENABLED: "true" },
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${base}/profil?tab=applications`)).ok) return;
    } catch { /* retry */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Vite did not start");
}

async function noOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${label}: overflow ${overflow}px`);
}

async function runEditLayout(browser) {
  const widths = [320, 390, 768, 900, 1024, 1440, 1920];
  const results = [];
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width <= 430 ? 844 : 1000 },
      locale: "de-DE",
    });
    await context.addInitScript(({ userKey, future }) => {
      localStorage.setItem("mj-lang", "de");
      sessionStorage.setItem(userKey, JSON.stringify({
        id_token: "synthetic-id-token",
        session_state: null,
        access_token: "synthetic-access-token",
        refresh_token: null,
        token_type: "Bearer",
        scope: "openid email profile",
        profile: {
          iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
          sub: "synthetic-editor-tab-user",
          email: "editor-tab@example.invalid",
          name: "Synthetic Editor Tab",
        },
        expires_at: future,
      }));
    }, { userKey: USER_KEY, future });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !/status of 409/.test(message.text())) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/models") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
      if (path === "/api/ris/consents") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ consent: null }) });
      if (path === "/api/ris/applications" && request.method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [appFixture("synthetic-layout-form", "Synthetic Layout Form")], nextCursor: null }) });
      }
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    });
    try {
      await page.goto(`${base}/profil?tab=applications`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Synthetic Layout Form/ }).first().click();
      await page.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }).click();
      const form = page.getByRole("form", { name: "Bewerbungsdaten bearbeiten" });
      await form.waitFor();
      const formState = await page.evaluate(() => {
        const box = (element) => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
        };
        const formElement = document.querySelector('form[aria-label="Bewerbungsdaten bearbeiten"]');
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          form: box(formElement),
          firstField: box(formElement?.querySelector("input, select, textarea")),
        };
      });
      if (formState.overflow > 0) throw new Error(`${width}: horizontal overflow ${formState.overflow}px in the edit form`);
      if (!formState.form || formState.form.left < 0 || formState.form.right > width) {
        throw new Error(`${width}: edit form is clipped (${JSON.stringify(formState.form)})`);
      }
      if (!formState.firstField || formState.firstField.width < 40) {
        throw new Error(`${width}: edit field is not usable (${JSON.stringify(formState.firstField)})`);
      }

      await page.getByLabel("Persönliche Notizen").fill(`Layout ${width}`);
      await page.getByRole("tab", { name: "Verlauf" }).click();
      const dialog = page.getByRole("alertdialog", { name: "Ungespeicherte Änderungen" });
      await dialog.waitFor();
      const dialogState = await page.evaluate(() => {
        const element = document.querySelector('[role="alertdialog"]');
        const rect = element?.getBoundingClientRect();
        return rect ? { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) } : null;
      });
      if (!dialogState || dialogState.left < 0 || dialogState.right > width) {
        throw new Error(`${width}: unsaved-edit dialog is clipped (${JSON.stringify(dialogState)})`);
      }
      await dialog.getByRole("button", { name: "Weiter bearbeiten" }).click();
      if (errors.length) throw new Error(`${width}: console errors ${errors.join(" | ")}`);
      results.push({ width, form: formState.form, firstField: formState.firstField, dialog: dialogState, overflow: formState.overflow });
    } finally {
      await context.close();
    }
  }
  return results;
}

async function run(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  try {
    await context.addInitScript(({ userKey, future }) => {
      localStorage.setItem("mj-lang", "de");
      sessionStorage.setItem(userKey, JSON.stringify({
        id_token: "synthetic-id-token",
        session_state: null,
        access_token: "synthetic-access-token",
        refresh_token: null,
        token_type: "Bearer",
        scope: "openid email profile",
        profile: {
          iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
          sub: "synthetic-editor-tab-user",
          email: "editor-tab@example.invalid",
          name: "Synthetic Editor Tab",
        },
        expires_at: future,
      }));
    }, { userKey: USER_KEY, future });
    const page = await context.newPage();
    const assetsDir = resolve(process.cwd(), "docs/reports/assets/JM-APPLICATION-EDIT-TAB-NAVIGATION-01");
    await mkdir(assetsDir, { recursive: true });
    const appA = appFixture("synthetic-app-a", "Synthetic Application A");
    const appB = appFixture("synthetic-app-b", "Synthetic Application B");
    let applications = [appA, appB];
    const serverAppA = () => applications.find((application) => application.applicationId === "synthetic-app-a");
    let failNextUpdate = false;
    const calls = [];
    const aiCalls = [];
    const consoleErrors = [];
    const pageErrors = [];
    // The intentional 409 (save failure) and 503 (capability probe) responses
    // are asserted through the UI; Chromium logs them as resource errors.
    const expectedResourceError = (text) =>
      /Failed to load resource: the server responded with a status of (409|503)/.test(text);
    page.on("console", (message) => {
      if (message.type() === "error" && !expectedResourceError(message.text())) consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      calls.push(`${method} ${path}`);
      if (["/api/profile", "/api/match", "/api/cover-letter", "/api/ats-analysis"].includes(path)) {
        aiCalls.push(`${method} ${path}`);
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      if (path === "/api/models") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
      if (path === "/api/ris/consents") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ consent: null }) });
      if (path === "/api/ris/applications" && method === "GET") {
        const id = url.searchParams.get("id");
        if (id) {
          const found = applications.find((application) => application.applicationId === id);
          return route.fulfill({
            status: found ? 200 : 404,
            contentType: "application/json",
            body: JSON.stringify(found ? { application: found } : { error: "not found", code: "not_found" }),
          });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: applications, nextCursor: null }) });
      }
      if (path === "/api/ris/applications" && method === "PATCH") {
        const id = url.searchParams.get("id");
        const body = request.postDataJSON();
        const current = applications.find((application) => application.applicationId === id);
        if (!current) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found", code: "not_found" }) });
        if (failNextUpdate) {
          failNextUpdate = false;
          return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "synthetic version conflict", code: "version_conflict" }) });
        }
        if (body.expectedVersion !== current.version) {
          return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "synthetic version conflict", code: "version_conflict" }) });
        }
        const { expectedVersion: _expectedVersion, ...changes } = body;
        const updated = {
          ...current,
          ...changes,
          updatedAt: new Date().toISOString(),
          version: current.version + 1,
          documents: { ...current.documents, ...(changes.documents ?? {}) },
        };
        if (changes.coverLetterDraft !== undefined) {
          updated.documents = {
            ...current.documents,
            coverLetterDraft: changes.coverLetterDraft,
            documentStatus: changes.documentStatus,
          };
        }
        applications = applications.map((application) => application.applicationId === id ? updated : application);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ application: updated }) });
      }
      calls.pop();
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked", code: "not_mocked" }) });
    });

    await page.goto(`${base}/profil?tab=applications`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Synthetic Application A/ }).waitFor();
    await page.getByRole("button", { name: /Synthetic Application A/ }).click();

    // Unchanged edit closes without a warning.
    await page.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }).click();
    await page.getByRole("form", { name: "Bewerbungsdaten bearbeiten" }).waitFor();
    await page.getByRole("tab", { name: "Dokumente" }).click();
    await page.getByRole("tabpanel", { name: "Dokumente" }).waitFor();
    if (await page.getByRole("alertdialog").count()) throw new Error("unchanged edit triggered warning");

    // Dirty edit: save before switching; a failed save preserves the data/dialog.
    await page.getByRole("tab", { name: "Übersicht" }).click();
    await page.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }).click();
    await page.getByLabel("Persönliche Notizen").fill("Geänderte synthetische Notiz.");
    await page.getByRole("tab", { name: "Kommunikation" }).click();
    await page.getByRole("alertdialog", { name: "Ungespeicherte Änderungen" }).waitFor();
    await page.screenshot({ path: resolve(assetsDir, "edit-unsaved-dialog-1440.png") });
    await noOverflow(page, "unsaved dialog 1440");
    failNextUpdate = true;
    await page.getByRole("button", { name: "Speichern und wechseln" }).click();
    await page.getByText("Die Bewerbung wurde zwischenzeitlich geändert.").waitFor();
    if (await page.getByRole("alertdialog").count() !== 1) throw new Error("failed save dismissed decision dialog");
    if (await page.getByLabel("Persönliche Notizen").inputValue() !== "Geänderte synthetische Notiz.") throw new Error("failed save lost edit text");
    await page.getByRole("button", { name: "Speichern und wechseln" }).click();
    await page.getByRole("tab", { name: "Kommunikation" }).waitFor();
    if (serverAppA().notes !== "Geänderte synthetische Notiz.") throw new Error("successful save did not persist before tab switch");

    // Own letter save, version preservation, reload, and edit.
    await page.getByRole("tab", { name: "Dokumente" }).click();
    const ownLetter = page.getByRole("region", { name: "Eigenes Anschreiben" });
    await ownLetter.waitFor();
    await ownLetter.getByRole("button", { name: "Eigenes Anschreiben bearbeiten" }).click();
    const ownText = "Eigenes synthetisches Anschreiben für den Produktions-Smoke.";
    await ownLetter.getByRole("textbox", { name: "Dein Anschreibentext" }).fill(ownText);
    await ownLetter.getByRole("button", { name: "Eigenes Anschreiben speichern" }).click();
    await ownLetter.getByText("Dein eigenes Anschreiben wurde gespeichert.").waitFor();
    await page.screenshot({ path: resolve(assetsDir, "own-letter-saved-1440.png") });
    await noOverflow(page, "own letter 1440");
    if (serverAppA().documents.coverLetterDraft !== ownText) throw new Error("own letter not patched remotely");
    if (serverAppA().documents.coverLetterVersions.length !== 1 || serverAppA().documents.coverLetterVersions[0].content !== "Synthetische ältere Version — unverändert.") {
      throw new Error("own letter changed or created a version");
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Synthetic Application A/ }).click();
    await page.getByRole("tab", { name: "Dokumente" }).click();
    const reloadedOwnLetter = page.getByRole("region", { name: "Eigenes Anschreiben" });
    await reloadedOwnLetter.getByText(ownText).waitFor();
    await reloadedOwnLetter.getByRole("button", { name: "Eigenes Anschreiben bearbeiten" }).click();
    await reloadedOwnLetter.getByRole("textbox", { name: "Dein Anschreibentext" }).fill(`${ownText} Nachtrag.`);
    await reloadedOwnLetter.getByRole("button", { name: "Eigenes Anschreiben speichern" }).click();
    await reloadedOwnLetter.getByText("Dein eigenes Anschreiben wurde gespeichert.").waitFor();

    // Own-letter dirty switch decision, discard path and other-application isolation.
    await reloadedOwnLetter.getByRole("button", { name: "Eigenes Anschreiben bearbeiten" }).click();
    await reloadedOwnLetter.getByRole("textbox", { name: "Dein Anschreibentext" }).fill("Nicht speichern.");
    await page.getByRole("tab", { name: "Verlauf" }).click();
    await page.getByRole("alertdialog", { name: "Ungespeichertes Anschreiben" }).waitFor();
    await page.getByRole("button", { name: "Änderungen verwerfen" }).last().click();
    await page.getByRole("tab", { name: "Verlauf" }).waitFor();
    if (serverAppA().documents.coverLetterDraft !== `${ownText} Nachtrag.`) throw new Error("discard mutated the saved own letter");

    // Fail the capability probe closed for a temporary session-mode run. The
    // signed-in synthetic browser identity stays in the same tab; no RIS write
    // is permitted while the capability endpoint is unavailable.
    const noCapability = async (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    await page.route("**/api/ris/consents", noCapability);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".applications-section").waitFor();
    await page.getByText("Diese Bewerbungen sind derzeit nur in der aktuellen Sitzung verfügbar").waitFor();
    await page.setViewportSize({ width: 390, height: 900 });
    await noOverflow(page, "session mode 390");
    await page.screenshot({ path: resolve(assetsDir, "session-mode-390.png"), fullPage: false });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const applicationWritesBeforeSession = calls.filter((entry) => /^(POST|PATCH|DELETE) \/api\/ris\/applications/.test(entry)).length;
    await page.getByRole("button", { name: /Neue Bewerbung/ }).click();
    await page.getByLabel(/Stellenbeschreibung/).fill("Synthetische Session-Ansicht für Tabnavigation.");
    await page.getByLabel("Stellenbezeichnung (optional)").fill("Synthetic Session Application");
    await page.getByRole("button", { name: "Als Entwurf anlegen" }).click();
    await page.getByText("Bewerbungsentwurf für diese Sitzung angelegt.").waitFor();
    const applicationWritesAfterSession = calls.filter((entry) => /^(POST|PATCH|DELETE) \/api\/ris\/applications/.test(entry)).length;
    if (applicationWritesAfterSession !== applicationWritesBeforeSession) {
      throw new Error("session mode issued a remote application write");
    }
    await page.unroute("**/api/ris/consents", noCapability);

    if (aiCalls.length) throw new Error(`unexpected AI calls: ${JSON.stringify(aiCalls)}`);
    if (consoleErrors.length || pageErrors.length) throw new Error(`browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
    const editLayout = await runEditLayout(browser);
    console.log(JSON.stringify({
      status: "PASS",
      editLayout,
      applications: applications.map((application) => ({ id: application.applicationId, version: application.version, versionCount: application.documents.coverLetterVersions.length })),
      api: [...new Set(calls)],
      aiCalls: aiCalls.length,
      consoleErrors,
      pageErrors,
    }, null, 2));
  } finally {
    await context.close();
  }
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  await run(browser);
} finally {
  await browser?.close();
  try { process.kill(-vite.pid, "SIGTERM"); } catch { /* already stopped */ }
}
