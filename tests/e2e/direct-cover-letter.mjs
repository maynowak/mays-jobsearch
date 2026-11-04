import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-DIRECT-COVER-LETTER-01B");
const port = 5207;
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
      const response = await fetch(`${base}/profil?tab=applications`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

async function preparePage(browser, viewport, { auth, lang }) {
  const context = await browser.newContext({ viewport, locale: lang === "de" ? "de-DE" : "en-GB" });
  await context.addInitScript(
    ({ auth, future, lang, userKey }) => {
      localStorage.setItem("mj-lang", lang);
      if (auth) {
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
    { auth, future, lang, userKey: USER_KEY }
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
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (url.pathname === "/api/cover-letter") {
      coverLetterBodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ letter }) });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });
  return { context, page, consoleErrors, coverLetterBodies };
}

function label(lang, de, en) {
  return lang === "de" ? de : en;
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  if (overflow) throw new Error(`${name}: horizontal overflow`);
}

async function runViewport(browser, name, viewport, options) {
  const { context, page, consoleErrors, coverLetterBodies } = await preparePage(
    browser,
    viewport,
    options
  );
  await page.goto(`${base}/profil?tab=applications`, { waitUntil: "networkidle" });
  await page.locator(".applications-section").waitFor();

  const newButton = page.getByRole("button", {
    name: label(options.lang, /Neue Bewerbung/, /New application/),
  });
  await newButton.click();
  await page.locator(".applications-new").waitFor();
  if (coverLetterBodies.length !== 0) throw new Error(`${name}: AI call on form open`);

  const description = label(
    options.lang,
    "Du entwickelst React-Anwendungen und bringst Erfahrung mit TypeScript und barrierefreien Oberflächen mit.",
    "You develop React applications and bring experience with TypeScript and accessible interfaces."
  );
  const descriptionField = page.getByLabel(
    label(options.lang, /Stellenbeschreibung/, /Job description/)
  );
  await descriptionField.fill(description);
  if (coverLetterBodies.length !== 0) throw new Error(`${name}: AI call while editing`);

  if (options.withUrl) {
    await page
      .getByLabel(label(options.lang, "Original-URL (optional)", "Original URL (optional)"))
      .fill("https://example.com/jobs/manual-e2e");
  }

  await page
    .getByRole("button", {
      name: label(options.lang, "Anschreiben generieren", "Generate cover letter"),
    })
    .click();
  await page.locator('[role="dialog"]').waitFor();
  if (coverLetterBodies.length !== 0) throw new Error(`${name}: AI call on modal open`);

  const sourceText = label(options.lang, "Manuell hinzugefügt", "Manually added");
  if (!(await page.getByText(sourceText).isVisible())) {
    throw new Error(`${name}: manual source badge missing`);
  }
  await page
    .locator('[role="dialog"]')
    .getByRole("button", {
      name: label(options.lang, "Anschreiben generieren", "Generate cover letter"),
    })
    .click();
  const editor = page.getByRole("textbox", {
    name: label(options.lang, "Bearbeitbares Anschreiben", "Editable cover letter"),
  });
  await editor.waitFor();
  const lockedText = label(
    options.lang,
    "Übernahme noch nicht verfügbar",
    "Application adoption not yet available"
  );
  await page.getByText(lockedText).waitFor();
  if (coverLetterBodies.length !== 1) {
    throw new Error(`${name}: expected one cover-letter request, got ${coverLetterBodies.length}`);
  }
  const body = coverLetterBodies[0];
  if (body.job.description !== description) {
    throw new Error(`${name}: description was not passed completely`);
  }
  if (JSON.stringify(body.job.source) !== JSON.stringify(["manual"])) {
    throw new Error(`${name}: manual source missing in request`);
  }
  const expectedUrl = options.withUrl ? "https://example.com/jobs/manual-e2e" : "";
  if (body.job.url !== expectedUrl) {
    throw new Error(`${name}: unexpected manual URL ${body.job.url}`);
  }
  await editor.fill(`${await editor.inputValue()}\n\nEdited in E2E.`);
  if (!(await page.getByRole("button", { name: label(options.lang, "Neu generieren", "Regenerate") }).isVisible())) {
    throw new Error(`${name}: regenerate action missing`);
  }

  await page.screenshot({
    path: resolve(evidenceDir, `${name}-generated.png`),
    fullPage: false,
  });

  await page
    .getByRole("button", { name: label(options.lang, "Schließen", "Close") })
    .click();
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  if ((await descriptionField.inputValue()) !== description) {
    throw new Error(`${name}: description lost after closing modal`);
  }

  await page
    .getByRole("button", {
      name: label(options.lang, "Anschreiben generieren", "Generate cover letter"),
    })
    .click();
  await page.locator('[role="dialog"]').waitFor();
  if (coverLetterBodies.length !== 1) throw new Error(`${name}: reopen triggered AI call`);
  await page
    .getByRole("button", { name: label(options.lang, "Schließen", "Close") })
    .click();
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });

  await assertNoOverflow(page, name);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: resolve(evidenceDir, `${name}-form.png`),
    fullPage: false,
  });

  const buttonBox = await page
    .getByRole("button", {
      name: label(options.lang, "Anschreiben generieren", "Generate cover letter"),
    })
    .boundingBox();
  if (!buttonBox || buttonBox.height < 44) {
    throw new Error(`${name}: generate button below 44px`);
  }

  await page
    .getByRole("button", { name: label(options.lang, "Abbrechen", "Cancel") })
    .click();
  await page.getByText(
    label(
      options.lang,
      "Diese ungespeicherte Stellenanzeige verwerfen?",
      "Discard this unsaved job posting?"
    )
  ).waitFor();
  await page
    .getByRole("button", { name: label(options.lang, "Verwerfen", "Discard") })
    .click();
  await page.locator(".applications-new").waitFor({ state: "detached" });

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
    await runViewport(browser, "desktop-1440-auth", { width: 1440, height: 900 }, {
      auth: true,
      lang: "de",
      withUrl: true,
    });
    await runViewport(browser, "desktop-1024-guest", { width: 1024, height: 900 }, {
      auth: false,
      lang: "en",
      withUrl: false,
    });
    await runViewport(browser, "tablet-768-guest", { width: 768, height: 900 }, {
      auth: false,
      lang: "de",
      withUrl: false,
    });
    await runViewport(browser, "mobile-430-guest", { width: 430, height: 900 }, {
      auth: false,
      lang: "en",
      withUrl: true,
    });
    await runViewport(browser, "mobile-390-guest", { width: 390, height: 844 }, {
      auth: false,
      lang: "de",
      withUrl: false,
    });
    await runViewport(browser, "mobile-320-guest", { width: 320, height: 700 }, {
      auth: false,
      lang: "en",
      withUrl: false,
    });
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
