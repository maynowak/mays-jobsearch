import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  parse,
  parseCv,
  parseJob,
  PARSER_LIBRARY_VERSION,
} from "../../api/_lib/parsers/ris.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "..", "..", "scripts", "ris-parser-cli.mjs");

const JOB = {
  title: "Senior Python Engineer",
  company: "Example GmbH",
  location: ["Berlin"],
  remote: true,
  jobTypes: ["full-time"],
  contractType: "permanent",
  language: "de",
  descriptionPlain:
    "We require Python, AWS and Docker. Kubernetes is a nice to have. " +
    "Must have 5+ years experience in backend development.",
  tags: ["Python", "AWS"],
};

const CV = `Ada Beispiel
ada@example.invalid
+49 30 1234567

Skills
Python, AWS; Docker | Kubernetes

Experience
Senior Engineer | Example GmbH | 2019 - 2024
Platform Engineer | Other AG | 2016 - 2019

Education
Master of Science in Computer Science

Languages
German, English
`;

test("library version is semver", () => {
  assert.match(PARSER_LIBRARY_VERSION, /^\d+\.\d+\.\d+$/);
});

test("parse.job is deterministic and reuses ATS requirements", () => {
  const first = parseJob({ job: JOB });
  const second = parseJob({ job: JOB });
  assert.equal(first.capability, "parse.job");
  assert.equal(first.parserVersion, PARSER_LIBRARY_VERSION);
  assert.equal(first.data.stableId, second.data.stableId);
  assert.match(first.data.stableId, /^[a-f0-9]{64}$/);
  assert.equal(first.data.title, "Senior Python Engineer");
  assert.ok(first.data.skills.some((s) => /python/i.test(s)));
  assert.ok(first.data.requirements.required.length > 0);
  assert.ok(first.data.experienceYears >= 5);
  assert.equal(first.data.metadata.remote, true);
  assert.equal(first.confidence.stableId, "high");
});

test("parse.job rejects empty and oversized input", () => {
  assert.throws(() => parseJob({ job: {} }), /title or descriptionPlain/);
  assert.throws(
    () => parseJob({ job: { descriptionPlain: "x".repeat(100001) } }),
    /exceeds/
  );
});

test("parse.cv is deterministic and keeps compatible fields", () => {
  const first = parseCv({ text: CV });
  const second = parseCv({ text: CV });
  assert.equal(first.capability, "parse.cv");
  assert.equal(first.data.stableId, second.data.stableId);
  assert.equal(first.data.email, "ada@example.invalid");
  assert.equal(first.data.name, "Ada Beispiel");
  assert.deepEqual(first.data.skills.slice(0, 3), ["Python", "AWS", "Docker"]);
  assert.equal(first.data.experienceLevel, "Senior");
  assert.equal(first.data.targetRoles.length, 0);
  assert.ok(first.data.education.some((e) => /master/i.test(e)));
  assert.ok(first.data.languages.length >= 2);
  assert.equal(first.confidence.email, "high");
});

test("parse.cv rejects too-short text and unsupported capability", () => {
  assert.throws(() => parseCv({ text: "short" }), /too short/);
  assert.throws(() => parse({ capability: "parse.other", input: {} }), /unsupported/);
});

test("CLI adapter emits JSON and stable exit codes", () => {
  const ok = spawnSync(
    process.execPath,
    [CLI, "--capability", "parse.cv"],
    { input: JSON.stringify({ input: { text: CV } }), encoding: "utf8" }
  );
  assert.equal(ok.status, 0, ok.stderr);
  const parsed = JSON.parse(ok.stdout);
  assert.equal(parsed.capability, "parse.cv");
  assert.equal(parsed.data.email, "ada@example.invalid");

  const bad = spawnSync(
    process.execPath,
    [CLI, "--capability", "parse.other"],
    { input: JSON.stringify({ input: {} }), encoding: "utf8" }
  );
  assert.equal(bad.status, 2);
  assert.equal(JSON.parse(bad.stdout).error.code, "unsupported_capability");
});
