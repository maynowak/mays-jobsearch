import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-BUILDER-01A");
const previewEvidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-BUILDER-01B");
const port = 5205;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

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

async function prepareContext(browser, viewport, authenticated) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(
    ({ key, future, userKey, authenticated }) => {
      localStorage.setItem("mj-lang", "de");
      if (authenticated) {
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
      }
    },
    { key: USER_KEY, future, userKey: USER_KEY, authenticated }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/models", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) })
  );
  return { context, page, consoleErrors };
}

async function openBuilderFromSearch(page) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen" }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
}

async function openBuilderFromProfile(page) {
  await page.goto(`${base}/profil`, { waitUntil: "networkidle" });
  await page.waitForSelector(".dashboard-v2");
  await page.getByRole("button", { name: "Lebenslauf" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
}

function builderDialog(page) {
  return page.getByRole("dialog", { name: "Strukturierter Lebenslauf-Editor" });
}

function openSection(page, name) {
  return builderDialog(page).locator("summary span").filter({ hasText: name }).first().click();
}

async function fillPersonal(page) {
  const dialog = builderDialog(page);
  await openSection(page, "Persönliche Angaben");
  await dialog.getByLabel("Vollständiger Name").fill("Alex Beispiel");
  await dialog.getByLabel("E-Mail").fill("alex@example.invalid");
  await dialog.getByLabel("Telefon").fill("+49 30 123456");
  await dialog.getByLabel("Standort").fill("Berlin");
}

async function fillExperience(page) {
  const dialog = builderDialog(page);
  await openSection(page, "Berufserfahrung");
  await dialog.getByRole("button", { name: "+ Berufserfahrung hinzufügen" }).click();
  await dialog.getByLabel("Position").fill("Senior Frontend Entwicklerin");
  await dialog.getByLabel("Arbeitgeber").fill("Beispiel GmbH");
  await dialog.getByLabel("Beginn (Monat/Jahr)").fill("2020-03");
  await dialog.getByLabel("Aktuell laufend").check();
  await dialog.getByLabel("Tätigkeiten / Beschreibung").fill(
    "React, TypeScript und barrierefreie UI-Komponenten.\n\nAufbau eines Designsystems, Mentoring im Team und enge Zusammenarbeit mit Produkt und Design."
  );

  await dialog.getByRole("button", { name: "+ Berufserfahrung hinzufügen" }).click();
  await dialog.getByLabel("Position").nth(1).fill("Frontend Entwicklerin");
  await dialog.getByLabel("Arbeitgeber").nth(1).fill("Vorherige AG");
  await dialog.getByLabel("Beginn (Monat/Jahr)").nth(1).fill("2017-01");
  await dialog.getByLabel("Ende (Monat/Jahr)").nth(1).fill("2020-02");
}

async function fillEducationAndSkills(page) {
  const dialog = builderDialog(page);
  await openSection(page, "Ausbildung");
  await dialog.getByRole("button", { name: "+ Ausbildung hinzufügen" }).click();
  await dialog.getByLabel("Bildungseinrichtung").fill("Beispiel-Universität");
  await dialog.getByLabel("Abschluss").fill("B.Sc. Informatik");
  await dialog.getByLabel("Beginn (Monat/Jahr)").last().fill("2013-10");
  await dialog.getByLabel("Ende (Monat/Jahr)").last().fill("2017-09");

  await openSection(page, "Fähigkeiten");
  await dialog.getByLabel("Fähigkeiten").fill("React, TypeScript, Cloud Architecture");
}

async function checkNoOverflow(page, label) {
  const dialog = builderDialog(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  if (overflow) throw new Error(`${label}: horizontal overflow`);
  const viewport = page.viewportSize();
  const box = await page.locator(".cv-builder-modal__box").boundingBox();
  if (!box || !viewport || box.width > viewport.width + 1) {
    throw new Error(`${label}: CV builder dialog exceeds viewport width`);
  }
  await dialog.getByRole("button", { name: "Lebenslauf-Editor schließen" }).waitFor();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).waitFor();
}

async function runGuest(browser) {
  const { context, page, consoleErrors } = await prepareContext(browser, { width: 1440, height: 1000 }, false);
  await openBuilderFromSearch(page);
  await fillPersonal(page);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: resolve(evidenceDir, "desktop-1440-personal.png"), fullPage: false });

  await fillExperience(page);
  await page.locator(".cv-builder-entry").last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(evidenceDir, "desktop-1440-experience.png"), fullPage: false });

  await fillEducationAndSkills(page);
  await page.locator(".cv-builder-sections").scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(evidenceDir, "desktop-1440-education-skills.png"), fullPage: false });

  await mkdir(previewEvidenceDir, { recursive: true });
  await page.locator(".cv-builder-modal__box").evaluate((element) => { element.scrollTop = 0; });
  const preview = page.locator(".cv-preview");
  for (const [button, slug] of [["Klassisch", "classic"], ["Modern", "modern"], ["Kompakt", "compact"]]) {
    await page.getByRole("button", { name: button }).click();
    const actual = await preview.getAttribute("data-template");
    if (actual !== slug) throw new Error(`preview template ${slug} not active`);
    await page.getByText("Alex Beispiel", { exact: true }).last().waitFor();
    await preview.screenshot({
      path: resolve(previewEvidenceDir, `desktop-1440-${slug}.png`),
    });
  }
  await page.getByRole("button", { name: "Klassisch" }).click();
  await page.screenshot({
    path: resolve(previewEvidenceDir, "desktop-1440-editor-live-preview.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await checkNoOverflow(page, "mobile-390");
  await openSection(page, "Persönliche Angaben");
  await page.screenshot({ path: resolve(evidenceDir, "mobile-390-editor.png"), fullPage: false });
  await openSection(page, "Berufserfahrung");
  await page.locator(".cv-builder-entry").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(evidenceDir, "mobile-390-dynamic-entries.png"), fullPage: false });
  await page.getByText(/nur während der aktuellen Sitzung bearbeitet/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(evidenceDir, "mobile-390-session-note.png"), fullPage: false });

  await page.getByRole("button", { name: "Vorschau" }).click();
  await page.screenshot({ path: resolve(previewEvidenceDir, "mobile-390-view-toggle.png"), fullPage: false });
  for (const [button, slug] of [["Klassisch", "classic"], ["Modern", "modern"], ["Kompakt", "compact"]]) {
    await page.getByRole("button", { name: button }).click();
    if ((await preview.getAttribute("data-template")) !== slug) {
      throw new Error(`mobile preview template ${slug} not active`);
    }
    await preview.screenshot({
      path: resolve(previewEvidenceDir, `mobile-390-${slug}.png`),
    });
  }
  await page.getByRole("button", { name: "Bearbeiten" }).click();
  if ((await builderDialog(page).getByLabel("Vollständiger Name").inputValue()) !== "Alex Beispiel") {
    throw new Error("mobile view switch lost editor data");
  }

  for (const width of [1024, 768, 430, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await checkNoOverflow(page, `width-${width}`);
    if (width <= 900) {
      await page.getByRole("button", { name: "Vorschau" }).click();
      await checkNoOverflow(page, `width-${width}-preview`);
      await page.getByRole("button", { name: "Bearbeiten" }).click();
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await builderDialog(page).getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("heading", { name: "Ungespeicherte Änderungen" }).waitFor();
  await page.getByRole("button", { name: "Weiter bearbeiten" }).click();
  await builderDialog(page).getByRole("button", { name: "Lebenslauf speichern" }).click();
  await builderDialog(page).getByRole("button", { name: "Schließen", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.getByRole("button", { name: "Lebenslauf erstellen" }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await openSection(page, "Persönliche Angaben");
  if ((await builderDialog(page).getByLabel("Vollständiger Name").inputValue()) !== "") {
    throw new Error("CV builder draft persisted after reload");
  }

  await context.close();
  return { consoleErrors };
}

async function runAuthenticated(browser) {
  const { context, page, consoleErrors } = await prepareContext(browser, { width: 1440, height: 1000 }, true);
  await openBuilderFromProfile(page);
  await fillPersonal(page);
  await builderDialog(page).getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("heading", { name: "Ungespeicherte Änderungen" }).waitFor();
  await page.getByRole("button", { name: "Speichern und schließen" }).click();
  await page.getByText("Lebenslauf 1").waitFor();
  await page.locator(".cv-builder-profiles__item").first()
    .getByRole("button", { name: "Bearbeiten" }).click();
  if ((await builderDialog(page).getByLabel("Vollständiger Name").inputValue()) !== "Alex Beispiel") {
    throw new Error("authenticated CV profile was not retained");
  }
  await context.close();
  return { consoleErrors };
}

async function main() {
  const vite = startVite();
  try {
    await waitForServer();
    const browser = await playwright.chromium.launch();
    try {
      const guest = await runGuest(browser);
      const authenticated = await runAuthenticated(browser);
      const errors = [...guest.consoleErrors, ...authenticated.consoleErrors];
      if (errors.length) throw new Error(`console errors: ${errors.join(" | ")}`);
      console.log(JSON.stringify({ status: "PASS", guest, authenticated }, null, 2));
    } finally {
      await browser.close();
    }
  } finally {
    try {
      process.kill(-vite.pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

await main();
