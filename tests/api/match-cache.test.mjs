// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/ai.mjs", () => ({ chat: vi.fn() }));
vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
  cacheDel: vi.fn(async () => undefined),
  cacheIncr: vi.fn(async () => 1),
  cacheHIncrBy: vi.fn(async () => 1),
  cacheHGetAll: vi.fn(async () => ({})),
}));

import { chat } from "../../api/_lib/ai.mjs";
import { HttpError } from "../../api/_lib/filter.mjs";
import { cacheDel, cacheGet, cacheHGetAll, cacheHIncrBy, cacheIncr, cacheSet } from "../../api/_lib/cache.mjs";
import handler from "../../api/match.mjs";

const jobA = {
  slug: "j1",
  title: "Frontend Developer",
  company_name: "Acme",
  location: ["Berlin"],
  remote: false,
  tags: ["react"],
  source: ["arbeitnow"],
};
const jobB = {
  slug: "j2",
  title: "Backend Engineer",
  company_name: "Beta",
  location: ["Berlin"],
  remote: false,
  tags: ["node"],
  source: ["arbeitnow"],
};

function makeReq(payload) {
  return { method: "POST", headers: { "x-mj-attempt": "1" }, body: payload };
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

function allCacheSpies() {
  return [cacheGet, cacheSet, cacheDel, cacheIncr, cacheHIncrBy, cacheHGetAll];
}

beforeEach(() => {
  vi.mocked(chat).mockReset();
  for (const spy of allCacheSpies()) vi.mocked(spy).mockClear();
});

describe("/api/match result caching", () => {
  it("liefert frische Ergebnisse direkt von der AI – es gibt keinen Ergebnis-Cache", async () => {
    vi.mocked(chat).mockResolvedValue(
      JSON.stringify({
        matches: [
          { slug: "j1", score: 90, why: "Passende Skills. Gute Stadt.", prepare: "Frage?" },
          { slug: "j2", score: 40, why: "Weniger passend. Andere Rolle.", prepare: "Frage?" },
        ],
      })
    );
    const res = makeRes();

    await handler(
      makeReq({
        skills: "React",
        targetRole: "Frontend",
        city: "Berlin",
        jobs: [jobA, jobB],
        model: "some/free-model:free",
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.matches.map((m) => m.job.slug)).toEqual(["j1", "j2"]);
    for (const spy of allCacheSpies()) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("ein früherer model_unavailable-Fehler wird NICHT gecacht – die nächste Suche funktioniert wieder", async () => {
    vi.mocked(chat)
      .mockRejectedValueOnce(new HttpError(502, "unavailable", "model_unavailable"))
      .mockResolvedValueOnce(
        JSON.stringify({ matches: [{ slug: "j1", score: 90, why: "a. b.", prepare: "q?" }] })
      );

    const first = makeRes();
    await handler(
      makeReq({ skills: "React", targetRole: "Frontend", jobs: [jobA], model: "m:free" }),
      first
    );
    expect(first.statusCode).toBe(502);
    expect(first.body.code).toBe("model_unavailable");
    for (const spy of allCacheSpies()) expect(spy).not.toHaveBeenCalled();

    const second = makeRes();
    await handler(
      makeReq({ skills: "React", targetRole: "Frontend", jobs: [jobA], model: "m:free" }),
      second
    );
    expect(second.statusCode).toBe(200);
    expect(second.body.matches[0].job.slug).toBe("j1");
  });

  it("eine ungültige/leere AI-Antwort wird nicht gecacht (bad_ai_response)", async () => {
    vi.mocked(chat).mockResolvedValue("no usable json here");
    const res = makeRes();

    await handler(makeReq({ skills: "React", targetRole: "Frontend", jobs: [jobA] }), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("bad_ai_response");
    for (const spy of allCacheSpies()) expect(spy).not.toHaveBeenCalled();
  });

  it("der Match-Handler importiert keinerlei Cache-Modul (strukturelle Absicherung)", () => {
    const source = readFileSync(new URL("../../api/match.mjs", import.meta.url), "utf8");
    expect(source).not.toMatch(/import.*cache/i);
  });
});
