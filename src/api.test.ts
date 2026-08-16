import { afterEach, describe, expect, it } from "vitest";
import { ApiError, isFreeQuotaExceeded, setFallbackMaxAttempts, withModelFallback } from "./api";

const unavailable = () => new ApiError("unavailable", 502, "model_unavailable");

describe("withModelFallback", () => {
  afterEach(() => setFallbackMaxAttempts(3));

  it("versucht selected -> recommended -> Katalog in Reihenfolge, ohne Wiederholung, maximal maxAttempts", async () => {
    setFallbackMaxAttempts(3);
    const attempts: (string | null)[] = [];
    await expect(
      withModelFallback({
        initialModel: "m-selected",
        availableModels: ["m-cat-a", "m-selected", "m-cat-b", "m-reco", "m-cat-c"],
        recommendedModel: "m-reco",
        request: async (model) => {
          attempts.push(model);
          throw unavailable();
        },
      })
    ).rejects.toBeInstanceOf(ApiError);

    expect(attempts).toEqual(["m-selected", "m-reco", "m-cat-a"]);
  });

  it("wiederholt kein bereits versuchtes Modell", async () => {
    setFallbackMaxAttempts(5);
    const attempts: (string | null)[] = [];
    const result = await withModelFallback({
      initialModel: "a",
      availableModels: ["a", "b", "c", "d"],
      recommendedModel: null,
      request: async (model) => {
        attempts.push(model);
        if (model === "b") return { ok: true };
        throw unavailable();
      },
    });

    expect(attempts).toEqual(["a", "b"]);
    expect(result.usedFallback).toBe(true);
  });

  it("respektiert die konfigurierte maximale Anzahl an Versuchen", async () => {
    setFallbackMaxAttempts(2);
    const attempts: (string | null)[] = [];
    await expect(
      withModelFallback({
        initialModel: "a",
        availableModels: ["b", "c"],
        recommendedModel: null,
        request: async (model) => {
          attempts.push(model);
          throw unavailable();
        },
      })
    ).rejects.toBeInstanceOf(ApiError);

    expect(attempts).toEqual(["a", "b"]);
  });

  it("fällt bei nicht-vorübergehenden Fehlern nicht zurück", async () => {
    const attempts: (string | null)[] = [];
    await expect(
      withModelFallback({
        initialModel: "a",
        availableModels: ["b"],
        recommendedModel: null,
        request: async (model) => {
          attempts.push(model);
          throw new ApiError("bad", 400, "bad_request");
        },
      })
    ).rejects.toMatchObject({ code: "bad_request" });

    expect(attempts).toEqual(["a"]);
  });

  it("fällt bei timeout NICHT zurück (kein weiterer Request)", async () => {
    const attempts: (string | null)[] = [];
    await expect(
      withModelFallback({
        initialModel: "a",
        availableModels: ["b"],
        recommendedModel: null,
        request: async (model) => {
          attempts.push(model);
          throw new ApiError("timeout", 504, "timeout");
        },
      })
    ).rejects.toMatchObject({ code: "timeout" });

    expect(attempts).toEqual(["a"]);
  });

  it("fällt bei network_error NICHT zurück (kein weiterer Request)", async () => {
    const attempts: (string | null)[] = [];
    await expect(
      withModelFallback({
        initialModel: "a",
        availableModels: ["b"],
        recommendedModel: null,
        request: async (model) => {
          attempts.push(model);
          throw new ApiError("net", 502, "network_error");
        },
      })
    ).rejects.toMatchObject({ code: "network_error" });

    expect(attempts).toEqual(["a"]);
  });

  it("wirft bei Erfolg im späteren Versuch kein Fallback-Note-Ergebnis zurück (usedFallback=true)", async () => {
    const result = await withModelFallback({
      initialModel: "a",
      availableModels: ["b"],
      recommendedModel: null,
      request: async (model) => {
        if (model === "a") throw unavailable();
        return { data: 42 };
      },
    });

    expect(result).toEqual({ data: { data: 42 }, usedFallback: true });
  });

  it("lässt den selectedModel-State (initialModel) unverändert", async () => {
    const attempts: (string | null)[] = [];
    await withModelFallback({
      initialModel: "m-selected",
      availableModels: ["m-other"],
      recommendedModel: null,
      request: async (model) => {
        attempts.push(model);
        if (model === "m-selected") throw unavailable();
        return { ok: true };
      },
    });

    expect(attempts[0]).toBe("m-selected");
    expect(attempts).toContain("m-selected");
  });
});

describe("free_quota_exceeded (OpenRouter 429 free-models-per-day)", () => {
  it("isFreeQuotaExceeded erkennt den Fehler", () => {
    expect(isFreeQuotaExceeded(new ApiError("quota", 429, "free_quota_exceeded"))).toBe(true);
    expect(isFreeQuotaExceeded(new ApiError("unavailable", 502, "model_unavailable"))).toBe(false);
    expect(isFreeQuotaExceeded(new Error("x"))).toBe(false);
  });

  it("gilt NICHT als model_unavailable → der Fallback stoppt sofort (keine weiteren Versuche)", async () => {
    const quota = () => new ApiError("quota", 429, "free_quota_exceeded");
    const attempts: (string | null)[] = [];
    await expect(
      withModelFallback({
        initialModel: "a",
        availableModels: ["b", "c"],
        recommendedModel: null,
        request: async (model) => {
          attempts.push(model);
          throw quota();
        },
      })
    ).rejects.toMatchObject({ code: "free_quota_exceeded" });

    expect(attempts).toEqual(["a"]);
  });
});
