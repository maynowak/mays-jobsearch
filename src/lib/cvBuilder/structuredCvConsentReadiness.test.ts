import { describe, expect, it } from "vitest";
import {
  classifyStructuredCvConsent,
  isStructuredCvConsentWritable,
} from "./structuredCvConsentReadiness";

const approved = {
  noticeState: "APPROVED",
  noticeApproved: true,
};

describe("structured CV consent readiness", () => {
  it("distinguishes loading, error and missing", () => {
    expect(classifyStructuredCvConsent({ loading: true })).toBe("loading");
    expect(classifyStructuredCvConsent({ error: "unavailable" })).toBe("error");
    expect(classifyStructuredCvConsent(null)).toBe("missing");
  });

  it("treats DRAFT and missing approval as not writable", () => {
    expect(classifyStructuredCvConsent({
      noticeState: "DRAFT", noticeApproved: true, consent: { status: "GRANTED" },
    })).toBe("draft");
    expect(classifyStructuredCvConsent({
      noticeState: "APPROVED", noticeApproved: false, consent: { status: "GRANTED" },
    })).toBe("draft");
    expect(isStructuredCvConsentWritable({
      noticeState: "DRAFT", noticeApproved: false, consent: { status: "GRANTED" },
    })).toBe(false);
  });

  it("distinguishes granted, withdrawn, not-granted and unknown", () => {
    expect(classifyStructuredCvConsent({
      ...approved, consent: { status: "GRANTED" },
    })).toBe("granted");
    expect(classifyStructuredCvConsent({
      ...approved, consent: { status: "WITHDRAWN" },
    })).toBe("withdrawn");
    expect(classifyStructuredCvConsent({
      ...approved, consent: { status: "NOT_GRANTED" },
    })).toBe("missing");
    expect(classifyStructuredCvConsent({
      ...approved, consent: { status: "SOMETHING_ELSE" },
    })).toBe("unknown");
  });

  it("allows writes only for granted consent under an approved notice", () => {
    expect(isStructuredCvConsentWritable({
      ...approved, consent: { status: "GRANTED" },
    })).toBe(true);
    expect(isStructuredCvConsentWritable({
      ...approved, consent: { status: "WITHDRAWN" },
    })).toBe(false);
  });

  it("supports a future approved notice without changing the classifier", () => {
    expect(classifyStructuredCvConsent({
      noticeState: "ACTIVE", noticeApproved: true, consent: { status: "GRANTED" },
    })).toBe("granted");
  });
});
