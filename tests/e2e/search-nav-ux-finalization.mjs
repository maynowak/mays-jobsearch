// JM-SEARCH-NAV-UX-FINALIZATION-01
// Local Chromium E2E for the permanent turquoise skills frame plus the
// existing search and navigation flow. All API calls are intercepted.
//
// Run: node tests/e2e/search-nav-ux-finalization.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-SEARCH-NAV-UX-FINALIZATION-01");
const port = 5209;
const base = `http://localhost:${port}`;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const jobs = {
  jobs: Array.from({ length: 14 }, (_, index) => ({
    slug: `final-job-${index + 1}`,
    title: `Fullstack Developer ${index + 1}`,
    company_name: `Beispiel GmbH ${index + 1}`,
    location: ["Berlin"],
    remote: index % 2 === 0,
    tags: ["React", "TypeScript", "AWS"],
    url: `https://example.invalid/jobs/${index + 1}`,
    source: ["arbeitnow"],
  })),
  meta: { totalFiltered: 14 },
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
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const consoleErrors = [];
  const apiRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/jobs") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobs) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  return { context, page, consoleErrors, apiRequests };
}

async function skillsStyle(page) {
  return page.evaluate(() => {
    const input = document.querySelector("#skills");
    const field = document.querySelector(".skills-field");
    const clear = document.querySelector(".skills-field .field-clear");
    if (!input || !field) throw new Error("skills field missing");
    const inputStyle = getComputedStyle(input);
    const fieldStyle = getComputedStyle(field);
    return {
      borderColor: inputStyle.borderColor,
      borderWidth: inputStyle.borderWidth,
      backgroundColor: inputStyle.backgroundColor,
      boxShadow: inputStyle.boxShadow,
      fieldBorderColor: fieldStyle.borderColor,
      inputHeight: input.getBoundingClientRect().height,
      clearHeight: clear?.getBoundingClientRect().height ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

function assertTurquoise(value, label) {
  if (!/rgb\(34,\s*211,\s*238\)|oklch\(/.test(value)) {
    throw new Error(`${label}: expected turquoise, got ${value}`);
  }
}

async function openSearch(page) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByText("Welche Fähigkeiten bringst du mit?").waitFor();
}

async function runDesktop(browser) {
  const { context, page, consoleErrors, apiRequests } = await preparePage(browser, { width: 1440, height: 1000 });
  await openSearch(page);

  let style = await skillsStyle(page);
  assertTurquoise(style.borderColor, "skills default border");
  if (style.inputHeight < 44) throw new Error(`skills input below 44px: ${style.inputHeight}`);
  if (style.backgroundColor === "rgb(255, 253, 249)") throw new Error("skills background is still beige");
  await page.locator(".skills-field").screenshot({ path: resolve(evidenceDir, "desktop-1440-skills-default.png") });

  await page.locator("#skills").focus();
  style = await skillsStyle(page);
  assertTurquoise(style.borderColor, "skills focus border");
  await page.locator(".skills-field").screenshot({ path: resolve(evidenceDir, "desktop-1440-skills-focus.png") });

  await page.fill("#skills", "Spring Boot");
  style = await skillsStyle(page);
  if (style.clearHeight < 44) throw new Error(`skills clear below 44px: ${style.clearHeight}`);
  if ((await page.locator(".skills-field__example").count()) !== 4) {
    throw new Error("skill example chips missing");
  }
  await page.locator(".skills-field .field-clear").click();
  if ((await page.locator("#skills").inputValue()) !== "") throw new Error("skills clear failed");
  await page.fill("#skills", "AWS Fullstack");
  await page.getByRole("button", { name: "Meine Treffer finden" }).click();
  await page.getByText("14 Stellen gefunden").waitFor();
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(evidenceDir, "desktop-1440-results.png"), fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(320);
  const hidden = await page.locator(".navbar").evaluate((nav) => nav.classList.contains("scrolled"));
  if (!hidden) throw new Error("navbar did not hide on long results");
  if (!(await page.getByRole("button", { name: "Nach oben" }).isVisible())) {
    throw new Error("back-to-top missing on long results");
  }
  await page.screenshot({ path: resolve(evidenceDir, "desktop-1440-nav-scrolled.png"), fullPage: false });

  if (style.overflow > 0) throw new Error(`desktop overflow: ${style.overflow}`);
  if (consoleErrors.length) throw new Error(`desktop console errors: ${consoleErrors.join(" | ")}`);
  if (apiRequests.some((path) => !["/api/models", "/api/jobs"].includes(path))) {
    throw new Error(`unexpected API requests: ${apiRequests.join(", ")}`);
  }
  await context.close();
  return { style, consoleErrors };
}

async function runMobile(browser, width, height, name) {
  const { context, page, consoleErrors } = await preparePage(browser, { width, height });
  await openSearch(page);
  let style = await skillsStyle(page);
  assertTurquoise(style.borderColor, `${name} skills default border`);
  if (style.inputHeight < 44) throw new Error(`${name}: input below 44px`);
  if (style.overflow > 0) throw new Error(`${name}: overflow ${style.overflow}px`);
  await page.locator(".skills-field").screenshot({ path: resolve(evidenceDir, `${name}-skills-default.png`) });

  await page.fill("#skills", "Spring Boot");
  await page.locator("#skills").focus();
  style = await skillsStyle(page);
  assertTurquoise(style.borderColor, `${name} skills focus border`);
  await page.locator(".skills-field").screenshot({ path: resolve(evidenceDir, `${name}-skills-focus.png`) });

  await page.keyboard.press("Tab");
  const focusIsClear = await page.evaluate(() => document.activeElement?.classList.contains("field-clear"));
  if (!focusIsClear) throw new Error(`${name}: keyboard focus did not reach clear control`);

  if (consoleErrors.length) throw new Error(`${name} console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
  return { name, style, consoleErrors };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch();
  const desktop = await runDesktop(browser);
  const mobile390 = await runMobile(browser, 390, 844, "mobile-390");
  const mobile320 = await runMobile(browser, 320, 800, "mobile-320");
  console.log(JSON.stringify({ status: "PASS", desktop, mobile390, mobile320 }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
