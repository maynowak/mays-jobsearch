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