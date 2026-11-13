// JM-CV-BUILDER-03C — synthetic durable CV UI roundtrip.
// Uses synthetic OIDC state and a controlled mock BFF. No real RIS/AWS/PDF
// uploads, no private CV data and no production flags.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-CV-BUILDER-03C-UI-INTEGRATION-01");
const port = 5233;
const base = `http://localhost:${port}`;
const AUTHORITY = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O";
const CLIENT_ID = "5hb3f6dj5ialg77jf4blur9g6g";
const USER_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
const future = Math.floor(Date.now() / 1000) + 3600;
const models = { models: [{ id: "mock-model", name: "Mock Model" }], defaultModel: "mock-model", recommendedModel: "mock-model", fallbackModel: null };
const profiles = new Map();
const idempotency = new Map();
let conflict = false;
let abortNextCreate = false;
let calls = [];

function now() {
  return new Date().toISOString();
}

function summary(profile) {
  return {
    profileId: profile.profileId,
    name: profile.name,
    template: profile.template,
    version: profile.version,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function full(profile) {
  return profile;
}

function seededReviewItems() {
  return Array.from({ length: 44 }, (_, index) => ({
    id: `review-${index}`, index,
    text: `Korrigierter synthetischer Text ${index}`,
    original: `Original synthetischer Text ${index}`,
    edited: index % 4 === 0,
    target: "skills",
    status: index % 2 === 0 ? "pending" : "accepted",
    applied: index % 2 === 1,
    page: (index % 3) + 1,
    sectionHeading: "Kenntnisse",
    reason: "ambiguous",
    suggestedTarget: "skills",
  }));
}

function seededReviewProfile() {
  const items = seededReviewItems();
  return {
    schemaVersion: 1,
    profileId: "cvp-00000044",
    name: "Review 44",
    template: "modern",
    cvData: {
      schemaVersion: 1, personal: { fullName: "Synthetische Person" }, profile: {},
      experience: [], education: [],
      skills: Array.from({ length: 71 }, (_, index) => `Synthetischer Skill ${index + 1}`),
      projects: [], certificates: [], languages: [], links: [],
    },
    importReview: {
      schemaVersion: 1, sourceName: "synthetic-71.pdf", pageCount: 3, pendingAcknowledged: true,
      selectedSections: ["skills"], skills: { total: 71, selected: 58, unselected: 13, limited: false },
      items, total: 44, pending: 22, accepted: 22, ignored: 0,
    },
    version: 3,
    createdAt: now(), updatedAt: now(),
  };
}

function makeProfile(body, key) {
  const existing = idempotency.get(key);
  if (existing) return existing;
  const profile = {
    schemaVersion: 1,
    profileId: `cvp-${String(profiles.size + 1).padStart(8, "0")}`,
    name: body.name,
    cvData: body.cvData,
    template: body.template,
    ...(body.importReview ? { importReview: body.importReview } : {}),
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  profiles.set(profile.profileId, profile);
  idempotency.set(key, profile);
  return profile;
}

async function mockApi(route) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method().toUpperCase();
  calls.push(`${method} ${path}`);
  if (path === "/api/models") {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
  }
  if (path === "/api/ris/consents") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        consent: {
          purpose: "cv-builder-profile-storage", status: "GRANTED",
          noticeVersion: "synthetic-approved-v1", version: 1,
        },
        noticeVersion: "synthetic-approved-v1",
        noticeState: "APPROVED", noticeApproved: true, acceptedForNewGrant: true,
        grantAllowed: true, noticeReason: null,
      }),
    });
  }
  if (path !== "/api/ris/cv-builder-profiles") {
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked", code: "not_mocked" }) });
  }

  if (method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const profile = profiles.get(id);
      if (!profile) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found", code: "NOT_FOUND" }) });
      if (url.searchParams.get("action") === "export") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaVersion: 1, exportedAt: now(), source: "ris-structured-cv-profile", profile: full(profile) }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", headers: { ETag: `"v${profile.version}"` }, body: JSON.stringify(full(profile)) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [...profiles.values()].map(summary), nextCursor: null }) });
  }

  if (method === "POST") {
    const body = request.postDataJSON();
    const key = request.headers()["idempotency-key"] ?? "";
    if (!key) return route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "missing key", code: "INVALID_IDEMPOTENCY_KEY" }) });
    const profile = makeProfile(body, key);
    if (abortNextCreate) {
      abortNextCreate = false;
      return route.abort("timedout");
    }
    return route.fulfill({ status: 201, contentType: "application/json", headers: { ETag: `"v${profile.version}"` }, body: JSON.stringify(full(profile)) });
  }

  if (method === "PATCH") {
    const id = url.searchParams.get("id");
    const profile = profiles.get(id);
    if (!profile) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found", code: "NOT_FOUND" }) });
    const match = /^"v([0-9]+)"$/.exec(request.headers()["if-match"] ?? "");
    if (!match) return route.fulfill({ status: 428, contentType: "application/json", body: JSON.stringify({ error: "precondition required", code: "PRECONDITION_REQUIRED" }) });
    if (conflict || Number(match[1]) !== profile.version) {
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "conflict", code: "VERSION_CONFLICT" }) });
    }
    const body = request.postDataJSON();
    const updated = { ...profile, ...body, version: profile.version + 1, updatedAt: now() };
    profiles.set(id, updated);
    return route.fulfill({ status: 200, contentType: "application/json", headers: { ETag: `"v${updated.version}"` }, body: JSON.stringify(full(updated)) });
  }

  if (method === "DELETE") {
    const id = url.searchParams.get("id");
    profiles.delete(id);
    return route.fulfill({ status: 204, body: "" });
  }
  return route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ error: "method", code: "METHOD_NOT_ALLOWED" }) });
}

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      VITE_RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED: "true",
    },
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/profil?tab=cv`);
      if (response.ok) return;
    } catch { /* retry */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not start");
}

async function newPage(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, locale: "de-DE", acceptDownloads: true });
  await context.addInitScript(({ key, future }) => {
    localStorage.setItem("mj-lang", "de");
    sessionStorage.setItem(key, JSON.stringify({
      id_token: "e2e-id-token", session_state: null, access_token: "e2e-access-token",
      refresh_token: null, token_type: "Bearer", scope: "openid email profile",
      profile: { iss: "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O", sub: "e2e-03c", email: "e2e@example.invalid", name: "E2E 03C" },
      expires_at: future,
    }));
  }, { key: USER_KEY, future });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/api/**", mockApi);
  await page.goto(`${base}/profil?tab=cv`, { waitUntil: "networkidle" });
  await page.locator(".cv-builder-profiles").waitFor();
  return { context, page, consoleErrors };
}

async function openEmptyEditor(page) {
  await page.getByRole("button", { name: "Lebenslauf erstellen", exact: true }).click();
  await page.getByRole("button", { name: "Leeren Lebenslauf erstellen" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
}

async function saveAndClose(page) {
  await page.getByRole("button", { name: "Lebenslauf speichern" }).click();
  await page.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
  await page.locator(".cv-builder-modal").waitFor({ state: "detached" });
}

const vite = startVite();
let browser;
try {
  await waitForServer();
  await mkdir(evidenceDir, { recursive: true });
  browser = await playwright.chromium.launch();
  for (const width of [1440, 768, 390, 320]) {
    profiles.clear();
    idempotency.clear();
    calls = [];
    const { context, page, consoleErrors } = await newPage(browser, width, 900);
    await openEmptyEditor(page);
    await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
    await page.getByLabel("Vollständiger Name").fill("Synthetische Person");
    await saveAndClose(page);
    await page.getByText("Lebenslauf 1").waitFor();
    await page.locator(".cv-builder-profiles__item").first()
      .getByRole("button", { name: "Dauerhaft speichern" }).click();
    await page.getByText("Im Konto gespeichert", { exact: true }).waitFor();
    if (!profiles.size) throw new Error(`${width}: durable create did not reach mock RIS`);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".cv-builder-profiles").waitFor();
    await page.getByText("Im Konto gespeichert", { exact: true }).waitFor();
    await page.locator(".cv-builder-profiles__item").first()
      .getByRole("button", { name: "Bearbeiten" }).click();
    await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
    await page.getByLabel("Vollständiger Name").fill(`Synthetische Person ${width}`);
    await saveAndClose(page);
    if (!calls.some((call) => call.startsWith("PATCH "))) throw new Error(`${width}: durable update missing`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error(`${width}: horizontal overflow ${overflow}px`);
    if (consoleErrors.length) throw new Error(`${width}: console errors ${consoleErrors.join(" | ")}`);
    await context.close();
  }

  // Full 71-skill / 44-review durable load roundtrip.
  profiles.clear();
  idempotency.clear();
  const reviewProfile = seededReviewProfile();
  profiles.set(reviewProfile.profileId, reviewProfile);
  {
    const { context, page } = await newPage(browser, 1024, 900);
    await page.getByText("Review 44").waitFor();
    await page.locator(".cv-builder-profiles__item").filter({ hasText: "Review 44" })
      .getByRole("button", { name: "Bearbeiten" }).click();
    await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
    const skills = await page.locator("#cv-builder-skills textarea").inputValue();
    if (skills.split(/[\n,]/).map((value) => value.trim()).filter(Boolean).length !== 71) {
      throw new Error("71 seeded skills were not restored");
    }
    await page.getByText("Importprüfung fortsetzen").waitFor();
    await page.locator(".cv-builder-backlog").first().waitFor();
    await page.screenshot({ path: resolve(evidenceDir, "review-44-restored.png"), fullPage: false });
    await context.close();
  }

  // Conflict + delete + duplicate in a fresh durable entry.
  profiles.clear();
  idempotency.clear();
  calls = [];
  const { context, page } = await newPage(browser, 1024, 900);
  await openEmptyEditor(page);
  await saveAndClose(page);
  await page.locator(".cv-builder-profiles__item").first()
    .getByRole("button", { name: "Dauerhaft speichern" }).click();
  await page.getByText("Im Konto gespeichert", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".cv-builder-profiles").waitFor();
  await page.getByText("Im Konto gespeichert", { exact: true }).waitFor();
  conflict = true;
  await page.locator(".cv-builder-profiles__item").first()
    .getByRole("button", { name: "Bearbeiten" }).click();
  await page.getByRole("heading", { name: "Strukturierter Lebenslauf-Editor" }).waitFor();
  await page.locator("summary").filter({ hasText: "Persönliche Angaben" }).click();
  await page.getByLabel("Vollständiger Name").fill("Konflikt");
  await page.getByRole("button", { name: "Lebenslauf speichern" }).click();
  await page.waitForTimeout(500);
  await page.locator(".letter-review-warning").filter({ hasText: /in einer anderen Sitzung geändert/ }).waitFor();
  conflict = false;
  await page.getByRole("button", { name: "Lebenslauf-Editor schließen" }).click();
  await page.getByRole("button", { name: "Verwerfen und schließen" }).click();
  abortNextCreate = true;
  await page.locator(".cv-builder-profiles__item").first()
    .getByRole("button", { name: "Duplizieren" }).click();
  await page.getByText("Im Konto gespeichert", { exact: true }).waitFor();
  if (profiles.size !== 2) throw new Error(`uncertain duplicate created ${profiles.size} profiles`);
  await page.locator(".cv-builder-profiles__item").first()
    .getByRole("button", { name: "Löschen" }).click();
  await page.getByRole("button", { name: "Lebenslauf löschen" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(evidenceDir, "durable-conflict-delete.png"), fullPage: false });
  await context.close();
  console.log(JSON.stringify({ ok: true, profiles: profiles.size, calls: calls.length }, null, 2));
} finally {
  await browser?.close();
  try { process.kill(-vite.pid, "SIGTERM"); } catch { /* ignore */ }
}
