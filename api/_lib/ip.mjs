import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * Trusted client IP resolution.
 *
 * Trust model:
 * - On Vercel (`VERCEL=1`), platform-provided headers are trusted.
 * - Outside Vercel, forwarded headers are ignored unless
 *   `MJ_TRUST_PROXY_IP=1` is explicitly set for a controlled test proxy.
 * - The first available trusted header is authoritative; an invalid value is
 *   not silently replaced by a more spoofable header.
 */
export function resolveTrustedClientIp(req, env = process.env) {
  const onVercel = String(env.VERCEL ?? "") === "1";
  const trustProxy = onVercel || String(env.MJ_TRUST_PROXY_IP ?? "") === "1";
  if (!trustProxy) return { status: "unavailable" };

  const headers = req?.headers ?? {};
  const read = (name) => {
    const value = headers[name];
    if (Array.isArray(value)) return value[0];
    return typeof value === "string" ? value : "";
  };

  const candidates = [
    read("x-vercel-forwarded-for"),
    read("x-real-ip"),
    read("x-forwarded-for"),
  ].filter((value) => value.trim().length > 0);

  if (candidates.length === 0) return { status: "unavailable" };

  const raw = firstHop(candidates[0]);
  const parsed = parseIp(raw);
  if (!parsed) return { status: "invalid" };
  return { status: "trusted-ip", ...parsed };
}

function firstHop(value) {
  return String(value).split(",")[0].trim();
}

/**
 * Parses and normalizes an IPv4 or IPv6 address.
 * Returns { family, address, group } or null.
 * `group` is the IPv4 address or the /64 prefix for IPv6.
 */
export function parseIp(raw) {
  let value = String(raw ?? "").trim();
  if (!value) return null;
  // Strip brackets and optional ports.
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end === -1) return null;
    value = value.slice(1, end);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }

  const mapped = /^::ffff:(\d{1,3}(\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];

  const family = isIP(value);
  if (family === 4) {
    return { family: 4, address: value, group: value };
  }
  if (family === 6) {
    const address = value.toLowerCase();
    return { family: 6, address, group: ipv6Prefix64(address) };
  }
  return null;
}

function ipv6ToBigInt(address) {
  const [head, tail] = address.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  const parts = [
    ...headParts,
    ...Array.from({ length: missing }, () => "0"),
    ...tailParts,
  ];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }
  return parts.reduce((acc, part) => (acc << 16n) + BigInt(parseInt(part, 16)), 0n);
}

function ipv6Prefix64(address) {
  const value = ipv6ToBigInt(address);
  if (value === null) return address;
  const mask = ((1n << 128n) - 1n) ^ ((1n << 64n) - 1n);
  return (value & mask).toString(16).padStart(32, "0");
}

/** HMAC-derived, non-reversible IP scope. Null when no server secret exists. */
export function deriveIpScope(group, env = process.env) {
  const secret = String(env.MJ_IP_QUOTA_SECRET ?? "").trim();
  if (!secret || !group) return null;
  return createHmac("sha256", secret).update(`ip:v1:${group}`).digest("hex").slice(0, 32);
}

export function ipQuotaVersion(env = process.env) {
  const version = String(env.MJ_IP_QUOTA_VERSION ?? "v1").trim();
  return /^[a-z0-9_-]{1,16}$/i.test(version) ? version : "v1";
}
