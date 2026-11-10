// PROFILE-UX-CONSOLIDATION-01 — mobile visual review harness.
//
// Synthetic OIDC session + mocked RIS/BFF responses only. No real Cognito,
// RIS, AWS or user data is used.
//
// Run:
//   SCREENSHOT_PHASE=before npm run test:e2e:mobile-visual
//   SCREENSHOT_PHASE=after  npm run test:e2e:mobile-visual

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phase = process.env.SCREENSHOT_PHASE === "after" ? "after" : "before";
const evidenceDir = resolve(
  repoRoot,
  `docs/reports/assets/PROFILE-UX-CONSOLIDATION-01-MOBILE/${phase}`
);
const widths = (process.env.SCREENSHOT_WIDTHS ?? "320,390,430,768,1024,1440")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const port = 5216;
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

const applicationConsent = {
  purpose: "application-storage",
  status: "GRANTED",
  noticeVersion: "application-storage/1.0",
  grantedAt: now,
  withdrawnAt: null,
  version: 1,
  specialCategoriesConsent: true,
  specialCategories: [],
  externalTextVersion: "application-storage-consent-2026-11-07-v4",
  externalTextSha256: "8722aed9fa78e5ee49c2b5e5a031bfd53a7109bf625dfb0e0c99743fd82443c7",
};

const manualProfile = {
  schemaVersion: 1,
  manualSearchProfileId: "mp-1",
  name: "Pflege Nord",
  description: "Synthetisches Profil für den Mobile-Review",
  origin: "manual",
  searchConfig: {
    skills: "Pflege, Wundversorgung, Dokumentation, Teamarbeit, Schichtdienst",
    targetRoles: ["Pflegefachkraft", "Wohnbereichsleitung"],
    city: "Hamburg",
    radiusKm: 25,
    workModes: ["hybrid", "onsite"],
    employmentTypes: ["full_time"],
  },
  matchingPreferences: {
    requiredSkills: ["Pflege"],
    preferredSkills: ["Wundversorgung"],
    excludedTerms: [],
  },
  createdAt: now,
  updatedAt: now,
  version: 1,
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
        VITE_RIS_CONSENT_UI_ENABLED: "true",
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
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not become ready");
}

async function preparePage(browser, viewport, options) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(
    ({ authenticated, future: expiry, userKey }) => {
      localStorage.setItem("mj-lang", "de");
      localStorage.removeItem("mj-may-help-open");
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
          profile: {
            iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O",
            sub: "e2e-mobile-review",
            email: "e2e@example.invalid",
            name: "E2E Mobile Review",
          },
          expires_at: expiry,
        })
      );
    },
    { authenticated: options.authenticated, future, userKey: USER_KEY }
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
        body: JSON.stringify({
          items: options.cvConsentGranted ? [cvDocument] : [],
          nextCursor: null,
        }),
      });
    }

    if (path === "/api/ris/cv-consents" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent: options.cvConsentGranted ? cvConsent : null,
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
          consent: options.searchConsentGranted ? searchProfileConsent : null,
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

    if (path === "/api/ris/consents" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          consent: options.applicationConsentGranted ? applicationConsent : null,
          noticeVersion: "application-storage/1.0",
          noticeState: "APPROVED",
          noticeApproved: true,
          acceptedForNewGrant: true,
          grantAllowed: true,
          noticeReason: null,
          textVersion: "application-storage-consent-2026-11-07-v4",
          textHash: "8722aed9fa78e5ee49c2b5e5a031bfd53a7109bf625dfb0e0c99743fd82443c7",
          textState: "APPROVED",
          textMapped: true,
          textApproved: true,
          textReason: null,
          specialCategoriesConsent: true,
          specialCategories: [],
          externalTextVersion: applicationConsent.externalTextVersion,
          externalTextSha256: applicationConsent.externalTextSha256,
        }),
      });
    }

    if (path === "/api/ris/search-profiles" && method === "GET") {
      const type = url.searchParams.get("type");
      if ((type === "cv" || type === "ats") && options.delayProfileCountsMs) {
        await new Promise((resolveWait) => setTimeout(resolveWait, options.delayProfileCountsMs));
      }
      if ((type === "cv" || type === "ats") && options.failProfileCounts) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "profile_counts_unavailable", code: "unavailable" }),
        });
      }
      if (type === "manual") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: options.searchConsentGranted ? [manualProfile] : [],
            nextCursor: null,
          }),
        });
      }
      if (type === "cv") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: options.searchConsentGranted ? cvProfiles : [],
            nextCursor: null,
          }),
        });
      }
      if (type === "ats") {
        const parent = url.searchParams.get("searchProfileId") ?? "";
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: options.searchConsentGranted ? (atsProfiles[parent] ?? []) : [],
            nextCursor: null,
          }),
        });
      }
    }

    if (path === "/api/jobs" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [], meta: { totalFiltered: 0, sources: {} } }),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });

  return { context, page, consoleErrors };
}

async function openBurgerMenu(page) {
  const burger = page.locator(".burger");
  if (!(await burger.isVisible())) return false;
  await burger.click();
  await page.locator(".mobile-menu").waitFor();
  await page.waitForTimeout(400);
  return true;
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    };
    const visibleButtons = Array.from(document.querySelectorAll("button"))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== "hidden";
      });
    const smallTargets = visibleButtons
      .map((element) => ({
        label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80),
        ...rect(element),
      }))
      .filter((item) => item.height < 44 || item.width < 44)
      .slice(0, 12);
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      headings: Array.from(document.querySelectorAll("h1,h2,h3")).slice(0, 8).map((element) => ({
        tag: element.tagName,
        text: (element.textContent || "").trim().slice(0, 120),
        ...rect(element),
      })),
      smallTargets,
    };
  });
}

const VIEWS = [
  {
    id: "landing",
    path: "/",
    authenticated: false,
    waitFor: "main, .landing",
  },
  {
    id: "login",
    path: "/anmelden",
    authenticated: false,
    waitFor: "main",
  },
  {
    id: "overview",
    path: "/profil?tab=overview",
    authenticated: true,
    waitFor: "#dashboard-v2-title",
  },
  {
    id: "profile",
    path: "/profil?tab=profile",
    authenticated: true,
    waitFor: "#dashboard-v2-title",
  },
  {
    id: "cv-session",
    path: "/profil?tab=cv",
    authenticated: true,
    cvConsentGranted: false,
    searchConsentGranted: false,
    waitFor: ".dashboard-v2__cv-section",
  },
  {
    id: "cv-ris",
    path: "/profil?tab=cv",
    authenticated: true,
    cvConsentGranted: true,
    searchConsentGranted: true,
    waitFor: ".cv-storage-card",
  },
  {
    id: "cv-ris-loading",
    path: "/profil?tab=cv",
    authenticated: true,
    cvConsentGranted: true,
    searchConsentGranted: true,
    delayProfileCountsMs: 6000,
    waitUntil: "domcontentloaded",
    action: async (page) => {
      await page.locator(".cv-storage-card").waitFor();
      await page.locator(".cv-storage-card").scrollIntoViewIfNeeded();
      await page.getByText("Such- und ATS-Profile werden geladen …").waitFor();
      if (await page.getByText("0 Suchprofile · 0 ATS-Profile").count()) {
        throw new Error("provisional zero shown while loading");
      }
    },
    waitFor: ".cv-storage-card",
  },
  {
    id: "cv-ris-error",
    path: "/profil?tab=cv",
    authenticated: true,
    cvConsentGranted: true,
    searchConsentGranted: true,
    failProfileCounts: true,
    action: async (page) => {
      await page.locator(".cv-storage-card").waitFor();
      await page.locator(".cv-storage-card").scrollIntoViewIfNeeded();
      await page.getByText("Profile konnten nicht geladen werden.").waitFor();
      await page.getByRole("button", { name: "Erneut versuchen" }).waitFor();
    },
    waitFor: ".cv-storage-card",
  },
  {
    id: "cv-profiles",
    path: "/profil?tab=cv",
    authenticated: true,
    cvConsentGranted: true,
    searchConsentGranted: true,
    action: async (page) => {
      await page.waitForSelector(".cv-storage-card");
      await page.getByRole("button", { name: "Profile anzeigen" }).click();
      await page.locator(".cv-profile-manager").waitFor();
      await page.getByRole("button", { name: "Zugehörige ATS-Profile anzeigen" }).first().click();
      await page.locator("#ats-list-sp-1").waitFor();
      if (phase === "after") {
        await page.getByText("2 CV-Suchprofile · 2 ATS-Profile").waitFor();
      }
    },
    waitFor: ".cv-storage-card",
  },
  {
    id: "applications",
    path: "/profil?tab=applications",
    authenticated: true,
    searchConsentGranted: true,
    waitFor: ".applications-section",
  },
  {
    id: "preferences",
    path: "/profil?tab=preferences",
    authenticated: true,
    searchConsentGranted: true,
    applicationConsentGranted: true,
    action: async (page) => {
      if (phase !== "after") return;
      const badge = page.getByText("Dauerhaft im RIS-Konto").first();
      await badge.waitFor();
      const box = await badge.boundingBox();
      if (!box || box.height > 32) throw new Error("persistent badge is not compact");
    },
    waitFor: ".dashboard-v2__manual-item, .dashboard-v2__manual-profiles",
  },
  {
    id: "settings",
    path: "/profil?tab=settings",
    authenticated: true,
    cvConsentGranted: true,
    searchConsentGranted: true,
    applicationConsentGranted: true,
    action: async (page) => {
      if (phase !== "after") return;
      if (await page.getByText(/Suchprofile bleiben vorerst sitzungsbezogen/).count()) {
        throw new Error("stale session-only search-profile claim");
      }
      await page.getByText(/Such- und ATS-Profile/).first().waitFor();
    },
    waitFor: ".storage-consent",
  },
  {
    id: "privacy",
    path: "/datenschutz",
    authenticated: false,
    action: async (page) => {
      if (phase !== "after") return;
      const box = await page.locator(".legal-page").boundingBox();
      if (!box || box.x < 8) throw new Error("legal page lost mobile padding");
    },
    waitFor: "main",
  },
];

const vite = startVite();
let browser;
const results = [];
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true });

  for (const width of widths) {
    const viewport = { width, height: width <= 430 ? 844 : 900 };
    for (const view of VIEWS) {
      const { context, page, consoleErrors } = await preparePage(browser, viewport, {
        authenticated: view.authenticated,
        cvConsentGranted: view.cvConsentGranted === true,
        searchConsentGranted: view.searchConsentGranted === true,
        applicationConsentGranted: view.applicationConsentGranted === true,
        delayProfileCountsMs: view.delayProfileCountsMs,
        failProfileCounts: view.failProfileCounts === true,
      });
      try {
        await page.goto(`${base}${view.path}`, { waitUntil: view.waitUntil ?? "networkidle" });
        if (view.waitFor) {
          await page.locator(view.waitFor).first().waitFor({ timeout: 15000 });
        }
        if (view.action) await view.action(page);
        await page.waitForTimeout(250);
        await page.evaluate(() => window.scrollTo(0, 0));
        const metrics = await measure(page);
        if (phase === "after" && metrics.overflow > 0) {
          throw new Error(`horizontal overflow ${metrics.overflow}px`);
        }
        const name = `${view.id}-${width}.png`;
        await page.screenshot({
          path: resolve(evidenceDir, name),
          fullPage: false,
        });
        if (view.id === "cv-ris" || view.id === "cv-ris-loading" || view.id === "cv-ris-error") {
          const suffix = view.id === "cv-ris" ? "cv-ris-card" : view.id;
          await page.locator(".cv-storage-card").scrollIntoViewIfNeeded();
          await page.waitForTimeout(100);
          await page.screenshot({
            path: resolve(evidenceDir, `${suffix}-${width}.png`),
            fullPage: false,
          });
        }
        if (view.id === "settings" || view.id === "privacy") {
          await page.screenshot({
            path: resolve(evidenceDir, `${view.id}-full-${width}.png`),
            fullPage: true,
          });
        }
        results.push({
          width,
          view: view.id,
          screenshot: name,
          consoleErrors,
          ...metrics,
        });
      } catch (err) {
        results.push({
          width,
          view: view.id,
          error: err instanceof Error ? err.message : String(err),
          consoleErrors,
        });
      } finally {
        await context.close();
      }
    }

    if (width <= 900) {
      const { context, page, consoleErrors } = await preparePage(browser, viewport, {
        authenticated: false,
        cvConsentGranted: false,
        searchConsentGranted: false,
        applicationConsentGranted: false,
      });
      try {
        await page.goto(`${base}/`, { waitUntil: "networkidle" });
        const opened = await openBurgerMenu(page);
        if (opened) {
          const metrics = await measure(page);
          const name = `menu-${width}.png`;
          await page.screenshot({
            path: resolve(evidenceDir, name),
            fullPage: false,
          });
          results.push({ width, view: "menu", screenshot: name, consoleErrors, ...metrics });
        }
      } catch (err) {
        results.push({
          width,
          view: "menu",
          error: err instanceof Error ? err.message : String(err),
          consoleErrors,
        });
      } finally {
        await context.close();
      }
    }
  }

  await writeFile(
    resolve(evidenceDir, "metrics.json"),
    JSON.stringify(
      {
        phase,
        generatedAt: new Date().toISOString(),
        syntheticSession: true,
        realRisCalls: false,
        results,
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      {
        phase,
        evidenceDir,
        views: VIEWS.length,
        widths,
        failures: results.filter((item) => item.error).length,
        screenshotCount: results.filter((item) => item.screenshot).length,
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
