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
    headers: {},
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
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
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/job-details route", () => {
  it("enriches Arbeitsagentur details for guests without a session cookie", async () => {
    const slug = "aa-13644-290571-S";
    vi.mocked(enrichArbeitsagenturDetails).mockResolvedValue({
      jobs: { [slug]: { slug, description: "<p>x</p>" } },
      enrichedCount: 1,
    });
    const res = makeRes();
    await handler.default(makeReq({ jobs: [slug] }, { "x-forwarded-for": "1.2.3.4" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.jobs[slug]).toBeDefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
    const args = vi.mocked(enrichArbeitsagenturDetails).mock.calls[0];
    expect(args[0]).toEqual([slug]);
    expect(args[1]).not.toHaveProperty("sessionId");
    expect(args[1]).not.toHaveProperty("clientIp");
    expect(args[1]).toHaveProperty("ipScope");
  });

  it("clears a legacy mj_session cookie without issuing a new one", async () => {
    const slug = "aa-13644-290571-S";
    vi.mocked(enrichArbeitsagenturDetails).mockResolvedValue({ jobs: {}, enrichedCount: 0 });
    const res = makeRes();
    await handler.default(
      makeReq({ jobs: [slug] }, { "x-forwarded-for": "1.2.3.4", cookie: "mj_session=legacy" }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toContain("mj_session=;");
    expect(res.headers["set-cookie"]).toContain("Max-Age=0");
  });

  it("maps quota_exceeded to HTTP 429", async () => {
    vi.mocked(enrichArbeitsagenturDetails).mockResolvedValue({ error: "quota_exceeded" });
    const res = makeRes();
    await handler.default(makeReq({ jobs: ["aa-1"] }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe("quota_exceeded");
  });

  it("maps invalid_slug to HTTP 400", async () => {
    vi.mocked(enrichArbeitsagenturDetails).mockResolvedValue({ error: "invalid_slug" });
    const res = makeRes();
    await handler.default(makeReq({ jobs: ["aa-1"] }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("invalid_slug");
  });

  it("maps quota_unavailable (Redis down) to HTTP 503", async () => {
    vi.mocked(enrichArbeitsagenturDetails).mockResolvedValue({ error: "quota_unavailable" });
    const res = makeRes();
    await handler.default(makeReq({ jobs: ["aa-1"] }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("quota_unavailable");
  });

  it("rejects an empty job list with 400", async () => {
    const res = makeRes();
    await handler.default(makeReq({ jobs: [] }), res);
    expect(res.statusCode).toBe(400);
  });
});
