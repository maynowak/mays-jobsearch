import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-MOBILE-NAV-UX-01");
const port = 5202;
const base = `http://localhost:${port}`;
const AUTHORITY =
  "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const FUTURE = Math.floor(Date.now() / 1000) + 3600;

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

async function preparePage(browser, viewport, authenticated) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(
    ({ key, authenticated, future, userKey }) => {
      localStorage.setItem("mj-lang", "de");
      if (!authenticated) {
        sessionStorage.removeItem(userKey);
        return;
      }
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
    { key: USER_KEY, authenticated, future: FUTURE, userKey: USER_KEY }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (url.pathname === "/api/jobs") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [], meta: { totalFiltered: 0, sources: {} } }),
      });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.locator(".navbar").waitFor();
  return { context, page, consoleErrors };
}

async function boxCenter(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("missing layout box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function runGuest(browser, width, height) {
  const { context, page, consoleErrors } = await preparePage(browser, { width, height }, false);
  const burger = page.locator(".burger");
  const mobile = width <= 900;

  if (mobile) {
    if (!(await burger.isVisible())) throw new Error(`${width}: burger not visible`);
    if (await page.locator(".nav-links").isVisible()) throw new Error(`${width}: desktop links visible`);
    if (await page.locator(".nav-right").isVisible()) throw new Error(`${width}: desktop auth group visible`);
    if (await page.locator(".nav-lang").isVisible()) throw new Error(`${width}: desktop language toggle visible`);
    if ((await page.getByRole("link", { name: "Anmelden" }).count()) !== 0) {
      throw new Error(`${width}: login outside menu`);
    }
    const brandBox = await page.locator(".navbar-title").boundingBox();
    const burgerBox = await burger.boundingBox();
    if (!brandBox || !burgerBox) throw new Error(`${width}: missing brand/burger box`);
    if (brandBox.x + brandBox.width > burgerBox.x) throw new Error(`${width}: brand overlaps burger`);
    if (burgerBox.x + burgerBox.width > width + 1) throw new Error(`${width}: burger outside viewport`);

    await burger.click();
    const menu = page.locator("#mobile-navigation");
    await menu.waitFor();
    await page.waitForFunction(() => {
      const element = document.querySelector("#mobile-navigation");
      if (!(element instanceof HTMLElement)) return false;
      return element.getBoundingClientRect().left < window.innerWidth - 1;
    });
    if (!(await menu.getByRole("link", { name: "Suche" }).isVisible())) throw new Error(`${width}: search link missing`);
    if (!(await menu.getByRole("link", { name: "Benachrichtigungen" }).isVisible())) {
      throw new Error(`${width}: alerts link missing`);
    }
    if ((await menu.getByRole("link", { name: "Anmelden" }).count()) !== 1) {
      throw new Error(`${width}: expected exactly one login in menu`);
    }
    if (await menu.getByRole("link", { name: "Profil" }).count()) throw new Error(`${width}: profile while guest`);
    if (await menu.getByRole("button", { name: "Logout" }).count()) throw new Error(`${width}: logout while guest`);
    if (!(await menu.getByRole("button", { name: "EN", exact: true }).isVisible())) throw new Error(`${width}: EN missing`);
    if (!(await menu.getByRole("button", { name: "DE", exact: true }).isVisible())) throw new Error(`${width}: DE missing`);
    await page.screenshot({ path: resolve(evidenceDir, `guest-${width}-menu.png`) });

    await page.keyboard.press("Escape");
    if (await menu.isVisible()) throw new Error(`${width}: Escape did not close menu`);
    await burger.click();
    await page.mouse.click(5, height - 5);
    if (await menu.isVisible()) throw new Error(`${width}: outside click did not close menu`);
  } else {
    if (await burger.isVisible()) throw new Error(`${width}: burger visible on desktop/tablet`);
    if (!(await page.locator(".nav-links").isVisible())) throw new Error(`${width}: desktop links missing`);
    if (!(await page.getByRole("link", { name: "Anmelden" }).isVisible())) throw new Error(`${width}: desktop login missing`);
    if ((await page.getByRole("link", { name: "Anmelden" }).count()) !== 1) {
      throw new Error(`${width}: duplicate login on desktop`);
    }
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error(`${width}: horizontal overflow`);
  await context.close();
  return { width, mode: mobile ? "mobile" : "desktop", consoleErrors };
}

async function runAuthenticated(browser, width, height) {
  const { context, page, consoleErrors } = await preparePage(browser, { width, height }, true);
  if (width <= 900) {
    await page.locator(".burger").click();
    const menu = page.locator("#mobile-navigation");
    await menu.waitFor();
    await page.waitForFunction(() => {
      const element = document.querySelector("#mobile-navigation");
      if (!(element instanceof HTMLElement)) return false;
      return element.getBoundingClientRect().left < window.innerWidth - 1;
    });
    if (!(await menu.getByRole("link", { name: "Profil" }).isVisible())) throw new Error(`${width}: profile missing`);
    if (!(await menu.getByRole("button", { name: "Logout" }).isVisible())) throw new Error(`${width}: logout missing`);
    if (await menu.getByRole("link", { name: "Anmelden" }).count()) throw new Error(`${width}: login while authenticated`);
    if ((await menu.getByRole("button", { name: "Logout" }).count()) !== 1) throw new Error(`${width}: duplicate logout`);
    await page.screenshot({ path: resolve(evidenceDir, `auth-${width}-menu.png`) });
  } else {
    if (!(await page.getByRole("link", { name: "Profil" }).isVisible())) throw new Error(`${width}: desktop profile missing`);
    if (!(await page.getByRole("button", { name: "Logout" }).isVisible())) throw new Error(`${width}: desktop logout missing`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error(`${width}: authenticated horizontal overflow`);
  await context.close();
  return { width, consoleErrors };
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const vite = startVite();
  try {
    await waitForServer();
    const browser = await playwright.chromium.launch();
    try {
      const results = [];
      for (const width of [390, 430, 768, 1024, 1440]) {
        const height = width < 768 ? 844 : 900;
        results.push(await runGuest(browser, width, height));
        results.push(await runAuthenticated(browser, width, height));
      }
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
