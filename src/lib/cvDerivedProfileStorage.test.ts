import { describe, expect, it } from "vitest";
import {
  defaultProfileStorageChoice,
  isDurableAtsParentValid,
  profileStorageUnavailableReason,
} from "./cvDerivedProfileStorage";

describe("derived profile storage guards", () => {
  it("requires a durable RIS cvId before any persistent choice", () => {
    expect(profileStorageUnavailableReason(undefined, true)).toBe("durable-cv");
  });

  it("requires the separate search-profile consent", () => {
    expect(profileStorageUnavailableReason("cv-1", false)).toBe("consent");
    expect(profileStorageUnavailableReason("cv-1", true)).toBeNull();
  });

  it("defaults a durable source CV to durable profiles only when consent is active", () => {
    expect(defaultProfileStorageChoice(undefined, true)).toBe("session");
    expect(defaultProfileStorageChoice("cv-1", false)).toBe("session");
    expect(defaultProfileStorageChoice("cv-1", true)).toBe("persistent");
  });

  it("rejects an ATS parent that is not a durable profile of this CV", () => {
    expect(isDurableAtsParentValid("", ["sp-1"])).toBe(false);
    expect(isDurableAtsParentValid("sp-2", ["sp-1"])).toBe(false);
    expect(isDurableAtsParentValid("sp-1", ["sp-1", "sp-2"])).toBe(true);
  });
});
