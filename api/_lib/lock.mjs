import { createHash, randomBytes } from "node:crypto";
import { cacheGet, cacheGetRaw, cacheSetNx, cacheEval } from "./cache.mjs";

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/** Stable, non-PII lock key for a provider + normalized request identity. */
export function singleFlightKey(namespace, payload) {
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
  return `mj-lock:${namespace}:${digest}`;
}

/**
 * Acquire a single-flight lock. Returns:
 * { status: "acquired", token } | { status: "busy" } | { status: "unavailable" }
 */
export async function acquireSingleFlight(key, ttlMs) {
  const token = randomBytes(16).toString("hex");
  const result = await cacheSetNx(key, token, ttlMs);
  if (result === "OK") return { status: "acquired", token };
  // Distinguish "busy" from Redis failure by checking the key.
  const existing = await cacheGetRaw(key);
  return existing ? { status: "busy" } : { status: "unavailable" };
}

/** Release only if the caller still owns the lock token. */
export async function releaseSingleFlight(key, token) {
  const result = await cacheEval(RELEASE_SCRIPT, [key], [token]);
  return result === 1;
}

/** Wait until the lock disappears (owner finished or TTL expired). */
export async function waitForLockRelease(key, waitMs = 3000, pollMs = 100) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if ((await cacheGetRaw(key)) === null) return true;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}

/**
 * Run a paid source call under a single-flight lock.
 * Busy callers wait briefly for the owner to finish, then return "busy".
 * They never start a second paid call; a retry will hit the owner's cache.
 */
export async function withSourceLock(key, ttlMs, run, waitMs = 3000) {
  const lock = await acquireSingleFlight(key, ttlMs);
  if (lock.status === "unavailable") return { status: "unavailable" };
  if (lock.status === "busy") {
    // Wait only to avoid a thundering herd; never start a second paid call.
    await waitForLockRelease(key, waitMs);
    return { status: "busy" };
  }
  try {
    return { status: "ran", value: await run() };
  } finally {
    await releaseSingleFlight(key, lock.token);
  }
}

/** Bounded wait for another request to fill the cache. */
export async function waitForCachedValue(key, waitMs = 2000, pollMs = 150) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const value = await cacheGet(key);
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return null;
}

// Exposed only for the isolated Redis verification script.
export const __LOCK_SCRIPTS = { release: RELEASE_SCRIPT };
