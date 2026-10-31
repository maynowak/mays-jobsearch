// Isolated Redis verification for the provider-budget Lua scripts.
// Requires Docker with the redis:7-alpine image. No production Redis is used.
//
// Run: node tests/tools/verify-budget-lua.mjs

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __BUDGET_SCRIPTS } from "../../api/_lib/usage.mjs";

const exec = promisify(execFile);
const container = `mj-budget-redis-${Date.now()}`;
const results = [];

function assert(name, actual, expected) {
  const ok = actual === expected;
  results.push({ name, ok, actual, expected });
  if (!ok) throw new Error(`${name}: expected ${expected}, got ${actual}`);
}

async function redis(args) {
  const { stdout } = await exec("docker", ["exec", container, "redis-cli", ...args]);
  return stdout.trim();
}

async function evalScript(scriptPath, keys, args) {
  const { stdout } = await exec("docker", [
    "exec",
    container,
    "redis-cli",
    "--eval",
    scriptPath,
    ...keys,
    ",",
    ...args.map(String),
  ]);
  return stdout.trim();
}

async function main() {
  await exec("docker", ["run", "--rm", "-d", "--name", container, "redis:7-alpine"]);
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await redis(["PING"])) === "PONG") break;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const dir = await mkdtemp(join(tmpdir(), "mj-budget-lua-"));
  const reservePath = "/tmp/mj-reserve.lua";
  const settlePath = "/tmp/mj-settle.lua";
  const releasePath = "/tmp/mj-release.lua";
  const localReserve = join(dir, "reserve.lua");
  const localSettle = join(dir, "settle.lua");
  const localRelease = join(dir, "release.lua");
  await writeFile(localReserve, __BUDGET_SCRIPTS.reserve);
  await writeFile(localSettle, __BUDGET_SCRIPTS.settle);
  await writeFile(localRelease, __BUDGET_SCRIPTS.release);
  for (const [local, remote] of [
    [localReserve, reservePath],
    [localSettle, settlePath],
    [localRelease, releasePath],
  ]) {
    await exec("docker", ["cp", local, `${container}:${remote}`]);
  }

  const now = Math.floor(Date.now() / 1000);
  const used = "mj-usage:test:credits:2026-10";
  const prevUsed = "mj-usage:test:credits:2026-09";
  const reservations = "mj-budget:test:reservations:2026-10";
  const prevReservations = "mj-budget:test:reservations:2026-09";

  // 1. Reserve within budget.
  assert(
    "reserve within budget",
    await evalScript(reservePath, [used, reservations, prevUsed], [25, 200, "2026-10:id1", now, 900, "2026-10", 1000, "2026-10"]),
    "1"
  );

  // 2. A second reservation that would exceed the budget is rejected.
  assert(
    "reserve exceeds budget",
    await evalScript(reservePath, [used, reservations, prevUsed], [180, 200, "2026-10:id2", now, 900, "2026-10", 1000, "2026-10"]),
    "-1"
  );

  // 3. Settle actual cost.
  assert(
    "settle actual",
    await evalScript(settlePath, [used, prevUsed, reservations, prevReservations], ["2026-10:id1", 3, "2026-10", 1000]),
    "3"
  );
  assert("used after settle", await redis(["GET", used]), "3");

  // 4. Double settle is a no-op.
  assert(
    "double settle",
    await evalScript(settlePath, [used, prevUsed, reservations, prevReservations], ["2026-10:id1", 3, "2026-10", 1000]),
    "-1"
  );
  assert("used after double settle", await redis(["GET", used]), "3");

  // 5. Release a reservation without charging.
  await redis(["SET", reservations + ":probe", "1"]);
  await redis(["DEL", reservations + ":probe"]);
  assert(
    "reserve for release",
    await evalScript(reservePath, [used, reservations, prevUsed], [10, 200, "2026-10:id3", now, 900, "2026-10", 1000, "2026-10"]),
    "1"
  );
  assert(
    "release",
    await evalScript(releasePath, [reservations, prevReservations], ["2026-10:id3"]),
    "1"
  );

  // 6. 900s TTL boundary: an expired unknown reservation is charged at max.
  await redis(["FLUSHALL"]);
  assert(
    "reserve short ttl",
    await evalScript(reservePath, [used, reservations, prevUsed], [10, 12, "2026-10:exp", now, 1, "2026-10", 1000, "2026-10"]),
    "1"
  );
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert(
    "expired reservation charges max and blocks over-budget",
    await evalScript(reservePath, [used, reservations, prevUsed], [5, 12, "2026-10:new", now + 2, 900, "2026-10", 1000, "2026-10"]),
    "-1"
  );
  assert("used after expiry charge", await redis(["GET", used]), "10");
  assert("expired reservation removed", await redis(["HEXISTS", reservations, "2026-10:exp"]), "0");

  // 7. Month rollover: a December reservation settles in December while the
  //    current month is January.
  await redis(["FLUSHALL"]);
  const decUsed = "mj-usage:test:credits:2026-12";
  const janUsed = "mj-usage:test:credits:2027-01";
  const decRes = "mj-budget:test:reservations:2026-12";
  const janRes = "mj-budget:test:reservations:2027-01";
  assert(
    "reserve December",
    await evalScript(reservePath, [decUsed, decRes, "mj-usage:test:credits:2026-11"], [20, 100, "2026-12:dec", now, 900, "2026-12", 1000, "2026-12"]),
    "1"
  );
  assert(
    "settle December from January",
    await evalScript(settlePath, [janUsed, decUsed, janRes, decRes], ["2026-12:dec", 7, "2027-01", 1000]),
    "7"
  );
  assert("December used", await redis(["GET", decUsed]), "7");
  assert("January used untouched", await redis(["GET", janUsed]), "");

  // 8. Parallel reservations must not both consume the same remaining budget.
  await redis(["FLUSHALL"]);
  const parallel = await Promise.all([
    evalScript(reservePath, [used, reservations, prevUsed], [150, 200, "2026-10:p1", now, 900, "2026-10", 1000, "2026-10"]),
    evalScript(reservePath, [used, reservations, prevUsed], [150, 200, "2026-10:p2", now, 900, "2026-10", 1000, "2026-10"]),
  ]);
  assert("parallel exactly one succeeds", parallel.filter((value) => value === "1").length, 1);

  await rm(dir, { recursive: true, force: true });
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ status: "FAIL", error: String(error), results }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await exec("docker", ["rm", "-f", container]);
    } catch {
      /* already removed */
    }
  });
