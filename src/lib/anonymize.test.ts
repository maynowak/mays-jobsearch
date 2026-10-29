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
});
