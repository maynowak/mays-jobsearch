// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deriveIpScope, parseIp, resolveTrustedClientIp } from "../../api/_lib/ip.mjs";

const req = (headers) => ({ headers });

describe("JM-COOKIELESS-QUOTA-02B-01: trusted IP resolver", () => {
  it("uses the Vercel-provided header on Vercel", () => {
    const result = resolveTrustedClientIp(
      req({ "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1" }),
      { VERCEL: "1" }
    );
    expect(result).toMatchObject({ status: "trusted-ip", family: 4, address: "203.0.113.7" });
  });

  it("does not trust forwarded headers outside a trusted proxy", () => {
    expect(resolveTrustedClientIp(req({ "x-forwarded-for": "203.0.113.7" }), {})).toEqual({
      status: "unavailable",
    });
  });

  it("rejects invalid header values without falling back", () => {
    expect(
      resolveTrustedClientIp(req({ "x-vercel-forwarded-for": "not-an-ip", "x-real-ip": "203.0.113.7" }), {
        VERCEL: "1",
      })
    ).toEqual({ status: "invalid" });
  });

  it("normalizes IPv4 and IPv4-mapped IPv6 consistently", () => {
    expect(parseIp("203.0.113.7")).toMatchObject({ family: 4, group: "203.0.113.7" });
    expect(parseIp("::ffff:203.0.113.7")).toMatchObject({ family: 4, group: "203.0.113.7" });
  });

  it("groups IPv6 by /64", () => {
    const a = parseIp("2001:db8:abcd:1234::1");
    const b = parseIp("2001:db8:abcd:1234::ffff");
    const c = parseIp("2001:db8:abcd:9999::1");
    expect(a?.group).toBe(b?.group);
    expect(a?.group).not.toBe(c?.group);
  });

  it("derives a non-reversible HMAC scope and requires a secret", () => {
    const group = "203.0.113.7";
    expect(deriveIpScope(group, {})).toBeNull();
    const a = deriveIpScope(group, { MJ_IP_QUOTA_SECRET: "secret-a" });
    const b = deriveIpScope(group, { MJ_IP_QUOTA_SECRET: "secret-a" });
    const c = deriveIpScope(group, { MJ_IP_QUOTA_SECRET: "secret-b" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(a).not.toContain("203.0.113");
  });
});
