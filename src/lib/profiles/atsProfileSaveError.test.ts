import { describe, expect, it } from "vitest";
import { atsProfileSaveMessageKey } from "./atsProfileSaveError";
import { ProfileValidationError } from "./profileValidation";
import { SearchProfilesApiError } from "../searchProfilesApi";

describe("JM-ATS-PROFILE-SAVE-FIX-02 error mapping", () => {
  it("maps known session validation errors to actionable messages", () => {
    expect(atsProfileSaveMessageKey(new ProfileValidationError("duplicate", "validation_error"))).toBe("cv.atsProfileValidation");
    expect(atsProfileSaveMessageKey(new ProfileValidationError("missing", "invalid_parent"))).toBe("cv.errorNoSearchProfileSelected");
    expect(atsProfileSaveMessageKey(new ProfileValidationError("full", "capacity_exceeded"))).toBe("cv.errorTooManyAtsProfiles");
  });

  it("maps known RIS contract errors without exposing backend details", () => {
    expect(atsProfileSaveMessageKey(new SearchProfilesApiError("forbidden", 403, "CONSENT_REQUIRED"))).toBe("searchProfiles.searchConsentRequired");
    expect(atsProfileSaveMessageKey(new SearchProfilesApiError("missing parent", 404))).toBe("cv.atsNoDurableParent");
    expect(atsProfileSaveMessageKey(new SearchProfilesApiError("invalid", 422))).toBe("cv.atsProfileValidation");
    expect(atsProfileSaveMessageKey(new SearchProfilesApiError("full", 409))).toBe("cv.errorTooManyAtsProfiles");
  });

  it("keeps network and unknown failures generic", () => {
    expect(atsProfileSaveMessageKey(new Error("network down"))).toBe("cv.errorAtsProfileSave");
    expect(atsProfileSaveMessageKey(new SearchProfilesApiError("server", 500))).toBe("cv.errorAtsProfileSave");
  });
});
