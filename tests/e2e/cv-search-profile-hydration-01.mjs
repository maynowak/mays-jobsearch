// JM-CV-SEARCH-PROFILE-HYDRATION-01
// Local Chromium E2E with synthetic OIDC, mocked RIS/BFF and no real data.
//
// Proves that durable CV/ATS search profiles are hydrated after login into
// the existing CV dropdowns, can be selected for a search, and that login
// itself creates no profile and starts no search/AI processing.
//
// Run: node tests/e2e/cv-search-profile-hydration-01.mjs

import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const fixturePdf = resolve(repoRoot, "tests/fixtures/cv/synthetic-cv.pdf");
const port = 5221;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-22T12:00:00.000Z";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
};

const suggestedProfile = {
  skills: ["React", "TypeScript"],
  experienceLevel: "Mid",
  targetRoles: ["Frontend Developer"],
  location: "Berlin",
};

const job = {
  slug: "synthetic-hydration-job",
  title: "Synthetic Hydration Job",
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
    name: "Dauerhaft Frontend",
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
];

const atsProfiles = {
  "sp-1": [
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-1",
      searchProfileId: "sp-1",
      name: "Dauerhaft ATS",
      targetRoles: ["Frontend Engineer"],
      skills: ["React", "GraphQL"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  ],
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

async function preparePage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
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
            sub: "e2e-hydration",
            email: "hydration@example.invalid",
            name: "E2E Hydration",
          },
          expires_at: expiry,
        })
      );
    },
    { future, userKey: USER_KEY }
  );

  const page = await context.newPage();
  const pdfBytes = await readFile(fixturePdf);
  const profileRequests = [];
  const jobsRequests = [];
  const risWrites = [];
  const unexpected = [];
  const hydration = { cv: 0, ats: 0 };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.startsWith("/api/ris/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      risWrites.push(`${method} ${path}`);
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
      profileRequests.push(method);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(suggestedProfile) });
    }
    if (path === "/api/jobs") {
      jobsRequests.push(url);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [job], meta: { totalFiltered: 1, sources: {} } }),
      });
    }
    if (path === "/api/ats" || path === "/api/match" || path === "/api/cover-letter") {
      unexpected.push(`${method} ${path}`);
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unexpected", code: "unexpected" }),
      });
    }

    if (path === "/api/ris/cvs" && method === "GET") {
      if (url.searchParams.get("action") === "document") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ downloadUrl: "https://download.invalid/hydration-cv.pdf" }),
        });
      }
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
        hydration.cv += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: cvProfiles, nextCursor: null }),
        });
      }
      if (type === "ats") {
        hydration.ats += 1;
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

  await context.route("https://download.invalid/hydration-cv.pdf", (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: pdfBytes })
  );

  return { context, page, profileRequests, jobsRequests, risWrites, unexpected, hydration };
}

async function run() {
  const browser = await playwright.chromium.launch({ headless: true });
  const { context, page, profileRequests, jobsRequests, risWrites, unexpected, hydration } =
    await preparePage(browser);

  try {
    const hydrationCv = page.waitForResponse(
      (response) =>
        response.url().includes("/api/ris/search-profiles") &&
        response.url().includes("type=cv")
    );
    const hydrationAts = page.waitForResponse(
      (response) =>
        response.url().includes("/api/ris/search-profiles") &&
        response.url().includes("type=ats")
    );

    await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
    await page.locator(".cv-storage-card").waitFor();
    await hydrationCv;
    await hydrationAts;
    if (hydration.cv < 1 || hydration.ats < 1) {
      throw new Error(`login hydration missing: ${JSON.stringify(hydration)}`);
    }
    if (profileRequests.length !== 0) throw new Error("AI profile request started on login");
    if (jobsRequests.length !== 0) throw new Error("job search started on login");

    // Process the stored CV through the existing workflow; this is a user
    // action and must not create a profile by itself.
    await page.getByRole("button", { name: /Verarbeiten/ }).first().click();
    await page.getByText("CV-Verarbeitung erlauben?").waitFor();
    if (profileRequests.length !== 0) throw new Error("AI profile request started before consent");
    await page.getByRole("checkbox", { name: /Ich stimme der Verarbeitung meiner CV-Daten/ }).check();
    await page.getByRole("button", { name: "Verarbeitung erlauben" }).click();
    await page.locator(".cv-anonymization-choice").waitFor();
    await page.getByRole("button", { name: "Weiter", exact: true }).click();
    await page.locator("#cv-model-selection-title").waitFor();
    await page.getByRole("button", { name: "Verarbeiten", exact: true }).click();
    await page.locator(".cv-result").waitFor();
    if (profileRequests.length !== 1) {
      throw new Error(`expected one profile request after consent, got ${profileRequests.length}`);
    }
    await page.getByRole("button", { name: "Workflow schließen" }).click();
    // The profile route keeps the durable list visible; the existing saved
    // profile dropdown lives on the search route. Client-side navigation keeps
    // the session CV state and the hydrated lists.
    await page.locator('a[href="/search"]').first().click();
    await page.waitForURL("**/search");
    await page.locator("#cv-saved-search-profile").waitFor({ timeout: 10000 });

    // The existing saved-profile dropdowns must expose the hydrated durable
    // profiles and the ATS child. Selecting them must use their values.
    await page.locator("#cv-saved-search-profile").selectOption({ label: "Dauerhaft Frontend" });
    await page.locator("#cv-saved-ats-profile").waitFor();
    await page.locator("#cv-saved-ats-profile").selectOption({ label: "Dauerhaft ATS" });
    await page.locator(".cv-saved-profiles__start").click();

    const deadline = Date.now() + 10000;
    while (jobsRequests.length === 0 && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    if (jobsRequests.length !== 1) {
      throw new Error(`expected one search request, got ${jobsRequests.length}`);
    }
    const params = jobsRequests[0];
    const skills = JSON.parse(params.searchParams.get("skills") ?? "[]");
    if (!Array.isArray(skills) || !skills.includes("React") || !skills.includes("GraphQL")) {
      throw new Error(`durable ATS skills not used: ${params.searchParams.get("skills")}`);
    }
    if (params.searchParams.get("city") !== "Berlin" || params.searchParams.get("radiusKm") !== "25") {
      throw new Error("durable parent location/radius not preserved");
    }
    if (params.searchParams.get("workMode") !== "remote,hybrid") {
      throw new Error("durable parent work modes not preserved");
    }
    if (params.searchParams.getAll("targetRole").join(",") !== "Frontend Engineer") {
      throw new Error(`durable ATS target role not used: ${params.searchParams.getAll("targetRole")}`);
    }

    if (profileRequests.length !== 1) {
      throw new Error(`dropdown use reprocessed the CV (${profileRequests.length} profile calls)`);
    }
    if (risWrites.length) throw new Error(`RIS writes occurred: ${risWrites.join(", ")}`);
    if (unexpected.length) throw new Error(`unexpected AI/ATS calls: ${unexpected.join(", ")}`);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    if (overflow > 0) throw new Error(`horizontal overflow: ${overflow}px`);

    console.log(
      JSON.stringify(
        {
          status: "PASS",
          hydration,
          profileRequests: profileRequests.length,
          jobsRequests: jobsRequests.length,
          risWrites: risWrites.length,
          unexpectedCalls: unexpected.length,
          overflow,
        },
        null,
        2
      )
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

const vite = startVite();
try {
  await waitForServer();
  await run();
} finally {
  process.kill(-vite.pid, "SIGTERM");
}
