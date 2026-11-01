// Isolated Redis verification for the one-off cv-profile purge script.
// Uses Docker + synthetic keys only. Never connects to Upstash/production.
//
// Run: npm run test:cv-purge:redis

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { purgeCvProfileCache, isCvProfileKey } from "../../scripts/purge-cv-profile-cache.mjs";

const exec = promisify(execFile);
const container = `mj-cv-purge-redis-${Date.now()}`;
const results = [];

function assert(name, actual, expected) {
  const ok = actual === expected;
  results.push({ name, ok, actual, expected });
  if (!ok) throw new Error(`${name}: expected ${expected}, got ${actual}`);
}

async function cli(...args) {
  const { stdout } = await exec("docker", ["exec", container, "redis-cli", "--json", ...args]);
  const text = stdout.trim();
  if (!text) return null;
  return JSON.parse(text);
}

const redis = {
  command: (...args) => cli(...args),
  pipeline: (commands) => Promise.all(commands.map((command) => cli(...command))),
};

const validKeys = [
  `cv-profile:${"a".repeat(64)}`,
  `cv-profile:${"b".repeat(64)}`,
  `cv-profile:${"c".repeat(64)}`,
];

const mismatchedCvKeys = [
  `cv-profile:${"A".repeat(64)}`,
  `cv-profile:${"d".repeat(63)}`,
  `cv-profile:${"e".repeat(65)}`,
  `cv-profile:${"f".repeat(64)}:suffix`,
  "cv-profile:short",
];

const otherNamespaceKeys = [
  "job-source:arbeitsagentur:test|berlin",
  "mj-detail:arbeitsagentur:ref-1",
  "mj-usage:test:requests:2026-11",
  "geo:city:Berlin",
  "alerts",
];

const otherKeys = [...mismatchedCvKeys, ...otherNamespaceKeys];

async function seed() {
  for (const key of [...validKeys, ...otherKeys]) {
    await cli("SET", key, "synthetic");
  }
  await cli("EXPIRE", validKeys[0], "3600");
  await cli("EXPIRE", validKeys[1], "86400");
  // validKeys[2] intentionally has no TTL.
}

async function exists(key) {
  return Number(await cli("EXISTS", key));
}

async function main() {
  await exec("docker", ["run", "--rm", "-d", "--name", container, "redis:7-alpine"]);
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await cli("PING")) === "PONG") break;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await seed();

  assert("key classifier accepts exact 64-hex key", isCvProfileKey(validKeys[0]), true);
  assert("key classifier rejects uppercase hash", isCvProfileKey(mismatchedCvKeys[0]), false);
  assert("key classifier rejects short hash", isCvProfileKey(mismatchedCvKeys[4]), false);

  const dryRun = await purgeCvProfileCache({ redis, dryRun: true, batchSize: 2 });
  assert("dry-run scans all cv-profile matches", dryRun.totalScanned, validKeys.length + mismatchedCvKeys.length);
  assert("dry-run counts exact CV keys", dryRun.validKeys, validKeys.length);
  assert("dry-run counts mismatched keys", dryRun.mismatchedKeys, mismatchedCvKeys.length);
  assert("dry-run deletes nothing", dryRun.deletedKeys, 0);
  assert("dry-run TTL no-expiry count", dryRun.ttlBuckets.noExpiry, 1);
  for (const key of [...validKeys, ...otherKeys]) {
    assert(`dry-run preserves ${key.slice(0, 12)}…`, await exists(key), 1);
  }

  const deleted = await purgeCvProfileCache({ redis, dryRun: false, batchSize: 2 });
  assert("delete counts exact CV keys", deleted.validKeys, validKeys.length);
  assert("delete removes exact CV keys", deleted.deletedKeys, validKeys.length);
  for (const key of validKeys) {
    assert(`deleted ${key.slice(0, 12)}…`, await exists(key), 0);
  }
  for (const key of otherKeys) {
    assert(`retained ${key.slice(0, 12)}…`, await exists(key), 1);
  }

  const repeated = await purgeCvProfileCache({ redis, dryRun: false, batchSize: 2 });
  assert("repeated run is idempotent (no keys)", repeated.validKeys, 0);
  assert("repeated run deletes nothing", repeated.deletedKeys, 0);
  for (const key of otherKeys) {
    assert(`repeat retains ${key.slice(0, 12)}…`, await exists(key), 1);
  }

  let failed = false;
  try {
    await purgeCvProfileCache({
      redis: {
        command: async () => {
          throw new Error("synthetic redis outage");
        },
        pipeline: async () => [],
      },
      dryRun: true,
    });
  } catch {
    failed = true;
  }
  assert("redis error is surfaced", failed, true);

  console.log(JSON.stringify({ status: "PASS", checks: results.length, container }, null, 2));
}

try {
  await main();
} finally {
  try {
    await exec("docker", ["stop", container]);
  } catch {
    /* container may not have started */
  }
}
