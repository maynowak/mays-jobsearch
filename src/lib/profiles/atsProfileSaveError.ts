import { ProfileValidationError } from "./profileValidation";
import { SearchProfilesApiError } from "../searchProfilesApi";

export type AtsProfileSaveMessageKey =
  | "cv.errorTooManyAtsProfiles"
  | "cv.errorNoSearchProfileSelected"
  | "cv.atsNoDurableParent"
  | "cv.atsProfileValidation"
  | "cv.unassignedCapacity"
  | "searchProfiles.searchConsentRequired"
  | "cv.errorAtsProfileSave";

/**
 * Maps only known contract errors to actionable UI messages.
 * Unknown/network errors deliberately stay generic; no payload or profile
 * content is logged or included in the message.
 */
export function atsProfileSaveMessageKey(error: unknown): AtsProfileSaveMessageKey {
  if (error instanceof ProfileValidationError) {
    if (error.code === "capacity_exceeded") return "cv.errorTooManyAtsProfiles";
    if (error.code === "invalid_parent") return "cv.errorNoSearchProfileSelected";
    if (error.code === "validation_error" || error.code === "invalid_enum" || error.code === "invalid_radius") {
      return "cv.atsProfileValidation";
    }
    return "cv.atsProfileValidation";
  }

  if (error instanceof SearchProfilesApiError) {
    if (error.status === 403) return "searchProfiles.searchConsentRequired";
    if (error.status === 404) return "cv.atsNoDurableParent";
    if (error.status === 400 || error.status === 422) return "cv.atsProfileValidation";
    if (error.status === 409 || error.code?.toLowerCase().includes("capacity")) {
      return "cv.errorTooManyAtsProfiles";
    }
  }

  return "cv.errorAtsProfileSave";
}
