// @vitest-environment node
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
import { cacheGet, cacheSet } from "../../api/_lib/cache.mjs";
import handler from "../../api/profile.mjs";

const HASH = "a".repeat(64);
const cachedProfile = {
  skills: ["React"],
  experienceLevel: "Senior",
  targetRoles: ["Frontend"],
  location: "Berlin",
};

function makeReq(payload) {
  return { method: "POST", headers: {}, body: payload };
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
  vi.mocked(chat).mockReset();
  vi.mocked(cacheGet).mockReset();
  vi.mocked(cacheSet).mockReset();
  vi.mocked(cacheGet).mockResolvedValue(null);
});

describe("/api/profile CV profile cache", () => {
  it("Cache-Hit: liefert das gespeicherte Profil ohne einen AI-Aufruf", async () => {
    vi.mocked(cacheGet).mockResolvedValue(cachedProfile);
    const res = makeRes();

    await handler(makeReq({ text: "React CV text", hash: HASH }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(cachedProfile);
    expect(vi.mocked(chat)).not.toHaveBeenCalled();
    expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
  });

  it("Cache-Miss: ruft die AI auf und schreibt ausschließlich in den Profil-Cache (cv-profile:<hash>)", async () => {
    vi.mocked(chat).mockResolvedValue(
      JSON.stringify({
        skills: ["React"],
        experienceLevel: "Senior",
        targetRoles: ["Frontend"],
        location: "Berlin",
      })
    );
    const res = makeRes();

    await handler(makeReq({ text: "React Senior Berlin CV text", hash: HASH }), res);

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(chat)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cacheSet)).toHaveBeenCalledTimes(1);
    const [key, value] = vi.mocked(cacheSet).mock.calls[0];
    expect(key).toBe(`cv-profile:${HASH}`);
    expect(value.skills).toEqual(["React"]);
    expect(value.experienceLevel).toBe("Senior");
  });

  it("Cache-Miss ohne verwertbares AI-Ergebnis -> 502, nichts wird gecacht", async () => {
    vi.mocked(chat).mockResolvedValue("this is not json");
    const res = makeRes();

    await handler(makeReq({ text: "React CV", hash: HASH }), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("bad_ai_response");
    expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
  });

  it("CV-Profil-Cache nutzt ausschließlich cv-profile:-Schlüssel (getrennt von Match-Ergebnissen)", async () => {
    vi.mocked(chat).mockResolvedValue(
      JSON.stringify({
        skills: ["React"],
        experienceLevel: "Senior",
        targetRoles: ["Frontend"],
        location: "Berlin",
      })
    );
    const res = makeRes();

    await handler(makeReq({ text: "React CV text", hash: HASH }), res);

    expect(res.statusCode).toBe(200);
    const [key] = vi.mocked(cacheSet).mock.calls[0];
    expect(key.startsWith("cv-profile:")).toBe(true);
    // /api/match hat keinen Cache (siehe match-cache.test.mjs) -> kein gemeinsamer Cache-Schlüssel.
    expect(key).not.toMatch(/match|results/);
  });
});
