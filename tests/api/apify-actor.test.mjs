// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheGetRaw: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
  cacheSetNx: vi.fn(async () => "OK"),
  cacheEval: vi.fn(async () => 1),
  cacheDel: vi.fn(async () => undefined),
  cacheIncr: vi.fn(async () => 1),
  cacheHIncrBy: vi.fn(async () => 1),
  cacheHGetAll: vi.fn(async () => ({})),
}));

vi.mock("../../api/_lib/usage.mjs", () => ({
  reserveApifyRunSlot: vi.fn(async () => ({ ok: true })),
  refundApifyRunSlot: vi.fn(async () => {}),
  countApifyCacheHit: vi.fn(async () => {}),
  countApifyCacheMiss: vi.fn(async () => {}),
  countApifyDatasetReuse: vi.fn(async () => {}),
  countJobSourceRequest: vi.fn(async () => {}),
  countJobSourceRun: vi.fn(async () => {}),
  countJobSourceDatasetReuse: vi.fn(async () => {}),
  countJobSourceCacheHit: vi.fn(async () => {}),
  countJobSourceCacheMiss: vi.fn(async () => {}),
}));

const { cacheGet, cacheSet, cacheDel } = await import("../../api/_lib/cache.mjs");
const { reserveApifyRunSlot, refundApifyRunSlot } = await import("../../api/_lib/usage.mjs");
const { fetchAllJobs } = await import("../../api/_lib/sources/index.mjs");

const baseApifyRecord = {
  referenceId: "aa-1",
  title: "Frontend Developer",
  employer: "Acme",
  location: "Berlin",
  isRemote: false,
  description: "Great job",
  portalUrl: "https://example.com/job-1",
  publishedDate: new Date().toISOString(),
  contractType: "Vollzeit",
  salary: "60000",
  startDate: "2024-01-01",
};

function setupApifyFlow(overrides = {}) {
  const { apifyRecords = [baseApifyRecord], datasetFresh = false, limitReached = false } = overrides;

  vi.mocked(cacheGet).mockImplementation(async (key) => {
    if (datasetFresh && key && String(key).startsWith("job-source:arbeitsagentur:dataset:")) {
      return { datasetId: "ds-1", createdAt: Date.now() };
    }
    return null;
  });
  vi.mocked(reserveApifyRunSlot).mockResolvedValue(limitReached ? { error: "exceeded" } : { ok: true });

  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("arbeitnow.com")) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    if (u.includes("/v2/acts/")) {
      return new Response(JSON.stringify({ data: { id: "run-1", defaultDatasetId: "ds-1" } }), { status: 201 });
    }
    if (u.includes("/v2/actor-runs/")) {
      return new Response(JSON.stringify({ data: { id: "run-1", status: "SUCCEEDED" } }), { status: 200 });
    }
    if (u.includes("/v2/datasets/")) {
      return new Response(JSON.stringify(apifyRecords), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${u}`);
  });
}

function setupApifyDisabled() {
  process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED = "false";
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("arbeitnow.com")) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    throw new Error(`should not call apify: ${u}`);
  });
  vi.mocked(cacheGet).mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheSet).mockResolvedValue(undefined);
  vi.mocked(cacheDel).mockResolvedValue(undefined);
  vi.mocked(reserveApifyRunSlot).mockResolvedValue({ ok: true });
  process.env.JOB_SOURCE_ARBEITNOW_ENABLED = "true";
  process.env.JOB_SOURCE_ARBEITSAGENTUR_ENABLED = "true";
  process.env.APIFY_API_TOKEN = "test-token";
});

describe("Apify Actor (arbeitsagentur)", () => {
  it("C) Arbeitsagentur enabled -> Jobs", async () => {
    setupApifyFlow();
    const result = await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.jobs[0].source).toContain("arbeitsagentur");
  });

  it("JM-BA-RESTORE-03: keeps BA jobs for English target roles with German titles", async () => {
    setupApifyFlow({
      apifyRecords: [
        {
          ...baseApifyRecord,
          referenceId: "aa-java-1",
          title: "Java-Entwickler (m/w/d)",
          location: "Frankfurt am Main",
          description: "Java, Spring Boot, Cloud",
        },
        {
          ...baseApifyRecord,
          referenceId: "aa-cloud-1",
          title: "Cloud-Engineer (m/w/d)",
          location: "Mainz",
          description: "AWS, Terraform",
        },
      ],
    });

    const java = await fetchAllJobs({
      paidSourcesAllowed: true,
      skills: "",
      targetRole: "Java Developer",
      city: "Frankfurt",
    });
    expect(java.jobs.some((job) => job.slug === "aa-aa-java-1")).toBe(true);

    const cloud = await fetchAllJobs({
      paidSourcesAllowed: true,
      skills: "",
      targetRole: "Cloud Engineer",
      city: "Mainz",
    });
    expect(cloud.jobs.some((job) => job.slug === "aa-aa-cloud-1")).toBe(true);
  });

  it("JM-BA-RESTORE-03: keeps BA jobs for multi-word skills", async () => {
    setupApifyFlow({
      apifyRecords: [
        {
          ...baseApifyRecord,
          referenceId: "aa-skill-java",
          title: "Java-Entwickler (m/w/d)",
          location: "Frankfurt am Main",
          description: "Java, Spring Boot, Cloud",
        },
        {
          ...baseApifyRecord,
          referenceId: "aa-skill-cloud",
          title: "Cloud-Engineer (m/w/d)",
          location: "Mainz",
          description: "AWS, Terraform",
        },
      ],
    });

    const java = await fetchAllJobs({
      paidSourcesAllowed: true,
      skills: ["Java Developer"],
      targetRole: "",
      city: "Frankfurt",
    });
    expect(java.jobs.some((job) => job.slug === "aa-aa-skill-java")).toBe(true);

    const cloud = await fetchAllJobs({
      paidSourcesAllowed: true,
      skills: ["Cloud Engineer"],
      targetRole: "",
      city: "Mainz",
    });
    expect(cloud.jobs.some((job) => job.slug === "aa-aa-skill-cloud")).toBe(true);
  });

  it("JM-BA-RESTORE-03: reproduces the three requested BA searches for guests and authenticated callers", async () => {
    const records = [
      {
        ...baseApifyRecord,
        referenceId: "10001-1002716922-S",
        title: "Java-Entwickler (m/w/d)",
        location: "Frankfurt am Main",
        description: "Java, Spring Boot, Cloud",
      },
      {
        ...baseApifyRecord,
        referenceId: "10002-1002716923-S",
        title: "Softwareentwickler (m/w/d)",
        location: "Darmstadt",
        description: "Java, TypeScript, Cloud",
      },
      {
        ...baseApifyRecord,
        referenceId: "10003-1002716924-S",
        title: "Cloud-Engineer (m/w/d)",
        location: "Mainz",
        description: "AWS, Terraform",
      },
    ];
    setupApifyFlow({ apifyRecords: records });

    const cases = [
      { skills: ["Java Developer"], targetRoles: [], city: "Frankfurt", slug: "aa-10001-1002716922-S" },
      { skills: ["Softwareentwickler"], targetRoles: [], city: "Darmstadt", slug: "aa-10002-1002716923-S" },
      { skills: ["Cloud Engineer"], targetRoles: [], city: "Mainz", slug: "aa-10003-1002716924-S" },
    ];

    for (const paidSourcesAllowed of [false, true]) {
      for (const search of cases) {
        const result = await fetchAllJobs({
          paidSourcesAllowed,
          skills: search.skills,
          targetRoles: search.targetRoles,
          city: search.city,
        });
        const job = result.jobs.find((candidate) => candidate.slug === search.slug);
        expect(job, `${search.city} (paidSourcesAllowed=${paidSourcesAllowed})`).toBeDefined();
        expect(job?.source).toContain("arbeitsagentur");
        expect(job?.company_name).toBe("Acme");
      }
    }
  });

  it("JM-BA-RESTORE-03: keeps target-role searches with German/hyphenated BA titles", async () => {
    setupApifyFlow({
      apifyRecords: [
        { ...baseApifyRecord, referenceId: "20001-1-S", title: "Java-Entwickler", location: "Frankfurt am Main" },
        { ...baseApifyRecord, referenceId: "20002-2-S", title: "Cloud-Engineer", location: "Mainz" },
      ],
    });

    for (const targetRole of ["Java Developer", "Cloud Engineer"]) {
      const result = await fetchAllJobs({
        paidSourcesAllowed: false,
        skills: [],
        targetRoles: [targetRole],
        city: targetRole === "Java Developer" ? "Frankfurt" : "Mainz",
      });
      expect(result.jobs.length).toBeGreaterThan(0);
      expect(result.jobs.some((job) => job.source?.includes("arbeitsagentur"))).toBe(true);
    }
  });

  it("D) Arbeitsagentur disabled -> kein Apify Run", async () => {
    setupApifyDisabled();
    const result = await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.jobs.length).toBe(0);
    expect(result.meta.disabledSources).toContain("arbeitsagentur");
    expect(result.meta.apify.enabled).toBe(false);
    expect(result.meta.apify.reason).toBe("disabled");
  });

  it("H) Cache Key enthält Source eindeutig", async () => {
    setupApifyFlow();
    await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    const cacheGetCalls = vi.mocked(cacheGet).mock.calls.map((c) => c[0]);
    const cacheSetCalls = vi.mocked(cacheSet).mock.calls.map((c) => c[0]);
    expect(cacheGetCalls.some((k) => String(k).startsWith("job-source:arbeitsagentur:"))).toBe(true);
    expect(cacheSetCalls.some((k) => String(k).startsWith("job-source:arbeitsagentur:"))).toBe(true);
    expect(cacheGetCalls.every((k) => !String(k).startsWith("apify-jobs:"))).toBe(true);
    expect(cacheSetCalls.every((k) => !String(k).startsWith("apify-jobs:"))).toBe(true);
  });

  it("I) Apify Dataset Reuse bleibt aktiv", async () => {
    setupApifyFlow({ datasetFresh: true });
    await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(fetchCalls.some((u) => u.includes("/v2/acts/"))).toBe(false);
    expect(vi.mocked(cacheGet).mock.calls.some((c) => String(c[0]).includes(":dataset:"))).toBe(true);
    const { countApifyDatasetReuse } = await import("../../api/_lib/usage.mjs");
    expect(vi.mocked(countApifyDatasetReuse)).toHaveBeenCalled();
  });

  it("J) Refresh Policy bleibt aktiv (stale dataset -> neuer Run)", async () => {
    setupApifyFlow({ datasetFresh: false });
    await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(fetchCalls.some((u) => u.includes("/v2/acts/"))).toBe(true);
  });

  it("classifies only definite 4xx start errors as not started", async () => {
    const { startErrorDefinitelyNotStarted } = await import(
      "../../api/_lib/sources/apify/client.mjs"
    );
    expect(startErrorDefinitelyNotStarted("upstream_400")).toBe(true);
    expect(startErrorDefinitelyNotStarted("upstream_422")).toBe(true);
    expect(startErrorDefinitelyNotStarted("upstream_408")).toBe(false);
    expect(startErrorDefinitelyNotStarted("upstream_500")).toBe(false);
    expect(startErrorDefinitelyNotStarted("network")).toBe(false);
    expect(startErrorDefinitelyNotStarted("unreadable")).toBe(false);
  });

  it("refunds the run slot when the start request is definitely rejected", async () => {
    setupApifyFlow();
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("arbeitnow.com")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      if (u.includes("/v2/acts/")) return new Response("bad request", { status: 400 });
      throw new Error(`unexpected fetch: ${u}`);
    });
    const result = await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.meta.apify.reason).toBe("upstream_400");
    expect(vi.mocked(refundApifyRunSlot)).toHaveBeenCalled();
  });

  it("keeps the run slot on an unknown start status (network)", async () => {
    setupApifyFlow();
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("arbeitnow.com")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      if (u.includes("/v2/acts/")) throw new Error("network down");
      throw new Error(`unexpected fetch: ${u}`);
    });
    const result = await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    expect(result.meta.apify.reason).toBe("network");
    expect(vi.mocked(refundApifyRunSlot)).not.toHaveBeenCalled();
  });

  it("K) Cost Guard verhindert neuen Apify Run", async () => {
    setupApifyFlow({ limitReached: true });
    const result = await fetchAllJobs({ paidSourcesAllowed: true, skills: "react", targetRole: "frontend", city: "berlin" });
    const aaJobs = result.jobs.filter((j) => j.source?.includes("arbeitsagentur"));
    expect(aaJobs.length).toBe(0);
    expect(result.meta.apify.enabled).toBe(false);
    expect(result.meta.apify.reason).toBe("limit_reached");
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.map((c) => String(c[0]));
    expect(fetchCalls.some((u) => u.includes("/v2/acts/"))).toBe(false);
  });
});