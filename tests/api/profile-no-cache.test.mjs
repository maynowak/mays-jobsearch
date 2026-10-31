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
const profile = {
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

describe("/api/profile without CV profile cache", () => {
  it("ruft die AI bei jeder Anfrage auf und nutzt keinen Redis-Cache", async () => {
    vi.mocked(chat).mockResolvedValue(JSON.stringify(profile));

    const first = makeRes();
    await handler(makeReq({ text: "React CV text" }), first);
    const second = makeRes();
    await handler(makeReq({ text: "React CV text" }), second);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(vi.mocked(chat)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(cacheGet)).not.toHaveBeenCalled();
    expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
  });

  it("ignoriert ein Legacy-hash-Feld; kein cv-profile:-Schlüssel wird gelesen oder geschrieben", async () => {
    vi.mocked(chat).mockResolvedValue(JSON.stringify(profile));
    const res = makeRes();

    await handler(makeReq({ text: "React CV text", hash: HASH }), res);

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(chat)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cacheGet)).not.toHaveBeenCalled();
    expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
  });

  it("Cache-Miss ohne verwertbares AI-Ergebnis -> 502, nichts wird gecacht", async () => {
    vi.mocked(chat).mockResolvedValue("this is not json");
    const res = makeRes();

    await handler(makeReq({ text: "React CV", hash: HASH }), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe("bad_ai_response");
    expect(vi.mocked(cacheSet)).not.toHaveBeenCalled();
  });

  it("verlangt keinen CV-Hash für die Profilerstellung", async () => {
    vi.mocked(chat).mockResolvedValue(JSON.stringify(profile));
    const res = makeRes();

    await handler(makeReq({ text: "CV text without any hash" }), res);

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(chat)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(cacheGet)).not.toHaveBeenCalled();
  });
});
