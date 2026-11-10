// PROFILE-UX-CONSOLIDATION-01 — direct search from durable CV/ATS profiles.
//
// Synthetic OIDC session and mocked RIS/BFF/search responses only. No real
// Cognito/RIS/AWS call and no real user data.
//
// Run: npm run test:e2e:direct-search

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/PROFILE-UX-CONSOLIDATION-01-DIRECT-SEARCH");
const port = 5217;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-10T12:00:00.000Z";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const job = {
  slug: "react-frontend-job",
  title: "React Frontend Job",
  company_name: "Synthetic GmbH",
  location: ["Berlin"],
  remote: false,
  tags: ["react", "typescript"],
  url: "https://example.invalid/job",
};

const cv = {
  cvId: "cv-1",
  filename: "Lebenslauf_2026.pdf",
  contentType: "application/pdf",
  processingStatus: "ready",
  sizeBytes: 123456,
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

const searchConsent = {
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

const cvProfiles = [
  {
    schemaVersion: 1,
    searchProfileId: "sp-1",
    cvId: "cv-1",
    name: "Frontend Berlin",
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
    name: "Frontend Berlin",
    origin: "cv",
    searchConfig: {
      skills: "Vue, CSS",
      targetRoles: ["Frontend Developer"],
      city: "Potsdam",
      radiusKm: 50,
      workModes: ["hybrid"],
      employmentTypes: ["full_time"],
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  },
];

const atsProfiles = {
  "sp-1": [
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-1",
      searchProfileId: "sp-1",
      name: "Frontend ATS",
      targetRoles: ["Frontend Engineer"],
      skills: ["React", "GraphQL"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-2",
      searchProfileId: "sp-1",
      name: "ATS Backend",
      targetRoles: ["Backend Engineer"],
      skills: ["Node.js", "PostgreSQL"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ],
  "sp-2": [],
};

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

async function preparePage(browser, viewport) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(
    ({ future: expiry, userKey }) => {
      localStorage.setItem("mj-lang", "de");
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
            sub: "e2e-direct-search",
            email: "direct-search@example.invalid",
            name: "E2E Direct Search",
          },
          expires_at: expiry,
        })
      );
    },
    { future, userKey: USER_KEY }
  );

  const page = await context.newPage();
  const jobsRequests = [];
  const risWrites = [];
  const unexpected = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.startsWith("/api/ris/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      risWrites.push(`${method} ${path}`);
    }

    if (path === "/api/models") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(models),
      });
    }

    if (path === "/api/jobs") {
      jobsRequests.push(url);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [job], meta: { totalFiltered: 1, sources: {} } }),
      });
    }

    if (
      path === "/api/profile" ||
      path === "/api/ats" ||
      path === "/api/match" ||
      path === "/api/cover-letter" ||
      path === "/api/job-details"
    ) {
      unexpected.push(`${method} ${path}`);
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unexpected", code: "unexpected" }),
      });
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
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent: searchConsent,
          noticeVersion: "search-profile-storage/1.0",
          noticeState: "APPROVED",
          noticeApproved: true,
          acceptedForNewGrant: true,
          grantAllowed: true,
          noticeReason: null,
          textVersion: searchConsent.externalTextVersion,
          textHash: searchConsent.externalTextSha256,
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textSyntheticAllowed: false,
          textReason: null,
          specialCategoriesConsent: false,
          specialCategories: [],
          externalTextVersion: searchConsent.externalTextVersion,
          externalTextSha256: searchConsent.externalTextSha256,
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
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: cvProfiles, nextCursor: null }),
        });
      }
      if (type === "ats") {
        const parent = url.searchParams.get("searchProfileId") ?? "";
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: atsProfiles[parent] ?? [], nextCursor: null }),
        });
      }
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });

  return { context, page, jobsRequests, risWrites, unexpected };
}

async function openProfiles(page) {
  await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
  await page.locator(".cv-storage-card").waitFor();
  await page.getByRole("button", { name: "Suchprofile anzeigen" }).click();
  await page.locator(".cv-profile-manager").waitFor();
  await page.getByText("2 CV-Suchprofile · 2 ATS-Profile").waitFor();
}

function assertNoOverflow(page, name) {
  return page.evaluate((label) => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    if (overflow > 0) throw new Error(`${label}: horizontal overflow ${overflow}px`);
  }, name);
}

async function runViewport(browser, width) {
  const { context, page, jobsRequests, risWrites, unexpected } = await preparePage(browser, {
    width,
    height: width <= 430 ? 844 : 900,
  });
  await mkdir(evidenceDir, { recursive: true });

  // CV search profile, first of two same-named cards.
  await openProfiles(page);
  await assertNoOverflow(page, `profiles-${width}`);
  await page.screenshot({ path: resolve(evidenceDir, `profiles-${width}.png`) });
  const cvList = page.locator(".profile-manager__section").first().locator("ul.profile-card-list").first();
  const cvCards = cvList.locator(":scope > li.profile-card");
  await cvCards.nth(0).getByRole("button", { name: "🔍 Damit suchen" }).click();
  await page.waitForURL("**/search");
  await page.getByText("React Frontend Job").waitFor();
  const first = jobsRequests.at(-1);
  if (!first) throw new Error("first search did not call /api/jobs");
  const firstSkills = JSON.parse(first.searchParams.get("skills") ?? "[]");
  if (!Array.isArray(firstSkills) || firstSkills.join(",") !== "React,TypeScript") {
    throw new Error(`unexpected CV skills: ${first.searchParams.get("skills")}`);
  }
  if (first.searchParams.get("city") !== "Berlin") {
    throw new Error(`unexpected CV city: ${first.searchParams.get("city")}`);
  }
  if (!first.searchParams.getAll("targetRole").includes("Frontend Developer")) {
    throw new Error("CV target role missing");
  }
  await assertNoOverflow(page, `search-cv-${width}`);
  await page.screenshot({ path: resolve(evidenceDir, `search-cv-${width}.png`) });

  // Reload, reopen the same durable profiles, then use the ATS child.
  await openProfiles(page);
  await page.getByRole("button", { name: "Zugehörige ATS-Profile anzeigen" }).first().click();
  await page.getByText("Frontend ATS").waitFor();
  const atsCard = page.getByText("Frontend ATS").locator("..").locator("..");
  await atsCard.getByRole("button", { name: "🔍 Damit suchen" }).click();
  await page.waitForURL("**/search");
  await page.getByText("React Frontend Job").waitFor();
  const second = jobsRequests.at(-1);
  if (!second) throw new Error("ATS search did not call /api/jobs");
  const skills = JSON.parse(second.searchParams.get("skills") ?? "[]");
  if (!Array.isArray(skills) || !skills.includes("React") || !skills.includes("GraphQL")) {
    throw new Error(`unexpected ATS skills: ${second.searchParams.get("skills")}`);
  }
  if (!second.searchParams.getAll("targetRole").includes("Frontend Engineer")) {
    throw new Error("ATS target role missing");
  }
  if (second.searchParams.get("city") !== "Berlin" || second.searchParams.get("radiusKm") !== "25") {
    throw new Error("ATS parent location/radius not preserved");
  }
  if (second.searchParams.get("workMode") !== "remote,hybrid") {
    throw new Error("ATS parent work modes not preserved");
  }
  if (second.searchParams.get("employmentType") !== "full_time") {
    throw new Error("ATS parent employment type not preserved");
  }

  // Second same-named CV card remains a distinct profile ID.
  await openProfiles(page);
  const cvListAgain = page.locator(".profile-manager__section").first().locator("ul.profile-card-list").first();
  const cvCardsAgain = cvListAgain.locator(":scope > li.profile-card");
  await cvCardsAgain.nth(1).getByRole("button", { name: "🔍 Damit suchen" }).click();
  await page.waitForURL("**/search");
  await page.getByText("React Frontend Job").waitFor();
  const third = jobsRequests.at(-1);
  if (!third) throw new Error("second same-named profile did not call /api/jobs");
  const thirdSkills = JSON.parse(third.searchParams.get("skills") ?? "[]");
  if (!Array.isArray(thirdSkills) || thirdSkills.join(",") !== "Vue,CSS") {
    throw new Error(`same-name profiles were confused: ${third.searchParams.get("skills")}`);
  }

  if (risWrites.length) throw new Error(`RIS writes occurred: ${risWrites.join(", ")}`);
  if (unexpected.length) throw new Error(`unexpected CV/AI calls: ${unexpected.join(", ")}`);
  if (jobsRequests.length !== 3) throw new Error(`expected exactly 3 searches, got ${jobsRequests.length}`);

  await context.close();
  return {
    width,
    searches: jobsRequests.length,
    risWrites: risWrites.length,
    unexpectedCalls: unexpected.length,
  };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  for (const width of [320, 390, 430, 768, 1440]) {
    results.push(await runViewport(browser, width));
  }
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
