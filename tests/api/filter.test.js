// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  stripHtml,
  htmlToPlainText,
  detectLanguage,
  employmentMatches,
  applySearchFilters,
} from "../../api/_lib/filter.mjs";

describe("API filter - stripHtml (plain text extraction for descriptionPlain)", () => {
  it("1) Raw HTML strips to plain text", () => {
    const input = "<p><strong>Hello</strong></p>";
    const result = stripHtml(input);
    expect(result).toBe("Hello");
  });

  it("2) Entity-encoded HTML decodes and strips to plain text", () => {
    // Actual entity-encoded HTML: <p><strong>Hello</strong></p>
    const input = "<p><strong>Hello</strong></p>";
    const result = stripHtml(input);
    expect(result).toBe("Hello");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("&");
    expect(result).not.toContain("&");
  });

  it("3) Double-encoded HTML decodes iteratively and strips", () => {
    // Production double-encoded: <div class="content-intro"><h3><strong>Who We Are</strong></h3>
    const input = "<div class=\"content-intro\"><h3><strong>Who We Are</strong></h3>";
    const result = stripHtml(input);
    expect(result).toBe("Who We Are");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("&");
    expect(result).not.toContain("&");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("&");
    expect(result).not.toContain("&");
  });

  it("4) HTML entities inside text decode to readable characters", () => {
    const input = "Salary < 50000 & score > 3 &nbsp; test 'quote' \"double\"";
    const result = stripHtml(input);
    // < 50000 & score > treated as tag and stripped, &nbsp; -> space, & -> &
    // Whitespace collapsed by stripHtml
    expect(result).toBe("Salary 3 test 'quote' \"double\"");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("&");
  });

  it("5) Mathematical comparison characters treated as tags and stripped", () => {
    const input = "Salary < 50000 and score > 3";
    const result = stripHtml(input);
    // < 50000 and > 3 look like tags and get stripped
    // "Salary " before tag remains, "3" after tag remains
    expect(result).toBe("Salary 3");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("6) XSS payloads produce safe plain text (tag content remains as text)", () => {
    const input = '<script>alert(1)</script><img src=x onerror="alert(1)">';
    const result = stripHtml(input);
    // Tag structure removed, but text content inside tags remains
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("onerror");
    expect(result).toContain("alert(1)"); // Text content preserved
    // Note: result is not empty because text content inside tags is preserved
  });

  it("7) Exact production job - descriptionPlain contains NO HTML artifacts", () => {
    const productionDescription = "<p><strong>About Sony Music Entertainment</strong></p>\n<p>At Sony Music Entertainment, we fuel the creative journey. We\u2019ve played a pioneering role in music history, from the first-ever music label to the invention of the flat disc record. We\u2019ve nurtured some of music\u2019s most iconic artists and produced some of the most influential recordings of all time.</p>\n<p>Today, we work in more than 70 countries, supporting a diverse roster of international superstars.</p>\n<div class=\"ICMS_InfoMsg ICMS_InfoMsgError\">...</div>";

    const result = stripHtml(productionDescription);

    // Should contain readable text
    expect(result).toContain("About Sony Music Entertainment");
    expect(result).toContain("fuel the creative journey");
    expect(result).toContain("pioneering role");

    // Should NOT contain any HTML artifacts
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("</p>");
    expect(result).not.toContain("<strong>");
    expect(result).not.toContain("</strong>");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("&");
    expect(result).not.toContain("ICMS_InfoMsg");
    expect(result).not.toContain("div class");
  });

  it("8) Production double-encoded job - Senior Technical Project Manager", () => {
    // Actual production double-encoded string from Arbeitnow API for "Senior Technical Project Manager" at Wundermanthompson
    const productionDescription = "<div class=\"content-intro\"><h3><strong>Who We Are</strong></h3><p>VML is a leading creative company...</p><h3>Senior Project Manager experienced managing technical teams...</h3><ul><li>Release and technical reporting...</li></ul>";
    const result = stripHtml(productionDescription);

    // Should contain readable text
    expect(result).toContain("Who We Are");
    expect(result).toContain("VML is a leading creative company");
    expect(result).toContain("Senior Project Manager");
    expect(result).toContain("Release and technical reporting");

    // Should NOT contain any HTML artifacts or entity strings
    expect(result).not.toContain("<div");
    expect(result).not.toContain("<h3>");
    expect(result).not.toContain("<strong>");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<ul>");
    expect(result).not.toContain("<li>");
    expect(result).not.toContain("content-intro");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("&");
    expect(result).not.toContain("&");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });
});

describe("API filter - detectLanguage (de/en detection for descriptions)", () => {
  it("detects German from a German description", () => {
    const text = "Wir suchen einen Entwickler für unser Team in Berlin. Die Arbeit umfasst die Entwicklung von Anwendungen und die Zusammenarbeit mit den Kollegen bei uns im Haus.";
    expect(detectLanguage(text)).toBe("de");
  });

  it("detects English from an English description", () => {
    const text = "We are looking for a developer to join our team. The role includes building applications and working with colleagues across the company to deliver results.";
    expect(detectLanguage(text)).toBe("en");
  });

  it("detects language ignoring surrounding HTML markup", () => {
    const text = "<p><strong>We are looking for a senior engineer to join our team and help with development.</strong></p>";
    expect(detectLanguage(text)).toBe("en");
  });

  it("returns undefined for empty input", () => {
    expect(detectLanguage("")).toBeUndefined();
    expect(detectLanguage(undefined)).toBeUndefined();
  });

  it("returns undefined for short/ambiguous text", () => {
    expect(detectLanguage("lorem ipsum dolor")).toBeUndefined();
  });
});

describe("API filter - employmentMatches (scope vs contract duration separation)", () => {
  it("1) Arbeitnow Full Time + full_time -> match", () => {
    const job = { title: "X", tags: [], jobTypes: ["Full Time"] };
    expect(employmentMatches(job, ["full_time"])).toBe(true);
  });

  it("2) Arbeitnow Part Time + full_time -> no match", () => {
    const job = { title: "X", tags: [], jobTypes: ["Part time"] };
    expect(employmentMatches(job, ["full_time"])).toBe(false);
    expect(employmentMatches(job, ["part_time"])).toBe(true);
  });

  it("3) AA UNBEFRISTET + jobTypes null + full_time -> NOT treated as non-full (passes)", () => {
    const job = { title: "X", tags: [], jobTypes: null, contractType: "UNBEFRISTET" };
    expect(employmentMatches(job, ["full_time"])).toBe(true);
  });

  it("4) AA BEFRISTET + jobTypes null + full_time -> passes (contract duration is not scope)", () => {
    const job = { title: "X", tags: [], jobTypes: null, contractType: "BEFRISTET" };
    expect(employmentMatches(job, ["full_time"])).toBe(true);
  });

  it("5) AA KEINE_ANGABE + jobTypes null -> passes (explicit unspecified behaviour)", () => {
    const job = { title: "X", tags: [], jobTypes: null, contractType: "KEINE_ANGABE" };
    expect(employmentMatches(job, ["full_time"])).toBe(true);
    expect(employmentMatches(job, ["part_time"])).toBe(true);
  });

  it("6) contractType alone never drives employment matching", () => {
    const job = { title: "X", tags: [], jobTypes: null, contractType: "UNBEFRISTET" };
    // part_time filter must also NOT exclude a job whose only signal is a contract duration
    expect(employmentMatches(job, ["part_time"])).toBe(true);
  });
});

describe("API filter - applySearchFilters keeps both sources without employmentType", () => {
  it("returns all jobs unchanged when no employment/workmode filter is present", () => {
    const jobs = [
      { slug: "a", title: "A", source: ["arbeitnow"], jobTypes: ["Full Time"] },
      { slug: "b", title: "B", source: ["arbeitsagentur"], jobTypes: null, contractType: "UNBEFRISTET" },
    ];
    const result = applySearchFilters(jobs, { employmentType: "" });
    expect(result.map((j) => j.slug)).toEqual(["a", "b"]);
  });

  it("with employmentType=full_time keeps arbeitnow full-time AND arbeitsagentur unspecified-scope jobs", () => {
    const jobs = [
      { slug: "a", title: "A", source: ["arbeitnow"], jobTypes: ["Full Time"] },
      { slug: "b", title: "B", source: ["arbeitnow"], jobTypes: ["Part time"] },
      { slug: "c", title: "C", source: ["arbeitsagentur"], jobTypes: null, contractType: "UNBEFRISTET" },
      { slug: "d", title: "D", source: ["arbeitsagentur"], jobTypes: null, contractType: "KEINE_ANGABE" },
    ];
    const result = applySearchFilters(jobs, { employmentType: "full_time" });
    expect(result.map((j) => j.slug)).toEqual(["a", "c", "d"]);
  });
});