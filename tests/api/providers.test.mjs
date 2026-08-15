// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
  cacheDel: vi.fn(async () => undefined),
  cacheIncr: vi.fn(async () => 1),
  cacheHIncrBy: vi.fn(async () => 1),
  cacheHGetAll: vi.fn(async () => ({})),
}));

vi.mock("../../api/_lib/providers/openrouter.mjs", () => ({
  PROVIDER_ID: "openrouter",
  PROVIDER_NAME: "OpenRouter",
  isConfigured: vi.fn(() => true),
  enabled: vi.fn(() => true),
  keyMode: vi.fn(() => "production"),
  ownsModel: vi.fn(async () => false),
  getModels: vi.fn(async () => [{ id: "openrouter/free-a", name: "Model A", structured: true }]),
  getCompatibleFallback: vi.fn(async () => "openrouter/free-a"),
  getEligibleModel: vi.fn(async () => "openrouter/free-a"),
  getDefaultModel: vi.fn(async () => "openrouter/free-a"),
  limitReached: vi.fn(async () => false),
  countRequest: vi.fn(async () => undefined),
  countFailure: vi.fn(async () => undefined),
  countAttempt: vi.fn(async () => undefined),
  chat: vi.fn(),
  isFreeDailyQuotaError: vi.fn(() => false),
}));

vi.mock("../../api/_lib/providers/edenai.mjs", () => ({
  PROVIDER_ID: "edenai",
  PROVIDER_NAME: "EdenAI",
  isConfigured: vi.fn(() => true),
  enabled: vi.fn(() => true),
  keyMode: vi.fn(() => "sandbox"),
  ownsModel: vi.fn(async () => false),
  getModels: vi.fn(async () => [{ id: "google/gemma-4-26b-a4b-it", name: "Gemma", structured: true }]),
  getCompatibleFallback: vi.fn(async () => "google/gemma-4-26b-a4b-it"),
  getEligibleModel: vi.fn(async () => "google/gemma-4-26b-a4b-it"),
  getDefaultModel: vi.fn(async () => "google/gemma-4-26b-a4b-it"),
  limitReached: vi.fn(async () => false),
  countRequest: vi.fn(async () => undefined),
  countFailure: vi.fn(async () => undefined),
  countAttempt: vi.fn(async () => undefined),
  chat: vi.fn(),
}));

import { HttpError } from "../../api/_lib/filter.mjs";
import { chat, getFreeModels } from "../../api/_lib/providers/index.mjs";
import * as openrouter from "../../api/_lib/providers/openrouter.mjs";
import * as edenai from "../../api/_lib/providers/edenai.mjs";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(openrouter.ownsModel).mockImplementation(async (id) => id === "openrouter/free-a");
  vi.mocked(edenai.ownsModel).mockImplementation(async (id) => id === "google/gemma-4-26b-a4b-it");
  vi.mocked(openrouter.getEligibleModel).mockResolvedValue("openrouter/free-a");
  vi.mocked(edenai.getEligibleModel).mockResolvedValue("google/gemma-4-26b-a4b-it");
  vi.mocked(openrouter.limitReached).mockResolvedValue(false);
  vi.mocked(edenai.limitReached).mockResolvedValue(false);
  vi.mocked(openrouter.getModels).mockResolvedValue([
    { id: "openrouter/free-a", name: "Model A", structured: true },
  ]);
  vi.mocked(edenai.getModels).mockResolvedValue([
    { id: "google/gemma-4-26b-a4b-it", name: "Gemma", structured: true },
  ]);
});

describe("provider catalog aggregation", () => {
  it("aggregiert die Modelle beider Provider ohne Duplikate", async () => {
    vi.mocked(edenai.ownsModel).mockImplementation(async (id) => id === "google/gemma-4-26b-a4b-it");
    const models = await getFreeModels();
    expect(models.map((m) => m.id)).toEqual(["openrouter/free-a", "google/gemma-4-26b-a4b-it"]);
    expect(models[1].provider).toEqual({ id: "edenai", name: "EdenAI" });
  });

  it("liefert bei gleicher Modell-ID nur EINEN Eintrag (dedup, OpenRouter zuerst)", async () => {
    vi.mocked(edenai.ownsModel).mockImplementation(async () => false);
    vi.mocked(edenai.getModels).mockResolvedValue([{ id: "shared/model", name: "Shared", structured: true }]);
    vi.mocked(openrouter.getModels).mockResolvedValue([{ id: "shared/model", name: "Shared", structured: true }]);
    const models = await getFreeModels();
    expect(models.filter((m) => m.id === "shared/model")).toHaveLength(1);
    expect(models.find((m) => m.id === "shared/model").provider.id).toBe("openrouter");
  });
});

describe("router chat(): provider fallback", () => {
  it("leitet ein Modell an den Provider, der es besitzt", async () => {
    vi.mocked(openrouter.ownsModel).mockImplementation(async (id) => id === "openrouter/free-a");
    vi.mocked(openrouter.chat).mockResolvedValue("ok-from-openrouter");
    const result = await chat({ system: "s", prompt: "p", model: "openrouter/free-a" });
    expect(result).toBe("ok-from-openrouter");
    expect(openrouter.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openrouter/free-a" })
    );
    expect(edenai.chat).not.toHaveBeenCalled();
  });

  it("fällt bei einem Provider-Quota-Fehler auf den nächsten Provider zurück", async () => {
    vi.mocked(openrouter.ownsModel).mockImplementation(async (id) => id === "openrouter/free-a");
    vi.mocked(openrouter.chat).mockRejectedValue(
      new HttpError(429, "The free AI request quota for today has been used up.", "free_quota_exceeded")
    );
    vi.mocked(edenai.ownsModel).mockImplementation(async (id) => id === "google/gemma-4-26b-a4b-it");
    vi.mocked(edenai.chat).mockResolvedValue("ok-from-edenai");

    const result = await chat({ system: "s", prompt: "p", model: "openrouter/free-a" });
    expect(result).toBe("ok-from-edenai");
    expect(openrouter.chat).toHaveBeenCalledTimes(1);
    expect(edenai.chat).toHaveBeenCalledTimes(1);
  });

  it("gibt einen Nicht-Quota-Fehler (model_unavailable) direkt weiter, ohne Providerwechsel", async () => {
    vi.mocked(openrouter.ownsModel).mockImplementation(async (id) => id === "openrouter/free-a");
    vi.mocked(openrouter.chat).mockRejectedValue(
      new HttpError(502, "unavailable", "model_unavailable")
    );
    await expect(chat({ system: "s", prompt: "p", model: "openrouter/free-a" })).rejects.toMatchObject({
      code: "model_unavailable",
    });
    expect(edenai.chat).not.toHaveBeenCalled();
  });

  it("bricht beim limit_reached des Providers ab und wirft limit_reached", async () => {
    vi.mocked(openrouter.limitReached).mockResolvedValue(true);
    vi.mocked(edenai.limitReached).mockResolvedValue(true);
    await expect(chat({ system: "s", prompt: "p", model: "openrouter/free-a" })).rejects.toMatchObject({
      code: "limit_reached",
    });
    expect(openrouter.chat).not.toHaveBeenCalled();
    expect(edenai.chat).not.toHaveBeenCalled();
  });

  it("wirft missing_key, wenn kein Provider konfiguriert ist", async () => {
    vi.mocked(openrouter.enabled).mockReturnValue(false);
    vi.mocked(edenai.enabled).mockReturnValue(false);
    await expect(chat({ system: "s", prompt: "p" })).rejects.toMatchObject({ code: "missing_key" });
    vi.mocked(openrouter.enabled).mockReturnValue(true);
    vi.mocked(edenai.enabled).mockReturnValue(true);
  });
});
