/**
 * JM-PRIVACY-CV-REDIS-PURGE-02
 *
 * One-off, exact-namespace cleanup for retired `cv-profile:<sha256>` keys.
 *
 * Safety rules:
 * - dry-run by default
 * - only `cv-profile:*` is scanned
 * - only keys matching `cv-profile:<64 lowercase hex>` are deleted
 * - deletion is explicit, batched and never wildcard-based
 * - no keys, hashes or credentials are logged
 *
 * CLI:
 *   node scripts/purge-cv-profile-cache.mjs
 *   node scripts/purge-cv-profile-cache.mjs --delete --confirm-production
 *
 * Production use requires a separate approval. This module does not read
 * secrets from files and does not write to Redis in dry-run mode.
 */

import { pathToFileURL } from "node:url";

const CV_PROFILE_KEY = /^cv-profile:[a-f0-9]{64}$/;
const DEFAULT_BATCH_SIZE = 100;

export function isCvProfileKey(key) {
  return typeof key === "string" && CV_PROFILE_KEY.test(key);
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function emptyTtlBuckets() {
  return {
    noExpiry: 0,
    missing: 0,
    under1h: 0,
    under1d: 0,
    under7d: 0,
    under30d: 0,
    over30d: 0,
  };
}

function addTtl(buckets, ttl) {
  if (ttl === -1) buckets.noExpiry += 1;
  else if (ttl === -2) buckets.missing += 1;
  else if (ttl < 3600) buckets.under1h += 1;
  else if (ttl < 86400) buckets.under1d += 1;
  else if (ttl < 7 * 86400) buckets.under7d += 1;
  else if (ttl <= 30 * 86400) buckets.under30d += 1;
  else buckets.over30d += 1;
}

/**
 * @param {object} options
 * @param {{ command: (...args: string[]) => Promise<unknown>, pipeline: (commands: string[][]) => Promise<unknown[]> }} options.redis
 * @param {boolean} [options.dryRun]
 * @param {number} [options.batchSize]
 * @returns {Promise<object>}
 */
export async function purgeCvProfileCache({ redis, dryRun = true, batchSize = DEFAULT_BATCH_SIZE }) {
  if (!redis || typeof redis.command !== "function" || typeof redis.pipeline !== "function") {
    throw new Error("redis adapter is required");
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error("batchSize must be between 1 and 1000");
  }

  async function scanPass({ deleteKeys }) {
    let cursor = "0";
    let iterations = 0;
    let totalScanned = 0;
    let validKeyCount = 0;
    let mismatchedKeyCount = 0;
    let duplicateKeyCount = 0;
    let deletedKeyCount = 0;
    const ttlBuckets = emptyTtlBuckets();
    const seenKeys = new Set();

    do {
      const result = await redis.command("SCAN", cursor, "MATCH", "cv-profile:*", "COUNT", String(batchSize));
      if (!Array.isArray(result) || result.length !== 2) {
        throw new Error("unexpected SCAN result");
      }
      cursor = String(result[0]);
      const keys = Array.isArray(result[1]) ? result[1] : [];
      totalScanned += keys.length;

      const exactKeys = [];
      for (const key of keys) {
        // SCAN can return a key more than once while the keyspace changes.
        // Count and delete each key only once per pass.
        if (seenKeys.has(key)) {
          duplicateKeyCount += 1;
          continue;
        }
        seenKeys.add(key);
        if (isCvProfileKey(key)) {
          validKeyCount += 1;
          exactKeys.push(key);
        } else {
          mismatchedKeyCount += 1;
        }
      }

      if (exactKeys.length) {
        const ttls = await redis.pipeline(exactKeys.map((key) => ["TTL", key]));
        if (!Array.isArray(ttls) || ttls.length !== exactKeys.length) {
          throw new Error("unexpected TTL pipeline result");
        }
        for (const ttl of ttls) addTtl(ttlBuckets, Number(ttl));

        if (deleteKeys) {
          for (const batch of chunk(exactKeys, batchSize)) {
            const deleted = await redis.command("DEL", ...batch);
            const count = Number(deleted);
            if (!Number.isFinite(count) || count < 0) throw new Error("unexpected DEL result");
            deletedKeyCount += count;
          }
        }
      }

      iterations += 1;
      if (iterations > 10000) throw new Error("SCAN iteration limit reached");
    } while (cursor !== "0");

    return {
      totalScanned,
      validKeys: validKeyCount,
      mismatchedKeys: mismatchedKeyCount,
      duplicateKeys: duplicateKeyCount,
      deletedKeys: deletedKeyCount,
      ttlBuckets,
      scanIterations: iterations,
    };
  }

  const result = await scanPass({ deleteKeys: !dryRun });
  const verification = dryRun ? null : await scanPass({ deleteKeys: false });
  return { dryRun, ...result, verification };
}

export function createUpstashRedis({ url, token, fetchImpl = fetch }) {
  if (!url || !token) throw new Error("missing Upstash configuration");
  const endpoint = url.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  async function parseResponse(response, label) {
    const text = await response.text();
    if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${label} invalid JSON`);
    }
    if (parsed && parsed.error) throw new Error(`${label} command error`);
    return parsed;
  }

  return {
    async command(...args) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
      const parsed = await parseResponse(response, "redis");
      return parsed?.result;
    },
    async pipeline(commands) {
      const response = await fetchImpl(`${endpoint}/pipeline`, {
        method: "POST",
        headers,
        body: JSON.stringify(commands),
      });
      const parsed = await parseResponse(response, "redis pipeline");
      if (!Array.isArray(parsed)) throw new Error("redis pipeline invalid shape");
      return parsed.map((entry) => {
        if (entry && entry.error) throw new Error("redis pipeline command error");
        return entry?.result;
      });
    },
  };
}

function parseArgs(argv) {
  return {
    delete: argv.includes("--delete"),
    confirmProduction: argv.includes("--confirm-production"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log(`Usage: node scripts/purge-cv-profile-cache.mjs [--delete --confirm-production]

Default is a dry-run. --delete removes only exact cv-profile:<64-hex> keys and
requires --confirm-production. The script never uses FLUSHDB/FLUSHALL and never
touches other namespaces.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.delete && !args.confirmProduction) {
    throw new Error("deletion requires --confirm-production");
  }

  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) {
    throw new Error("missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  }

  let host = "unknown";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("invalid UPSTASH_REDIS_REST_URL");
  }

  const redis = createUpstashRedis({ url, token });
  const result = await purgeCvProfileCache({ redis, dryRun: !args.delete });
  console.log(JSON.stringify({ redisHost: host, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(JSON.stringify({ error: err?.message || "purge failed" }));
    process.exitCode = 1;
  });
}
