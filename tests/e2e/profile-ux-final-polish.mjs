// DESIGN-PROFILE-UX-CONSOLIDATION-01 — FINAL POLISH
// Local Chromium E2E for the persistent profile hierarchy.
//
// Synthetic session only. All RIS/BFF responses are mocked in the browser;
// no Cognito login, RIS call, AWS access or real user data is involved.
//
// Run: npm run test:e2e:profile-ux-final

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(
  repoRoot,
  "docs/reports/assets/DESIGN-PROFILE-UX-CONSOLIDATION-01-FINAL-E2E"
);
const port = 5214;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-10T09:00:00.000Z";

const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};

const cvDocument = {
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

const searchProfileConsent = {
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
      skills: "React, TypeScript, „Node.js“, GraphQL, Docker, AWS, SQL, Python",
      targetRoles: ["Frontend Developer", "Software Engineer"],
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
      targetRoles: ["Frontend Developer"],
      skills: ["React", "TypeScript", "GraphQL", "Docker", "AWS", "SQL", "Python", "Go"],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    {
      schemaVersion: 1,
      atsSearchProfileId: "ats-2",
      searchProfileId: "sp-1",
      name: "ATS Backend",
      targetRoles: ["Backend Developer"],
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
            sub: "e2e-profile-ux",
            email: "e2e@example.invalid",
            name: "E2E Profile",
          },
          expires_at: expiry,
        })
      );
    },
    { future, userKey: USER_KEY }
  );

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/models") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(models),
      });
    }

    if (path === "/api/ris/cvs" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [cvDocument], nextCursor: null }),
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
          textVersion: "cv-storage-consent-2026-11-08-v1",
          textHash: "synthetic",
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textSyntheticAllowed: false,
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
          consent: searchProfileConsent,
          noticeVersion: "search-profile-storage/1.0",
          noticeState: "APPROVED",
          noticeApproved: true,
          acceptedForNewGrant: true,
          grantAllowed: true,
          noticeReason: null,
          textVersion: "search-profile-storage-consent-2026-11-08-v2",
          textHash: "synthetic",
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textSyntheticAllowed: false,
          textReason: null,
          specialCategoriesConsent: false,
          specialCategories: [],
          externalTextVersion: searchProfileConsent.externalTextVersion,
          externalTextSha256: searchProfileConsent.externalTextSha256,
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
          body: JSON.stringify({
            items: atsProfiles[parent] ?? [],
            nextCursor: null,
          }),
        });
      }
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });

  return { context, page, consoleErrors };
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  if (overflow > 0) throw new Error(`${name}: horizontal overflow ${overflow}px`);
  return overflow;
}

async function openProfileManager(page) {
  await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
  await page.locator(".cv-storage-card").waitFor();
  await page.getByRole("button", { name: "Suchprofile anzeigen" }).click();
  await page.locator(".cv-profile-manager").waitFor();
  await page.getByRole("heading", { name: "CV-Suchprofile" }).waitFor();
  await page.locator("#persistent-cv-search-title").waitFor();
}

async function runFullFlow(browser) {
  const { context, page, consoleErrors } = await preparePage(browser, {
    width: 1440,
    height: 1000,
  });
  await openProfileManager(page);

  const cvList = page
    .locator(".profile-manager__section")
    .first()
    .locator("ul.profile-card-list")
    .first();
  const cvCards = cvList.locator(":scope > li.profile-card");
  if ((await cvCards.count()) !== 2) {
    throw new Error("expected two distinct CV search profile cards");
  }
  const duplicateNames = await cvList
    .locator(":scope > li.profile-card .profile-card__head strong")
    .allTextContents();
  if (
    duplicateNames.length !== 2 ||
    duplicateNames[0] !== "Frontend Berlin" ||
    duplicateNames[1] !== "Frontend Berlin"
  ) {
    throw new Error(`unexpected duplicate-name cards: ${JSON.stringify(duplicateNames)}`);
  }
  if ((await page.locator(".profile-card--ats").count()) !== 0) {
    throw new Error("ATS profiles must be collapsed by default");
  }

  // Long skill list: bounded chips, then show more/less.
  const firstCv = cvCards.first();
  const initialChips = await firstCv.locator(".skill-chips__chip").count();
  if (initialChips !== 6) {
    throw new Error(`expected 6 initial skill chips, got ${initialChips}`);
  }
  await firstCv.getByRole("button", { name: "Weitere anzeigen" }).click();
  const expandedChips = await firstCv.locator(".skill-chips__chip").count();
  if (expandedChips !== 8) {
    throw new Error(`expected 8 expanded skill chips, got ${expandedChips}`);
  }
  await firstCv.getByRole("button", { name: "Weniger anzeigen" }).click();
  if ((await firstCv.locator(".skill-chips__chip").count()) !== 6) {
    throw new Error("skill chips did not collapse");
  }

  // Duplicate CV name hint must not block or rewrite the existing records.
  await page.getByRole("button", { name: "+ Neues Suchprofil erstellen" }).click();
  await page.getByRole("heading", { name: "CV-Suchprofil erstellen" }).waitFor();
  await page.getByLabel("Name").fill("Frontend Berlin");
  await page
    .getByText(/Ein CV-Suchprofil mit diesem Namen existiert bereits/)
    .waitFor();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await page.getByRole("heading", { name: "CV-Suchprofil erstellen" }).waitFor({
    state: "detached",
  });

  // Expand ATS under the first parent and verify both children.
  await page
    .getByRole("button", { name: "Zugehörige ATS-Profile anzeigen" })
    .first()
    .click();
  await page.locator("#ats-list-sp-1").waitFor();
  if ((await page.locator("#ats-list-sp-1 .profile-card--ats").count()) !== 2) {
    throw new Error("expected two nested ATS profiles under the first parent");
  }
  const nestedNames = await page
    .locator("#ats-list-sp-1 .profile-card--ats .profile-card__head strong")
    .allTextContents();
  if (!nestedNames.includes("Frontend ATS") || !nestedNames.includes("ATS Backend")) {
    throw new Error(`unexpected nested ATS names: ${JSON.stringify(nestedNames)}`);
  }

  // ATS duplicate hint under the same parent.
  await page.getByRole("button", { name: "+ ATS-Profil" }).first().click();
  await page.getByRole("heading", { name: "ATS-Profil erstellen" }).waitFor();
  await page.getByLabel("Name").fill("Frontend ATS");
  await page
    .getByText(/Unter diesem Elternprofil existiert bereits ein ATS-Profil/)
    .waitFor();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await page.getByRole("heading", { name: "ATS-Profil erstellen" }).waitFor({
    state: "detached",
  });

  // The second parent has no ATS: one empty state, not a repeated global block.
  await page
    .getByRole("button", { name: "Zugehörige ATS-Profile anzeigen" })
    .first()
    .click();
  await page.locator("#ats-list-sp-2").waitFor();
  if ((await page.getByText("Noch kein ATS-Profil zu diesem Suchprofil.").count()) !== 1) {
    throw new Error("empty ATS state must appear exactly once per expanded parent");
  }

  const overflow = await assertNoOverflow(page, "desktop-1440");
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: resolve(evidenceDir, "profile-hierarchy-1440.png"),
    fullPage: false,
  });
  if (consoleErrors.length) {
    throw new Error(`desktop console errors: ${consoleErrors.join(" | ")}`);
  }
  await context.close();
  return { overflow, duplicateNames, nestedNames };
}

async function runResponsive(browser, width) {
  const { context, page, consoleErrors } = await preparePage(browser, {
    width,
    height: width <= 430 ? 844 : 900,
  });
  await openProfileManager(page);
  await page
    .getByRole("button", { name: "Zugehörige ATS-Profile anzeigen" })
    .first()
    .click();
  await page.locator("#ats-list-sp-1").waitFor();
  const overflow = await assertNoOverflow(page, `responsive-${width}`);
  const toggle = page.getByRole("button", { name: "Weitere anzeigen" }).first();
  const toggleBox = await toggle.boundingBox();
  if (!toggleBox || toggleBox.height < 44) {
    throw new Error(`responsive-${width}: skill toggle below 44px`);
  }
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: resolve(evidenceDir, `profile-hierarchy-${width}.png`),
    fullPage: false,
  });
  if (consoleErrors.length) {
    throw new Error(`responsive-${width} console errors: ${consoleErrors.join(" | ")}`);
  }
  await context.close();
  return { width, overflow, toggleHeight: toggleBox.height };
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const full = await runFullFlow(browser);
  const responsive = [];
  for (const width of [320, 390, 430, 768, 1024]) {
    responsive.push(await runResponsive(browser, width));
  }
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        syntheticSession: true,
        realRisCalls: false,
        full,
        responsive,
      },
      null,
      2
    )
  );
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-vite.pid, "SIGTERM");
  } catch {
    /* ignore */
  }
}
