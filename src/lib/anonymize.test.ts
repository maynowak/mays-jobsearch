import { describe, expect, it } from "vitest";
import { anonymizeText } from "./anonymize";

describe("anonymizeText", () => {
  it("preserves capitalized job roles and skills", () => {
    const text = "React Developer with Software Engineer experience";

    expect(anonymizeText(text)).toBe(text);
  });

  it("still anonymizes ordinary two-word names", () => {
    expect(anonymizeText("Name: Max Mustermann worked as a React Developer.")).toBe(
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

  it("masks the first-line name at repeated headers and explicit author context", () => {
    const result = anonymizeText(
      "May Nowak\nSenior Software Architect\n\nMAY NOWAK · PROFESSIONAL CV\n" +
        "under the author name Maymilly Nowak. Professional Training."
    );
    expect(result).toBe(
      "[NAME]\nSenior Software Architect\n\n[NAME] · PROFESSIONAL CV\n" +
        "under the author name [NAME]. Professional Training."
    );
  });

  it("uses an all-caps header name to mask the following mixed-case repeat", () => {
    expect(
      anonymizeText("MAY NOWAK · PROFESSIONAL CV 1\nMay Nowak\nSenior Software Architect")
    ).toBe("[NAME] · PROFESSIONAL CV 1\n[NAME]\nSenior Software Architect");
  });

  it("does not mask the modal or month by itself", () => {
    expect(anonymizeText("May apply in May 2026.")) .toBe("May apply in May 2026.");
  });

  it("masks PDF-spaced email variants as complete addresses", () => {
    const result = anonymizeText(
      "anna.beispiel@example.com; anna.beispiel @example.com; " +
        "anna.beispiel@ example.com; anna+jobs@mail.example.com; " +
        "anna.beispiel @ example.com"
    );
    expect(result).not.toMatch(/anna\.beispiel|@example|@mail/);
    expect(result.match(/\[E-MAIL\]/g)).toHaveLength(5);
  });

  it("masks synthetic German street addresses across PDF line breaks", () => {
    const result = anonymizeText(
      "Beispielstraße 12b, 12345 Musterstadt\nBeispielstr. 12 B\n12345 Musterstadt"
    );
    expect(result).not.toContain("Beispielstraße");
    expect(result).not.toContain("Beispielstr.");
    expect(result).not.toContain("12345 Musterstadt");
    expect(result.match(/\[ADRESSE\]/g)).toHaveLength(2);
  });

  it("preserves professional date ranges and technical qualifications", () => {
    const result = anonymizeText(
      "2023–2025 Senior Software Architect. 10/2019–07/2020 AWS Cloud Practitioner. " +
        "Full-Stack Developer, Event-Driven Architecture, Professional Training, " +
        "Language Skills, Information Systems, Data Warehouse."
    );
    expect(result).toContain("2023–2025");
    expect(result).toContain("10/2019–07/2020");
    expect(result).toContain("Senior Software Architect");
    expect(result).toContain("AWS Cloud Practitioner");
    expect(result).toContain("Full-Stack Developer");
    expect(result).toContain("Event-Driven Architecture");
    expect(result).not.toContain("[TELEFON]");
  });
});
