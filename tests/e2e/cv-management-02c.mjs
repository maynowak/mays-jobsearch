import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-MANAGEMENT-02C");
const port = 5210;
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
const letter = [
  "Sehr geehrte Damen und Herren,",
  "ich bewerbe mich auf die ausgeschriebene Stelle und bringe Erfahrung mit React und TypeScript mit.",
  "Mit freundlichen Grüßen",
  "E2E Bewerber",
].join("\n\n");
const description =
  "Du entwickelst React-Anwendungen und bringst Erfahrung mit TypeScript und barrierefreien Oberflächen mit.";

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
      const response = await fetch(`${base}/profil?tab=cv`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

async function preparePage(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    locale: "de-DE",
    acceptDownloads: true,
  });
  await context.addInitScript(
    ({ future, userKey }) => {
      localStorage.setItem("mj-lang", "de");
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
    },
    { future, userKey: USER_KEY }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  const coverLetterBodies = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/models") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(models),
      });
    }
    if (url.pathname === "/api/cover-letter") {
      coverLetterBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ letter }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });
  return { context, page, consoleErrors, coverLetterBodies };
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  if (overflow) throw new Error(`${name}: horizontal overflow`);
}

async function createBuilderCv(page) {
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
  await page.getByLabel("Vollständiger Name").fill("Ada Beispiel");
  await page.locator("summary").filter({ hasText: "Berufliches Kurzprofil" }).click();
  await page.getByLabel("Berufsbezeichnung").fill("Senior Frontend Engineer");
  await page.getByLabel("Kurzprofil").fill("Ada Beispiel entwickelt React-Anwendungen.");
  await page.getByRole("button", { name: "Lebenslauf speichern" }).click();
  await page.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
  await page.locator(".cv-builder-modal").waitFor({ state: "detached" });
  await page.getByText("Lebenslauf 1").waitFor();
}

async function runViewport(browser, name, viewport) {
  const { context, page, consoleErrors, coverLetterBodies } = await preparePage(
    browser,
    viewport
  );
  await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
  await page.locator(".cv-builder-profiles").waitFor();
  await createBuilderCv(page);

  // Keep the in-memory session repository alive: use the dashboard navigation
  // instead of a full page reload, which would correctly discard all profiles.
  await page.getByRole("button", { name: "Bewerbungen", exact: true }).click();
  await page.locator(".applications-section").waitFor();
  await page.getByRole("button", { name: /Neue Bewerbung/ }).click();
  await page.getByLabel(/Stellenbeschreibung/).fill(description);
  await page.getByRole("button", { name: "Anschreiben generieren" }).click();
  await page.locator('[role="dialog"]').waitFor();
  if (coverLetterBodies.length !== 0) throw new Error(`${name}: AI call on modal open`);

  const builderOption = page.locator('[role="dialog"]').getByLabel(/Lebenslauf 1/);
  await builderOption.check();
  if (coverLetterBodies.length !== 0) throw new Error(`${name}: AI call on CV selection`);
  await page.getByText("Vorschau des für die Generierung vorgesehenen Lebenslauftexts").click();
  await page.locator(".letter-cv-preview").getByText("Senior Frontend Engineer").waitFor();

  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Anschreiben generieren" })
    .click();
  await page.getByRole("textbox", { name: "Bearbeitbares Anschreiben" }).waitFor();
  if (coverLetterBodies.length !== 1) {
    throw new Error(`${name}: expected one cover-letter request, got ${coverLetterBodies.length}`);
  }
  const cvText = coverLetterBodies[0].candidate.cv_text;
  if (!String(cvText).includes("Senior Frontend Engineer")) {
    throw new Error(`${name}: professional builder CV data missing`);
  }
  if (String(cvText).includes("Ada Beispiel")) {
    throw new Error(`${name}: personal name leaked into CV text`);
  }
  if (coverLetterBodies[0].candidate.cv_anonymized !== true) {
    throw new Error(`${name}: cv_anonymized missing`);
  }

  await page.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" }).click();
  await page.getByText("Dein Bewerbungsentwurf ist bereit.").waitFor();
  await page.getByRole("button", { name: "Dokumente öffnen" }).click();
  await page.getByRole("tab", { name: "Dokumente" }).waitFor();
  await page.getByText("CV-Quelle").waitFor();
  await page.getByText("Meine erstellten Lebensläufe").first().waitFor();
  const cvSelect = page.getByLabel("Zugeordneten Lebenslauf ändern");
  await cvSelect.selectOption("none");
  await cvSelect.evaluate(
    (element) =>
      new Promise((resolveValue) => {
        const check = () => {
          if (element.value === "none") resolveValue(true);
          else setTimeout(check, 50);
        };
        check();
      })
  );
  if (coverLetterBodies.length !== 1) {
    throw new Error(`${name}: CV reassignment triggered another AI request`);
  }

  await assertNoOverflow(page, name);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: resolve(evidenceDir, `${name}-application-cv.png`),
    fullPage: false,
  });
  if (consoleErrors.length) {
    throw new Error(`${name}: console errors: ${consoleErrors.join(" | ")}`);
  }
  await context.close();
}

const child = startVite();
try {
  await waitForServer();
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    await runViewport(browser, "desktop-1440", { width: 1440, height: 1000 });
    await runViewport(browser, "desktop-1024", { width: 1024, height: 900 });
    await runViewport(browser, "tablet-768", { width: 768, height: 900 });
    await runViewport(browser, "mobile-430", { width: 430, height: 900 });
    await runViewport(browser, "mobile-390", { width: 390, height: 844 });
    await runViewport(browser, "mobile-320", { width: 320, height: 700 });
  } finally {
    await browser.close();
  }
} finally {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
