// JM-GUEST-CV-E2E-09
// Standalone Chromium E2E for the anonymous CV workflow.
// Backend endpoints are intercepted locally; no real provider is contacted.
//
// Run: node tests/e2e/guest-cv-workflow.mjs
// The script starts Vite on an isolated port and stops it afterwards.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const fixturePdf = resolve(repoRoot, "tests/fixtures/cv/synthetic-cv.pdf");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-GUEST-CV-E2E-09");
const port = 5199;
const base = `http://localhost:${port}`;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  fallbackModel: null,
  recommendedModel: null,
};

const suggestedProfile = {
  skills: ["Java", "AWS", "Terraform", "Docker"],
  experienceLevel: "Mid",
  targetRoles: ["Cloud Engineer"],
  location: "Frankfurt",
};

const jobs = {
  jobs: [
    {
      slug: "synthetic-cloud-job",
      title: "Cloud Engineer",
      company_name: "Synthetic Corp",
      location: ["Frankfurt"],
      remote: false,
      tags: ["aws", "terraform"],
      url: "https://example.invalid/jobs/synthetic-cloud-job",
    },
  ],
  meta: { totalFiltered: 1, sources: { arbeitnow: 1 } },
};

function startVite() {
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--port", String(port), "--strictPort"],
    { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], detached: true }
  );
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
  const page = await context.newPage();
  const consoleErrors = [];
  const requests = { profile: 0, jobs: 0, match: 0, login: 0 };
  const profileBodies = [];
  const jobUrls = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/auth")) requests.login += 1;
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (url.pathname === "/api/profile") {
      requests.profile += 1;
      profileBodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(suggestedProfile) });
    }
    if (url.pathname === "/api/jobs") {
      requests.jobs += 1;
      jobUrls.push(url.searchParams);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobs) });
    }
    if (url.pathname === "/api/match") {
      requests.match += 1;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "not expected", code: "unexpected" }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked", code: "not_mocked" }) });
  });

  await page.goto(`${base}/search`, { waitUntil: "networkidle" });

  // Guest CV tab must be available without login.
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixturePdf);

  await page.getByText("CV-Verarbeitung erlauben?").waitFor();
  if (requests.profile !== 0) throw new Error("profile request started before consent");

  await page.getByRole("checkbox", { name: /Ich stimme der Verarbeitung meiner CV-Daten/ }).check();
  await page.getByRole("button", { name: "Verarbeitung erlauben" }).click();

  await page.locator(".cv-anonymization-choice").waitFor();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();

  await page.locator("#cv-model-selection-title").waitFor();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();

  await page.locator(".cv-result").waitFor();
  if (requests.profile !== 1) throw new Error(`expected one profile request, got ${requests.profile}`);

  const sentText = String(profileBodies[0]?.text ?? "");
  if (!sentText.includes("Synthetic Test CV") || !sentText.includes("Terraform")) {
    throw new Error(`unexpected extracted CV text: ${sentText.slice(0, 200)}`);
  }

  await page.locator("#cv-profile-name").fill("Synthetic CV Profile");
  // Parent profile deliberately uses a smaller/different skill set than the
  // ATS variant so the jobs request can prove the ATS override.
  await page.locator("#cv-skills").fill("Java, AWS");
  await page.locator("#cv-targetRole").fill("Platform Engineer");
  await page.locator("#cv-radius").selectOption("50");
  await page.getByRole("button", { name: "Speichern" }).click();

  await page.getByRole("button", { name: "Ziel ausführen" }).click();
  await page.locator("#cv-ats-profile-name").waitFor();
  await page.locator("#cv-ats-profile-name").fill("Synthetic ATS");
  await page.getByRole("button", { name: "Mit ausgewählten Skills fortfahren" }).click();

  await page.locator("#cv-saved-search-profile").waitFor();
  await page.locator("#cv-saved-search-profile").selectOption({ label: "Synthetic CV Profile" });
  await page.locator("#cv-saved-ats-profile").selectOption({ label: "Synthetic ATS" });
  await page.locator(".cv-saved-profiles__start").click();

  const deadline = Date.now() + 10000;
  while (requests.jobs === 0 && Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  if (requests.jobs !== 1) throw new Error(`expected exactly one jobs request, got ${requests.jobs}`);
  if (requests.match !== 0) throw new Error("unexpected match request");

  const params = jobUrls[0];
  const skills = params.get("skills") ?? "";
  // Parent profile has only Java, AWS. The ATS variant adds Terraform and
  // Docker, so their presence proves the ATS skills override won.
  if (!skills.includes("Terraform") || !skills.includes("Docker")) {
    throw new Error(`ATS skills override missing: ${skills}`);
  }
  if (!skills.includes("Java") || !skills.includes("AWS")) {
    throw new Error(`ATS skills did not preserve selected skills: ${skills}`);
  }
  if (params.get("targetRole") !== "Platform Engineer") {
    throw new Error(`parent/ATS target role missing: ${params.get("targetRole")}`);
  }
  if (params.get("city") !== "Frankfurt") {
    throw new Error(`parent city missing: ${params.get("city")}`);
  }
  if (params.get("radiusKm") !== "50") {
    throw new Error(`parent radius missing: ${params.get("radiusKm")}`);
  }
  if (params.get("employmentType") !== "full_time") {
    throw new Error(`parent employment type missing: ${params.get("employmentType")}`);
  }

  await page.waitForTimeout(300);
  const finalUrl = new URL(page.url());
  if (finalUrl.pathname !== "/search") throw new Error(`unexpected redirect: ${page.url()}`);
  if (requests.login !== 0) throw new Error("login redirect detected");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  if (overflow > 0) throw new Error(`horizontal overflow: ${overflow}px`);
  if (consoleErrors.length > 0) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);

  await page.screenshot({ path: resolve(evidenceDir, `${name}.png`), fullPage: true });
  await context.close();

  return {
    viewport: name,
    profileRequests: requests.profile,
    jobRequests: requests.jobs,
    matchRequests: requests.match,
    loginRequests: requests.login,
    overflow,
    consoleErrors,
  };
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const vite = startVite();
  let browser;
  try {
    await waitForServer();
    browser = await playwright.chromium.launch();
    const results = [];
    results.push(await runViewport(browser, "desktop-1440", { width: 1440, height: 900 }));
    results.push(await runViewport(browser, "mobile-390", { width: 390, height: 844 }));
    console.log(JSON.stringify({ status: "PASS", results }, null, 2));
  } finally {
    if (browser) await browser.close();
    try {
      process.kill(-vite.pid, "SIGTERM");
    } catch {
      vite.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "FAIL", error: String(error) }, null, 2));
  process.exitCode = 1;
});
