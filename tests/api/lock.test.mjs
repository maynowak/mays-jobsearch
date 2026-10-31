// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheGetRaw: vi.fn(async () => null),
  cacheSetNx: vi.fn(async () => "OK"),
  cacheEval: vi.fn(async () => 1),
}));

const { cacheEval, cacheGetRaw, cacheSetNx } = await import("../../api/_lib/cache.mjs");
const { acquireSingleFlight, releaseSingleFlight, singleFlightKey } = await import(
  "../../api/_lib/lock.mjs"
);

beforeEach(() => {
  vi.mocked(cacheSetNx).mockReset();
  vi.mocked(cacheSetNx).mockResolvedValue("OK");
  vi.mocked(cacheGetRaw).mockReset();
  vi.mocked(cacheGetRaw).mockResolvedValue(null);
  vi.mocked(cacheEval).mockReset();
  vi.mocked(cacheEval).mockResolvedValue(1);
});

describe("JM-COOKIELESS-QUOTA-02B-02A: single-flight lock", () => {
  it("creates a stable, non-PII lock key", () => {
    const key = singleFlightKey("theirstack", { skills: "aws", city: "Berlin" });
    expect(key).toMatch(/^mj-lock:theirstack:[a-f0-9]{32}$/);
    expect(key).not.toContain("aws");
    expect(key).not.toContain("Berlin");
    expect(singleFlightKey("theirstack", { skills: "aws", city: "Berlin" })).toBe(key);
  });

  it("acquires with SET NX and reports busy when the key exists", async () => {
    const acquired = await acquireSingleFlight("lock-key", 5000);
    expect(acquired.status).toBe("acquired");
    expect(acquired.token).toMatch(/^[a-f0-9]{32}$/);
    expect(cacheSetNx).toHaveBeenCalledWith("lock-key", acquired.token, 5000);

    vi.mocked(cacheSetNx).mockResolvedValue(null);
    vi.mocked(cacheGetRaw).mockResolvedValue("other-token");
    await expect(acquireSingleFlight("lock-key", 5000)).resolves.toEqual({ status: "busy" });
  });

  it("fails closed when Redis is unavailable", async () => {
    vi.mocked(cacheSetNx).mockResolvedValue(null);
    vi.mocked(cacheGetRaw).mockResolvedValue(null);
    await expect(acquireSingleFlight("lock-key", 5000)).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("releases only with the owner token", async () => {
    await expect(releaseSingleFlight("lock-key", "token-a")).resolves.toBe(true);
    vi.mocked(cacheEval).mockResolvedValue(0);
    await expect(releaseSingleFlight("lock-key", "stale")).resolves.toBe(false);
  });
});
