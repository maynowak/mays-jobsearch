import { describe, it, expect, vi } from "vitest";

describe("Provider Safety Observer - EdenAI", () => {
  it("setSafetyObserver and getSafetyObserver exist and are functions", async () => {
    const mod = await import("../../api/_lib/providers/edenai.mjs");
    expect(typeof mod.setSafetyObserver).toBe("function");
    expect(typeof mod.getSafetyObserver).toBe("function");
  });

  it("setSafetyObserver sets observer and getSafetyObserver returns it", async () => {
    const mod = await import("../../api/_lib/providers/edenai.mjs");
    const observer = { emit: vi.fn() };
    mod.setSafetyObserver(observer);
    expect(mod.getSafetyObserver()).toBe(observer);
  });

  it("without observer, getSafetyObserver returns null", async () => {
    const mod = await import("../../api/_lib/providers/edenai.mjs");
    mod.setSafetyObserver(null);
    expect(mod.getSafetyObserver()).toBeNull();
  });
});

describe("Provider Safety Observer - OpenRouter", () => {
  it("setSafetyObserver and getSafetyObserver exist and are functions", async () => {
    const mod = await import("../../api/_lib/providers/openrouter.mjs");
    expect(typeof mod.setSafetyObserver).toBe("function");
    expect(typeof mod.getSafetyObserver).toBe("function");
  });

  it("setSafetyObserver sets observer and getSafetyObserver returns it", async () => {
    const mod = await import("../../api/_lib/providers/openrouter.mjs");
    const observer = { emit: vi.fn() };
    mod.setSafetyObserver(observer);
    expect(mod.getSafetyObserver()).toBe(observer);
  });

  it("without observer, getSafetyObserver returns null", async () => {
    const mod = await import("../../api/_lib/providers/openrouter.mjs");
    mod.setSafetyObserver(null);
    expect(mod.getSafetyObserver()).toBeNull();
  });
});
