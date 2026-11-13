import { describe, expect, it } from "vitest";
import {
  DURABLE_CV_PREFIX,
  durableCvId,
  durableServerProfileId,
  isDurableConsentReady,
  isDurableCvId,
} from "./durableProfileRef";

describe("durable CV profile reference", () => {
  it("keeps local and server identity distinct", () => {
    const serverId = "cvp-12345678";
    const localId = durableCvId(serverId);
    expect(localId).toBe(`${DURABLE_CV_PREFIX}${serverId}`);
    expect(localId).not.toBe(serverId);
    expect(isDurableCvId(localId)).toBe(true);
    expect(isDurableCvId("cvb-local")).toBe(false);
    expect(durableServerProfileId(localId)).toBe(serverId);
    expect(durableServerProfileId("cvb-local")).toBeNull();
  });

  it("opens writes only for granted consent under an approved notice", () => {
    expect(isDurableConsentReady(null)).toBe(false);
    expect(isDurableConsentReady({ consent: null, noticeApproved: false })).toBe(false);
    expect(isDurableConsentReady({
      consent: { status: "GRANTED" }, noticeApproved: false, noticeState: "DRAFT",
    })).toBe(false);
    expect(isDurableConsentReady({
      consent: { status: "GRANTED" }, noticeApproved: true, noticeState: "APPROVED",
    })).toBe(true);
    expect(isDurableConsentReady({
      consent: { status: "WITHDRAWN" }, noticeApproved: true, noticeState: "APPROVED",
    })).toBe(false);
  });
});
