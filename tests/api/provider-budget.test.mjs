// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/config.mjs", () => ({
  getConfig: vi.fn(() => ({
    theirstackMonthlyMaxCredits: 200,
    jobspipeMonthlyMaxCredits: 200,
  })),
}));

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
  cacheDel: vi.fn(async () => undefined),
  cacheIncr: vi.fn(async () => 1),
  cacheIncrBy: vi.fn(async () => 1),
  cacheHIncrBy: vi.fn(async () => 1),
  cacheHGetAll: vi.fn(async () => ({})),
  cacheReserveIncr: vi.fn(async () => 1),
  cacheDecrBy: vi.fn(async () => 1),
  cacheEval: vi.fn(async () => 1),
}));

const { cacheEval } = await import("../../api/_lib/cache.mjs");
const {
  reserveProviderBudget,
  settleProviderBudget,
  releaseProviderBudget,
} = await import("../../api/_lib/usage.mjs");

beforeEach(() => {
  vi.mocked(cacheEval).mockReset();
  vi.mocked(cacheEval).mockResolvedValue(1);
});

describe("JM-COOKIELESS-QUOTA-IMPLEMENTATION-02A: atomic provider budgets", () => {
  it("reserves a maximum cost with a server-generated id", async () => {
    const result = await reserveProviderBudget("theirstack", 25);
    expect(result.ok).toBe(true);
    expect(result.id).toMatch(/^[a-f0-9]{32}$/);
    const [script, keys, args] = vi.mocked(cacheEval).mock.calls[0];
    expect(String(script)).toContain("HGETALL");
    expect(keys[0]).toMatch(/^mj-usage:theirstack:credits:\d{4}-\d{2}$/);
    expect(keys[1]).toMatch(/^mj-budget:theirstack:reservations:\d{4}-\d{2}$/);
    expect(args[0]).toBe(25);
    expect(args[1]).toBe(200);
  });

  it("maps an exceeded budget without a provider call", async () => {
    vi.mocked(cacheEval).mockResolvedValue(-1);
    await expect(reserveProviderBudget("jobspipe", 20)).resolves.toEqual({ error: "exceeded" });
  });

  it("fails closed when Redis is unavailable", async () => {
    vi.mocked(cacheEval).mockResolvedValue(null);
    await expect(reserveProviderBudget("theirstack", 25)).resolves.toEqual({ error: "unavailable" });
    await expect(settleProviderBudget("theirstack", "id", 2)).resolves.toEqual({ error: "unavailable" });
    await expect(releaseProviderBudget("theirstack", "id")).resolves.toEqual({ error: "unavailable" });
  });

  it("settles the actual cost and reports a missing reservation idempotently", async () => {
    vi.mocked(cacheEval).mockResolvedValue(3);
    await expect(settleProviderBudget("theirstack", "id", 3)).resolves.toEqual({ ok: true, actual: 3 });
    vi.mocked(cacheEval).mockResolvedValue(-1);
    await expect(settleProviderBudget("theirstack", "id", 3)).resolves.toEqual({ error: "missing" });
  });

  it("releases only existing reservations", async () => {
    vi.mocked(cacheEval).mockResolvedValue(1);
    await expect(releaseProviderBudget("jobspipe", "id")).resolves.toEqual({ ok: true });
    vi.mocked(cacheEval).mockResolvedValue(0);
    await expect(releaseProviderBudget("jobspipe", "id")).resolves.toEqual({ error: "missing" });
  });

  it("rejects unknown providers and invalid costs", async () => {
    await expect(reserveProviderBudget("unknown", 10)).resolves.toEqual({ error: "unavailable" });
    await expect(reserveProviderBudget("theirstack", 0)).resolves.toEqual({ error: "unavailable" });
    await expect(reserveProviderBudget("theirstack", Number.NaN)).resolves.toEqual({ error: "unavailable" });
  });
});
