// @vitest-environment node
import { describe, expect, it } from "vitest";
import { budgetMonth, previousBudgetMonth } from "../../api/_lib/usage.mjs";

describe("JM-COOKIELESS-QUOTA-02A-CLOSEOUT-02: UTC month keys", () => {
  it("uses UTC for the current month", () => {
    expect(budgetMonth(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12");
    expect(budgetMonth(new Date("2027-01-01T00:30:00Z"))).toBe("2027-01");
    expect(budgetMonth(new Date("2026-03-01T00:00:00Z"))).toBe("2026-03");
  });

  it("handles December to January", () => {
    expect(previousBudgetMonth(new Date("2027-01-01T00:30:00Z"))).toBe("2026-12");
    expect(previousBudgetMonth(new Date("2027-01-31T23:59:59Z"))).toBe("2026-12");
  });

  it("does not depend on local timezone formatting", () => {
    const instant = new Date("2027-01-01T00:30:00Z");
    // The same instant must produce the same UTC month regardless of how the
    // process TZ is configured; UTC getters are timezone-independent.
    expect(budgetMonth(instant)).toBe("2027-01");
    expect(instant.getUTCMonth()).toBe(0);
  });

  it("rolls back across a year boundary", () => {
    expect(previousBudgetMonth(new Date("2026-01-15T12:00:00Z"))).toBe("2025-12");
  });
});
