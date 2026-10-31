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

  const w1 = "mj-quota:ip:v1:test:w:1:scope";
  const w2 = "mj-quota:ip:v1:test:w:2:scope";
  const d1 = "mj-quota:ip:v1:test:d:2026-10-31:scope";
  const d0 = "mj-quota:ip:v1:test:d:2026-10-30:scope";
  const receipt = "a".repeat(32);
  const rKey = `mj-quota:ip:v1:test:r:${receipt}`;

  assert(
    "first reserve",
    await evalScript("/tmp/reserve.lua", [w1, d1, rKey], [2, 10, 600, 86400, 1, "2026-10-31", 600, "scope"]),
    "1"
  );
  assert("receipt stored", await redis(["GET", rKey]), "1|2026-10-31|scope");
  assert(
    "second reserve",
    await evalScript("/tmp/reserve.lua", [w1, d1, `mj-quota:ip:v1:test:r:${"b".repeat(32)}`], [2, 10, 600, 86400, 1, "2026-10-31", 600, "scope"]),
    "1"
  );
  assert(
    "third reserve blocked",
    await evalScript("/tmp/reserve.lua", [w1, d1, `mj-quota:ip:v1:test:r:${"c".repeat(32)}`], [2, 10, 600, 86400, 1, "2026-10-31", 600, "scope"]),
    "-1"
  );
  assert(
    "release first",
    await evalScript("/tmp/release.lua", [rKey, w1, w2, d1, d0], [1, "2026-10-31", "scope"]),
    "1"
  );
  assert("window after release", await redis(["GET", w1]), "1");
  assert("daily after release", await redis(["GET", d1]), "1");
  assert(
    "double release no-op",
    await evalScript("/tmp/release.lua", [rKey, w1, w2, d1, d0], [1, "2026-10-31", "scope"]),
    "0"
  );
  assert("window after double release", await redis(["GET", w1]), "1");

  // Release in a later window must decrement the original window, not the new.
  await redis(["FLUSHALL"]);
  await evalScript("/tmp/reserve.lua", [w1, d1, rKey], [1, 10, 600, 86400, 1, "2026-10-31", 600, "scope"]);
  await evalScript("/tmp/release.lua", [rKey, w2, w1, d1, d0], [2, "2026-10-31", "scope"]);
  assert("old window decremented", await redis(["GET", w1]), "0");
  assert("new window untouched", await redis(["GET", w2]), "");

  // Release after UTC midnight must decrement the original day, not the new one.
  await redis(["FLUSHALL"]);
  await evalScript("/tmp/reserve.lua", [w1, d1, rKey], [1, 10, 600, 86400, 1, "2026-10-31", 600, "scope"]);
  await evalScript("/tmp/release.lua", [rKey, w1, w2, d0, d1], [1, "2026-10-30", "scope"]);
  assert("old day decremented", await redis(["GET", d1]), "0");
  assert("new day untouched", await redis(["GET", d0]), "");

  // Parallel releases: exactly one consumes the receipt.
  await redis(["FLUSHALL"]);
  await evalScript("/tmp/reserve.lua", [w1, d1, rKey], [1, 10, 600, 86400, 1, "2026-10-31", 600, "scope"]);
  const parallel = await Promise.all([
    evalScript("/tmp/release.lua", [rKey, w1, w2, d1, d0], [1, "2026-10-31", "scope"]),
    evalScript("/tmp/release.lua", [rKey, w1, w2, d1, d0], [1, "2026-10-31", "scope"]),
  ]);
  assert("parallel exactly one release", parallel.filter((value) => value === "1").length, 1);
  assert("counter not over-refunded", await redis(["GET", w1]), "0");

  await redis(["FLUSHALL"]);
  assert(
    "reserve after releases",
    await evalScript("/tmp/reserve.lua", [w1, d1, rKey], [1, 10, 600, 86400, 1, "2026-10-31", 600, "scope"]),
    "1"
  );

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
