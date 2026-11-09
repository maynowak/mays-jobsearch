import { describe, expect, it } from "vitest";
import { persistentCvProcessBlocker } from "./cvProcessingHandoff";

const ready = { processingStatus: "ready" as const };
const guard = {
  identityVerified: true,
  accessToken: "token",
  storageEnabled: true,
  consentStatus: "GRANTED",
};

describe("persistentCvProcessBlocker", () => {
  it("allows a ready CV only for a verified identity with granted storage consent", () => {
    expect(persistentCvProcessBlocker(ready, guard, 1)).toBeNull();
  });

  it("rejects a missing identity or token", () => {
    expect(persistentCvProcessBlocker(ready, { ...guard, identityVerified: false }, 1)).toBe("identity");
    expect(persistentCvProcessBlocker(ready, { ...guard, accessToken: "" }, 1)).toBe("identity");
  });

  it("rejects missing or non-granted storage consent", () => {
    expect(persistentCvProcessBlocker(ready, { ...guard, storageEnabled: false }, 1)).toBe("consent");
    expect(persistentCvProcessBlocker(ready, { ...guard, consentStatus: "WITHDRAWN" }, 1)).toBe("consent");
  });

  it("rejects a CV that is not ready", () => {
    expect(persistentCvProcessBlocker({ processingStatus: "pending" }, guard, 1)).toBe("not-ready");
  });

  it("rejects a full session instead of silently dropping the new CV", () => {
    expect(persistentCvProcessBlocker(ready, guard, 10)).toBe("capacity");
  });
});
