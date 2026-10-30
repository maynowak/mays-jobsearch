import { describe, expect, it } from "vitest";
import { anonymizeText } from "./anonymize";

describe("anonymizeText", () => {
  it("preserves capitalized job roles and skills", () => {
    const text = "React Developer with Software Engineer experience";

    expect(anonymizeText(text)).toBe(text);
  });

  it("still anonymizes ordinary two-word names", () => {
    expect(anonymizeText("Max Mustermann worked as a React Developer.")).toBe(
      "[NAME] worked as a React Developer."
    );
  });

  it("anonymizes titled names without masking the surrounding text", () => {
    expect(anonymizeText("Dr. Jane Doe, Software Engineer")).toBe(
      "[NAME], Software Engineer"
    );
  });

  it("anonymizes all-caps names in CV headers", () => {
    expect(anonymizeText("MAY NOWAK · PROFESSIONAL CV\nArchitect")) .toBe(
      "[NAME] · PROFESSIONAL CV\nArchitect"
    );
  });

  it("masks apostrophe names without masking the product name", () => {
    expect(anonymizeText("May's CV\nO'Connor and O’Connor\nMay's Job Matcher\nMay’s Job Matcher")) .toBe(
      "[NAME] CV\n[NAME] and [NAME]\nMay's Job Matcher\nMay’s Job Matcher"
    );
  });

  it("does not mask the modal or month by itself", () => {
    expect(anonymizeText("May apply in May 2026.")) .toBe("May apply in May 2026.");
  });
});
