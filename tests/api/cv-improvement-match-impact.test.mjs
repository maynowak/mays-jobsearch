// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/ai.mjs", () => ({ chat: vi.fn() }));
vi.mock("../../api/_lib/matching.mjs", () => ({
  computeMatchForJob: vi.fn(async ({ profile }) => ({
    score: String(profile.skills ?? "").includes("typescript") ? 90 : 50,
  })),
}));

import handler from "../../api/cv-improvement.mjs";

function makeRes() {
  return {
    statusCode: 200,
    data: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
}

const body = {
  job: { title: "React Developer", tags: ["react", "typescript"] },
  originalProfile: { skills: "react" },
  improvedProfile: { skills: "react, typescript" },
};

describe("CV improvement match-impact endpoint", () => {
  it("computes the delta without requiring a legacy profile field", async () => {
    const res = makeRes();
    await handler({ method: "POST", url: "/api/v1/cv-improvement/match-impact", body }, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.data.before.score).toBe(50);
    expect(res.data.data.after.score).toBe(90);
    expect(res.data.data.delta.score).toBe(40);
    expect(res.data.data.changes.improved.length).toBeGreaterThan(0);
  });

  it("rejects an invalid payload before computing", async () => {
    const res = makeRes();
    await handler({ method: "POST", url: "/api/v1/cv-improvement/match-impact", body: { job: {} } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.data.code).toBe("bad_request");
  });
});
