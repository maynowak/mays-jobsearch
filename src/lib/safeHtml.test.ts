import { describe, expect, it } from "vitest";
import { prepareHtmlForRender, sanitizeHtml } from "./safeHtml";

describe("safeHtml - sanitizeHtml", () => {
  it("A) keeps safe HTML tags", () => {
    const html = "<p>Hello</p><strong>Text</strong><ul><li>Job</li></ul>";
    const result = sanitizeHtml(html);
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<strong>Text</strong>");
    expect(result).toContain("<ul><li>Job</li></ul>");
  });

  it("C) removes script tags", () => {
    const html = '<script>alert("x")</script><p>Safe</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Safe</p>");
  });

  it("D) removes event handlers", () => {
    const html = '<img src="x" onerror="alert(1)"><p>Safe</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Safe</p>");
  });

  it("E) removes javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">Bad</a><a href="https://example.com">Good</a>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("javascript:");
    expect(result).toContain('href="https://example.com"');
  });

  it("F) keeps allowed links with target/rel", () => {
    const html = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener"');
  });

  it("strips disallowed tags but keeps content", () => {
    const html = "<div><span>Test</span></div>";
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<div>");
    expect(result).not.toContain("<span>");
    expect(result).toContain("Test");
  });

  it("handles nested allowed tags", () => {
    const html = "<ul><li><strong>Item</strong></li></ul>";
    const result = sanitizeHtml(html);
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
    expect(result).toContain("<strong>Item</strong>");
  });
});

describe("safeHtml - prepareHtmlForRender", () => {
  it("sanitizes HTML - removes script tags", () => {
    const input = "<script>alert(1)</script><p>Safe</p>";
    const result = prepareHtmlForRender(input);
    expect(result).not.toContain("<script>");
    expect(result).toContain("<p>Safe</p>");
  });

  it("keeps safe HTML tags", () => {
    const input = "<p>Hello<strong>World</strong></p>";
    const result = prepareHtmlForRender(input);
    expect(result).toContain("<p>Hello<strong>World</strong></p>");
  });

  it("returns empty string for undefined/null/empty", () => {
    expect(prepareHtmlForRender(undefined)).toBe("");
    expect(prepareHtmlForRender(null as any)).toBe("");
    expect(prepareHtmlForRender("")).toBe("");
  });

  it("removes event handlers", () => {
    const input = '<img src="x" onerror="alert(1)"><p>Safe</p>';
    const result = prepareHtmlForRender(input);
    expect(result).not.toContain("onerror");
    expect(result).toContain("<p>Safe</p>");
  });

  it("removes javascript: URLs", () => {
    const input = '<a href="javascript:alert(1)">Bad</a><a href="https://example.com">Good</a>';
    const result = prepareHtmlForRender(input);
    expect(result).not.toContain("javascript:");
    expect(result).toContain('href="https://example.com"');
  });
});