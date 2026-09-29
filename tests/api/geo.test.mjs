// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
}));

const { cacheGet, cacheSet } = await import("../../api/_lib/cache.mjs");
const { geocodeCity, haversineKm } = await import("../../api/_lib/geo.mjs");

const MUNICH = [{ lat: "48.13743", lon: "11.57549", display_name: "München" }];

function mockNominatim(payload, status = 200) {
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (!u.startsWith("https://nominatim.openstreetmap.org/search")) {
      throw new Error(`unexpected fetch: ${u}`);
    }
    return new Response(JSON.stringify(payload), { status });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
});

describe("geo - geocodeCity (Nominatim)", () => {
  it("resolves a city to numeric lat/lon", async () => {
    mockNominatim(MUNICH);
    const result = await geocodeCity("München");
    expect(result).toEqual({ lat: 48.13743, lon: 11.57549 });
  });

  it("sends a proper User-Agent (Nominatim policy)", async () => {
    mockNominatim(MUNICH);
    await geocodeCity("Berlin");
    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(options.headers["User-Agent"]).toMatch(/^MaysJobMatcher\//);
  });

  it("uses the cache on repeat lookups (one Nominatim call max)", async () => {
    mockNominatim(MUNICH);
    vi.mocked(cacheGet).mockResolvedValueOnce(null).mockResolvedValue({ lat: 48.13743, lon: 11.57549 });
    expect(await geocodeCity("München")).toEqual({ lat: 48.13743, lon: 11.57549 });
    expect(await geocodeCity("München")).toEqual({ lat: 48.13743, lon: 11.57549 });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it("returns null for empty input, HTTP errors and empty results", async () => {
    expect(await geocodeCity("")).toBeNull();
    expect(await geocodeCity("   ")).toBeNull();
    mockNominatim([], 200);
    expect(await geocodeCity("Nowhere")).toBeNull();
    mockNominatim(null, 500);
    expect(await geocodeCity("Berlin")).toBeNull();
  });

  it("returns null on network failure instead of throwing", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await geocodeCity("Berlin")).toBeNull();
  });

  it("rejects out-of-range coordinates", async () => {
    mockNominatim([{ lat: "999", lon: "999" }]);
    expect(await geocodeCity("Berlin")).toBeNull();
  });
});

describe("geo - haversineKm", () => {
  it("computes Berlin–Munich distance plausibly", () => {
    const km = haversineKm({ lat: 52.52, lon: 13.405 }, { lat: 48.13743, lon: 11.57549 });
    expect(km).toBeGreaterThan(450);
    expect(km).toBeLessThan(550);
  });

  it("is zero for identical points", () => {
    expect(haversineKm({ lat: 50, lon: 8 }, { lat: 50, lon: 8 })).toBe(0);
  });
});
