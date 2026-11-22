// JM-CV-SEARCH-LOGIN-AUTOHYDRATION-04
// New browser session -> synthetic login -> open /search directly -> select
// stored RIS CV in the search UI -> CV/ATS profiles -> exactly one search.
// No profile-management visit and no CV processing.
//
// Synthetic OIDC, mocked RIS/BFF, no real data, no RIS writes.
//
// Run: npm run test:e2e:cv-search-login-autohydration-04

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const port = 5234;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-22T19:00:00.000Z";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
};

const cv1 = {
  cvId: "cv-direct-1",
  filename: "Autohydration.pdf",
  contentType: "application/pdf",
  processingStatus: "ready",
  sizeBytes: 2048,
  createdAt: now,
  updatedAt: now,
  version: 1,
};
const cv2 = {
  ...cv1,
  cvId: "cv-direct-2",
  filename: "Autohydration-Zweit.pdf",
};

const cvConsent = {
  purpose: "cv-storage",
  status: "GRANTED",
  noticeVersion: "cv-storage/1.0",
  grantedAt: now,
  withdrawnAt: null,
  version: 1,
  specialCategoriesConsent: true,
  specialCategories: [],
  externalTextVersion: "cv-storage-consent-2026-11-08-v1",
  externalTextSha256: "synthetic",
};

const grantedSearchConsent = {
  purpose: "search-profile-storage",
  status: "GRANTED",
  noticeVersion: "search-profile-storage/1.0",
  grantedAt: now,
  withdrawnAt: null,
  version: 1,
  specialCategoriesConsent: false,
  specialCategories: [],
  externalTextVersion: "search-profile-storage-consent-2026-11-08-v2",
  externalTextSha256: "synthetic",
};
const missingSearchConsent = { ...grantedSearchConsent, status: "NOT_GRANTED", grantedAt: null, version: 0 };

const names = (token, cvId) =>
  cvId === "cv-direct-2"
    ? {
        first: `${token} Zweit Frontend`,
        second: `${token} Zweit Backend`,
        ats: `${token} Zweit ATS`,
      }
    : {
        first: `${token} Direkt Frontend`,
        second: `${token} Direkt Backend`,
        ats: `${token} Direkt ATS`,
      };

const profilesFor = (token, cvId) => {
  const current = names(token, cvId);
  if (cvId === "cv-direct-2") {
    return [
      {
        schemaVersion: 1,
        searchProfileId: "sp-10",
        cvId,
        name: current.first,
        origin: "cv",
        searchConfig: {
          skills: "Python, Django",
          targetRoles: ["Backend Developer"],
          city: "Munich",
          radiusKm: 30,
          workModes: ["remote"],
          employmentTypes: ["full_time"],
        },
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
    ];
  }
  return [
    {
      schemaVersion: 1,
      searchProfileId: "sp-1",
      cvId,
      name: current.first,
      origin: "cv",
      searchConfig: {
        skills: "React, TypeScript",
        targetRoles: ["Frontend Developer"],
        city: "Berlin",
        radiusKm: 25,
        workModes: ["remote", "hybrid"],
        employmentTypes: ["full_time"],
      },
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      schemaVersion: 1,
      searchProfileId: "sp-2",
      cvId,
      name: current.second,
      origin: "cv",
      searchConfig: {
        skills: "Node.js, PostgreSQL",
        targetRoles: ["Backend Developer"],
        city: "Hamburg",
        radiusKm: 50,
        workModes: ["hybrid"],
        employmentTypes: ["full_time"],
      },
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ];
};

const atsFor = (token, cvId) => ({
  "sp-1": [
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-1",
      searchProfileId: "sp-1",
      name: `${token} Direkt ATS`,
      targetRoles: ["Frontend Engineer"],
      skills: ["React", "GraphQL"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ],
  "sp-2": [],
  "sp-10": [
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-10",
      searchProfileId: "sp-10",
      name: `${token} Zweit ATS`,
      targetRoles: ["Backend Engineer"],
      skills: ["Python", "Django"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ],
});

function startVite() {
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--port", String(port), "--strictPort"],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: {
        ...process.env,
        VITE_RIS_CV_STORAGE_ENABLED: "true",
        VITE_RIS_SEARCH_PROFILE_STORAGE_ENABLED: "true",
      },
    }
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

function authPayload(token) {
  return {
    id_token: `id-${token}`,
    session_state: null,
    access_token: token,
    refresh_token: null,
    token_type: "Bearer",
    scope: "openid email profile",
    profile: {
      iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
      sub: `sub-${token}`,
      email: `${token}@example.invalid`,
      name: token,
    },
    expires_at: future,
  };
}

async function preparePage(browser, { width, token, searchConsent, failFirstCvList = false }) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(
    ({ userKey, value }) => {
      localStorage.setItem("mj-lang", "de");
      if (!sessionStorage.getItem(userKey)) {
        sessionStorage.setItem(userKey, JSON.stringify(value));
      }
    },
    { userKey: USER_KEY, value: authPayload(token) }
  );

  const page = await context.newPage();
  const calls = {
    profile: 0,
    jobs: [],
    risWrites: [],
    unexpected: [],
    cvLists: [],
    atsLists: [],
    cvDownloads: 0,
    profileRouteVisits: 0,
  };
  let cvListFailures = failFirstCvList ? 1 : 0;

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/profil" || path.startsWith("/profil?")) {
      calls.profileRouteVisits += 1;
    }
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const requestToken = (request.headers().authorization ?? "").replace(/^Bearer\s+/i, "");

    if (path.startsWith("/api/ris/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      calls.risWrites.push(`${method} ${path}`);
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unexpected RIS write", code: "unexpected" }),
      });
    }
    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/profile") {
      calls.profile += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: ["React"], experienceLevel: "Mid", targetRoles: ["Frontend"], location: "Berlin" }),
      });
    }
    if (path === "/api/jobs") {
      calls.jobs.push(url);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: [], meta: {} }) });
    }
    if (path === "/api/ats" || path === "/api/match" || path === "/api/cover-letter") {
      calls.unexpected.push(`${method} ${path}`);
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unexpected", code: "unexpected" }),
      });
    }
    if (path === "/api/ris/cvs" && method === "GET") {
      if (url.searchParams.get("action") === "document") calls.cvDownloads += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [cv1, cv2], nextCursor: null }),
      });
    }
    if (path === "/api/ris/cv-consents" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent: cvConsent,
          noticeVersion: "cv-storage/1.0",
          noticeState: "APPROVED",
          noticeApproved: true,
          acceptedForNewGrant: true,
          grantAllowed: true,
          textVersion: cvConsent.externalTextVersion,
          textHash: cvConsent.externalTextSha256,
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textReason: null,
          specialCategoriesConsent: true,
          specialCategories: [],
          externalTextVersion: cvConsent.externalTextVersion,
          externalTextSha256: cvConsent.externalTextSha256,
        }),
      });
    }
    if (path === "/api/ris/search-profile-consents" && method === "GET") {
      const consent = searchConsent;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent,
          noticeVersion: "search-profile-storage/1.0",
          noticeState: "APPROVED",
          noticeApproved: true,
          acceptedForNewGrant: true,
          grantAllowed: true,
          noticeReason: null,
          textVersion: consent.externalTextVersion,
          textHash: consent.externalTextSha256,
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textSyntheticAllowed: true,
          textReason: null,
          specialCategoriesConsent: false,
          specialCategories: [],
          externalTextVersion: consent.externalTextVersion,
          externalTextSha256: consent.externalTextSha256,
        }),
      });
    }
    if (path === "/api/ris/search-profiles" && method === "GET") {
      const type = url.searchParams.get("type");
      if (type === "manual") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], nextCursor: null }),
        });
      }
      if (type === "cv") {
        calls.cvLists.push(requestToken);
        if (cvListFailures > 0) {
          cvListFailures -= 1;
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "synthetic profile load failure", code: "synthetic" }),
          });
        }
        const cvId = url.searchParams.get("cvId") ?? cv1.cvId;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: profilesFor(requestToken, cvId), nextCursor: null }),
        });
      }
      if (type === "ats") {
        calls.atsLists.push(requestToken);
        const parent = url.searchParams.get("searchProfileId") ?? "";
        const cvId = parent === "sp-10" ? cv2.cvId : cv1.cvId;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: atsFor(requestToken, cvId)[parent] ?? [], nextCursor: null }),
        });
      }
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });

  return { context, page, calls };
}

async function openSearch(page) {
  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
}

async function chooseSearch(page, token, cvId) {
  await page.locator("#cv-saved-durable-cv").selectOption({ value: cvId });
  await page.locator("#cv-saved-search-profile").waitFor();
  const current = names(token, cvId);
  await page.locator("#cv-saved-search-profile").selectOption({ label: current.first });
  await page.locator("#cv-saved-ats-profile").waitFor();
  const atsOptions = await page.locator("#cv-saved-ats-profile option").allTextContents();
  if (!atsOptions.includes(current.ats)) {
    throw new Error(`ATS profile missing: ${atsOptions.join(" | ")}`);
  }
  await page.locator("#cv-saved-ats-profile").selectOption({ label: current.ats });
}

async function assertCleanBeforeSearch(calls) {
  if (calls.profile || calls.jobs.length || calls.cvDownloads || calls.risWrites.length || calls.unexpected.length) {
    throw new Error(`unexpected pre-search call: ${JSON.stringify(calls)}`);
  }
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`${label}: overflow ${overflow}px`);
}

async function runMain(browser) {
  const { context, page, calls } = await preparePage(browser, {
    width: 1440,
    token: "token-a",
    searchConsent: grantedSearchConsent,
  });
  try {
    await openSearch(page);
    await page.locator("#cv-saved-durable-cv").waitFor();
    const options = await page.locator("#cv-saved-durable-cv option").allTextContents();
    if (options.length !== 3) throw new Error(`expected two stored CVs: ${options.join(" | ")}`);
    if (!options.some((option) => option.includes("Autohydration.pdf")) ||
        !options.some((option) => option.includes("Autohydration-Zweit.pdf"))) {
      throw new Error(`stored CV labels missing: ${options.join(" | ")}`);
    }
    await assertCleanBeforeSearch(calls);

    await chooseSearch(page, "token-a", cv1.cvId);
    const paramsBefore = calls.jobs.length;
    await page.locator(".cv-saved-profiles__start").click();
    const deadline = Date.now() + 10000;
    while (calls.jobs.length === paramsBefore && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    if (calls.jobs.length !== 1) throw new Error(`expected one search, got ${calls.jobs.length}`);
    const params = calls.jobs[0].searchParams;
    const skills = JSON.parse(params.get("skills") ?? "[]");
    if (!Array.isArray(skills) || !skills.includes("GraphQL")) {
      throw new Error(`ATS skills missing: ${params.get("skills")}`);
    }
    if (params.getAll("targetRole").join(",") !== "Frontend Engineer") {
      throw new Error(`ATS target role missing: ${params.getAll("targetRole")}`);
    }
    if (params.get("city") !== "Berlin" || params.get("radiusKm") !== "25") {
      throw new Error("stored parent parameters missing");
    }
    if (calls.profile || calls.cvDownloads || calls.risWrites.length || calls.unexpected.length) {
      throw new Error("processing or write occurred during search selection");
    }
    if (calls.profileRouteVisits !== 0) throw new Error("profile route was visited");

    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#cv-saved-durable-cv").waitFor();
    await chooseSearch(page, "token-a", cv1.cvId);
    await assertNoOverflow(page, "main-1440");

    return {
      scenario: "main",
      width: 1440,
      searchCalls: calls.jobs.length,
      profileCalls: calls.profile,
      cvDownloads: calls.cvDownloads,
      risWrites: calls.risWrites.length,
      unexpected: calls.unexpected.length,
      profileRouteVisits: calls.profileRouteVisits,
    };
  } finally {
    await context.close();
  }
}

async function runMobile(browser) {
  const { context, page, calls } = await preparePage(browser, {
    width: 390,
    token: "token-a",
    searchConsent: grantedSearchConsent,
  });
  try {
    await openSearch(page);
    await page.locator("#cv-saved-durable-cv").waitFor();
    await page.locator("#cv-saved-durable-cv").selectOption({ value: cv2.cvId });
    await page.locator("#cv-saved-search-profile").waitFor();
    await assertNoOverflow(page, "mobile-390");
    await assertCleanBeforeSearch(calls);
    return { scenario: "mobile", width: 390, profileRouteVisits: calls.profileRouteVisits };
  } finally {
    await context.close();
  }
}

async function runConsentDenied(browser) {
  const { context, page, calls } = await preparePage(browser, {
    width: 1440,
    token: "token-a",
    searchConsent: missingSearchConsent,
  });
  try {
    await openSearch(page);
    await page.waitForTimeout(600);
    if (await page.locator("#cv-saved-durable-cv").count()) {
      throw new Error("durable CV picker is visible without search-profile consent");
    }
    if (calls.cvLists.length || calls.atsLists.length) {
      throw new Error("profiles loaded without search-profile consent");
    }
    return { scenario: "consent-denied", cvLists: calls.cvLists.length, atsLists: calls.atsLists.length };
  } finally {
    await context.close();
  }
}

async function runLoadError(browser) {
  const { context, page, calls } = await preparePage(browser, {
    width: 1440,
    token: "token-a",
    searchConsent: grantedSearchConsent,
    failFirstCvList: true,
  });
  try {
    await openSearch(page);
    await page.locator("#cv-saved-durable-cv").waitFor();
    await page.locator("#cv-saved-durable-cv").selectOption({ value: cv1.cvId });
    await page.getByText("Profile konnten nicht geladen werden.").waitFor();
    await page.getByRole("button", { name: "Erneut versuchen" }).click();
    await page.locator("#cv-saved-search-profile").waitFor();
    return { scenario: "load-error-retry", cvLists: calls.cvLists.length };
  } finally {
    await context.close();
  }
}

async function runIdentityIsolation(browser) {
  const { context, page, calls } = await preparePage(browser, {
    width: 1440,
    token: "token-a",
    searchConsent: grantedSearchConsent,
  });
  try {
    await openSearch(page);
    await page.locator("#cv-saved-durable-cv").waitFor();
    await page.locator("#cv-saved-durable-cv").selectOption({ value: cv1.cvId });
    await page.locator("#cv-saved-search-profile").waitFor();
    const oldName = names("token-a", cv1.cvId).first;
    await page.evaluate(
      ({ userKey, value }) => sessionStorage.setItem(userKey, JSON.stringify(value)),
      { userKey: USER_KEY, value: authPayload("token-b") }
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#cv-saved-durable-cv").waitFor();
    await page.locator("#cv-saved-durable-cv").selectOption({ value: cv1.cvId });
    await page.locator("#cv-saved-search-profile").waitFor();
    const options = await page.locator("#cv-saved-search-profile option").allTextContents();
    if (options.includes(oldName) || !options.includes(names("token-b", cv1.cvId).first)) {
      throw new Error(`identity isolation failed: ${options.join(" | ")}`);
    }
    if (calls.profile || calls.cvDownloads || calls.risWrites.length || calls.unexpected.length) {
      throw new Error("identity switch caused processing or a write");
    }
    return { scenario: "identity-isolation", options };
  } finally {
    await context.close();
  }
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const results = [
    await runMain(browser),
    await runMobile(browser),
    await runConsentDenied(browser),
    await runLoadError(browser),
    await runIdentityIsolation(browser),
  ];
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* server already exited */
  }
}
