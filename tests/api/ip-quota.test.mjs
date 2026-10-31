// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheEval: vi.fn(async () => 1),
}));

const { cacheEval } = await import("../../api/_lib/cache.mjs");
const { ipQuotaConfig, releaseIpQuota, reserveIpQuota } = await import(
  "../../api/_lib/ipQuota.mjs"
);

const env = {
  IP_QUOTA_ENABLED: "true",
  IP_QUOTA_WINDOW_SEC: "600",
  IP_QUOTA_MAX_PER_WINDOW: "30",
  IP_QUOTA_DAILY_MAX: "300",
  MJ_IP_QUOTA_SECRET: "test-secret",
  MJ_IP_QUOTA_VERSION: "v1",
};
const scope = "a".repeat(32);

beforeEach(() => {
  vi.mocked(cacheEval).mockReset();
  vi.mocked(cacheEval).mockResolvedValue(1);
});

describe("JM-COOKIELESS-QUOTA-02B-01: IP quota", () => {
  it("is disabled by default", () => {
    expect(ipQuotaConfig({}).enabled).toBe(false);
    expect(ipQuotaConfig(env).enabled).toBe(true);
  });

  it("returns allowed when disabled without touching Redis", async () => {
    await expect(reserveIpQuota("theirstack", scope, 1_700_000_000, {})).resolves.toEqual({
      status: "allowed",
      disabled: true,
    });
    expect(cacheEval).not.toHaveBeenCalled();
  });

  it("reserves atomically with window, daily and receipt keys", async () => {
    const result = await reserveIpQuota("theirstack", scope, 1_700_000_000, env);
    expect(result.status).toBe("allowed");
    expect(result.receipt).toMatch(/^[a-f0-9]{32}$/);
    const [, keys, args] = vi.mocked(cacheEval).mock.calls[0];
    expect(keys[0]).toMatch(/^mj-quota:ip:v1:theirstack:w:\d+:[a-f0-9]{32}$/);
    expect(keys[1]).toMatch(/^mj-quota:ip:v1:theirstack:d:\d{4}-\d{2}-\d{2}:[a-f0-9]{32}$/);
    expect(keys[2]).toMatch(/^mj-quota:ip:v1:theirstack:r:[a-f0-9]{32}$/);
    expect(args[0]).toBe(30);
    expect(args[1]).toBe(300);
    expect(args[2]).toBe(660);
    expect(args[3]).toBe(86_460);
    expect(args[6]).toBe(600);
  });

  it("maps limit and Redis failure", async () => {
    vi.mocked(cacheEval).mockResolvedValue(-1);
    await expect(reserveIpQuota("jobspipe", scope, 1_700_000_000, env)).resolves.toEqual({
      status: "limit_reached",
    });
    vi.mocked(cacheEval).mockResolvedValue(null);
    await expect(reserveIpQuota("jobspipe", scope, 1_700_000_000, env)).resolves.toEqual({
      status: "quota_unavailable",
    });
  });

  it("rejects invalid provider or scope", async () => {
    await expect(reserveIpQuota("bad provider", scope, 1_700_000_000, env)).resolves.toEqual({
      status: "invalid_scope",
    });
    await expect(reserveIpQuota("theirstack", "not-hex", 1_700_000_000, env)).resolves.toEqual({
      status: "invalid_scope",
    });
  });

  it("releases only with a matching receipt and is idempotent", async () => {
    const receipt = "b".repeat(32);
    await expect(
      releaseIpQuota("theirstack", scope, receipt, 1_700_000_000, env)
    ).resolves.toEqual({ status: "allowed" });
    const [script, keys, args] = vi.mocked(cacheEval).mock.calls[0];
    expect(String(script)).toContain("DECR");
    expect(keys).toHaveLength(5);
    expect(keys[0]).toMatch(new RegExp(`:r:${receipt}$`));
    expect(args).toHaveLength(3);
    expect(args[2]).toBe(scope);

    vi.mocked(cacheEval).mockResolvedValue(0);
    await expect(
      releaseIpQuota("theirstack", scope, receipt, 1_700_000_000, env)
    ).resolves.toEqual({ status: "missing" });

    await expect(
      releaseIpQuota("theirstack", scope, "not-a-receipt", 1_700_000_000, env)
    ).resolves.toEqual({ status: "invalid_scope" });
  });
});
