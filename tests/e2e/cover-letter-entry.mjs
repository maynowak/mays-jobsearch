import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-COVER-LETTER-02");
const port = 5201;
const base = `http://localhost:${port}`;

const jobs = {
  jobs: [
    {
      slug: "job-frontend",
      title: "Frontend Engineer",
      company_name: "Example GmbH",
      location: ["Berlin"],
      remote: true,
      tags: ["React", "TypeScript"],
      url: "https://example.invalid/jobs/job-frontend",
      source: ["arbeitnow"],
    },
    {
      slug: "job-backend",
      title: "Backend Engineer",
      company_name: "Other AG",
      location: ["Munich"],
      remote: false,
      tags: ["Node.js"],
      url: "https://example.invalid/jobs/job-backend",
      source: ["arbeitnow"],
    },
  ],
  meta: { totalFiltered: 2, sources: { arbeitnow: 2 } },
};

const matches = {
  matches: [
    {
      score: 88,
      why: "Strong React and TypeScript match.",
      prepare: "Ask about the frontend platform.",
      job: jobs.jobs[0],
    },
  ],
  meta: { evaluated: 1 },
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

async function runViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const consoleErrors = [];
  let coverLetterCalls = 0;
  let jobsCalls = 0;
  let jobDetailsCalls = 0;
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
        body: JSON.stringify({ models: [{ id: "mock-model", name: "Mock Model" }], defaultModel: "mock-model", recommendedModel: "mock-model", fallbackModel: null }),
      });
    }
    if (url.pathname === "/api/jobs") {
      jobsCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobs) });
    }
    if (url.pathname === "/api/job-details") {
      jobDetailsCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: {}, meta: { enrichedCount: 0 } }) });
    }
    if (url.pathname === "/api/match") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(matches) });
    }
    if (url.pathname === "/api/cover-letter") {
      coverLetterCalls += 1;
      coverLetterBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ letter: "Sehr geehrte Damen und Herren,\n\nvielen Dank für die Einladung." }),
      });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked", code: "not_mocked" }) });
  });

  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.fill("#skills", "React");
  await page.click("#find-btn");
  await page.waitForSelector("#match-btn");
  await page.click("#match-btn");
  await page.waitForSelector(".match-card");

  const matchActions = page.locator(".match-card .job-actions").first();
  if ((await matchActions.count()) !== 1) throw new Error(`${name}: match action bar missing`);
  const matchButtons = matchActions.locator("button, a");
  if ((await matchButtons.count()) !== 3) throw new Error(`${name}: match actions expected 3, got ${await matchButtons.count()}`);

  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: resolve(evidenceDir, `${name}-cards.png`), fullPage: false });

  await page.locator(".match-card .letter-btn").first().click();
  await page.waitForSelector('[role="dialog"]');
  if (coverLetterCalls !== 0) throw new Error(`${name}: AI call on dialog open`);
  if (!(await page.getByText("Vorläufige Version").isVisible())) throw new Error(`${name}: preparation view missing`);
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-intro.png`), fullPage: false });

  await page.getByLabel("Weitere Informationen zur Stellenanzeige einfügen").fill(
    "Position als Frontend Engineer bei Example GmbH in Berlin. Du entwickelst React-Anwendungen und hast Erfahrung mit TypeScript."
  );
  await page.getByRole("button", { name: "Beschreibung prüfen" }).click();
  await page.waitForSelector("text=Plausibel");
  if (coverLetterCalls !== 0) throw new Error(`${name}: AI call during description review`);
  if (jobsCalls !== 1) throw new Error(`${name}: unexpected /api/jobs request during review (${jobsCalls})`);
  if (jobDetailsCalls !== 0) throw new Error(`${name}: unexpected /api/job-details request during review (${jobDetailsCalls})`);
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-review.png`), fullPage: false });

  await page.getByRole("button", { name: "Schließen" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });
  if (coverLetterCalls !== 0) throw new Error(`${name}: AI call on dialog close`);

  await page.getByRole("button", { name: /Weitere gefundene Jobs ansehen/ }).click();
  await page.waitForSelector(".remaining-card");
  const remainingActions = page.locator(".remaining-card .job-actions").first();
  if ((await remainingActions.locator("button, a").count()) !== 3) {
    throw new Error(`${name}: remaining actions expected 3, got ${await remainingActions.locator("button, a").count()}`);
  }
  await page.locator(".remaining-card .letter-btn").first().click();
  await page.waitForSelector('[role="dialog"]');
  if (coverLetterCalls !== 0) throw new Error(`${name}: AI call on remaining dialog open`);
  await page.getByRole("button", { name: "Schließen" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });

  await page.locator(".match-card .letter-btn").first().click();
  await page.getByRole("button", { name: "Vorläufiges Anschreiben erstellen" }).click();
  await page.waitForSelector("text=vielen Dank für die Einladung.");
  if (coverLetterCalls !== 1) throw new Error(`${name}: expected one AI call, got ${coverLetterCalls}`);
  if (JSON.stringify(coverLetterBodies).includes("Position als Frontend Engineer bei Example GmbH in Berlin. Du entwickelst React-Anwendungen")) {
    throw new Error(`${name}: enriched review text was sent to the model`);
  }
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-generated.png`), fullPage: false });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error(`${name}: horizontal overflow detected`);

  await context.close();
  return { name, coverLetterCalls, jobsCalls, jobDetailsCalls, consoleErrors };
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
