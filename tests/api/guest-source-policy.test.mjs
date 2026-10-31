// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GUEST_APIFY_SOURCE_IDS,
  GUEST_FREE_SOURCE_IDS,
  guestAllowedSources,
  isGuestAllowedSource,
} from "../../api/_lib/sourcePolicy.mjs";

const source = (id, provider) => ({ id, provider });

describe("JM-COOKIELESS-GUEST-MODEL-A-CUTOVER-01: guest source policy", () => {
  it("allows only free sources for guests", () => {
    expect(isGuestAllowedSource(source("arbeitnow", "direct-api"))).toBe(true);
    expect(isGuestAllowedSource(source("greenhouse", "ats"))).toBe(true);
    expect(isGuestAllowedSource(source("adzuna", "job-api"))).toBe(true);
    expect(isGuestAllowedSource(source("personio:acme", "ats"))).toBe(true);
    expect(isGuestAllowedSource(source("theirstack", "job-api"))).toBe(false);
    expect(isGuestAllowedSource(source("jobspipe", "job-api"))).toBe(false);
    expect(isGuestAllowedSource(source("arbeitsagentur", "apify"))).toBe(true);
    expect(isGuestAllowedSource(source("other-apify", "apify"))).toBe(false);
    expect(isGuestAllowedSource(source("unknown-paid", "job-api"))).toBe(false);
    expect(isGuestAllowedSource(source("future-paid-ats", "ats"))).toBe(false);
    expect(isGuestAllowedSource(source("future-paid-direct", "direct-api"))).toBe(false);
  });

  it("requires both approved identity and expected adapter/provider type", () => {
    // Approved identity with the wrong billing/provider class stays blocked.
    expect(isGuestAllowedSource(source("arbeitnow", "job-api"))).toBe(false);
    expect(isGuestAllowedSource(source("arbeitnow", "apify"))).toBe(false);
    expect(isGuestAllowedSource(source("greenhouse", "job-api"))).toBe(false);
    expect(isGuestAllowedSource(source("greenhouse", "apify"))).toBe(false);
    expect(isGuestAllowedSource(source("adzuna", "direct-api"))).toBe(false);
    expect(isGuestAllowedSource(source("adzuna", "ats"))).toBe(false);
    expect(isGuestAllowedSource(source("arbeitsagentur", "job-api"))).toBe(false);
    expect(isGuestAllowedSource(source("arbeitsagentur", "ats"))).toBe(false);
    expect(isGuestAllowedSource(source("arbeitsagentur", "direct-api"))).toBe(false);
    // Public ATS prefix with a paid provider class stays blocked.
    expect(isGuestAllowedSource(source("lever:paid", "job-api"))).toBe(false);
    expect(isGuestAllowedSource(source("greenhouse:paid", "apify"))).toBe(false);
    expect(isGuestAllowedSource(source("personio:acme", "job-api"))).toBe(false);
    // Every real public-ATS adapter remains allowed with provider === "ats".
    for (const id of [
      "greenhouse:acme",
      "lever:acme",
      "ashby:acme",
      "workable:acme",
      "recruitee:acme",
      "personio:acme",
    ]) {
      expect(isGuestAllowedSource(source(id, "ats"))).toBe(true);
    }
  });

  it("filters paid sources out of the guest registry view", () => {
    const filtered = guestAllowedSources([
      source("arbeitnow", "direct-api"),
      source("greenhouse", "ats"),
      source("adzuna", "job-api"),
      source("lever:acme", "ats"),
      source("theirstack", "job-api"),
      source("jobspipe", "job-api"),
      source("arbeitsagentur", "apify"),
      source("lever:paid", "job-api"),
      source("greenhouse:paid", "apify"),
      source("arbeitsagentur", "job-api"),
    ]);
    expect(filtered.map((entry) => entry.id)).toEqual([
      "arbeitnow",
      "greenhouse",
      "adzuna",
      "lever:acme",
      "arbeitsagentur",
    ]);
  });

  it("exposes only the explicit Arbeitsagentur paid exception ID", () => {
    expect([...GUEST_APIFY_SOURCE_IDS]).toEqual(["arbeitsagentur"]);
    expect([...GUEST_FREE_SOURCE_IDS]).toEqual(["arbeitnow", "greenhouse", "adzuna"]);
  });
});
