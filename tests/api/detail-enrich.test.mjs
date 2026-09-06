// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
  cacheReserveIncr: vi.fn(async () => 1),
  cacheDecrBy: vi.fn(async () => 0),
}));

vi.mock("../../api/_lib/usage.mjs", () => ({
  reserveApifyRunSlot: vi.fn(async () => ({ ok: true })),
  refundApifyRunSlot: vi.fn(async () => {}),
  countJobSourceRun: vi.fn(async () => {}),
}));

vi.mock("../../api/_lib/sources/apify/client.mjs", () => ({
  startApifyRun: vi.fn(async () => ({ run: { id: "run-1" } })),
  waitForRun: vi.fn(async () => ({ run: { id: "run-1", defaultDatasetId: "ds-1" } })),
  readDataset: vi.fn(async () => ({ records: [] })),
}));

const { cacheGet, cacheSet, cacheReserveIncr, cacheDecrBy } = await import("../../api/_lib/cache.mjs");
const { reserveApifyRunSlot, refundApifyRunSlot } = await import("../../api/_lib/usage.mjs");
const { startApifyRun, readDataset } = await import("../../api/_lib/sources/apify/client.mjs");
const { getConfig } = await import("../../api/_lib/config.mjs");
const { APIFY_ACTORS, SOURCE_ID } = await import("../../api/_lib/sources/apify/actors.mjs");
const {
  enrichArbeitsagenturDetails,
  parseArbeitsagenturSlug,
  portalUrlForRefNr,
} = await import("../../api/_lib/detailEnrich.mjs");

const REF = "13644-290571-S";
const SLUG = `aa-${REF}`;
const ID = { clientIp: "1.2.3.4", sessionId: "a".repeat(32) };

function detailRecord(ref = REF) {
  return {
    referenceId: ref,
    title: "Data Engineer (w/m/d)",
    employer: "Acme GmbH",
    location: "Berlin",
    isRemote: false,
    descriptionHtml: "<p>Wir suchen einen Data Engineer.</p>",
    description: "Wir suchen einen Data Engineer.",
    portalUrl: portalUrlForRefNr(ref),
    publishedDate: "2026-01-01T00:00:00.000Z",
    contractType: "UNBEFRISTET",
    salary: "60000",
    startDate: "2026-02-01",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
  vi.mocked(cacheReserveIncr).mockResolvedValue(1);
  vi.mocked(cacheDecrBy).mockResolvedValue(0);
  vi.mocked(reserveApifyRunSlot).mockResolvedValue({ ok: true });
  vi.mocked(refundApifyRunSlot).mockResolvedValue(undefined);
  vi.mocked(readDataset).mockResolvedValue({ records: [] });
  delete process.env.APIFY_DETAIL_MAX_PER_USER_PER_DAY;
  delete process.env.APIFY_DETAIL_MAX_PER_IP_PER_DAY;
  process.env.APIFY_API_TOKEN = "test-token";
});

describe("detailEnrich - config default", () => {
  it("defaults detail quota to 30 per user per day", () => {
    expect(getConfig().apifyDetailMaxPerUserPerDay).toBe(30);
  });
});

describe("detailEnrich - slug + portalUrl validation", () => {
  it("parses a valid arbeitsagentur slug into its refnr", () => {
    expect(parseArbeitsagenturSlug(SLUG)).toBe(REF);
  });

  it("rejects non-arbeitsagentur slugs (arbitrary external input)", () => {
    expect(parseArbeitsagenturSlug("job-123")).toBeNull();
    expect(parseArbeitsagenturSlug("arbeitnow-abc")).toBeNull();
    expect(parseArbeitsagenturSlug("https://evil.example.com/x")).toBeNull();
    expect(parseArbeitsagenturSlug("aa-")).toBeNull();
    expect(parseArbeitsagenturSlug("")).toBeNull();
    expect(parseArbeitsagenturSlug(undefined)).toBeNull();
  });

  it("builds the portal URL server-side (fixed BA host only)", () => {
    expect(portalUrlForRefNr(REF)).toBe(`https://www.arbeitsagentur.de/jobsuche/suche?id=${REF}`);
  });
});

describe("detailEnrich - actor input", () => {
  const actor = APIFY_ACTORS.find((a) => a.sourceId === SOURCE_ID);

  it("normal search path keeps includeDetails:false", () => {
    const input = actor.buildInput("engineer", "Berlin", 40);
    expect(input.includeDetails).toBe(false);
    expect(input.startUrls).toBeUndefined();
  });

  it("targeted detail input uses startUrls + includeDetails:true", () => {
    const input = actor.buildTargetedDetailInput([portalUrlForRefNr(REF)]);
    expect(input.includeDetails).toBe(true);
    expect(input.startUrls).toEqual([portalUrlForRefNr(REF)]);
  });
});

describe("detailEnrich - enrichment flow", () => {
  it("serves cache hits without an Apify run and without consuming quota", async () => {
    vi.mocked(cacheGet).mockResolvedValue({ slug: SLUG, title: "Data Engineer", description: "<p>cached</p>" });

    const result = await enrichArbeitsagenturDetails([SLUG], ID);

    expect(result.error).toBeUndefined();
    expect(result.enrichedCount).toBe(0);
    expect(result.jobs[SLUG].description).toBe("<p>cached</p>");
    expect(startApifyRun).not.toHaveBeenCalled();
    expect(cacheReserveIncr).not.toHaveBeenCalled();
    expect(reserveApifyRunSlot).not.toHaveBeenCalled();
  });

  it("enriches a single missing job in one targeted run and reserves session + ip quota", async () => {
    vi.mocked(readDataset).mockResolvedValue({ records: [detailRecord()] });

    const result = await enrichArbeitsagenturDetails([SLUG], ID);

    expect(result.error).toBeUndefined();
    expect(result.enrichedCount).toBe(1);
    expect(result.jobs[SLUG].description).toContain("Data Engineer");
    expect(startApifyRun).toHaveBeenCalledTimes(1);
    expect(reserveApifyRunSlot).toHaveBeenCalledTimes(1);
    expect(cacheReserveIncr).toHaveBeenCalledTimes(2);
    const keys = vi.mocked(cacheReserveIncr).mock.calls.map((c) => String(c[0]));
    expect(keys.some((k) => k.startsWith("mj-detail:quota:s:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("mj-detail:quota:ip:"))).toBe(true);
    for (const call of vi.mocked(cacheReserveIncr).mock.calls) expect(call[1]).toBe(1);
  });

  it("batches multiple missing jobs into ONE run", async () => {
    vi.mocked(readDataset).mockResolvedValue({
      records: [detailRecord("13644-290571-S"), detailRecord("12288-4929522800-S")],
    });

    const result = await enrichArbeitsagenturDetails(
      ["aa-13644-290571-S", "aa-12288-4929522800-S"],
      ID
    );

    expect(result.error).toBeUndefined();
    expect(result.enrichedCount).toBe(2);
    expect(startApifyRun).toHaveBeenCalledTimes(1);
    for (const call of vi.mocked(cacheReserveIncr).mock.calls) expect(call[1]).toBe(2);
    const inputArg = vi.mocked(startApifyRun).mock.calls[0][2];
    expect(inputArg.startUrls.length).toBe(2);
    expect(inputArg.includeDetails).toBe(true);
  });

  it("blocks when the per-session quota is exceeded", async () => {
    let calls = 0;
    vi.mocked(cacheReserveIncr).mockImplementation(async () => {
      calls += 1;
      return calls === 1 ? -1 : 1;
    });
    const result = await enrichArbeitsagenturDetails([SLUG], ID);
    expect(result.error).toBe("quota_exceeded");
    expect(startApifyRun).not.toHaveBeenCalled();
    expect(refundApifyRunSlot).toHaveBeenCalled();
  });

  it("blocks when the IP backstop is exceeded even if session is fine", async () => {
    let calls = 0;
    vi.mocked(cacheReserveIncr).mockImplementation(async () => {
      calls += 1;
      return calls === 1 ? 1 : -1;
    });
    const result = await enrichArbeitsagenturDetails([SLUG], ID);
    expect(result.error).toBe("quota_exceeded");
    expect(startApifyRun).not.toHaveBeenCalled();
  });

  it("fails closed when Redis/quota is unavailable (no uncontrolled Apify run)", async () => {
    vi.mocked(cacheReserveIncr).mockResolvedValue(null);
    const result = await enrichArbeitsagenturDetails([SLUG], ID);
    expect(result.error).toBe("quota_unavailable");
    expect(startApifyRun).not.toHaveBeenCalled();
  });

  it("honours the global APIFY_MONTHLY_MAX_RUNS backstop (atomic)", async () => {
    vi.mocked(reserveApifyRunSlot).mockResolvedValue({ error: "exceeded" });
    const result = await enrichArbeitsagenturDetails([SLUG], ID);
    expect(result.error).toBe("apify_limit_reached");
    expect(startApifyRun).not.toHaveBeenCalled();
    expect(cacheReserveIncr).not.toHaveBeenCalled();
  });

  it("rejects invalid slugs before any Apify call", async () => {
    const result = await enrichArbeitsagenturDetails(["https://evil.example.com"], ID);
    expect(result.error).toBe("invalid_slug");
    expect(startApifyRun).not.toHaveBeenCalled();
  });

  it("refunds quota and run slot when the run fails to start", async () => {
    vi.mocked(startApifyRun).mockResolvedValue({ error: "upstream_500" });

    const result = await enrichArbeitsagenturDetails([SLUG], ID);

    expect(result.error).toBe("upstream_500");
    expect(cacheDecrBy).toHaveBeenCalled();
    expect(refundApifyRunSlot).toHaveBeenCalled();
  });
});