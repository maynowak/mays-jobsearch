// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from "vitest";

// BROWSER-BUG-22: /api/ats-analysis akzeptiert ein optionales ai.model und
// reicht es bis zur bestehenden chat({ model })-Kette durch.
// Ohne ai.model bleibt das Server-Default-Verhalten unveraendert.

const { chat } = vi.hoisted(() => ({ chat: vi.fn(async () => ({ proposedText: "x", rationale: "y" })) }));

vi.mock("../../api/_lib/providers/index.mjs", () => ({
  chat,
  isFreeDailyQuotaError: () => false,
}));

const { default: handler } = await import("../../api/ats-analysis.mjs");

const baseBody = {
  job: { title: "React Developer", tags: ["react"], slug: "j-1" },
  profile: { skills: "react, typescript" },
  ai: { enabled: true, consent: true },
};

function makeRes() {
  const res = {
    statusCode: 0,
    data: undefined,
    setHeader: () => {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  return res;
}

beforeEach(() => {
  chat.mockClear();
});

describe("BROWSER-BUG-22: ATS ai.model Vertrag", () => {
  it("A) ohne ai.model bleibt das bisherige Verhalten unveraendert", async () => {
    const res = makeRes();
    await handler({ method: "POST", body: baseBody }, res);
    expect(res.statusCode).toBe(200);
    expect(res.data.analysis).toBeDefined();
    // kein erzwungenes Modell in der Antwort
    expect(res.data.ai.model).not.toBe("custom-model-x");
  });

  it("B) mit ai.model wird das Modell in der Antwort gespiegelt", async () => {
    const res = makeRes();
    await handler(
      { method: "POST", body: { ...baseBody, ai: { enabled: true, consent: true, model: "custom-model-x" } } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.data.ai.model).toBe("custom-model-x");
  });

  it("C/D) ai.model erreicht formulateCVText -> chat({ model })", async () => {
    const res = makeRes();
    await handler(
      { method: "POST", body: { ...baseBody, ai: { enabled: true, consent: true, model: "custom-model-x" } } },
      res
    );
    expect(res.statusCode).toBe(200);
    // mindestens ein chat-Aufruf mit dem gewaehlten Modell
    const callsWithModel = chat.mock.calls.filter((c) => c[0]?.model === "custom-model-x");
    expect(callsWithModel.length).toBeGreaterThan(0);
  });

  it("E) ohne ai.model ruft chat ohne model-Feld (Server-Default)", async () => {
    const res = makeRes();
    await handler({ method: "POST", body: baseBody }, res);
    expect(res.statusCode).toBe(200);
    if (chat.mock.calls.length > 0) {
      for (const call of chat.mock.calls) {
        expect(call[0]?.model).toBeUndefined();
      }
    }
  });
});
