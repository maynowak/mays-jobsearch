// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/ai.mjs", () => ({
  chat: vi.fn(),
}));

import handler, { parseTranslation } from "../../api/job-details.mjs";
import { chat } from "../../api/_lib/ai.mjs";
import { HttpError } from "../../api/_lib/filter.mjs";

function makeReq(body) {
  return { method: "POST", headers: {}, body };
}

function makeRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
    setHeader() {},
  };
  return res;
}

async function call(body) {
  const req = makeReq(body);
  const res = makeRes();
  await handler(req, res);
  return res;
}

const englishJob = {
  action: "translate",
  description: "We are looking for a Software Engineer. You will build reliable systems with AWS and TypeScript.",
  sourceLanguage: "en",
  targetLanguage: "de",
  consent: true,
};

describe("JM-JOB-TRANSLATION-01: job translation API", () => {
  beforeEach(() => {
    vi.mocked(chat).mockReset();
    vi.mocked(chat).mockResolvedValue(JSON.stringify({
      translation: "Wir suchen einen Software Engineer. Du baust zuverlässige Systeme mit AWS und TypeScript.",
    }));
  });

  it("translates an English job description and sends no CV data", async () => {
    const res = await call({
      ...englishJob,
      cv_text: "PRIVATE CV TEXT",
      candidate: { email: "private@example.com" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.data).toMatchObject({
      sourceLanguage: "en",
      targetLanguage: "de",
      translated: true,
    });
    expect(res.data.translation).toContain("Wir suchen");
    expect(chat).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(chat).mock.calls[0][0].prompt;
    expect(prompt).not.toContain("PRIVATE CV TEXT");
    expect(prompt).not.toContain("private@example.com");
    expect(prompt).toContain("Software Engineer");
  });

  it("forwards an explicitly selected supported model", async () => {
    const res = await call({
      ...englishJob,
      model: "vendor/translation-model:free",
    });

    expect(res.statusCode).toBe(200);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(chat).mock.calls[0][0].model).toBe("vendor/translation-model:free");
  });

  it("does not call the provider for a German description", async () => {
    const res = await call({
      ...englishJob,
      description: "Wir suchen einen Software Engineer mit AWS und TypeScript.",
      sourceLanguage: "de",
    });

    expect(res.statusCode).toBe(200);
    expect(res.data).toMatchObject({
      sourceLanguage: "de",
      targetLanguage: "de",
      translated: false,
    });
    expect(chat).not.toHaveBeenCalled();
  });

  it("requires explicit consent", async () => {
    const res = await call({ ...englishJob, consent: false });

    expect(res.statusCode).toBe(400);
    expect(res.data.code).toBe("consent_required");
    expect(chat).not.toHaveBeenCalled();
  });

  it("rejects oversized descriptions before calling the provider", async () => {
    const res = await call({ ...englishJob, description: "A".repeat(20001) });

    expect(res.statusCode).toBe(400);
    expect(res.data.code).toBe("description_too_long");
    expect(chat).not.toHaveBeenCalled();
  });

  it("detects English when sourceLanguage is auto", async () => {
    const res = await call({ ...englishJob, sourceLanguage: "auto" });

    expect(res.statusCode).toBe(200);
    expect(res.data.sourceLanguage).toBe("en");
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("returns a provider error without an empty translation", async () => {
    vi.mocked(chat).mockRejectedValueOnce(
      new HttpError(504, "The translation provider timed out.", "timeout")
    );

    const res = await call(englishJob);

    expect(res.statusCode).toBe(504);
    expect(res.data).toMatchObject({
      code: "timeout",
      error: expect.stringMatching(/timed out/i),
    });
    expect(res.data.translation).toBeUndefined();
  });

  it("fails closed when the provider returns no usable translation", async () => {
    vi.mocked(chat).mockResolvedValueOnce("");

    const res = await call(englishJob);

    expect(res.statusCode).toBe(502);
    expect(res.data.code).toBe("bad_ai_response");
    expect(res.data.translation).toBeUndefined();
  });

  it("does not accept an unsupported target language", async () => {
    const res = await call({ ...englishJob, targetLanguage: "fr" });

    expect(res.statusCode).toBe(400);
    expect(res.data.code).toBe("unsupported_language");
    expect(chat).not.toHaveBeenCalled();
  });

  it("strips script payloads from the translation prompt, including end-tag variants", async () => {
    const res = await call({
      ...englishJob,
      description:
        "<p>Visible paragraph</p><script>ALERT_TOKEN_1()</script >" +
        "<script>ALERT_TOKEN_2()</SCRIPT\n><style>.x{content:'ALERT_TOKEN_3'}</style>" +
        "<img src=x onerror=\"ALERT_TOKEN_4()\"><noscript>ALERT_TOKEN_5</noscript>",
    });

    expect(res.statusCode).toBe(200);
    expect(chat).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(chat).mock.calls[0][0].prompt;
    expect(prompt).toContain("Visible paragraph");
    expect(prompt).not.toContain("ALERT_TOKEN_1");
    expect(prompt).not.toContain("ALERT_TOKEN_2");
    expect(prompt).not.toContain("ALERT_TOKEN_3");
    expect(prompt).not.toContain("ALERT_TOKEN_4");
    expect(prompt).not.toContain("ALERT_TOKEN_5");
    expect(prompt).not.toContain("<script");
  });
});


describe("JM-JOB-DETAILS-TRANSLATION-HOTFIX-01: bounded translation parsing", () => {
  it.each([
    ["valid JSON", '{"translation":"Wir suchen eine Fachkraft."}', "Wir suchen eine Fachkraft."],
    ["escaped quotes", '{"translation":"Er sagte: \\"Hallo\\"."}', 'Er sagte: "Hallo".'],
    ["malformed inner quotes", '{"translation":"Er sagte: "Hallo"."}', 'Er sagte: "Hallo".'],
    ["unescaped newline", '{"translation":"Zeile 1\nZeile 2"}', "Zeile 1\nZeile 2"],
    ["truncated before quote", '{"translation":"Abgeschnitten', ""],
    ["double-encoded JSON", JSON.stringify(JSON.stringify({ translation: "Doppelt kodiert." })), "Doppelt kodiert."],
    ["plain text", "Einfacher Text mit Umlauten äöü.", "Einfacher Text mit Umlauten äöü."],
    ["fenced JSON", '```json\n{"translation":"Gefenced."}\n```', "Gefenced."],
    ["invalid object", '{"foo":"bar"}', ""],
    ["empty", "   ", ""],
  ])("parses %s", (_label, input, expected) => {
    expect(parseTranslation(input)).toBe(expected);
  });

  it("rejects an oversized translation instead of silently truncating it", () => {
    expect(parseTranslation(JSON.stringify({ translation: "x".repeat(30001) }))).toBe("");
  });

  it("never returns a visible JSON wrapper for malformed model output", async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"translation":"Wir suchen "Fachkräfte" für AWS."}');
    const res = await call(englishJob);
    expect(res.statusCode).toBe(200);
    expect(res.data.translation).toBe('Wir suchen "Fachkräfte" für AWS.');
    expect(res.data.translation).not.toContain('{"translation"');
  });

  it("fails closed for a truncated wrapper and keeps the original available", async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"translation":"Abgeschnitten');
    const res = await call(englishJob);
    expect(res.statusCode).toBe(502);
    expect(res.data.code).toBe("bad_ai_response");
    expect(res.data.translation).toBeUndefined();
  });

  it("fails closed for an invalid JSON object without a translation", async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"foo":"bar"}');
    const res = await call(englishJob);
    expect(res.statusCode).toBe(502);
    expect(res.data.translation).toBeUndefined();
  });
});
