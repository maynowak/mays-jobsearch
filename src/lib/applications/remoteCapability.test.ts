import { describe, expect, it, vi } from "vitest";
import { RisConsentApiError } from "../risConsentApi";
import {
  checkRisRemoteApplicationAccess,
  isRemoteCapabilityForProfile,
} from "./remoteCapability";

describe("RIS remote application capability", () => {
  it("returns true only after the server consent probe succeeds", async () => {
    const probe = vi.fn(async () => ({ consent: null, grantAllowed: false }));

    await expect(checkRisRemoteApplicationAccess("token-1", probe)).resolves.toBe(true);
    expect(probe).toHaveBeenCalledWith("token-1");
  });

  it("fails closed without a token and never calls the server", async () => {
    const probe = vi.fn(async () => ({}));

    for (const token of [null, undefined, "", "   "]) {
      await expect(checkRisRemoteApplicationAccess(token, probe)).resolves.toBe(false);
    }
    expect(probe).not.toHaveBeenCalled();
  });

  it("fails closed for 401, 403 and 503 responses", async () => {
    for (const status of [401, 403, 503]) {
      const probe = vi.fn(async () => {
        throw new RisConsentApiError("denied", status, "denied");
      });
      await expect(checkRisRemoteApplicationAccess("token-1", probe)).resolves.toBe(false);
    }
  });

  it("fails closed for network and unexpected errors", async () => {
    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const unexpected = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(checkRisRemoteApplicationAccess("token-1", network)).resolves.toBe(false);
    await expect(checkRisRemoteApplicationAccess("token-1", unexpected)).resolves.toBe(false);
  });

  it("trims the token before probing", async () => {
    const probe = vi.fn(async () => ({}));

    await expect(checkRisRemoteApplicationAccess("  token-2  ", probe)).resolves.toBe(true);
    expect(probe).toHaveBeenCalledWith("token-2");
  });
});

describe("remote capability identity binding", () => {
  const key = "https://issuer.example.invalid|user-1";

  it("accepts only an allowed capability for the exact profile key", () => {
    expect(isRemoteCapabilityForProfile({ key, allowed: true }, key)).toBe(true);
  });

  it("rejects a capability from a previous identity", () => {
    expect(isRemoteCapabilityForProfile({ key, allowed: true }, "https://issuer.example.invalid|user-2"))
      .toBe(false);
  });

  it("rejects a denied, missing or keyless capability", () => {
    expect(isRemoteCapabilityForProfile({ key, allowed: false }, key)).toBe(false);
    expect(isRemoteCapabilityForProfile(null, key)).toBe(false);
    expect(isRemoteCapabilityForProfile(undefined, key)).toBe(false);
    expect(isRemoteCapabilityForProfile({ key, allowed: true }, "")).toBe(false);
    expect(isRemoteCapabilityForProfile({ key, allowed: true }, null)).toBe(false);
  });
});
