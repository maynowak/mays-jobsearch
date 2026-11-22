// JM-CV-SEARCH-PROFILE-DIRECT-SELECT-03
// Login -> CV upload area -> select a stored RIS CV -> use hydrated CV/ATS
// dropdowns and start exactly one existing search, without CV processing.
//
// Synthetic OIDC, mocked RIS/BFF, no real data, no RIS writes.
//
// Run: npm run test:e2e:cv-search-profile-direct-select-03

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const port = 5233;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-22T18:00:00.000Z";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
};

const cv = {
  cvId: "cv-1",
  filename: "Direktauswahl.pdf",
  contentType: "application/pdf",
  processingStatus: "ready",
  sizeBytes: 2048,
  createdAt: now,
  updatedAt: now,
  version: 1,
};

const cv2 = {
  ...cv,
  cvId: "cv-2",
  filename: "Zweitauswahl.pdf",
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

const profileNames = (token) => ({
  frontend: `${token} Frontend Berlin`,
  backend: `${token} Backend Hamburg`,
  frontendAts: `${token} Frontend ATS`,
  backendAts: `${token} Backend ATS`,
  secondFrontend: `${token} Zweit Frontend`,
  secondAts: `${token} Zweit ATS`,
});

const profilesFor = (token, cvId = "cv-1") => {
  if (cvId === "cv-2") {
    return [
      {
        schemaVersion: 1,
        searchProfileId: "sp-3",
        cvId: "cv-2",
        name: profileNames(token).secondFrontend,
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
    cvId: "cv-1",
    name: profileNames(token).frontend,
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
    cvId: "cv-1",
    name: profileNames(token).backend,
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

const atsFor = (token) => ({
  "sp-1": [
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-1",
      searchProfileId: "sp-1",
      name: profileNames(token).frontendAts,
      targetRoles: ["Frontend Engineer"],
      skills: ["React", "GraphQL"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ],
  "sp-3": [
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-3",
      searchProfileId: "sp-3",
      name: profileNames(token).secondAts,
      targetRoles: ["Backend Engineer"],
      skills: ["Python", "Django"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ],
  "sp-2": [
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-2",
      searchProfileId: "sp-2",
      name: profileNames(token).backendAts,
      targetRoles: ["Backend Engineer"],
      skills: ["Node.js", "Django"],
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

async function preparePage(browser, { width, token, searchConsent, failFirstCvList = false, twoCvs = false }) {
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
  };
  let cvListFailures = failFirstCvList ? 1 : 0;

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
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [], meta: {} }),
      });
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
      if (url.searchParams.get("action") === "document") {
        calls.cvDownloads += 1;
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: twoCvs ? [cv, cv2] : [cv], nextCursor: null }),
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
        const cvId = url.searchParams.get("cvId") ?? "cv-1";
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: profilesFor(requestToken, cvId), nextCursor: null }),
        });
      }
      if (type === "ats") {
        calls.atsLists.push(requestToken);
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

  return { context, page, calls };
}

async function openCvTab(page) {
  await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
  await page.locator(".cv-storage-card").first().waitFor();
}

async function selectDurableCv(page, waitForDropdown = true) {
  await page.getByRole("button", { name: "Profile auswählen" }).first().click();
  if (waitForDropdown) {
    await page.locator("#dashboard-v2-durable-search-profile").waitFor();
  }
}

async function chooseProfiles(page, token, { ats = true } = {}) {
  const names = profileNames(token);
  await page.locator("#dashboard-v2-durable-search-profile").selectOption({ label: names.frontend });
  await page.locator("#dashboard-v2-durable-ats-profile").waitFor();
  const options = await page.locator("#dashboard-v2-durable-ats-profile option").allTextContents();
  if (!options.includes(names.frontendAts) || options.includes(names.backendAts)) {
    throw new Error(`ATS parent filtering failed: ${options.join(" | ")}`);
  }
  if (ats) {
    await page.locator("#dashboard-v2-durable-ats-profile").selectOption({ label: names.frontendAts });
  }
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function runGranted(browser, width, { reload = false, search = true, twoCvs = false } = {}) {
  const { context, page, calls } = await preparePage(browser, {
    width,
    token: "token-a",
    searchConsent: grantedSearchConsent,
    twoCvs,
  });
  try {
    await openCvTab(page);
    await selectDurableCv(page);
    if (calls.profile || calls.jobs.length || calls.cvDownloads) {
      throw new Error("CV processing/AI/search started before explicit action");
    }
    await chooseProfiles(page, "token-a");
    await assertNoOverflow(page, `granted-${width}`);

    // Parent switch must clear the previous ATS child and only expose the
    // children of the newly selected CV search profile.
    const names = profileNames("token-a");
    await page.locator("#dashboard-v2-durable-search-profile").selectOption({ label: names.backend });
    if ((await page.locator("#dashboard-v2-durable-ats-profile").inputValue()) !== "") {
      throw new Error("ATS child was not reset after parent switch");
    }
    const backendAtsOptions = await page.locator("#dashboard-v2-durable-ats-profile option").allTextContents();
    if (!backendAtsOptions.includes(names.backendAts) || backendAtsOptions.includes(names.frontendAts)) {
      throw new Error(`ATS options not scoped to new parent: ${backendAtsOptions.join(" | ")}`);
    }
    await page.locator("#dashboard-v2-durable-search-profile").selectOption({ label: names.frontend });
    await page.locator("#dashboard-v2-durable-ats-profile").selectOption({ label: names.frontendAts });

    if (twoCvs) {
      await page.locator(".cv-storage-card").nth(1)
        .getByRole("button", { name: "Profile auswählen" }).click();
      await page.locator("#dashboard-v2-durable-search-profile").waitFor();
      if ((await page.locator("#dashboard-v2-durable-search-profile").inputValue()) !== "" ||
          (await page.locator("#dashboard-v2-durable-ats-profile").inputValue()) !== "") {
        throw new Error("profile selection was not reset after CV switch");
      }
      const secondOptions = await page.locator("#dashboard-v2-durable-search-profile option").allTextContents();
      if (!secondOptions.includes(names.secondFrontend) || secondOptions.includes(names.frontend)) {
        throw new Error(`CV switch exposed wrong profiles: ${secondOptions.join(" | ")}`);
      }
      await page.locator(".cv-storage-card").nth(0)
        .getByRole("button", { name: "Profile auswählen" }).click();
      await page.locator("#dashboard-v2-durable-search-profile").waitFor();
      await page.locator("#dashboard-v2-durable-search-profile").selectOption({ label: names.frontend });
      await page.locator("#dashboard-v2-durable-ats-profile").selectOption({ label: names.frontendAts });
    }

    if (search) {
      // Verify that the selected durable context is also available in the
      // existing saved-profile box on the search route.
      await page.locator('a[href="/search"]').first().click();
      await page.waitForURL("**/search");
      await page.locator("#cv-saved-search-profile").waitFor();
      const searchNames = profileNames("token-a");
      await page.locator("#cv-saved-search-profile").selectOption({ label: searchNames.frontend });
      await page.locator("#cv-saved-ats-profile").selectOption({ label: searchNames.frontendAts });
      if (calls.profile || calls.cvDownloads) {
        throw new Error("search dropdown use started CV processing");
      }
      const jobsBefore = calls.jobs.length;
      await page.locator(".cv-saved-profiles__start").click();
      const deadline = Date.now() + 10000;
      while (calls.jobs.length === jobsBefore && Date.now() < deadline) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
      if (calls.jobs.length !== 1) {
        throw new Error(`expected exactly one search, got ${calls.jobs.length}`);
      }
      const params = calls.jobs[0].searchParams;
      const skills = JSON.parse(params.get("skills") ?? "[]");
      if (!Array.isArray(skills) || !skills.includes("GraphQL") || !skills.includes("React")) {
        throw new Error(`ATS skills not used: ${params.get("skills")}`);
      }
      if (params.getAll("targetRole").join(",") !== "Frontend Engineer") {
        throw new Error(`ATS target role not used: ${params.getAll("targetRole")}`);
      }
      if (params.get("city") !== "Berlin" || params.get("radiusKm") !== "25") {
        throw new Error("parent search configuration not preserved");
      }
      if (params.get("workMode") !== "remote,hybrid") {
        throw new Error("parent work modes not preserved");
      }
      if (calls.profile !== 0 || calls.cvDownloads !== 0 || calls.risWrites.length || calls.unexpected.length) {
        throw new Error("unexpected AI/RIS call during direct selection search");
      }
    }

    if (reload) {
      await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
      await page.locator(".cv-storage-card").first().waitFor();
      await selectDurableCv(page);
      await chooseProfiles(page, "token-a", { ats: false });
      await assertNoOverflow(page, `reload-${width}`);
      if (calls.profile || calls.cvDownloads || calls.risWrites.length || calls.unexpected.length) {
        throw new Error("reload/direct selection caused processing or a write");
      }
    }

    return {
      scenario: "granted",
      width,
      searchCalls: calls.jobs.length,
      profileCalls: calls.profile,
      cvDownloads: calls.cvDownloads,
      risWrites: calls.risWrites.length,
      unexpected: calls.unexpected.length,
    };
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
    await openCvTab(page);
    const select = page.getByRole("button", { name: "Profile auswählen" }).first();
    if (!(await select.isDisabled())) throw new Error("direct selection enabled without consent");
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
    await openCvTab(page);
    await selectDurableCv(page, false);
    await page.getByText("Profile konnten nicht geladen werden.").waitFor();
    await page.getByRole("button", { name: "Erneut versuchen" }).click();
    await page.locator("#dashboard-v2-durable-search-profile").waitFor();
    await chooseProfiles(page, "token-a", { ats: false });
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
    await openCvTab(page);
    await selectDurableCv(page);
    await chooseProfiles(page, "token-a", { ats: false });
    const oldName = profileNames("token-a").frontend;

    await page.evaluate(
      ({ userKey, value }) => {
        sessionStorage.setItem(userKey, JSON.stringify(value));
      },
      { userKey: USER_KEY, value: authPayload("token-b") }
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".cv-storage-card").first().waitFor();
    await selectDurableCv(page);
    await page.locator("#dashboard-v2-durable-search-profile").waitFor();
    const options = await page.locator("#dashboard-v2-durable-search-profile option").allTextContents();
    if (options.includes(oldName) || !options.includes(profileNames("token-b").frontend)) {
      throw new Error(`user isolation failed: ${options.join(" | ")}`);
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
    await runGranted(browser, 1440, { reload: true, search: true, twoCvs: true }),
    await runGranted(browser, 390, { reload: false, search: false }),
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
