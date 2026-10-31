// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GUEST_FREE_SOURCE_IDS,
  guestAllowedSources,
  isGuestAllowedSource,
  paidSourcesAllowedForGuest,
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
    expect(isGuestAllowedSource(source("arbeitsagentur", "apify"))).toBe(false);
    expect(isGuestAllowedSource(source("unknown-paid", "job-api"))).toBe(false);
  });

  it("filters paid sources out of the guest registry view", () => {
    const filtered = guestAllowedSources([
      source("arbeitnow", "direct-api"),
      source("theirstack", "job-api"),
      source("jobspipe", "job-api"),
      source("arbeitsagentur", "apify"),
    ]);
    expect(filtered.map((entry) => entry.id)).toEqual(["arbeitnow"]);
  });

  it("never allows paid sources for public guests", () => {
    expect(paidSourcesAllowedForGuest()).toBe(false);
    expect([...GUEST_FREE_SOURCE_IDS]).toEqual(["arbeitnow", "greenhouse", "adzuna"]);
  });
});
