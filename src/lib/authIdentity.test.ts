import { describe, expect, it } from "vitest";
import { deriveAuthProfileKey, isVerifiedAuthProfileKey, UNVERIFIED_AUTH_KEY } from "./authIdentity";

describe("JM-PROFILE-AUTH-BOUNDARY-07: identity key", () => {
  it("uses iss + sub as the stable combination", () => {
    const key = deriveAuthProfileKey(true, { iss: "https://issuer.example", sub: "user-a" });
    expect(key).not.toBeNull();
    expect(isVerifiedAuthProfileKey(key)).toBe(true);
    expect(key).toBe(JSON.stringify(["https://issuer.example", "user-a"]));
  });

  it("does not treat a missing issuer as verified", () => {
    const key = deriveAuthProfileKey(true, { sub: "user-a" });
    expect(key).toBe(UNVERIFIED_AUTH_KEY);
    expect(isVerifiedAuthProfileKey(key)).toBe(false);
  });

  it("does not treat a blank issuer as verified", () => {
    expect(deriveAuthProfileKey(true, { iss: "   ", sub: "user-a" })).toBe(UNVERIFIED_AUTH_KEY);
  });

  it("separates users with different subs even when email is identical", () => {
    const a = deriveAuthProfileKey(true, { iss: "iss", sub: "a", email: "same@example.invalid" });
    const b = deriveAuthProfileKey(true, { iss: "iss", sub: "b", email: "same@example.invalid" });
    expect(a).not.toBe(b);
  });

  it("separates the same sub from different issuers", () => {
    const a = deriveAuthProfileKey(true, { iss: "issuer-a", sub: "same" });
    const b = deriveAuthProfileKey(true, { iss: "issuer-b", sub: "same" });
    expect(a).not.toBe(b);
  });

  it("avoids delimiter ambiguity between issuer and subject", () => {
    const a = deriveAuthProfileKey(true, { iss: "issuer|one", sub: "user" });
    const b = deriveAuthProfileKey(true, { iss: "issuer", sub: "one|user" });
    expect(a).not.toBe(b);
  });

  it("never uses email alone as a verified identity", () => {
    expect(deriveAuthProfileKey(true, { email: "only@example.invalid" })).toBe(UNVERIFIED_AUTH_KEY);
    expect(isVerifiedAuthProfileKey(UNVERIFIED_AUTH_KEY)).toBe(false);
  });

  it("returns null for guests", () => {
    expect(deriveAuthProfileKey(false, { sub: "user-a" })).toBeNull();
    expect(isVerifiedAuthProfileKey(null)).toBe(false);
  });
});
