import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-APPLICATION-MANAGEMENT-02");
const editEvidenceDir = resolve(repoRoot, "docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04A");
const port = 5203;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;

const job = {
  slug: "aa-10001-1002716922-S",
  title: "Senior Fullstack Developer (w/m/d)",
  company_name: "Siemens AG",
  location: ["Frankfurt am Main"],
  remote: false,
  tags: ["Python", "Angular", "AWS"],
  url: "https://www.arbeitsagentur.de/jobsuche/suche?id=10001-1002716922-S",
  source: ["arbeitsagentur"],
};
const jobs = { jobs: [job], meta: { totalFiltered: 1, sources: { arbeitsagentur: 1 } } };
const matches = {
  matches: [{ score: 91, why: "Strong fullstack and cloud fit.", prepare: "Ask about the team.", job }],
  meta: { evaluated: 1 },
};
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

async function preparePage(browser, viewport) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(
    ({ key, future, userKey }) => {
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
      void key;
    },
    { key: USER_KEY, future, userKey: USER_KEY }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/models") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    if (url.pathname === "/api/jobs") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobs) });
    if (url.pathname === "/api/job-details") return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not needed", code: "not_mocked" }) });
    if (url.pathname === "/api/profile") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ skills: ["AWS"], experienceLevel: "Senior", targetRoles: ["Fullstack Developer"], location: "Frankfurt" }) });
    if (url.pathname === "/api/match") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(matches) });
    if (url.pathname === "/api/cover-letter") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ letter: "Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Einladung." }) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  return { context, page, consoleErrors };
}

async function openDashboard(page, mobile) {
  if (mobile) {
    await page.locator(".burger").click();
    await page.getByRole("link", { name: "Profil" }).click();
  } else {
    await page.getByRole("link", { name: "Profil" }).click();
  }
  await page.waitForSelector(".dashboard-v2");
}

async function runViewport(browser, name, viewport) {
  const mobile = viewport.width < 768;
  const { context, page, consoleErrors } = await preparePage(browser, viewport);
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.fill("#skills", "AWS Fullstack");
  await page.click("#find-btn");
  await page.waitForSelector("#match-btn");
  await page.click("#match-btn");
  await page.waitForSelector(".match-card");

  await page.locator(".match-card .letter-btn").first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.getByLabel("Weitere Informationen zur Stellenanzeige einfügen").fill(
    "Position als Senior Fullstack Developer bei Siemens AG in Frankfurt. Python, Angular und AWS."
  );
  await page.getByRole("button", { name: "Beschreibung prüfen" }).click();
  await page.waitForSelector("text=Plausibel");
  await page.getByRole("button", { name: "Anschreiben generieren" }).click();
  await page.waitForFunction(() => {
    const editor = document.querySelector('textarea[aria-label="Bearbeitbares Anschreiben"]');
    return editor instanceof HTMLTextAreaElement && editor.value.length > 0;
  });
  await page.getByRole("button", { name: "Als Bewerbungsentwurf übernehmen" }).click();
  await page.getByRole("button", { name: "Schließen" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await openDashboard(page, mobile);
  await page.getByRole("button", { name: "Bewerbungen" }).click();
  await page.waitForSelector(".applications-section");
  await page.getByText("Diese Bewerbungen sind derzeit nur in der aktuellen Sitzung verfügbar").waitFor();
  await page.getByText("Senior Fullstack Developer (w/m/d)").first().waitFor();
  await page.getByText("Siemens AG").first().waitFor();
  await page.locator(".applications-detail").getByText("Entwurf").first().waitFor();
  await page.getByRole("link", { name: "Originalanzeige öffnen" }).waitFor();
  await page.locator(".applications-section").scrollIntoViewIfNeeded();
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: resolve(evidenceDir, `${name}-overview.png`), fullPage: false });

  // UX-04A: edit and persist all previously read-only application details.
  await page.getByRole("button", { name: "Bewerbungsdaten bearbeiten" }).click();
  await page.getByRole("form", { name: "Bewerbungsdaten bearbeiten" }).waitFor();
  await page.getByLabel("Bewerbungsweg").selectOption("email");
  await page.getByLabel("Bewerbungsdatum").fill("2026-10-20");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("E2E Kontakt");
  await page.getByRole("textbox", { name: "E-Mail", exact: true }).fill("e2e.kontakt@example.invalid");
  await page.getByRole("textbox", { name: "Telefon", exact: true }).fill("+49 30 123456");
  await page.getByRole("textbox", { name: "Persönliche Notizen", exact: true }).fill("E2E edit note");
  await page.getByRole("spinbutton", { name: "Gehaltsvorstellung Betrag", exact: true }).fill("80000");
  await page.getByRole("spinbutton", { name: "Angebotenes Gehalt Betrag", exact: true }).fill("75000");
  await mkdir(editEvidenceDir, { recursive: true });
  await page.screenshot({ path: resolve(editEvidenceDir, `${name}-edit.png`), fullPage: false });
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await page.getByText("E2E edit note").waitFor();
  await page.getByText("E2E Kontakt").waitFor();
  await page.screenshot({ path: resolve(editEvidenceDir, `${name}-updated.png`), fullPage: false });

  await page.getByRole("button", { name: "Beworben / Antwort ausstehend" }).click();
  await page.getByText("Hast du diese Bewerbung tatsächlich abgeschickt?").waitFor();
  await page.getByRole("button", { name: "Ja, als versendet markieren" }).click();
  await page.locator(".applications-detail").getByText("Beworben / Antwort ausstehend").first().waitFor();

  await page.screenshot({ path: resolve(evidenceDir, `${name}-detail.png`), fullPage: false });

  // Session-only MVP: React state is intentionally not persisted. A reload
  // must show a fresh empty applications view, not a stale prior session.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Bewerbungen" }).click();
  await page.getByText("Noch keine Bewerbungen").waitFor();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error(`${name}: horizontal overflow`);
  await context.close();
  return { name, consoleErrors };
}

async function main() {
  const vite = startVite();
  try {
    await waitForServer();
    const browser = await playwright.chromium.launch();
    try {
      const results = [];
      results.push(await runViewport(browser, "desktop-1440", { width: 1440, height: 1000 }));
      results.push(await runViewport(browser, "mobile-390", { width: 390, height: 844 }));
      console.log(JSON.stringify({ status: "PASS", results }, null, 2));
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
