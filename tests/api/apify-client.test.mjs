// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { startApifyRun, waitForRun, readDataset } = await import("../../api/_lib/sources/apify/client.mjs");

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = vi.fn(async () => new Response("{}", { status: 200 }));
});

describe("Apify client - Bearer token transport", () => {
  it("startApifyRun sends the token via Authorization header, not in the URL", async () => {
    await startApifyRun("secret-token", "someuser~some-actor", { maxResults: 1 });
    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).not.toContain("token=");
    expect(String(url)).toBe("https://api.apify.com/v2/acts/someuser~some-actor/runs");
    expect(options.headers.Authorization).toBe("Bearer secret-token");
  });

  it("waitForRun sends the token via Authorization header, not in the URL", async () => {
    await waitForRun("secret-token", "run-id-1", 1000);
    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).not.toContain("token=");
    expect(String(url)).toBe("https://api.apify.com/v2/actor-runs/run-id-1");
    expect(options.headers.Authorization).toBe("Bearer secret-token");
  });

  it("readDataset sends the token via Authorization header, not in the URL", async () => {
    await readDataset("secret-token", "dataset-id-1");
    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).not.toContain("token=");
    expect(String(url)).toBe("https://api.apify.com/v2/datasets/dataset-id-1/items");
    expect(options.headers.Authorization).toBe("Bearer secret-token");
  });
});