import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "docs/reports/assets/JM-COVER-LETTER-UX-01");
const longLetter = [
  "Sehr geehrte Damen und Herren,",
  "vielen Dank für die Einladung. " + "Ich freue mich sehr über die Möglichkeit, das Team kennenzulernen. ".repeat(18),
  "Mit freundlichen Grüßen",
  "MIT-FREUNDLICHEN-GRUESSEN",
].join("\n\n");
const fixturePdf = resolve(repoRoot, "tests/fixtures/cv/synthetic-cv.pdf");
const port = 5201;
const base = `http://localhost:${port}`;

const jobs = {
  jobs: [
    {
      slug: "job-frontend",
      title: "Frontend Engineer",
      company_name: "Example GmbH",
      location: ["Berlin"],
      remote: true,
      tags: ["React", "TypeScript"],
      url: "https://example.invalid/jobs/job-frontend",
      source: ["arbeitnow"],
    },
    {
      slug: "job-backend",
      title: "Backend Engineer",
      company_name: "Other AG",
      location: ["Munich"],
      remote: false,
      tags: ["Node.js"],
      url: "https://example.invalid/jobs/job-backend",
      source: ["arbeitnow"],
    },
  ],
  meta: { totalFiltered: 2, sources: { arbeitnow: 2 } },
};

const matches = {
  matches: [
    {
      score: 88,
      why: "Strong React and TypeScript match.",
      prepare: "Ask about the frontend platform.",
      job: jobs.jobs[0],
    },
  ],
  meta: { evaluated: 1 },
};

function startVite() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
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

async function runViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport, locale: "de-DE" });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const consoleErrors = [];
  let coverLetterCalls = 0;
  let jobsCalls = 0;
  let jobDetailsCalls = 0;
  let profileCalls = 0;
  const coverLetterBodies = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/models") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [
            { id: "mock-model", name: "Mock Model" },
            { id: "mock-model-b", name: "Mock Model B" },
          ],
          defaultModel: "mock-model",
          recommendedModel: "mock-model",
          fallbackModel: null,
        }),
      });
    }
    if (url.pathname === "/api/jobs") {
      jobsCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobs) });
    }
    if (url.pathname === "/api/job-details") {
      jobDetailsCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: {}, meta: { enrichedCount: 0 } }) });
    }
    if (url.pathname === "/api/profile") {
      profileCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          skills: ["React", "TypeScript"],
          experienceLevel: "Mid",
          targetRoles: ["Frontend Engineer"],
          location: "Berlin",
        }),
      });
    }
    if (url.pathname === "/api/match") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(matches) });
    }
    if (url.pathname === "/api/cover-letter") {
      coverLetterCalls += 1;
      coverLetterBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ letter: longLetter }),
      });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked", code: "not_mocked" }) });
  });

  await page.goto(`${base}/search`, { waitUntil: "networkidle" });
  await page.fill("#skills", "React");
  await page.click("#find-btn");
  await page.waitForSelector("#match-btn");
  await page.click("#match-btn");
  await page.waitForSelector(".match-card");

  const matchActions = page.locator(".match-card .job-actions").first();
  if ((await matchActions.count()) !== 1) throw new Error(`${name}: match action bar missing`);
  const matchButtons = matchActions.locator("button, a");
  if ((await matchButtons.count()) !== 3) throw new Error(`${name}: match actions expected 3, got ${await matchButtons.count()}`);

  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: resolve(evidenceDir, `${name}-cards.png`), fullPage: false });

  await page.locator(".match-card .letter-btn").first().click();
  await page.waitForSelector('[role="dialog"]');
  if (coverLetterCalls !== 0) throw new Error(`${name}: AI call on dialog open`);
  if (!(await page.getByText("Anschreiben-Assistent").isVisible())) throw new Error(`${name}: preparation view missing`);
  if (!(await page.getByRole("heading", { name: "Bewerbungsschreiben" }).isVisible())) {
    throw new Error(`${name}: dialog heading not visible`);
  }
  const initialScrollTop = await page
    .locator('[role="dialog"]')
    .evaluate((element) => element.scrollTop);
  if (initialScrollTop !== 0) throw new Error(`${name}: dialog did not start at top (${initialScrollTop})`);
  if ((await page.getByRole("combobox").count()) < 1) throw new Error(`${name}: model selector missing`);
  const modelTrigger = page.locator(".letter-model .model-trigger");
  const modelBox = await modelTrigger.boundingBox();
  if (!modelBox) throw new Error(`${name}: model selector has no layout box`);
  await page.mouse.click(modelBox.x + modelBox.width / 2, modelBox.y + modelBox.height / 2);
  await page.getByRole("option", { name: "Mock Model B" }).click();
  const selectedBeforeCv = await page.locator(".letter-model .model-trigger").getAttribute("aria-label");
  if (!selectedBeforeCv?.includes("mock-model-b")) {
    throw new Error(`${name}: model selection did not apply (${selectedBeforeCv})`);
  }
  if (coverLetterCalls !== 0) throw new Error(`${name}: model change started an AI call`);
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-intro.png`), fullPage: false });

  await page.getByLabel("Weitere Informationen zur Stellenanzeige einfügen").fill(
    "Position als Frontend Engineer bei Example GmbH in Berlin. Du entwickelst React-Anwendungen und hast Erfahrung mit TypeScript."
  );
  await page.getByRole("button", { name: "Beschreibung prüfen" }).click();
  await page.waitForSelector("text=Plausibel");
  if (coverLetterCalls !== 0) throw new Error(`${name}: AI call during description review`);
  if (jobsCalls !== 1) throw new Error(`${name}: unexpected /api/jobs request during review (${jobsCalls})`);
  if (jobDetailsCalls !== 0) throw new Error(`${name}: unexpected /api/job-details request during review (${jobDetailsCalls})`);
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-review.png`), fullPage: false });

  // CL-03: add a CV through the existing upload workflow and return to the
  // preserved letter context.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Neuen Lebenslauf hinzufügen" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fixturePdf);
  await page.getByText("CV-Verarbeitung erlauben?").waitFor();
  if (coverLetterCalls !== 0) throw new Error(`${name}: AI call while opening CV workflow`);
  await page.getByRole("checkbox", { name: /Ich stimme der Verarbeitung meiner CV-Daten/ }).check();
  await page.getByRole("button", { name: "Verarbeitung erlauben" }).click();
  await page.locator(".cv-anonymization-choice").waitFor();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.locator("#cv-model-selection-title").waitFor();
  await page.getByRole("button", { name: "Verarbeiten", exact: true }).click();
  await page.locator(".cv-result").waitFor();
  if (profileCalls !== 1) throw new Error(`${name}: expected one CV profile request, got ${profileCalls}`);
  if (coverLetterCalls !== 0) throw new Error(`${name}: cover-letter request during CV processing`);
  await page.getByRole("button", { name: "Zurück zum Anschreiben" }).click();
  await page.waitForSelector('[role="dialog"]');
  if ((await page.getByLabel("Weitere Informationen zur Stellenanzeige einfügen").inputValue()) === "") {
    throw new Error(`${name}: review text lost after CV workflow`);
  }
  await page.getByText("Verarbeitet — kein gespeichertes Suchprofil").waitFor();
  const returnScrollTop = await page
    .locator('[role="dialog"]')
    .evaluate((element) => element.scrollTop);
  if (returnScrollTop !== 0) throw new Error(`${name}: dialog did not return to top (${returnScrollTop})`);
  const restoredModel = await page.locator(".letter-model .model-trigger").getAttribute("aria-label");
  if (!restoredModel?.includes("mock-model-b")) {
    throw new Error(`${name}: selected model was lost after CV workflow (${restoredModel})`);
  }
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-cv-return.png`), fullPage: false });

  // CL-04: generate with the selected, processed CV and verified description.
  await page.getByRole("button", { name: "Anschreiben generieren" }).click();
  await page.waitForFunction(() => {
    const editor = document.querySelector('textarea[aria-label="Bearbeitbares Anschreiben"]');
    return editor instanceof HTMLTextAreaElement && editor.value.includes("MIT-FREUNDLICHEN-GRUESSEN");
  });
  const editorBox = await page.locator('textarea[aria-label="Bearbeitbares Anschreiben"]').evaluate((editor) => ({
    scrollHeight: editor.scrollHeight,
    clientHeight: editor.clientHeight,
  }));
  if (editorBox.scrollHeight > editorBox.clientHeight + 2) {
    throw new Error(`${name}: generated letter is clipped in the editor`);
  }
  if (coverLetterCalls !== 1) throw new Error(`${name}: expected one cover-letter call, got ${coverLetterCalls}`);
  if (profileCalls !== 1) throw new Error(`${name}: generation made an additional profile request`);
  const coverBody = JSON.stringify(coverLetterBodies[0] || {});
  if (!coverBody.includes("Position als Frontend Engineer bei Example GmbH in Berlin. Du entwickelst React-Anwendungen")) {
    throw new Error(`${name}: selected description was not sent`);
  }
  if (!coverBody.includes("Synthetic") || !coverBody.includes("cv_text")) {
    throw new Error(`${name}: selected CV text was not sent`);
  }
  if (coverBody.includes("synthetic-cv.pdf") || coverBody.includes("cvHash") || coverBody.includes("processedAt")) {
    throw new Error(`${name}: CV file/hash metadata was sent`);
  }
  if (coverBody.includes("PRAKTISCHE FRAGE") || coverBody.includes("ANTWORTSKIZZE")) {
    throw new Error(`${name}: interview section was sent`);
  }
  if (JSON.parse(coverBody).options?.model !== "mock-model-b") {
    throw new Error(`${name}: selected model was not sent`);
  }
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-generated.png`), fullPage: false });

  // JM-COVER-LETTER-UX-01: visible revision path, explicit action only.
  await page.getByLabel("Was möchtest du am Anschreiben verbessern?").fill("Bitte kürzer.");
  if (coverLetterCalls !== 1) throw new Error(`${name}: feedback started an AI call`);
  const revisionResponse = page.waitForResponse(
    (response) => response.url().includes("/api/cover-letter") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Mit Kommentar verbessern" }).click();
  await revisionResponse;
  if (coverLetterCalls !== 2) throw new Error(`${name}: expected one revision call, got ${coverLetterCalls}`);
  const revisionBody = coverLetterBodies[1] || {};
  if (revisionBody.operation !== "revise") throw new Error(`${name}: revision operation missing`);
  if (revisionBody.revision?.draft_anonymized !== true) throw new Error(`${name}: draft anonymization flag missing`);
  if (!String(revisionBody.revision?.draft_text ?? "").includes("Sehr geehrte")) {
    throw new Error(`${name}: current draft was not sent as revision basis`);
  }
  if (!String(revisionBody.revision?.feedback ?? "").includes("Bitte kürzer")) {
    throw new Error(`${name}: revision feedback was not sent`);
  }

  await page.getByRole("button", { name: "Schließen" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });

  // CL-03 abort path: reopen, start a new CV upload, return before processing.
  await page.locator(".match-card .letter-btn").first().click();
  const abortChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Neuen Lebenslauf hinzufügen" }).click();
  const abortChooser = await abortChooserPromise;
  await abortChooser.setFiles(fixturePdf);
  await page.locator(".cv-anonymization-choice").waitFor();
  await page.getByRole("button", { name: "Zurück zum Anschreiben" }).click();
  await page.waitForSelector('[role="dialog"]');
  if (profileCalls !== 1) throw new Error(`${name}: aborted CV workflow started processing`);
  await page.screenshot({ path: resolve(evidenceDir, `${name}-letter-cv-abort.png`), fullPage: false });
  await page.getByRole("button", { name: "Schließen" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });

  await page.getByRole("button", { name: /Weitere gefundene Jobs ansehen/ }).click();
  await page.waitForSelector(".remaining-card");
  const remainingActions = page.locator(".remaining-card .job-actions").first();
  if ((await remainingActions.locator("button, a").count()) !== 3) {
    throw new Error(`${name}: remaining actions expected 3, got ${await remainingActions.locator("button, a").count()}`);
  }
  await page.locator(".remaining-card .letter-btn").first().click();
  await page.waitForSelector('[role="dialog"]');
  if (coverLetterCalls !== 2) throw new Error(`${name}: unexpected additional AI call on remaining dialog open`);
  await page.getByRole("button", { name: "Schließen" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });


  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error(`${name}: horizontal overflow detected`);

  await context.close();
  return { name, coverLetterCalls, jobsCalls, jobDetailsCalls, profileCalls, consoleErrors };
}

async function main() {
  const vite = startVite();
  try {
    await waitForServer();
    const browser = await playwright.chromium.launch();
    try {
      const results = [];
      results.push(await runViewport(browser, "desktop-1440", { width: 1440, height: 1000 }));
      results.push(await runViewport(browser, "mobile-390", { width: 390, height: 844 }));
      console.log(JSON.stringify({ status: "PASS", results }, null, 2));
    } finally {
      await browser.close();
    }
  } finally {
    try {
      process.kill(-vite.pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

await main();
