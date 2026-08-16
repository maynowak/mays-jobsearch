// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/cache.mjs", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
  cacheDel: vi.fn(async () => undefined),
  cacheIncr: vi.fn(async () => 1),
  cacheHIncrBy: vi.fn(async () => 1),
  cacheHGetAll: vi.fn(async () => ({})),
}));

import {
  __resetModelsCacheForTests,
  apiKey,
  chat,
  getCompatibleFallback,
  getDefaultModel,
  getModels,
  keyMode,
} from "../../api/_lib/providers/edenai.mjs";

const EDENAI_MODELS = {
  data: [
    {
      id: "cloudflare/@cf/google/gemma-2b-it-lora",
      model_name: "Gemma 2b LoRA",
      owned_by: "cloudflare",
      pricing: { input_cost_per_token: 0, output_cost_per_token: 0 },
      capabilities: {
        input_modalities: ["text"],
        output_modalities: ["text"],
        supports_response_schema: false,
      },
    },
    {
      id: "google/gemma-4-26b-a4b-it",
      model_name: "Gemma 4 26B A4B",
      owned_by: "google",
      pricing: { input_cost_per_token: 0, output_cost_per_token: 0 },
      capabilities: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
        supports_response_schema: true,
      },
    },
    {
      id: "openai/gpt-4o",
      model_name: "GPT-4o",
      owned_by: "openai",
      pricing: { input_cost_per_token: 0.0000025, output_cost_per_token: 0.00001 },
      capabilities: {
        input_modalities: ["text"],
        output_modalities: ["text"],
        supports_response_schema: true,
      },
    },
    {
      id: "google/lyria-3-clip-preview",
      model_name: "Lyria Clip",
      owned_by: "google",
      pricing: { input_cost_per_token: 0, output_cost_per_token: 0 },
      capabilities: {
        input_modalities: ["text", "image"],
        output_modalities: ["text", "audio"],
        supports_response_schema: true,
      },
    },
,
    {
      id: "anthropic/claude-3-haiku",
      model_name: "Claude 3 Haiku",
      owned_by: "anthropic",
      pricing: { input_cost_per_token: 0, output_cost_per_token: 0 },
      capabilities: {
        input_modalities: ["text"],
        output_modalities: ["text"],
        supports_response_schema: true,
      },
    },

  ],
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: vi.fn(async () => body),
  };
}

beforeEach(() => {
  __resetModelsCacheForTests();
  vi.stubGlobal("fetch", vi.fn());
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EdenAI key selection", () => {
  it("nutzt im Produktionsmodus (VERCEL_ENV=production) den EDENAI_API_KEY", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.stubEnv("EDENAI_DEV_API_KEY", "dev-key");
    expect(keyMode()).toBe("production");
    expect(apiKey()).toBe("prod-key");
  });

  it("bevorzugt außerhalb der Produktion den EDENAI_DEV_API_KEY (Sandbox)", () => {
    delete process.env.VERCEL_ENV;
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.stubEnv("EDENAI_DEV_API_KEY", "dev-key");
    expect(keyMode()).toBe("sandbox");
    expect(apiKey()).toBe("dev-key");
  });

  it("EDENAI_ENV=production überschreibt VERCEL_ENV", () => {
    vi.stubEnv("EDENAI_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    expect(keyMode()).toBe("production");
    expect(apiKey()).toBe("prod-key");
  });
});

describe("EdenAI model catalog", () => {
  it("markiert ausschließlich Modelle mit 0-Kosten-Pricing als free (keine Namens-Heuristik)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(EDENAI_MODELS));
    const models = await getModels();
    const ids = models.map((m) => m.id);
    expect(ids).toContain("cloudflare/@cf/google/gemma-2b-it-lora");
    expect(ids).toContain("google/gemma-4-26b-a4b-it");
    expect(ids).not.toContain("openai/gpt-4o");
    expect(ids).not.toContain("google/lyria-3-clip-preview");
  });

  it("liest die Strukturiertheits-Fähigkeit aus supports_response_schema", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(EDENAI_MODELS));
    const models = await getModels();
    expect(models.find((m) => m.id === "google/gemma-4-26b-a4b-it").structured).toBe(true);
    expect(models.find((m) => m.id === "cloudflare/@cf/google/gemma-2b-it-lora").structured).toBe(false);
  });

  it("bevorzugt strukturierte Modelle als Fallback", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(EDENAI_MODELS));
    const fallback = await getCompatibleFallback(null);
    expect(fallback).toBe("anthropic/claude-3-haiku");
  });

  it("liefert beim nicht erreichbaren Katalog kein Fallback-Modell", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "nope" }, 500));
    await expect(getCompatibleFallback(null)).resolves.toBeNull();
    await expect(getDefaultModel()).resolves.toBe("cloudflare/@cf/google/gemma-7b-it-lora");
  });
});

describe("EdenAI chat", () => {
  it("sendet OpenAI-kompatible Anfragen an /v3/chat/completions", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "Hallo" } }] })
    );
    const result = await chat({
      system: "sys",
      prompt: "prompt",
      json: false,
      temperature: 0.3,
      maxTokens: 900,
      model: "anthropic/claude-3-haiku",
    });
    expect(result).toBe("Hallo");
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/v3/chat/completions");
    const body = JSON.parse(opts.body);
    expect(body.model).toBe("anthropic/claude-3-haiku");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
  });

  it("fügt response_format nur bei strukturierten Modellen hinzu (json=true)", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(EDENAI_MODELS)).mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: "{}" } }] })
    );
    await chat({
      system: "sys",
      prompt: "prompt",
      json: true,
      model: "anthropic/claude-3-haiku",
    });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[1][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("mappt 402 auf insufficient_credits", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: "error", error: { code: "insufficient_credits", message: "Not enough credits." } }, 402)
    );
    await expect(
      chat({ system: "s", prompt: "p", model: "m" })
    ).rejects.toMatchObject({ code: "insufficient_credits", status: 402 });
  });

  it("mappt 401 auf key_invalid", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: "error", error: { code: "unauthorized", message: "Invalid token." } }, 401)
    );
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "key_invalid",
    });
  });

  it("mappt 429 mit Quota-Hinweis auf quota_exhausted", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: "error", error: { message: "Quota exceeded for this API." } }, 429)
    );
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "quota_exhausted",
    });
  });

  it("mappt 5xx auf model_unavailable", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "model_unavailable",
    });
  });

  it("mappt einen Timeout (AbortSignal) auf timeout statt model_unavailable", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    const timeoutErr = new Error("The operation was aborted");
    timeoutErr.name = "TimeoutError";
    vi.mocked(fetch).mockRejectedValue(timeoutErr);
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "timeout",
      status: 504,
    });
  });

  it("mappt einen Netzwerkfehler auf network_error statt model_unavailable", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "network_error",
      status: 502,
    });
  });

  it("liest den Erfolgs-Response-Body nur einmal (kein doppeltes response.json)", async () => {
    vi.stubEnv("EDENAI_API_KEY", "prod-key");
    const realResponse = new Response(
      JSON.stringify({ choices: [{ message: { content: "Hallo" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    vi.mocked(fetch).mockResolvedValue(realResponse);
    await expect(
      chat({ system: "s", prompt: "p", json: false, model: "m" })
    ).resolves.toBe("Hallo");
  });
});
