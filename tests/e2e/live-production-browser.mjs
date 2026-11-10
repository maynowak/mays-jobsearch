// Live production browser E2E with an explicit manual-login handoff.
//
// The agent must never receive or store the test-account password. The operator
// signs in manually in the visible Chrome window, then runs the "run" command.
// The run phase is read-only: navigation, rendering and responsive checks only.
//
// Usage:
//   npm run test:e2e:live-browser -- open
//   # operator signs in in the opened window
//   npm run test:e2e:live-browser -- run
//
// Optional:
//   LIVE_BASE_URL=https://www.mays-job-matcher.app
//   LIVE_CDP_PORT=9223

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const baseUrl = (process.env.LIVE_BASE_URL ?? "https://www.mays-job-matcher.app").replace(/\/$/, "");
const cdpPort = Number(process.env.LIVE_CDP_PORT ?? "9223");
const profileDir = process.env.LIVE_PROFILE_DIR ?? "/tmp/opencode/mays-live-e2e-profile";
const mode = process.argv[2] ?? "open";
const evidenceDir = resolve(
  process.env.LIVE_EVIDENCE_DIR ??
    `/tmp/opencode/live-production-browser-e2e/${new Date().toISOString().replace(/[:.]/g, "-")}`
);
const widths = (process.env.LIVE_WIDTHS ?? "320,390,430,768,1024,1440")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const tabs = ["overview", "profile", "cv", "applications", "preferences", "settings"];

async function cdpVersion() {
  const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`).catch(() => null);
  if (!response?.ok) return null;
  return response.json();
}

async function openBrowser() {
  if (await cdpVersion()) {
    console.log(`Chrome is already listening on CDP port ${cdpPort}.`);
    return;
  }
  const child = spawn(
    "google-chrome",
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--new-window",
      `${baseUrl}/anmelden`,
    ],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ":0" },
    }
  );
  child.unref();

  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (await cdpVersion()) {
      console.log(
        [
          "",
          `Live browser opened at ${baseUrl}/anmelden`,
          "Sign in manually with the approved synthetic/test account.",
          "Do not paste credentials into chat or a terminal.",
          `When the profile page is visible, run:`,
          "  npm run test:e2e:live-browser -- run",
          "",
        ].join("\n")
      );
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 400));
  }
  throw new Error(
    `Chrome did not expose CDP on ${cdpPort}. Is a desktop session available on DISPLAY=${process.env.DISPLAY ?? "<unset>"}?`
  );
}

async function measure(page) {
  return page.evaluate(() => {
    const visibleButtons = Array.from(document.querySelectorAll("button, a, select"))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== "hidden";
      });
    const smallTargets = visibleButtons
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((item) => item.height < 44 || item.width < 44)
      .slice(0, 20);
    return {
      url: window.location.href,
      title: document.title,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      headings: Array.from(document.querySelectorAll("h1,h2,h3"))
        .slice(0, 8)
        .map((element) => (element.textContent || "").trim().slice(0, 120)),
      smallTargets,
    };
  });
}

async function runReadOnlyChecks() {
  if (!(await cdpVersion())) {
    throw new Error("No live Chrome session. Run `npm run test:e2e:live-browser -- open` first.");
  }
  const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("No browser context available.");
  const page =
    context.pages().find((candidate) => candidate.url().includes(new URL(baseUrl).hostname)) ??
    context.pages()[0];
  if (!page) throw new Error("No browser page available.");

  await page.goto(`${baseUrl}/profil`, { waitUntil: "networkidle" });
  const dashboard = page.locator("#dashboard-v2-title");
  if ((await dashboard.count()) === 0) {
    throw new Error(
      "Not signed in. Sign in manually in the opened Chrome window, then run the `run` command again."
    );
  }

  await mkdir(evidenceDir, { recursive: true });
  const results = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
    for (const tab of tabs) {
      await page.goto(`${baseUrl}/profil?tab=${tab}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(250);
      const metrics = await measure(page);
      if (metrics.overflow > 0) {
        throw new Error(`${tab} ${width}: horizontal overflow ${metrics.overflow}px`);
      }
      const file = `${tab}-${width}.png`;
      await page.screenshot({ path: resolve(evidenceDir, file), fullPage: false });
      results.push({ width, tab, file, ...metrics });
    }
  }

  const footer = await page.locator("footer").innerText().catch(() => "");
  await writeFile(
    resolve(evidenceDir, "live-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        mode: "live-read-only",
        buildFooter: footer,
        results,
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        baseUrl,
        evidenceDir,
        buildFooter: footer,
        checks: results.length,
        widths,
        tabs,
      },
      null,
      2
    )
  );
  await browser.close();
}

if (mode === "open") {
  await openBrowser();
} else if (mode === "run") {
  await runReadOnlyChecks();
} else {
  throw new Error("Use `open` or `run`.");
}
