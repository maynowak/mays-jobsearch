import { HttpError } from "./filter.mjs";

const HASH_KEY = "alerts";

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new HttpError(
      500,
      "The alert store isn't configured yet. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on Vercel to use job alerts.",
      "missing_config"
    );
  }
  return { url, token };
}

async function redis(command, ...args) {
  const { url, token } = redisConfig();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([command, ...args]),
    });
  } catch {
    throw new HttpError(502, "Couldn't reach the alert store right now.", "network");
  }
  if (!res.ok) {
    throw new HttpError(502, `The alert store returned HTTP ${res.status}.`, "upstream");
  }
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    throw new HttpError(502, `The alert store reported an error: ${data.error}.`, "upstream");
  }
  return data.result;
}

export async function listSubscriptions() {
  const flat = await redis("HGETALL", HASH_KEY);
  const subs = [];
  for (let i = 0; i < flat.length; i += 2) {
    try {
      subs.push(JSON.parse(flat[i + 1]));
    } catch {
      /* skip corrupt entries */
    }
  }
  return subs;
}

export async function saveSubscription(sub) {
  await redis("HSET", HASH_KEY, sub.email, JSON.stringify(sub));
}

export async function deleteSubscription(email) {
  await redis("HDEL", HASH_KEY, String(email).toLowerCase());
}
