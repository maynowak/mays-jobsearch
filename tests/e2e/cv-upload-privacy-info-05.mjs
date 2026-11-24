// JM-CV-UPLOAD-PRIVACY-INFO-05
// Local visual/a11y check for the compact CV privacy disclosure.
// No real API calls or personal data.
//
// Run: npm run test:e2e:cv-upload-privacy-info-05

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const outDir = resolve("/tmp/opencode", "cv-upload-privacy-info-05");
const port = 5235;
const base = `http://localhost:${port}`;

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

async function runWidth(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [{ id: "mock", name: "Mock" }],
          defaultModel: "mock",
          recommendedModel: null,
          fallbackModel: null,
        }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });

  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Lebenslauf hochladen" }).click();
  const details = page.locator("details.cv-privacy-disclosure");
  const summary = details.locator("summary");
  const dropzone = page.locator(".cv-dropzone");
  await details.waitFor();
  await dropzone.waitFor();

  const closed = await details.evaluate((element) => element.open);
  if (closed) throw new Error(`${width}: disclosure must start closed`);
  const closedLayout = {
    details: await details.boundingBox(),
    summary: await summary.boundingBox(),
    dropzone: await dropzone.boundingBox(),
  };
  if (!closedLayout.details || !closedLayout.summary || !closedLayout.dropzone) {
    throw new Error(`${width}: missing layout box`);
  }
  if (closedLayout.summary.height < 44) {
    throw new Error(`${width}: summary target is below 44px`);
  }
  if (closedLayout.details.y + closedLayout.details.height > closedLayout.dropzone.y) {
    throw new Error(`${width}: disclosure overlaps the upload field`);
  }

  await page.screenshot({ path: resolve(outDir, `closed-${width}.png`) });
  await summary.focus();
  await summary.press("Enter");
  if (!(await details.evaluate((element) => element.open))) {
    throw new Error(`${width}: keyboard Enter did not open disclosure`);
  }
  const openLayout = {
    details: await details.boundingBox(),
    dropzone: await dropzone.boundingBox(),
  };
  if (!openLayout.details || !openLayout.dropzone) throw new Error(`${width}: open layout missing`);
  if (openLayout.details.y + openLayout.details.height > openLayout.dropzone.y) {
    throw new Error(`${width}: open disclosure overlaps the upload field`);
  }
  const noteVisible = await page.getByText(/Privat: Deine PDF wird für diese Funktion lokal/).isVisible();
  if (!noteVisible) throw new Error(`${width}: full privacy note is not visible when open`);
  await page.screenshot({ path: resolve(outDir, `open-${width}.png`) });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  if (overflow > 0) throw new Error(`${width}: horizontal overflow ${overflow}px`);
  if (errors.length) throw new Error(`${width}: console errors ${errors.join(" | ")}`);

  await context.close();
  return { width, overflow, summaryHeight: closedLayout.summary.height };
}

const vite = startVite();
let browser;
try {
  await mkdir(outDir, { recursive: true });
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const results = [await runWidth(browser, 1440), await runWidth(browser, 390)];
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* server already exited */
  }
}
