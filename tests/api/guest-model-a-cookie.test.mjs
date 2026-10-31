// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/sources/index.mjs", () => ({
  fetchAllJobs: vi.fn(async () => ({ jobs: [], meta: {} })),
}));
vi.mock("../../api/_lib/matching.mjs", () => ({
  computeMatch: vi.fn(async () => ({ matches: [], meta: {} })),
}));
vi.mock("../../api/_lib/detailEnrich.mjs", () => ({
  enrichArbeitsagenturDetails: vi.fn(async () => ({ jobs: {}, enrichedCount: 0 })),
}));

const { fetchAllJobs } = await import("../../api/_lib/sources/index.mjs");
const { enrichArbeitsagenturDetails } = await import("../../api/_lib/detailEnrich.mjs");
const jobsHandler = (await import("../../api/jobs.mjs")).default;
const matchHandler = (await import("../../api/match.mjs")).default;
const detailsHandler = (await import("../../api/job-details.mjs")).default;

function makeRes() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
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
}

function jobsReq(headers = {}) {
  return { method: "GET", query: { skills: "aws" }, headers };
}
function postReq(body, headers = {}) {
  return { method: "POST", body, headers };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("JM-COOKIELESS-GUEST-MODEL-A-CUTOVER-01: guest cookie cutover", () => {
  it("does not issue a cookie for a fresh guest search", async () => {
    const res = makeRes();
    await jobsHandler(jobsReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(fetchAllJobs).toHaveBeenCalledWith(
      expect.not.objectContaining({ identity: expect.anything() })
    );
  });

  it("deletes a legacy mj_session cookie exactly once", async () => {
    const res = makeRes();
    await jobsHandler(jobsReq({ cookie: "mj_session=legacyvalue; other=1" }), res);
    expect(res.headers["set-cookie"]).toContain("mj_session=;");
    expect(res.headers["set-cookie"]).toContain("Max-Age=0");
    expect(res.headers["set-cookie"]).toContain("Path=/");
    expect(res.headers["set-cookie"]).not.toMatch(/mj_session=[a-f0-9]{32}/);
  });

  it("does not issue a cookie for matching and never enriches unrelated paid jobs", async () => {
    const res = makeRes();
    await matchHandler(
      postReq({ skills: "aws", targetRole: "", city: "", jobs: [{ slug: "job-1", title: "Job", company_name: "C", location: ["Berlin"], remote: false, tags: [], url: "https://example.invalid" }] }, {}),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(enrichArbeitsagenturDetails).not.toHaveBeenCalled();
  });

  it("blocks job-details for guests and clears the legacy cookie", async () => {
    const res = makeRes();
    await detailsHandler(postReq({ jobs: ["aa-1"] }, { cookie: "mj_session=legacyvalue" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toContain("mj_session=;");
    expect(res.headers["set-cookie"]).toContain("Max-Age=0");
    expect(enrichArbeitsagenturDetails).toHaveBeenCalled();
  });

  it("does not issue cookies on OPTIONS", async () => {
    const res = makeRes();
    await jobsHandler({ method: "OPTIONS", headers: {} }, res);
    expect(res.statusCode).toBe(204);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("keeps ten parallel guest searches cookie-free", async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const res = makeRes();
        await jobsHandler(jobsReq(), res);
        return res;
      })
    );
    expect(responses.every((res) => res.headers["set-cookie"] === undefined)).toBe(true);
    expect(fetchAllJobs).toHaveBeenCalledTimes(10);
  });
});
