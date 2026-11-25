// JM-JOB-DETAILS-TRANSLATION-HOTFIX-01
// Synthetic translation UI check: a wrapper response must never be rendered;
// a clean response must render through the existing sanitized HTML path.
// No real AI, RIS, CV, auth or job data.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "playwright";

const port = 5292;
const base = `http://localhost:${port}`;
const evidenceDir = resolve("docs/reports/assets/JM-JOB-DETAILS-TRANSLATION-HOTFIX-01");
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};
const englishText = "We are looking for a Software Engineer. You will build reliable systems with AWS and TypeScript. ".repeat(8);

function makeJob(index) {
  return {
    slug: `translation-job-${index}`,
    title: `Translation Role ${index}`,
    company_name: `Translation GmbH ${index}`,
    location: ["Berlin"],
    remote: false,
    tags: ["React", "TypeScript"],
    url: `https://example.invalid/jobs/${index}`,
    source: ["arbeitnow"],
    language: "en",
    description: `<p>${englishText}</p>`,
    descriptionPlain: englishText,
  };
}

const jobs = Array.from({ length: 8 }, (_, index) => makeJob(index + 1));
const matches = jobs.slice(0, 6).map((job) => ({
  score: 90,
  why: "Guter fachlicher Fit.",
  prepare: "Frage nach dem Team.",
  job,
}));

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${base}/search`)).ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not start");
}

async function run() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const calls = { translation: 0, unexpected: [], errors: [] };
  page.on("console", (message) => { if (message.type() === "error") calls.errors.push(message.text()); });
  page.on("pageerror", (error) => calls.errors.push(String(error)));
  await page.route("**/api/**", async (handler) => {
    const request = handler.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/_lib/")) return handler.continue();
    if (path === "/api/models") {
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/jobs") {
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs, meta: { totalFiltered: jobs.length, sources: {} } }) });
    }
    if (path === "/api/match") {
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches, meta: { evaluated: matches.length } }) });
    }
    if (path === "/api/job-details" && request.method() === "POST") {
      calls.translation += 1;
      const body = request.postDataJSON();
      if (body?.action !== "translate") {
        calls.unexpected.push(`unexpected job-details action ${body?.action}`);
        return handler.fulfill({ status: 400, contentType: "application/json", body: "{}" });
      }
      if (calls.translation === 1) {
        return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ translation: '{"translation":"Deutsche Fassung."}', sourceLanguage: "en", targetLanguage: "de", translated: true }) });
      }
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ translation: '<p>Deutsche Fassung zwei.</p><img src=x onerror="window.__xss=1">', sourceLanguage: "en", targetLanguage: "de", translated: true }) });
    }
    calls.unexpected.push(`${request.method()} ${path}`);
    return handler.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await mkdir(evidenceDir, { recursive: true });
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByLabel("Skills").fill("React, TypeScript");
  await page.getByRole("button", { name: "Meine Treffer finden" }).click();
  await page.locator(".remaining-card").first().waitFor();
  await page.getByRole("button", { name: /Mit KI bewerten/ }).click();
  await page.locator(".match-card").first().waitFor({ timeout: 20000 });
  await page.locator(".results-remaining-toggle").click();
  await page.locator(".remaining-card").first().waitFor();

  const first = page.locator(".remaining-card").first();
  await page.screenshot({ path: resolve(evidenceDir, "before-translation-1440.png") });
  await first.getByRole("button", { name: "Deutsch lesen" }).click();
  await first.getByRole("alert").waitFor();
  const firstText = await first.innerText();
  if (firstText.includes('{"translation"')) throw new Error("wrapper visible after failed translation");
  if (!firstText.includes("We are looking for a Software Engineer")) throw new Error("original text missing after failed translation");
  await page.screenshot({ path: resolve(evidenceDir, "after-wrapper-error-1440.png") });

  const second = page.locator(".remaining-card").nth(1);
  await second.getByRole("button", { name: "Deutsch lesen" }).click();
  await second.getByText("Deutsche Fassung zwei.").waitFor();
  if ((await second.locator("img").count()) !== 0) throw new Error("unsafe translated image survived");
  if ((await second.locator("script").count()) !== 0) throw new Error("unsafe translated script survived");
  if ((await page.evaluate(() => window.__xss ?? 0)) !== 0) throw new Error("translated HTML executed");
  await page.screenshot({ path: resolve(evidenceDir, "after-clean-translation-1440.png") });

  if (calls.unexpected.length) throw new Error(`unexpected calls: ${calls.unexpected.join(", ")}`);
  if (calls.errors.length) throw new Error(`browser errors: ${calls.errors.join(" | ")}`);
  console.log(JSON.stringify({ status: "PASS", calls, evidenceDir }, null, 2));
  await context.close();
}

const server = startVite();
let browser;
try {
  await waitForServer();
  browser = await playwright.chromium.launch();
  await run();
} finally {
  await browser?.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* ignore */ }
}
