// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isFreeDailyQuotaError } from "../../api/_lib/ai.mjs";

describe("isFreeDailyQuotaError", () => {
  it("erkennt die OpenRouter free-models-per-day Meldung (kontoweitiges Tageslimit)", () => {
    const msg =
      "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day";
    expect(isFreeDailyQuotaError(msg)).toBe(true);
    expect(isFreeDailyQuotaError("Free-Models-Per-Day reached")).toBe(true);
  });

  it("unterscheidet andere 429-Meldungen (per-Modell-Rate-Limit) NICHT als Tagesquota", () => {
    expect(isFreeDailyQuotaError("Rate limit exceeded: RPM")).toBe(false);
    expect(isFreeDailyQuotaError("429 Too Many Requests")).toBe(false);
    expect(isFreeDailyQuotaError("")).toBe(false);
    expect(isFreeDailyQuotaError(undefined)).toBe(false);
  });
});
