// JM-CV-SEARCH-PROFILE-HYDRATION-RELEASE-GATE-02
// Local Chromium checks for reload, consent and authenticated identity
// isolation of the read-only durable-profile hydration.
//
// Run: npm run test:e2e:cv-search-profile-hydration-release-gate-02
//
// Synthetic OIDC, mocked BFF/RIS only; no real data and no RIS writes.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const port = 5222;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-22T13:00:00.000Z";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
};

const cv = {
  cvId: "cv-1",
  filename: "Hydration_Release.pdf",
  contentType: "application/pdf",
  processingStatus: "ready",
  sizeBytes: 1234,
  createdAt: now,
  updatedAt: now,
  version: 1,
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

const missingSearchConsent = {
  ...grantedSearchConsent,
  status: "NOT_GRANTED",
  grantedAt: null,
  version: 0,
};

const profilesFor = (token) => [
  {
    schemaVersion: 1,
    searchProfileId: `sp-${token}`,
    cvId: "cv-1",
    name: `Profil ${token}`,
    origin: "cv",
    searchConfig: {
      skills: token === "token-a" ? "React, TypeScript" : "Python, Django",
      targetRoles: [token === "token-a" ? "Frontend Developer" : "Backend Developer"],
      city: "Berlin",
      radiusKm: 25,
      workModes: ["hybrid"],
      employmentTypes: ["full_time"],
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  },
];

const atsFor = (token) => ({
  [`sp-${token}`]: [
    {
      schemaVersion: 1,
      atsSearchProfileId: `ats-${token}`,
      searchProfileId: `sp-${token}`,
      name: `ATS ${token}`,
      targetRoles: [token === "token-a" ? "Frontend Engineer" : "Backend Engineer"],
      skills: [token === "token-a" ? "GraphQL" : "Django"],
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
      const response = await fetch(`${base}/profil?tab=cv`);
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

async function preparePage(browser, { token, searchConsent }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  await context.addInitScript(
    ({ userKey, value }) => {
      localStorage.setItem("mj-lang", "de");
      // Keep a deliberately switched test identity across reloads; the
      // initial synthetic user is only seeded when the tab has none.
      if (!sessionStorage.getItem(userKey)) {
        sessionStorage.setItem(userKey, JSON.stringify(value));
      }
    },
    { userKey: USER_KEY, value: authPayload(token) }
  );

  const page = await context.newPage();
  const hydration = { cv: [], ats: [], writes: [], profile: 0, jobs: 0 };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.startsWith("/api/ris/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      hydration.writes.push(`${method} ${path}`);
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
      hydration.profile += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: ["React"], experienceLevel: "Mid", targetRoles: ["Frontend"], location: "Berlin" }),
      });
    }
    if (path === "/api/jobs") {
      hydration.jobs += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: [], meta: {} }) });
    }
    if (path === "/api/ris/cvs" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [cv], nextCursor: null }),
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
      const requestToken = (request.headers().authorization ?? "").replace(/^Bearer\s+/i, "");
      if (type === "manual") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], nextCursor: null }),
        });
      }
      if (type === "cv") {
        hydration.cv.push({ token: requestToken, body: profilesFor(requestToken) });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: profilesFor(requestToken), nextCursor: null }),
        });
      }
      if (type === "ats") {
        hydration.ats.push({ token: requestToken });
        const parent = url.searchParams.get("searchProfileId") ?? "";
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: atsFor(requestToken)[parent] ?? [], nextCursor: null }),
        });
      }
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });

  return { context, page, hydration };
}

async function waitForHydration(page, kind) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/ris/search-profiles") &&
      response.url().includes(`type=${kind}`)
  );
}

async function runGrantedReload(browser) {
  const { context, page, hydration } = await preparePage(browser, {
    token: "token-a",
    searchConsent: grantedSearchConsent,
  });
  try {
    const firstCv = waitForHydration(page, "cv");
    const firstAts = waitForHydration(page, "ats");
    await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
    await firstCv;
    await firstAts;
    if (hydration.cv.length < 1 || hydration.ats.length < 1) {
      throw new Error("initial hydration missing");
    }
    if (hydration.profile || hydration.jobs) {
      throw new Error("login triggered AI or search");
    }

    const reloadCv = waitForHydration(page, "cv");
    const reloadAts = waitForHydration(page, "ats");
    await page.reload({ waitUntil: "networkidle" });
    await reloadCv;
    await reloadAts;
    if (hydration.cv.length < 2 || hydration.ats.length < 2) {
      throw new Error("reload did not hydrate again");
    }
    if (hydration.writes.length) throw new Error(`RIS writes: ${hydration.writes.join(", ")}`);
    if (hydration.cv.some((entry) => entry.token !== "token-a")) {
      throw new Error("unexpected token in reload hydration");
    }
    return { scenario: "reload", cv: hydration.cv.length, ats: hydration.ats.length };
  } finally {
    await context.close();
  }
}

async function runConsentDenied(browser) {
  const { context, page, hydration } = await preparePage(browser, {
    token: "token-b",
    searchConsent: missingSearchConsent,
  });
  try {
    await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    if (hydration.cv.length || hydration.ats.length) {
      throw new Error("hydration ran without search-profile consent");
    }
    if (hydration.profile || hydration.jobs) {
      throw new Error("consent check triggered AI or search");
    }
    if (hydration.writes.length) throw new Error(`RIS writes: ${hydration.writes.join(", ")}`);
    return { scenario: "consent-denied", cv: 0, ats: 0 };
  } finally {
    await context.close();
  }
}

async function runIdentityIsolation(browser) {
  const { context, page, hydration } = await preparePage(browser, {
    token: "token-a",
    searchConsent: grantedSearchConsent,
  });
  try {
    const firstCv = waitForHydration(page, "cv");
    const firstAts = waitForHydration(page, "ats");
    await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
    await firstCv;
    await firstAts;
    if (!hydration.cv.some((entry) => entry.token === "token-a")) {
      throw new Error("user A hydration missing");
    }

    await page.evaluate(
      ({ userKey, value }) => {
        sessionStorage.setItem(userKey, JSON.stringify(value));
      },
      { userKey: USER_KEY, value: authPayload("token-b") }
    );
    const secondCv = waitForHydration(page, "cv");
    const secondAts = waitForHydration(page, "ats");
    await page.reload({ waitUntil: "networkidle" });
    await secondCv;
    await secondAts;

    const tokens = hydration.cv.map((entry) => entry.token);
    if (!tokens.includes("token-a") || !tokens.includes("token-b")) {
      throw new Error(`identity switch did not hydrate both users: ${tokens.join(",")}`);
    }
    const last = hydration.cv.at(-1);
    if (!last || last.token !== "token-b" || last.body[0]?.name !== "Profil token-b") {
      throw new Error(`last hydration was not user B: ${JSON.stringify(last)}`);
    }
    if (hydration.writes.length) throw new Error(`RIS writes: ${hydration.writes.join(", ")}`);
    return { scenario: "identity-isolation", tokens };
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
    await runGrantedReload(browser),
    await runConsentDenied(browser),
    await runIdentityIsolation(browser),
  ];
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  if (browser) await browser.close();
  process.kill(-vite.pid, "SIGTERM");
}
