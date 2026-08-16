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
  chat,
  getModels,
} from "../../api/_lib/providers/openrouter.mjs";

const OPENROUTER_MODELS = {
  data: [
    {
      id: "dots-studio/dots-3-note-preview:free",
      name: "Dots 3 Note",
      pricing: { prompt: "0", completion: "0", request: "0" },
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: ["response_format"],
    },
    {
      id: "cohere/north-mini-code:free",
      name: "North Mini",
      pricing: { prompt: "0", completion: "0", request: "0" },
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: [],
    },
    {
      id: "anthropic/claude-3-haiku",
      name: "Claude Haiku",
      pricing: { prompt: "0.000005", completion: "0.000015", request: "0" },
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: [],
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
  vi.stubEnv("OPENROUTER_API_KEY", "prod-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("OpenRouter chat", () => {
  it("sendet OpenAI-kompatible Anfragen an /chat/completions", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "Hallo" } }] })
    );
    const result = await chat({
      system: "sys",
      prompt: "prompt",
      json: false,
      model: "dots-studio/dots-3-note-preview:free",
    });
    expect(result).toBe("Hallo");
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/chat/completions");
    const body = JSON.parse(opts.body);
    expect(body.model).toBe("dots-studio/dots-3-note-preview:free");
  });

  it("mappt einen Timeout (AbortSignal) auf timeout statt model_unavailable", async () => {
    const timeoutErr = new Error("The operation was aborted");
    timeoutErr.name = "TimeoutError";
    vi.mocked(fetch).mockRejectedValue(timeoutErr);
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "timeout",
      status: 504,
    });
  });

  it("mappt einen Netzwerkfehler auf network_error statt model_unavailable", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "network_error",
      status: 502,
    });
  });

  it("mappt 402 auf insufficient_credits", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: { message: "Insufficient credits" } }, 402)
    );
    await expect(chat({ system: "s", prompt: "p", model: "m" })).rejects.toMatchObject({
      code: "insufficient_credits",
      status: 402,
    });
  });
});

describe("OpenRouter model catalog", () => {
  it("markiert ausschließlich Modelle mit 0-Kosten-Pricing als free", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(OPENROUTER_MODELS));
    const models = await getModels();
    const ids = models.map((m) => m.id);
    expect(ids).toContain("dots-studio/dots-3-note-preview:free");
    expect(ids).toContain("cohere/north-mini-code:free");
    expect(ids).not.toContain("anthropic/claude-3-haiku");
  });
});
