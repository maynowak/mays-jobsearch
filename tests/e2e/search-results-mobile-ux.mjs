import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-SEARCH-RESULTS-MOBILE-UX-04");
const port = 5206;
const base = `http://localhost:${port}`;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

function makeJob(index) {
  return {
    slug: `job-${index}`,
    title: `Fullstack Developer ${index}`,
    company_name: `Beispiel GmbH ${index}`,
    location: ["Berlin"],
    remote: index % 2 === 0,
    tags: ["React", "TypeScript", "AWS"],
    url: `https://example.invalid/jobs/${index}`,
    source: ["arbeitnow"],
  };
}

function makeJobs(count) {
  return Array.from({ length: count }, (_, index) => makeJob(index + 1));
}

function makeMatches(jobs) {
  return {
    matches: jobs.map((job) => ({
      score: 90,
      why: "Guter fachlicher Fit.",
      prepare: "Frage nach dem Team.",
      job,
    })),
    meta: { evaluated: jobs.length },
  };
}

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

async function preparePage(browser, viewport, options) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  const page = await context.newPage();
  const consoleErrors = [];
  let matchRequests = 0;
  let releaseMatch = null;
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The explicit failure scenario intentionally returns 502 from /api/match.
    if (options.matchMode === "fail" && message.text().includes("Failed to load resource")) return;
    consoleErrors.push(message.text());
  });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  await page.route("**/api/models", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) })
  );
  await page.route("**/api/jobs**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jobs: options.jobs, meta: { totalFiltered: options.jobs.length } }),
    })
  );
  await page.route("**/api/match", async (route) => {
    matchRequests += 1;
    if (options.matchMode === "fail") {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Mock provider unavailable", code: "model_unavailable" }),
      });
      return;
    }
    if (options.matchMode === "pending") {
      await new Promise((resolveMatch) => {
        releaseMatch = () => {
          resolveMatch(null);
          void route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(makeMatches(options.jobs)),
          });
        };
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeMatches(options.jobs)),
    });
  });
  return {
    context,
    page,
    consoleErrors,
    matchRequests: () => matchRequests,
    releaseMatch: () => releaseMatch?.(),
  };
}

async function runSearch(page) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.fill("#skills", "AWS Fullstack");
  await page.getByRole("button", { name: "Meine Treffer finden" }).click();
  await page.locator(".search-results-summary").waitFor();
  await page.waitForTimeout(450);
}

async function runOneJob(browser) {
  const jobs = makeJobs(1);
  const env = await preparePage(browser, { width: 390, height: 844 }, { jobs, matchMode: "success" });
  await runSearch(env.page);
  await env.page.getByText("1 Stelle gefunden").waitFor();
  await env.page.screenshot({ path: resolve(evidenceDir, "mobile-390-one-job.png"), fullPage: false });

  await env.page.getByRole("button", { name: "Zu der Stelle" }).click();
  await env.page.waitForFunction(() => document.activeElement?.id === "matches-heading");
  await env.page.getByRole("button", { name: "Mit KI bewerten" }).click();
  await env.page.getByText("Dein bester Treffer").waitFor();
  await env.page.screenshot({ path: resolve(evidenceDir, "mobile-390-one-job-evaluated.png"), fullPage: false });
  await env.context.close();
  return env.consoleErrors;
}

async function runMultipleJobs(browser) {
  const jobs = makeJobs(12);
  const env = await preparePage(browser, { width: 390, height: 844 }, { jobs, matchMode: "pending" });
  await runSearch(env.page);
  await env.page.getByText("12 Stellen gefunden").waitFor();
  await env.page.screenshot({ path: resolve(evidenceDir, "mobile-390-multiple-jobs.png"), fullPage: false });

  await env.page.getByRole("button", { name: "Zu den 12 Stellen" }).click();
  await env.page.waitForFunction(() => document.activeElement?.id === "matches-heading");

  const matchButton = env.page.getByRole("button", { name: "Mit KI bewerten" });
  await matchButton.click();
  await env.page.locator("#match-btn").waitFor();
  await env.page.locator("#match-btn[aria-busy='true']").waitFor();
  await env.page.screenshot({ path: resolve(evidenceDir, "mobile-390-ai-running.png"), fullPage: false });
  if (env.matchRequests() !== 1) throw new Error("match request was duplicated");
  env.releaseMatch();
  await env.page.locator("#match-btn:not([aria-busy='true'])").waitFor();
  await env.page.getByText("Alle 12 bewerteten Treffer").waitFor();
  await env.page.getByRole("button", { name: "Zu den 12 Stellen" }).click();
  await env.page.screenshot({ path: resolve(evidenceDir, "mobile-390-expanded-results.png"), fullPage: false });
  await env.context.close();
  return env.consoleErrors;
}

async function runFailure(browser) {
  const jobs = makeJobs(3);
  const env = await preparePage(browser, { width: 390, height: 844 }, { jobs, matchMode: "fail" });
  await runSearch(env.page);
  await env.page.getByText("3 Stellen gefunden").waitFor();
  await env.page.getByRole("button", { name: "Mit KI bewerten" }).click();
  await env.page.locator("#status").waitFor();
  await env.page.getByText(/bereits gefundenen Stellen bleiben erhalten/).waitFor();
  await env.page.getByText("Fullstack Developer 1").first().waitFor();
  await env.page.screenshot({ path: resolve(evidenceDir, "mobile-390-ai-failed.png"), fullPage: false });
  await env.context.close();
  return env.consoleErrors;
}

async function runDesktop(browser) {
  const jobs = makeJobs(4);
  const env = await preparePage(browser, { width: 1440, height: 1000 }, { jobs, matchMode: "success" });
  await runSearch(env.page);
  await env.page.getByText("4 Stellen gefunden").waitFor();
  const button = env.page.getByRole("button", { name: "Mit KI bewerten" });
  const box = await button.boundingBox();
  if (!box || box.height < 44) throw new Error("desktop match button is below 44px");
  await env.page.screenshot({ path: resolve(evidenceDir, "desktop-1440-ai-button.png"), fullPage: false });
  for (const width of [1024, 768, 430, 390, 320]) {
    await env.page.setViewportSize({ width, height: 900 });
    const overflow = await env.page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    if (overflow) throw new Error(`${width}: horizontal overflow`);
    await env.page.locator(".search-results-summary").waitFor();
    const actionBox = await env.page.getByRole("button", { name: "Mit KI bewerten" }).boundingBox();
    if (!actionBox || actionBox.height < 44) throw new Error(`${width}: AI action below 44px`);
  }
  await env.context.close();
  return env.consoleErrors;
}

async function main() {
  const vite = startVite();
  try {
    await waitForServer();
    await mkdir(evidenceDir, { recursive: true });
    const browser = await playwright.chromium.launch();
    try {
      const errors = [
        ...(await runOneJob(browser)),
        ...(await runMultipleJobs(browser)),
        ...(await runFailure(browser)),
        ...(await runDesktop(browser)),
      ];
      if (errors.length) throw new Error(`console errors: ${errors.join(" | ")}`);
      console.log(JSON.stringify({ status: "PASS", consoleErrors: [] }, null, 2));
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
