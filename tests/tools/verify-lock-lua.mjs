// Isolated Redis verification for single-flight lock semantics.
// Run: node tests/tools/verify-lock-lua.mjs
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __LOCK_SCRIPTS } from "../../api/_lib/lock.mjs";

const exec = promisify(execFile);
const container = `mj-lock-redis-${Date.now()}`;
const results = [];

function assert(name, actual, expected) {
  results.push({ name, ok: actual === expected, actual, expected });
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
}

async function redis(args) {
  const { stdout } = await exec("docker", ["exec", container, "redis-cli", ...args]);
  return stdout.trim();
}

async function main() {
  await exec("docker", ["run", "--rm", "-d", "--name", container, "redis:7-alpine"]);
  for (let i = 0; i < 50; i += 1) {
    try { if ((await redis(["PING"])) === "PONG") break; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const dir = await mkdtemp(join(tmpdir(), "mj-lock-lua-"));
  const localRelease = join(dir, "release.lua");
  await writeFile(localRelease, __LOCK_SCRIPTS.release);
  await exec("docker", ["cp", localRelease, `${container}:/tmp/release.lua`]);

  const key = "mj-lock:test:abc";

  const parallel = await Promise.all([
    redis(["SET", key, "token-a", "NX", "PX", "5000"]),
    redis(["SET", key, "token-b", "NX", "PX", "5000"]),
  ]);
  assert("parallel acquire exactly one", parallel.filter((value) => value === "OK").length, 1);
  const winner = parallel[0] === "OK" ? "token-a" : "token-b";
  const loser = winner === "token-a" ? "token-b" : "token-a";

  assert(
    "stale owner cannot release",
    await redis(["EVAL", __LOCK_SCRIPTS.release, "1", key, loser]),
    "0"
  );
  assert("lock still present", await redis(["EXISTS", key]), "1");
  assert(
    "owner releases",
    await redis(["EVAL", __LOCK_SCRIPTS.release, "1", key, winner]),
    "1"
  );
  assert("lock removed", await redis(["EXISTS", key]), "0");

  await redis(["SET", key, "token-c", "NX", "PX", "300"]);
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert("ttl expiry releases lock", await redis(["EXISTS", key]), "0");

  await rm(dir, { recursive: true, force: true });
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", error: String(error), results }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await exec("docker", ["rm", "-f", container]); } catch { /* removed */ }
  });
