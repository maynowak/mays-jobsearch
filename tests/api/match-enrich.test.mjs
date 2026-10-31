// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/ai.mjs", () => ({ chat: vi.fn() }));
vi.mock("../../api/_lib/detailEnrich.mjs", () => ({
  enrichArbeitsagenturDetails: vi.fn(async () => ({ jobs: {} })),
}));

const { chat } = await import("../../api/_lib/ai.mjs");
const { enrichArbeitsagenturDetails } = await import("../../api/_lib/detailEnrich.mjs");
const handler = (await import("../../api/match.mjs")).default;

const aaJob = {
  slug: "aa-13644-290571-S",
  title: "Data Engineer (w/m/d)",
  company_name: "Acme",
  location: ["Berlin"],
  remote: false,
  tags: [],
  source: ["arbeitsagentur"],
};
const arbeitnowJob = {
  slug: "job-1",
  title: "Frontend Developer",
  company_name: "Beta",
  location: ["Berlin"],
  remote: false,
  tags: ["react"],
  source: ["arbeitnow"],
};

function makeReq(payload) {
  return { method: "POST", headers: { "x-forwarded-for": "1.2.3.4" }, body: payload };
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chat).mockResolvedValue(
    JSON.stringify({
      matches: [
        { slug: "aa-13644-290571-S", score: 90, why: "Passt. Gut.", prepare: "Frage?" },
        { slug: "job-1", score: 70, why: "Passt. Gut.", prepare: "Frage?" },
      ],
    })
  );
  vi.mocked(enrichArbeitsagenturDetails).mockResolvedValue({
    jobs: { "aa-13644-290571-S": { ...aaJob, description: "<p>full</p>" } },
    enrichedCount: 1,
  });
});

describe("/api/match BA detail enrichment", () => {
  it("does not run paid detail enrichment for public guests", async () => {
    const res = makeRes();
    await handler(
      makeReq({
        skills: "Data Engineer",
        targetRole: "Data Engineer",
        city: "Berlin",
        jobs: [aaJob, arbeitnowJob],
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(chat).toHaveBeenCalled();
    expect(enrichArbeitsagenturDetails).not.toHaveBeenCalled();
    const aaMatch = res.body.matches.find((m) => m.job.slug === "aa-13644-290571-S");
    expect(aaMatch.job.description).toBeUndefined();
  });

  it("AI failure => ZERO detail-enrichment Apify runs", async () => {
    vi.mocked(chat).mockRejectedValue(new Error("ai down"));

    const res = makeRes();
    await handler(
      makeReq({
        skills: "Data Engineer",
        targetRole: "Data Engineer",
        city: "Berlin",
        jobs: [aaJob, arbeitnowJob],
      }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(enrichArbeitsagenturDetails).not.toHaveBeenCalled();
  });
});