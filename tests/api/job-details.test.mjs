// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/detailEnrich.mjs", () => ({
  enrichArbeitsagenturDetails: vi.fn(async () => ({ jobs: {}, enrichedCount: 0 })),
}));

const { enrichArbeitsagenturDetails } = await import("../../api/_lib/detailEnrich.mjs");
const handler = await import("../../api/job-details.mjs");

function makeReq(body, headers = {}) {
  return { method: "POST", headers, body };
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
});

describe("/api/job-details route", () => {
  it("blocks paid detail enrichment for public guests", async () => {
    const slug = "aa-13644-290571-S";
    const res = makeRes();
    await handler.default(
      makeReq({ jobs: [slug], userId: "attacker-chosen-id" }, { "x-forwarded-for": "1.2.3.4" }),
      res
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("paid_source_blocked");
    expect(enrichArbeitsagenturDetails).not.toHaveBeenCalled();
  });

  it("blocks even an empty or malformed paid detail request", async () => {
    for (const body of [{}, { jobs: [] }, { jobs: ["aa-1"] }]) {
      const res = makeRes();
      await handler.default(makeReq(body), res);
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("paid_source_blocked");
    }
    expect(enrichArbeitsagenturDetails).not.toHaveBeenCalled();
  });

  it("continues to reject non-POST methods", async () => {
    const res = makeRes();
    await handler.default({ method: "GET", headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
