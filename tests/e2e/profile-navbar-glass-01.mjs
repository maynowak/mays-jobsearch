// JM-PROFILE-NAVBAR-GLASS-01
// Visual/navigation check: /profil uses the same floating glass navbar as /search.
// Synthetic OIDC and mocked APIs only; no real data.
//
// Run: npm run test:e2e:profile-navbar-glass-01

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const outDir = resolve("/tmp/opencode", "profile-navbar-glass-01");
const port = 5236;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
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

async function preparePage(browser, { width, authenticated }) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(
    ({ key, future, userKey, authenticated }) => {
      localStorage.setItem("mj-lang", "de");
      if (authenticated) {
        sessionStorage.setItem(
          userKey,
          JSON.stringify({
            id_token: "e2e-id-token",
            session_state: null,
            access_token: "e2e-access-token",
            refresh_token: null,
            token_type: "Bearer",
            scope: "openid email profile",
            profile: {
              iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
              sub: "e2e-navbar-sub",
              email: "navbar@example.invalid",
              name: "Navbar E2E",
            },
            expires_at: future,
          })
        );
      }
      void key;
    },
    { key: USER_KEY, future, userKey: USER_KEY, authenticated }
  );
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/ris/cv-consents") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent: null,
          noticeVersion: "cv-storage/1.0",
          noticeState: "DRAFT",
          noticeApproved: false,
          acceptedForNewGrant: false,
          grantAllowed: false,
          noticeReason: "synthetic",
          textVersion: null,
          textHash: null,
          textState: "DRAFT",
          textMapped: false,
          textApproved: false,
          textReason: "synthetic",
          specialCategoriesConsent: false,
          specialCategories: [],
          externalTextVersion: null,
          externalTextSha256: null,
        }),
      });
    }
    if (path === "/api/ris/search-profile-consents") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent: null,
          noticeVersion: "search-profile-storage/1.0",
          noticeState: "DRAFT",
          noticeApproved: false,
          acceptedForNewGrant: false,
          grantAllowed: false,
          noticeReason: "synthetic",
          textVersion: null,
          textHash: null,
          textState: "DRAFT",
          textMapped: false,
          textApproved: false,
          textReason: "synthetic",
          specialCategoriesConsent: false,
          specialCategories: [],
          externalTextVersion: null,
          externalTextSha256: null,
        }),
      });
    }
    if (path === "/api/ris/cvs") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], nextCursor: null }),
      });
    }
    if (path === "/api/ris/search-profiles") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], nextCursor: null }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });
  return { context, page, errors };
}

async function navMetrics(page) {
  const nav = page.locator(".nav-inner");
  const box = await nav.boundingBox();
  const style = await nav.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      borderRadius: computed.borderRadius,
      backgroundColor: computed.backgroundColor,
      backdropFilter: computed.backdropFilter,
      paddingTop: computed.paddingTop,
      paddingRight: computed.paddingRight,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
    };
  });
  return { box, style };
}

async function runWidth(browser, width) {
  const auth = await preparePage(browser, { width, authenticated: true });
  const search = await preparePage(browser, { width, authenticated: false });
  try {
    await auth.page.goto(`${base}/profil`, { waitUntil: "networkidle" });
    await auth.page.locator(".dashboard-v2__header").waitFor();
    await auth.page.screenshot({ path: resolve(outDir, `profile-${width}.png`) });

    const profileNav = await navMetrics(auth.page);
    const profileHeader = await auth.page.locator(".dashboard-v2__header").boundingBox();
    if (!profileNav.box || !profileHeader) throw new Error(`${width}: missing profile layout`);
    if (profileHeader.y < profileNav.box.y + profileNav.box.height - 1) {
      throw new Error(`${width}: profile header overlaps navbar`);
    }
    const profileOverflow = await auth.page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    if (profileOverflow > 0) throw new Error(`${width}: profile overflow ${profileOverflow}px`);

    await search.page.goto(`${base}/search`, { waitUntil: "networkidle" });
    await search.page.locator(".navbar-glass").waitFor();
    await search.page.screenshot({ path: resolve(outDir, `search-${width}.png`) });
    const searchNav = await navMetrics(search.page);
    if (!searchNav.box) throw new Error(`${width}: missing search navbar`);
    for (const key of ["width", "x", "y"]) {
      if (Math.abs(profileNav.box[key] - searchNav.box[key]) > 1) {
        throw new Error(`${width}: navbar ${key} mismatch ${profileNav.box[key]} vs ${searchNav.box[key]}`);
      }
    }
    for (const key of ["borderRadius", "backgroundColor", "backdropFilter", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
      if (profileNav.style[key] !== searchNav.style[key]) {
        throw new Error(`${width}: navbar ${key} mismatch ${profileNav.style[key]} vs ${searchNav.style[key]}`);
      }
    }

    if (width <= 900) {
      await auth.page.getByRole("button", { name: "Menü öffnen" }).click();
      await auth.page.locator(".mobile-menu").waitFor();
      await auth.page.waitForTimeout(350);
      await auth.page.screenshot({ path: resolve(outDir, `profile-menu-${width}.png`) });
      await auth.page.keyboard.press("Escape");
      await auth.page.locator(".mobile-menu").waitFor({ state: "detached" });
      await auth.page.waitForTimeout(100);
    }

    await auth.page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 900);
    });
    await auth.page.waitForTimeout(250);
    const scrolledClass = await auth.page.locator(".navbar").evaluate((element) => element.className);
    const scrollInfo = await auth.page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    if (!scrolledClass.includes("scrolled")) {
      throw new Error(`${width}: navbar did not hide on scroll ${JSON.stringify(scrollInfo)} class=${scrolledClass}`);
    }
    await auth.page.evaluate(() => window.scrollTo(0, 0));
    await auth.page.waitForTimeout(200);

    if (width === 1440) {
      await auth.page.getByRole("link", { name: "Suche" }).first().click();
      await auth.page.waitForURL("**/search");
      await auth.page.getByRole("link", { name: "Profil" }).first().click();
      await auth.page.waitForURL("**/profil**");
      if (auth.errors.length) throw new Error(`profile console errors: ${auth.errors.join(" | ")}`);
    }

    return {
      width,
      profile: profileNav,
      search: searchNav,
      profileOverflow,
      profileHeaderTop: profileHeader.y,
      navBottom: profileNav.box.y + profileNav.box.height,
      scrolled: true,
    };
  } finally {
    await auth.context.close();
    await search.context.close();
  }
}

async function runApplicationsScroll(browser) {
  const { context, page, errors } = await preparePage(browser, { width: 1440, authenticated: true });
  try {
    await page.goto(`${base}/profil?tab=applications`, { waitUntil: "networkidle" });
    await page.locator(".dashboard-v2--applications").waitFor();
    await page.screenshot({ path: resolve(outDir, "applications-1440.png") });
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(200);
    const position = await page.locator(".navbar").evaluate((element) => getComputedStyle(element).position);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    if (position !== "relative") throw new Error(`applications navbar position ${position}, expected relative`);
    if (overflow > 0) throw new Error(`applications overflow ${overflow}px`);
    if (errors.length) throw new Error(`applications console errors: ${errors.join(" | ")}`);
    return { position, overflow };
  } finally {
    await context.close();
  }
}

const vite = startVite();
let browser;
try {
  await mkdir(outDir, { recursive: true });
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of [1920, 1440, 768, 390]) {
    results.push(await runWidth(browser, width));
  }
  const applications = await runApplicationsScroll(browser);
  console.log(JSON.stringify({ status: "PASS", results, applications }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* server already exited */
  }
}
