const DEFAULT_TTL_SEC = 600;

function cacheConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function cacheCommand(command, ...args) {
  const cfg = cacheConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([command, ...args]),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (data.error) return null;
    return data.result;
  } catch {
    return null;
  }
}

export async function cacheGet(key) {
  const raw = await cacheCommand("GET", key);
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSec = DEFAULT_TTL_SEC) {
  await cacheCommand("SETEX", key, ttlSec, JSON.stringify(value));
}

export async function cacheDel(key) {
  await cacheCommand("DEL", key);
}

export async function cacheIncr(key, ttlSec) {
  const result = await cacheCommand("INCR", key);
  if (typeof result === "number" && result === 1 && ttlSec) {
    await cacheCommand("EXPIRE", key, ttlSec);
  }
  return typeof result === "number" ? result : null;
}

export async function cacheHIncrBy(key, field, by = 1, ttlSec) {
  const result = await cacheCommand("HINCRBY", key, field, by);
  if (typeof result === "number" && result === by && ttlSec) {
    await cacheCommand("EXPIRE", key, ttlSec);
  }
  return typeof result === "number" ? result : null;
}

export async function cacheHGetAll(key) {
  const result = await cacheCommand("HGETALL", key);
  if (!Array.isArray(result)) return {};
  const out = {};
  for (let i = 0; i + 1 < result.length; i += 2) {
    out[String(result[i])] = Number(result[i + 1]) || 0;
  }
  return out;
}

// Atomic check-and-reserve: increment key by `n` only if current + n <= limit.
// Returns the new value on success, -1 if it would exceed the limit, or null if
// Redis is unavailable (caller must fail closed).
export async function cacheReserveIncr(key, n, limit, ttlSec = 0) {
  const script = [
    "local current = tonumber(redis.call('GET', KEYS[1]) or '0')",
    "local n = tonumber(ARGV[1])",
    "local limit = tonumber(ARGV[2])",
    "if (current + n) > limit then return -1 end",
    "local next = redis.call('INCRBY', KEYS[1], n)",
    "if current == 0 and tonumber(ARGV[3]) > 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end",
    "return next",
  ].join("\n");
  const result = await cacheCommand("EVAL", script, 1, key, n, limit, ttlSec || 0);
  return typeof result === "number" ? result : null;
}

export async function cacheDecrBy(key, n) {
  if (!n || n <= 0) return null;
  const result = await cacheCommand("INCRBY", key, -n);
  return typeof result === "number" ? result : null;
}