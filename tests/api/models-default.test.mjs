// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

// Regression: /api/models darf als defaultModel kein nicht-freies (bzw. in der
// freien Liste fehlendes) Modell ausspielen — sonst schlaegt jeder
// Default-Aufruf mit model_not_free fehl.

const { getFreeModels, getCompatibleFallback, resolveDefaultModel } = vi.hoisted(() => ({
  getFreeModels: vi.fn(),
  getCompatibleFallback: vi.fn(),
  resolveDefaultModel: vi.fn(),
}));

vi.mock("../../api/_lib/providers/index.mjs", () => ({
  getFreeModels,
  getCompatibleFallback,
  resolveDefaultModel,
  allProvidersInfo: () => [{ id: "openrouter", name: "OpenRouter", enabled: true, configured: true }],
}));

vi.mock("../../api/_lib/config.mjs", () => ({
  getConfig: () => ({ modelFallbackMaxAttempts: 3 }),
}));

const { default: handler } = await import("../../api/models.mjs");

function makeRes() {
  const res = {
    statusCode: 0,
    data: undefined,
    setHeader: () => {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_MODEL = "openai/gpt-4o-mini"; // konfiguriertes, nicht-freies Modell
  getFreeModels.mockResolvedValue([
    { id: "cohere/north-mini-code:free", name: "Cohere", structured: true },
    { id: "dots-studio/dots-3-note-preview:free", name: "Dots", structured: true },
  ]);
  getCompatibleFallback.mockResolvedValue("dots-studio/dots-3-note-preview:free");
  resolveDefaultModel.mockResolvedValue("dots-studio/dots-3-note-preview:free");
});

describe("/api/models defaultModel (Production-Befund)", () => {
  it("gibt das kompatible freie Modell aus, wenn das konfigurierte nicht frei ist", async () => {
    const res = makeRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(200);
    expect(getCompatibleFallback).toHaveBeenCalledWith("openai/gpt-4o-mini");
    expect(res.data.defaultModel).toBe("dots-studio/dots-3-note-preview:free");
    expect(res.data.defaultModel).not.toBe("openai/gpt-4o-mini");
  });

  it("beh\u00e4lt das konfigurierte Modell, wenn es kompatibel/frei ist", async () => {
    process.env.OPENROUTER_MODEL = "cohere/north-mini-code:free";
    getCompatibleFallback.mockResolvedValue("cohere/north-mini-code:free");
    resolveDefaultModel.mockResolvedValue("cohere/north-mini-code:free");
    const res = makeRes();
    await handler({ method: "GET" }, res);
    expect(res.data.defaultModel).toBe("cohere/north-mini-code:free");
  });
});
