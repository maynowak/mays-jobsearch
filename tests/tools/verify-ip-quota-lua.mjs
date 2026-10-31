// Isolated Redis verification for IP-quota Lua scripts.
// Run: node tests/tools/verify-ip-quota-lua.mjs
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __IP_QUOTA_SCRIPTS } from "../../api/_lib/ipQuota.mjs";

const exec = promisify(execFile);
const container = `mj-ipquota-redis-${Date.now()}`;
const results = [];

function assert(name, actual, expected) {
  results.push({ name, ok: actual === expected, actual, expected });
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
}

async function redis(args) {
  const { stdout } = await exec("docker", ["exec", container, "redis-cli", ...args]);
  return stdout.trim();
}

async function evalScript(path, keys, args) {
  const { stdout } = await exec("docker", [
    "exec", container, "redis-cli", "--eval", path, ...keys, ",", ...args.map(String),
  ]);
  return stdout.trim();
}

async function main() {
  await exec("docker", ["run", "--rm", "-d", "--name", container, "redis:7-alpine"]);
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await redis(["PING"])) === "PONG") break;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const dir = await mkdtemp(join(tmpdir(), "mj-ipquota-lua-"));
  const localReserve = join(dir, "reserve.lua");
  const localRelease = join(dir, "release.lua");
  await writeFile(localReserve, __IP_QUOTA_SCRIPTS.reserve);
  await writeFile(localRelease, __IP_QUOTA_SCRIPTS.release);
  await exec("docker", ["cp", localReserve, `${container}:/tmp/reserve.lua`]);
  await exec("docker", ["cp", localRelease, `${container}:/tmp/release.lua`]);

  const w = "mj-quota:ip:v1:test:w:1:scope";
  const d = "mj-quota:ip:v1:test:d:2026-10-31:scope";

  assert("first reserve", await evalScript("/tmp/reserve.lua", [w, d], [2, 10, 600, 86400]), "1");
  assert("second reserve", await evalScript("/tmp/reserve.lua", [w, d], [2, 10, 600, 86400]), "1");
  assert("third reserve blocked", await evalScript("/tmp/reserve.lua", [w, d], [2, 10, 600, 86400]), "-1");
  assert("window counter", await redis(["GET", w]), "2");
  assert("release", await evalScript("/tmp/release.lua", [w, d], []), "1");
  assert("window after release", await redis(["GET", w]), "1");
  assert("reserve after release", await evalScript("/tmp/reserve.lua", [w, d], [2, 10, 600, 86400]), "1");

  await redis(["FLUSHALL"]);
  const parallel = await Promise.all([
    evalScript("/tmp/reserve.lua", [w, d], [1, 10, 600, 86400]),
    evalScript("/tmp/reserve.lua", [w, d], [1, 10, 600, 86400]),
  ]);
  assert("parallel exactly one succeeds", parallel.filter((value) => value === "1").length, 1);

  await redis(["FLUSHALL"]);
  assert("short window reserve", await evalScript("/tmp/reserve.lua", [w, d], [1, 10, 1, 86400]), "1");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert("window expiry allows new reserve", await evalScript("/tmp/reserve.lua", [w, d], [1, 10, 1, 86400]), "1");

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
