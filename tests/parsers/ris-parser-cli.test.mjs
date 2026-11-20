import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import { handler } from "../../lambda/ris_parser_handler.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const CLI = join(REPO, "scripts", "ris-parser-cli.mjs");
const PDF = join(REPO, "docs", "reports", "assets",
  "CV-BUILDER-PDF-EXPORT-FIX-01", "template-classic.pdf");

function run(capability, input) {
  return spawnSync(process.execPath, [CLI, "--capability", capability], {
    input: JSON.stringify({ input }),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

const JOB = {
  title: "Senior Python Engineer",
  company: "Example GmbH",
  location: ["Berlin"],
  remote: true,
  jobTypes: ["full-time"],
  descriptionPlain:
    "Required: Python, AWS and Docker. Kubernetes is a nice to have. " +
    "Must have 5+ years experience in backend development.",
  tags: ["Python", "AWS"],
};

test("parse.job returns tags and a deterministic stableId", () => {
  const first = run("parse.job", { job: JOB });
  assert.equal(first.status, 0, first.stderr);
  const a = JSON.parse(first.stdout);
  assert.equal(a.capability, "parse.job");
  assert.equal(a.schemaVersion, "1.0");
  assert.match(a.data.stableId, /^[a-f0-9]{64}$/);
  assert.ok(a.data.jobTags.some((tag) => /python/i.test(tag)));
  assert.equal(a.data.workMode, "remote");
  assert.deepEqual(a.data.location, ["Berlin"]);

  const second = JSON.parse(run("parse.job", { job: JOB }).stdout);
  assert.equal(a.data.stableId, second.data.stableId);
});

test("parse.cv parses the existing PDF fixture into cvTags", () => {
  const pdfBase64 = readFileSync(PDF).toString("base64");
  const result = run("parse.cv", { pdfBase64 });
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.capability, "parse.cv");
  assert.match(body.data.stableId, /^[a-f0-9]{64}$/);
  assert.ok(body.data.cvTags.some((tag) => /aws/i.test(tag)));
  assert.ok(body.data.skills.length > 0);
  assert.ok(["confirmed", "partial", "uncertain"].includes(body.data.confidence));
  assert.equal(body.data.provenance.source, "mays-jobsearch");
});

test("invalid capability and input fail with exit 2", () => {
  const bad = run("parse.other", {});
  assert.equal(bad.status, 2);
  assert.equal(JSON.parse(bad.stdout).error.code, "unsupported_capability");

  const noTitle = run("parse.job", { job: { descriptionPlain: "x" } });
  assert.equal(noTitle.status, 2);
  assert.equal(JSON.parse(noTitle.stdout).error.code, "invalid_input");
});

test("Lambda handler reuses the parser and returns a JSON error", async () => {
  const ok = await handler({ capability: "parse.job", input: { job: JOB } });
  assert.equal(ok.capability, "parse.job");
  assert.match(ok.data.stableId, /^[a-f0-9]{64}$/);

  const cv = await handler({
    capability: "parse.cv",
    input: { pdfBase64: readFileSync(PDF).toString("base64") },
  });
  assert.equal(cv.capability, "parse.cv");
  assert.ok(cv.data.cvTags.length > 0);
  assert.ok(cv.data.document.textLength > 0);

  const bad = await handler({
    capability: "parse.job", input: { job: {} },
  });
  assert.equal(bad.error.code, "invalid_input");
});
