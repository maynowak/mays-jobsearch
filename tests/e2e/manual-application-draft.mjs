import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-MANUAL-APPLICATION-DRAFT-01");
const port = 5208;
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
const letter = "Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Stellenanzeige.";

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

function label(lang, de, en) {
  return lang === "de" ? de : en;
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
  await page.getByRole("button", {
    name: label(options.lang, /Neue Bewerbung/, /New application/),
  }).click();
  await page.locator(".applications-new").waitFor();

  const description = label(
    options.lang,
    "Du entwickelst React-Anwendungen und bringst Erfahrung mit TypeScript und barrierefreien Oberflächen mit.",
    "You develop React applications and bring experience with TypeScript and accessible interfaces."
  );
  await page.getByRole("textbox", {
    name: label(options.lang, /Stellenbeschreibung/, /Job description/),
  }).fill(description);

  if (options.auth) {
    if (options.withUrl) {
      await page.getByLabel(
        label(options.lang, "Original-URL (optional)", "Original URL (optional)")
      ).fill("https://example.com/jobs/draft-e2e");
    }
    const draftButton = page.getByRole("button", {
      name: label(options.lang, "Als Entwurf anlegen", "Create as draft"),
    });
    const draftBox = await draftButton.boundingBox();
    if (!draftBox || draftBox.height < 44) {
      throw new Error(`${name}: draft button below 44px`);
    }
    await draftButton.click();
    await page.getByText(
      label(
        options.lang,
        "Bewerbungsentwurf für diese Sitzung angelegt.",
        "Application draft created for this session."
      )
    ).waitFor();
    if (coverLetterBodies.length !== 0) throw new Error(`${name}: AI call while creating draft`);
    if (await page.locator(".applications-list__item").count() !== 1) {
      throw new Error(`${name}: draft was not shown exactly once`);
    }
    await page.getByRole("tab", {
      name: label(options.lang, "Dokumente", "Documents"),
    }).click();
    const createLetter = page.getByRole("button", {
      name: label(options.lang, "Anschreiben erstellen", "Create cover letter"),
    });
    const createBox = await createLetter.boundingBox();
    if (!createBox || createBox.height < 44) {
      throw new Error(`${name}: create-letter button below 44px`);
    }
    await createLetter.click();
    await page.locator('[role="dialog"]').waitFor();
    if (coverLetterBodies.length !== 0) throw new Error(`${name}: AI call on modal open`);
    await page.locator('[role="dialog"]').getByRole("button", {
      name: label(options.lang, "Anschreiben generieren", "Generate cover letter"),
    }).click();
    await page.getByRole("textbox", {
      name: label(options.lang, "Bearbeitbares Anschreiben", "Editable cover letter"),
    }).waitFor();
    if (coverLetterBodies.length !== 1) throw new Error(`${name}: expected one generation`);
    if (coverLetterBodies[0].job.description !== description) {
      throw new Error(`${name}: session description not passed to modal`);
    }
    await page.getByRole("button", {
      name: /Als Bewerbungsentwurf übernehmen|Anschreiben im Bewerbungsentwurf aktualisieren|Adopt as application draft|Update cover letter in application draft/,
    }).click();
    await page.getByText(
      label(options.lang, "Dein Bewerbungsentwurf ist bereit.", "Your application draft is ready.")
    ).waitFor();
    await page.getByRole("button", {
      name: label(options.lang, "Dokumente öffnen", "Open documents"),
    }).click();
    await page.waitForFunction(() => {
      const select = document.querySelector(".applications-letter-comparison select");
      return select instanceof HTMLSelectElement && select.options.length >= 2;
    });
    if (await page.locator(".applications-list__item").count() !== 1) {
      throw new Error(`${name}: adoption created a duplicate application`);
    }
    await page.locator(".applications-letter-comparison").scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, `${name}-draft-with-version.png`),
      fullPage: false,
    });
  } else {
    if (await page.getByRole("button", {
      name: label(options.lang, "Als Entwurf anlegen", "Create as draft"),
    }).count()) {
      throw new Error(`${name}: guest draft action must not be available`);
    }
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, `${name}-guest-form.png`),
      fullPage: false,
    });
  }

  await assertNoOverflow(page, name);
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
    await runViewport(browser, "desktop-1024-auth", { width: 1024, height: 900 }, {
      auth: true,
      lang: "en",
      withUrl: false,
    });
    await runViewport(browser, "tablet-768-auth", { width: 768, height: 900 }, {
      auth: true,
      lang: "de",
      withUrl: false,
    });
    await runViewport(browser, "mobile-430-auth", { width: 430, height: 900 }, {
      auth: true,
      lang: "en",
      withUrl: true,
    });
    await runViewport(browser, "mobile-390-auth", { width: 390, height: 844 }, {
      auth: true,
      lang: "de",
      withUrl: false,
    });
    await runViewport(browser, "mobile-320-auth", { width: 320, height: 700 }, {
      auth: true,
      lang: "en",
      withUrl: false,
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
      withUrl: false,
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
