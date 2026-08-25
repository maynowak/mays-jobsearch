import { describe, expect, it } from "vitest";
import { descriptionPreview } from "./jobMeta";

describe("jobMeta - descriptionPreview HTML entity decoding", () => {
  it("decodes common HTML entities in description", () => {
    const html = "<p>About Us&nbsp;Company's \"mission\" & values <3 >2</p>";
    const result = descriptionPreview(html, 200, true);
    expect(result).toBe("About Us Company's \"mission\" & values <3 >2");
  });

  it("decodes numeric entities", () => {
    const html = "<div>Price: &#x24;100&#x2F;hr</div>";
    const result = descriptionPreview(html, 200, true);
    expect(result).toBe("Price: $100/hr");
  });

  it("strips HTML tags", () => {
    const html = "<div class='content-intro'><p><strong>About Us</strong></p><p>We are hiring.</p></div>";
    const result = descriptionPreview(html, 200, true);
    expect(result).toBe("About Us We are hiring.");
  });

  it("handles mixed content with entities and strips tags", () => {
    const html = "<p>Title&nbsp;" + "'Quote'" + "Double<tag></p>";
    const result = descriptionPreview(html, 200, true);
    // <tag> is stripped as it looks like an HTML tag
    expect(result).toBe("Title 'Quote'Double");
  });

  it("truncates correctly after decoding when not expanded", () => {
    const html = "<p>Short text with&nbsp;entity</p>";
    const result = descriptionPreview(html, 10, false);
    // "Short text" = 10 chars, then adds "…"
    expect(result).toBe("Short text…");
  });

  it("returns full text when expanded", () => {
    const html = "<p>Short text with&nbsp;entity</p>";
    const result = descriptionPreview(html, 10, true);
    expect(result).toBe("Short text with entity");
  });

  it("returns null for empty or whitespace-only HTML", () => {
    expect(descriptionPreview("", 100, true)).toBeNull();
    expect(descriptionPreview("   ", 100, true)).toBeNull();
    expect(descriptionPreview("<div></div>", 100, true)).toBeNull();
    expect(descriptionPreview("<p>&nbsp;</p>", 100, true)).toBeNull();
  });
});