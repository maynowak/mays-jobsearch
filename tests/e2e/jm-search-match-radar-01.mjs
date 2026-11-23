// JM-SEARCH-MATCH-RADAR-01
// 20 synthetic found jobs, radar positions/click/wheel/collapse/reload and
// mobile result overview. No AI/match calls.
//
// Run: npm run test:e2e:match-radar-01

import { spawn } from "node:child_process";
import { mkdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import playwright from "playwright";
import sharp from "sharp";

const port = 5256;
const base = `http://localhost:${port}`;
const evidenceDir = resolve("docs/reports/assets/JM-SEARCH-MATCH-RADAR-01");
const models = {
  models: [{ id: "mock-model", name: "Mock Model" }],
  defaultModel: "mock-model",
  recommendedModel: null,
  fallbackModel: null,
};

function makeJobs(prefix) {
  return Array.from({ length: 20 }, (_, index) => ({
    slug: `${prefix}-job-${index + 1}`,
    title: `${prefix} Radar Role ${String(index + 1).padStart(2, "0")}`,
    company_name: `Synthetic ${index + 1}`,
    location: ["Berlin"],
    remote: false,
    tags: ["react"],
    url: `https://example.invalid/${prefix}/${index + 1}`,
  }));
}

function startVite() {
  return spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/search`);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error("Vite did not start");
}

async function saveWebp(page, name) {
  const path = resolve(evidenceDir, `${name}.webp`);
  const png = `${path}.png`;
  await page.screenshot({ path: png, fullPage: false });
  await sharp(png).webp({ quality: 84 }).toFile(path);
  await unlink(png);
  if ((await stat(path)).size <= 0) throw new Error(`missing screenshot ${name}`);
}

async function preparePage(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 430 ? 844 : 1000 },
    locale: "de-DE",
  });
  await context.addInitScript(() => localStorage.setItem("mj-lang", "de"));
  const page = await context.newPage();
  const calls = { jobs: 0, match: 0, profile: 0, ats: 0, unexpected: [] };
  let run = 0;
  await page.route("**/api/**", (handler) => {
    const url = new URL(handler.request().url());
    const path = url.pathname;
    if (path === "/api/models") {
      return handler.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(models) });
    }
    if (path === "/api/jobs") {
      calls.jobs += 1;
      run += 1;
      return handler.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobs: makeJobs(run === 1 ? "Alpha" : "Beta"),
          meta: { totalFiltered: 20, sources: {} },
        }),
      });
    }
    if (path === "/api/match") {
      calls.match += 1;
      return handler.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    }
    if (path === "/api/profile") calls.profile += 1;
    if (path === "/api/ats") calls.ats += 1;
    calls.unexpected.push(`${handler.request().method()} ${path}`);
    return handler.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  return { context, page, calls };
}

async function runSearch(page, skills) {
  await page.getByLabel("Skills").fill(skills);
  await page.getByRole("button", { name: "Meine Treffer finden" }).click();
  await page.locator(".remaining-card").first().waitFor();
}

async function radarSnapshot(page) {
  return page.evaluate(() => {
    const markers = Array.from(document.querySelectorAll("[data-radar-marker-id]")).map((node) => ({
      id: node.getAttribute("data-radar-marker-id"),
      top: Number.parseFloat(node.style.top),
    }));
    const cards = Array.from(document.querySelectorAll("[data-radar-job-id]")).map((node) => ({
      id: node.getAttribute("data-radar-job-id"),
      title: node.getAttribute("data-radar-job-title"),
      top: node.getBoundingClientRect().top + window.scrollY,
    }));
    const active = document.querySelector("[data-radar-marker-id].is-active")?.getAttribute("data-radar-marker-id") ?? null;
    const section = document.getElementById("matches");
    const rail = document.querySelector(".match-radar__rail");
    const sectionRect = section?.getBoundingClientRect();
    return {
      markers,
      cards,
      active,
      scrollY: window.scrollY,
      sectionTop: sectionRect ? sectionRect.top + window.scrollY : 0,
      sectionHeight: section?.offsetHeight ?? 1,
      railHeight: rail?.clientHeight ?? 1,
    };
  });
}

async function runDesktop(browser) {
  const { context, page, calls } = await preparePage(browser, 1440);
  try {
    await page.goto(`${base}/search`, { waitUntil: "networkidle" });
    await runSearch(page, "React");
    await page.locator("[data-radar-marker-id]").first().waitFor();
    let snapshot = await radarSnapshot(page);
    if (snapshot.markers.length !== 20 || snapshot.cards.length !== 20) {
      throw new Error(`expected 20 markers/cards, got ${snapshot.markers.length}/${snapshot.cards.length}`);
    }
    if (snapshot.markers.map((m) => m.id).join("|") !== snapshot.cards.map((c) => c.id).join("|")) {
      throw new Error("radar marker order does not match card DOM order");
    }
    for (let index = 1; index < snapshot.markers.length; index += 1) {
      if (snapshot.markers[index].top <= snapshot.markers[index - 1].top) {
        throw new Error(`radar marker ${index} is not below previous marker`);
      }
    }
    const usableHeight = snapshot.railHeight - 28;
    snapshot.markers.forEach((marker, index) => {
      const card = snapshot.cards[index];
      const expected = 14 + ((card.top - snapshot.sectionTop) / snapshot.sectionHeight) * usableHeight;
      if (Math.abs(marker.top - expected) > 2) {
        throw new Error(`marker ${index} does not match actual card position: ${marker.top} vs ${expected}`);
      }
    });
    await saveWebp(page, "radar-1440");

    await page.locator(".match-radar__rail").hover();
    await page.waitForTimeout(250);
    const labels = await page.locator(".match-radar__label").count();
    if (labels < 1 || labels > 5) throw new Error(`expected 1-5 hover labels, got ${labels}`);
    const labelBoxes = await page.locator(".match-radar__label").evaluateAll((nodes) =>
      nodes.map((node) => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height }))
        .sort((a, b) => a.top - b.top)
    );
    for (let index = 1; index < labelBoxes.length; index += 1) {
      if (labelBoxes[index].top < labelBoxes[index - 1].top + labelBoxes[index - 1].height - 1) {
        throw new Error("radar hover labels overlap");
      }
    }
    await saveWebp(page, "radar-hover-1440");

    const target = snapshot.cards[9];
    await page.locator(`[data-radar-marker-id="${target.id}"]`).click();
    await page.waitForTimeout(900);
    const afterClick = await radarSnapshot(page);
    const targetCard = afterClick.cards.find((card) => card.id === target.id);
    if (!targetCard) throw new Error("target card missing after radar click");
    const navHeight = await page.locator(".navbar").evaluate((node) => node.getBoundingClientRect().height);
    if (Math.abs(targetCard.top - afterClick.scrollY - navHeight) > 140) {
      throw new Error("radar click did not scroll to the target card");
    }
    if (afterClick.active !== target.id) throw new Error("clicked marker did not become active");

    await page.locator(".match-radar__rail").hover();
    await page.waitForTimeout(150);
    const beforeWheel = await radarSnapshot(page);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(700);
    const afterWheel = await radarSnapshot(page);
    if (!beforeWheel.active || !afterWheel.active || beforeWheel.active === afterWheel.active) {
      throw new Error("wheel down did not move to next radar marker");
    }
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(700);
    const afterWheelUp = await radarSnapshot(page);
    const ids = beforeWheel.markers.map((marker) => marker.id);
    const beforeIndex = ids.indexOf(beforeWheel.active);
    const downIndex = ids.indexOf(afterWheel.active);
    const upIndex = ids.indexOf(afterWheelUp.active);
    if (!(downIndex > beforeIndex && upIndex >= 0 && upIndex < downIndex)) {
      throw new Error(`wheel navigation did not move forward/back: ${beforeIndex}/${downIndex}/${upIndex}`);
    }

    // Collapse the remaining list, then activate the radar again. The radar
    // must expand the list and expose all 20 real cards.
    await page.getByRole("button", { name: "Gefundene Stellen ausblenden" }).click();
    await page.waitForTimeout(200);
    if ((await page.locator("[data-radar-job-id]").count()) !== 0) {
      throw new Error("collapsed list still exposes cards");
    }
    await page.locator(".match-radar__rail").hover();
    await page.locator("[data-radar-marker-id]").first().waitFor();
    await page.waitForTimeout(350);
    snapshot = await radarSnapshot(page);
    if (snapshot.markers.length !== 20 || snapshot.cards.length !== 20) {
      throw new Error(`collapsed radar activation did not restore 20 entries: ${snapshot.markers.length}`);
    }

    // Normal wheel scrolling outside the radar must remain untouched.
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(300, 500);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(250);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    if (scrollAfter <= scrollBefore) throw new Error("normal page wheel scrolling was blocked");

    // A new search must replace the radar entries, not append stale ones.
    await runSearch(page, "Python");
    await page.waitForTimeout(350);
    const updated = await radarSnapshot(page);
    if (updated.markers.length !== 20 || !updated.markers.every((marker) => marker.id?.startsWith("Beta"))) {
      throw new Error(`new search did not refresh radar: ${JSON.stringify(updated.markers.slice(0, 2))}`);
    }
    if (calls.match || calls.profile || calls.ats) {
      throw new Error(`unexpected AI/profile call: ${JSON.stringify(calls)}`);
    }
    return { calls, markers: snapshot.markers.length, updatedMarkers: updated.markers.length };
  } finally {
    await context.close();
  }
}

async function runMobile(browser, width) {
  const { context, page, calls } = await preparePage(browser, width);
  try {
    await page.goto(`${base}/search`, { waitUntil: "networkidle" });
    await runSearch(page, "React");
    await page.locator(".match-radar__mobile-toggle").waitFor();
    if (await page.locator(".match-radar__rail").isVisible()) {
      throw new Error(`${width}: desktop rail visible on mobile`);
    }
    await page.getByRole("button", { name: "Trefferübersicht" }).click();
    await page.locator(".match-radar__panel").waitFor();
    const count = await page.locator(".match-radar__panel button").count();
    if (count !== 20) throw new Error(`${width}: panel has ${count} entries`);
    await saveWebp(page, `radar-panel-${width}`);
    await page.locator(".match-radar__panel button").nth(10).click();
    await page.waitForTimeout(800);
    const scrollY = await page.evaluate(() => window.scrollY);
    if (scrollY <= 0) throw new Error(`${width}: mobile radar did not scroll`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error(`${width}: overflow ${overflow}px`);
    await saveWebp(page, `radar-${width}`);
    if (calls.match || calls.profile || calls.ats) {
      throw new Error(`${width}: unexpected AI/profile call`);
    }
    return { width, entries: count, scrollY, overflow };
  } finally {
    await context.close();
  }
}

async function runSnapshot(browser, width) {
  const { context, page, calls } = await preparePage(browser, width);
  try {
    await page.goto(`${base}/search`, { waitUntil: "networkidle" });
    await runSearch(page, "React");
    await page.locator("[data-radar-marker-id]").first().waitFor();
    const snapshot = await radarSnapshot(page);
    if (snapshot.markers.length !== 20) throw new Error(`${width}: ${snapshot.markers.length} markers`);
    await saveWebp(page, `radar-${width}`);
    if (calls.match || calls.profile || calls.ats) throw new Error(`${width}: unexpected API call`);
    return { width, markers: snapshot.markers.length };
  } finally {
    await context.close();
  }
}

const vite = startVite();
let browser;
try {
  await mkdir(evidenceDir, { recursive: true });
  await waitForServer();
  browser = await playwright.chromium.launch({ headless: true });
  const desktop = await runDesktop(browser);
  const mobile390 = await runMobile(browser, 390);
  const mobile768 = await runMobile(browser, 768);
  const desktop1920 = await runSnapshot(browser, 1920);
  console.log(JSON.stringify({ status: "PASS", desktop, mobile390, mobile768, desktop1920, evidenceDir }, null, 2));
} finally {
  await browser?.close();
  if (vite.pid) {
    try { process.kill(-vite.pid, "SIGTERM"); } catch { /* server already exited */ }
  }
}
