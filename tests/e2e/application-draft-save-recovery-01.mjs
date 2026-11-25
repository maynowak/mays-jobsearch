// JM-APPLICATION-DRAFT-SAVE-RECOVERY-01
// Authenticated browser flow with a mocked RIS application BFF:
// New application -> empty optional location/URL -> first create failure ->
// retry with the same idempotency key -> draft visible -> reload -> draft read
// from RIS. No real RIS/AI requests.
//
// Run: npm run test:e2e:application-draft-save-recovery-01

import { spawn } from "node:child_process";
import playwright from "playwright";

const port = 5257;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const now = "2026-11-23T12:00:00.000Z";
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: "mock-model",
  fallbackModel: null,
};
const description = "Wir suchen eine erfahrene Person für die Entwicklung barrierefreier React-Anwendungen mit TypeScript, APIs und verlässlicher Zusammenarbeit im Team.";

function applicationFor(job, applicationId = "application-1") {
  return {
    schemaVersion: 1,
    applicationId,
    ownerId: "e2e-user",
    job: {
      jobId: job.jobId,
      title: job.title,
      companyName: job.companyName,
      location: Array.isArray(job.location) ? [...job.location] : [],
      source: [...job.source],
      ...(job.originalUrl ? { originalUrl: job.originalUrl } : {}),
      jobOrigin: "manual",
    },
    documents: {
      coverLetterDraft: "",
      coverLetterVersions: [],
      documentStatus: "missing",
    },
    status: "draft",
    statusHistory: [{ at: now, from: null, to: "draft" }],
    history: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      VITE_RIS_APPLICATION_STORAGE_ENABLED: "true",
    },
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/profil?tab=applications`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not start");
}

async function preparePage(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(
    ({ userKey, future }) => {
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
            sub: "e2e-user",
            email: "draft@example.invalid",
            name: "Draft User",
          },
          expires_at: future,
        })
      );
    },
    { userKey: USER_KEY, future }
  );
  const page = await context.newPage();
  const calls = { creates: [], keys: [], lists: 0, unexpected: [], profile: 0 };
  let applications = [];
  let createAttempt = 0;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/models") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/ris/consents") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ consent: null }) });
    }
    if (path === "/api/profile" || path === "/api/match" || path === "/api/cover-letter" || path === "/api/ats") {
      calls.profile += 1;
      calls.unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    }
    if (path === "/api/ris/applications" && request.method() === "GET") {
      if (url.searchParams.get("id")) {
        const found = applications.find((item) => item.applicationId === url.searchParams.get("id"));
        return route.fulfill({
          status: found ? 200 : 404,
          contentType: "application/json",
          body: JSON.stringify(found ? { application: found } : { error: "not found", code: "not_found" }),
        });
      }
      calls.lists += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: applications, nextCursor: null }),
      });
    }
    if (path === "/api/ris/applications" && request.method() === "POST") {
      const key = request.headers()["idempotency-key"] ?? "";
      const body = request.postDataJSON();
      calls.keys.push(key);
      calls.creates.push(body);
      createAttempt += 1;
      if (createAttempt === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "synthetic unavailable", code: "unavailable" }),
        });
      }
      if (!key) {
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ error: "idempotency key required", code: "invalid_idempotency_key" }),
        });
      }
      if (!body?.job || body.job.jobOrigin !== "manual" || !Array.isArray(body.job.location) ||
          body.job.location.length !== 0 || body.job.originalUrl) {
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ error: "unexpected manual payload", code: "validation_error" }),
        });
      }
      const created = applicationFor(body.job, `application-${applications.length + 1}`);
      applications = [created];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ application: created }),
      });
    }
    calls.unexpected.push(`${request.method()} ${path}`);
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not mocked", code: "not_mocked" }),
    });
  });
  return { context, page, calls, getApplications: () => applications };
}

async function run(browser) {
  const { context, page, calls } = await preparePage(browser);
  try {
    await page.goto(`${base}/profil?tab=applications`, { waitUntil: "networkidle" });
    await page.locator(".applications-section").waitFor();
    await page.getByText("Diese Bewerbungen werden über RIS in deinem Konto gespeichert.").waitFor();
    await page.getByRole("button", { name: "Neue Bewerbung" }).click();
    await page.getByLabel(/Stellenbeschreibung/).fill(description);
    // Location and URL deliberately remain empty.
    await page.getByRole("button", { name: "Als Entwurf anlegen" }).click();
    await page.getByRole("alert").filter({ hasText: /nicht abgeschlossen|ungültig|Entwurf/ }).first().waitFor().catch(() => undefined);
    await page.waitForTimeout(150);
    const retained = await page.getByLabel(/Stellenbeschreibung/).inputValue();
    if (retained !== description) throw new Error("form text was lost after failed create");
    if (await page.getByText("Bewerbungsentwurf in deinem Konto gespeichert.").count()) {
      throw new Error("remote create failure incorrectly showed a success message");
    }

    await page.getByRole("button", { name: "Als Entwurf anlegen" }).click();
    await page.getByText("Bewerbungsentwurf in deinem Konto gespeichert.").waitFor();
    if (calls.creates.length !== 2) throw new Error(`expected two create attempts, got ${calls.creates.length}`);
    if (calls.keys.length !== 2 || calls.keys[0] !== calls.keys[1] || !calls.keys[0]) {
      throw new Error(`idempotency key was not reused: ${calls.keys.join(" | ")}`);
    }
    if (calls.creates[0].job.location.length !== 0 || calls.creates[0].job.originalUrl) {
      throw new Error("manual optional fields were not sent as empty");
    }

    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".applications-section").waitFor();
    await page.getByText("Initiativbewerbung").first().waitFor();
    if (calls.lists < 2) throw new Error(`expected list before and after reload, got ${calls.lists}`);
    if (calls.profile || calls.unexpected.length) {
      throw new Error(`unexpected AI/profile calls: ${JSON.stringify(calls.unexpected)}`);
    }

    return {
      createAttempts: calls.creates.length,
      idempotencyReused: calls.keys[0] === calls.keys[1],
      listCalls: calls.lists,
      emptyLocation: calls.creates[0].job.location,
      emptyUrl: calls.creates[0].job.originalUrl,
      aiCalls: calls.profile,
      reloadFoundDraft: true,
    };
  } finally {
    await context.close();
  }
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const result = await run(browser);
  console.log(JSON.stringify({ status: "PASS", result }, null, 2));
} finally {
  await browser?.close();
  if (vite.pid) {
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* server already exited */ }
  }
}
