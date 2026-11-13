// JM-MARKETING-02B
// Local Chromium E2E for the landing-page CTA hover/focus/active states,
// the closing CTA, reduced motion and touch behaviour.
// No API calls are required; the landing page renders without backend data.
//
// Run: node tests/e2e/landing-visual-polish.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-MARKETING-02B");
const port = 5211;
const base = `http://localhost:${port}`;

const PRIMARY = ".lp2-hero .lp2-cta-primary";
const SECONDARY = ".lp2-hero .lp2-cta-secondary";
const FINAL = ".lp2-final-cta .lp2-cta-primary";

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
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

const styles = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      borderColor: cs.borderColor,
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      transitionProperty: cs.transitionProperty,
      transitionDuration: cs.transitionDuration,
    };
  }, selector);

async function load(page, lang) {
  await page.addInitScript((value) => localStorage.setItem("mj-lang", value), lang);
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await page.waitForTimeout(500);
}

async function checkDesktop(browser, lang, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await load(page, lang);

  const primaryBase = await styles(page, PRIMARY);
  const secondaryBase = await styles(page, SECONDARY);
  if (!primaryBase || !secondaryBase) throw new Error(`${lang}-${width}: hero CTA missing`);
  if (primaryBase.transform !== "none") throw new Error("primary CTA has a base transform");
  if (secondaryBase.transform !== "none") throw new Error("secondary CTA has a base transform");

  await page.hover(PRIMARY);
  await page.waitForTimeout(280);
  const primaryHover = await styles(page, PRIMARY);
  if (primaryHover.transform === "none") throw new Error("primary CTA hover has no transform");
  if (primaryHover.boxShadow === primaryBase.boxShadow) {
    throw new Error("primary CTA hover has no shadow change");
  }
  if (primaryHover.background === primaryBase.background) {
    throw new Error("primary CTA hover has no background change");
  }
  if (!primaryHover.transitionDuration.includes("0.2s")) {
    throw new Error(`primary CTA transition duration unexpected: ${primaryHover.transitionDuration}`);
  }
  if (lang === "de" && width === 1440) {
    await page.screenshot({
      path: resolve(evidenceDir, "de-1440-primary-hover.png"),
      fullPage: false,
    });
  }
  await page.mouse.move(2, 700);
  await page.waitForTimeout(320);
  const primaryOut = await styles(page, PRIMARY);
  if (primaryOut.transform !== "none") throw new Error("primary CTA did not reset after mouseout");
  if (primaryOut.boxShadow !== primaryBase.boxShadow) {
    throw new Error("primary CTA shadow did not reset after mouseout");
  }

  await page.hover(SECONDARY);
  await page.waitForTimeout(280);
  const secondaryHover = await styles(page, SECONDARY);
  if (secondaryHover.transform === "none") throw new Error("secondary CTA hover has no transform");
  if (secondaryHover.background === secondaryBase.background) {
    throw new Error("secondary CTA hover has no background change");
  }
  if (secondaryHover.borderColor === secondaryBase.borderColor) {
    throw new Error("secondary CTA hover has no border change");
  }
  if (lang === "de" && width === 1440) {
    await page.screenshot({
      path: resolve(evidenceDir, "de-1440-secondary-hover.png"),
      fullPage: false,
    });
  }

  await page.mouse.move(2, 700);
  await page.waitForTimeout(320);
  const secondaryOut = await styles(page, SECONDARY);
  if (secondaryOut.transform !== "none") throw new Error("secondary CTA did not reset after mouseout");

  await page.focus(PRIMARY);
  const focused = await styles(page, PRIMARY);
  if (!focused.outline.startsWith("solid 3px")) {
    throw new Error(`primary CTA focus ring missing: ${focused.outline}`);
  }

  await page.hover(PRIMARY);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const active = await styles(page, PRIMARY);
  if (active.transform === "none") throw new Error("primary CTA active state missing");
  await page.mouse.move(2, 700);
  await page.mouse.up();

  const finalBase = await styles(page, FINAL);
  if (!finalBase) throw new Error("closing CTA missing");
  await page.hover(FINAL);
  await page.waitForTimeout(280);
  const finalHover = await styles(page, FINAL);
  if (finalHover.background === finalBase.background) {
    throw new Error("closing CTA hover has no background change");
  }
  if (finalHover.transform === "none") throw new Error("closing CTA hover has no transform");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  if (overflow > 0) throw new Error(`horizontal overflow: ${overflow}px`);

  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);

  await context.close();
  return { primaryBase, primaryHover, secondaryBase, secondaryHover, active, finalBase, finalHover };
}

async function checkNavigation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await load(page, "de");

  await page.focus(PRIMARY);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/search");
  if (!(await page.getByRole("button", { name: "Meine Treffer finden" }).count())) {
    throw new Error("primary CTA did not open the search UI");
  }

  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.click(SECONDARY);
  await page.waitForTimeout(600);
  const secondary = await page.evaluate(() => ({
    hash: window.location.hash,
    top: Math.round(document.querySelector("#lp2-how").getBoundingClientRect().top),
  }));
  if (secondary.hash !== "#lp2-how") throw new Error("secondary CTA hash missing");
  if (secondary.top < 0 || secondary.top > 140) {
    throw new Error(`secondary CTA scroll position unexpected: ${secondary.top}`);
  }

  await context.close();
}

async function checkReducedMotion(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await load(page, "de");
  const base = await styles(page, PRIMARY);
  await page.hover(PRIMARY);
  await page.waitForTimeout(280);
  const hovered = await styles(page, PRIMARY);
  if (hovered.transform !== "none") throw new Error("reduced motion still transforms CTA");
  if (hovered.transitionProperty.includes("transform")) {
    throw new Error("reduced motion still transitions transform");
  }
  if (hovered.background === base.background) {
    throw new Error("reduced motion lost the colour feedback");
  }
  await context.close();
}

async function checkTouch(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await load(page, "de");
  const media = await page.evaluate(() => ({
    hover: matchMedia("(hover: hover)").matches,
    fine: matchMedia("(pointer: fine)").matches,
  }));
  if (media.hover || media.fine) throw new Error(`touch context still reports hover/fine: ${JSON.stringify(media)}`);
  await page.hover(PRIMARY);
  await page.waitForTimeout(280);
  const hovered = await styles(page, PRIMARY);
  if (hovered.transform !== "none") throw new Error("touch context applied hover transform");
  await context.close();
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const vite = startVite();
  try {
    await waitForServer();
    const browser = await playwright.chromium.launch();
    try {
      const results = {};
      for (const lang of ["de", "en"]) {
        results[`${lang}-1440`] = await checkDesktop(browser, lang, 1440);
        results[`${lang}-390`] = await checkDesktop(browser, lang, 390);
      }
      await checkNavigation(browser);
      await checkReducedMotion(browser);
      await checkTouch(browser);

      // Mobile closing-CTA evidence.
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await load(page, "de");
      const finalCta = page.locator(FINAL);
      await finalCta.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: resolve(evidenceDir, "de-390-final-cta.png"),
        fullPage: false,
      });
      await context.close();

      console.log(
        JSON.stringify(
          {
            status: "PASS",
            evidence: evidenceDir,
            primary: {
              base: results["de-1440"].primaryBase,
              hover: results["de-1440"].primaryHover,
              active: results["de-1440"].active,
            },
            secondary: {
              base: results["de-1440"].secondaryBase,
              hover: results["de-1440"].secondaryHover,
            },
            finalCta: {
              base: results["de-1440"].finalBase,
              hover: results["de-1440"].finalHover,
            },
          },
          null,
          2
        )
      );
    } finally {
      await browser.close();
    }
  } finally {
    try {
      process.kill(-vite.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
