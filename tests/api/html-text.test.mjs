// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, htmlToText } from "../../api/_lib/htmlText.mjs";

describe("htmlToText - tag scanner", () => {
  it("removes script content for all end-tag spellings", () => {
    const inputs = [
      "<script>alert(1)</script>visible",
      "<script>alert(1)</script >visible",
      "<script>alert(1)</script\t>visible",
      "<script>alert(1)</SCRIPT\n>visible",
      "<script>alert(1)</script data-x>visible",
    ];
    for (const input of inputs) {
      const text = htmlToText(input);
      expect(text).not.toContain("alert");
      expect(text).toContain("visible");
    }
  });

  it("removes raw-text containers and their payloads", () => {
    const text = htmlToText(
      "<style>body{display:none}</style><noscript>enable js</noscript><template><p>tpl</p></template>" +
        "<iframe src=\"javascript:alert(1)\"></iframe><object data=x></object><embed src=x>" +
        "<svg><script>alert(1)</script><text>icon</text></svg><math>1</math>safe"
    );
    for (const leaked of ["display:none", "enable js", "tpl", "javascript:", "alert", "icon"]) {
      expect(text).not.toContain(leaked);
    }
    expect(text).toContain("safe");
  });

  it("removes XHTML-style self-closing script/textarea bodies", () => {
    for (const input of [
      "<script/>alert(1)</script>visible",
      "<script />alert(1)</script >visible",
      "<textarea/>ALERT_TA</textarea>visible",
      "<style/>.x{content:'ALERT_CSS'}</style>visible",
    ]) {
      const text = htmlToText(input);
      expect(text).not.toContain("alert");
      expect(text).not.toContain("ALERT_TA");
      expect(text).not.toContain("ALERT_CSS");
      expect(text).toContain("visible");
    }
  });

  it("removes raw-text payloads without quadratic rescans or offset drift", () => {
    const adversarial = `<script>${"</scriptx".repeat(4000)}</script>tail`;
    const text = htmlToText(adversarial);
    expect(text).toContain("tail");
    expect(text).not.toContain("scriptx");

    const unicodePrefix = `<script>${"İ".repeat(200)}</script>ok`;
    expect(htmlToText(unicodePrefix)).toContain("ok");

    // Long non-tag "<" runs are preserved and scanned once.
    const comparisons = `${"< ".repeat(5000)}>`;
    expect(htmlToText(comparisons)).toBe(comparisons);
  });

  it("treats self-closing svg/math as closed instead of swallowing the text", () => {
    expect(htmlToText("<svg/>after")).toContain("after");
    expect(htmlToText("<math/>after")).toContain("after");
    expect(htmlToText("<svg><text>icon</text></svg>after")).not.toContain("icon");
    expect(htmlToText("<svg><text>icon</text></svg>after")).toContain("after");
  });

  it("drops an unterminated raw-text block instead of leaking its payload", () => {
    const text = htmlToText("<p>before</p><script>alert('never closed')<p>hidden");
    expect(text).toContain("before");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("hidden");
  });

  it("strips event handlers and attribute payloads with tags", () => {
    const text = htmlToText('<img src=x onerror="alert(1)"><p onclick="alert(2)">Text</p>');
    expect(text).not.toContain("onerror");
    expect(text).not.toContain("onclick");
    expect(text).toContain("Text");
  });

  it("handles quoted greater-than signs inside attributes", () => {
    const text = htmlToText('<div title="a > b">content</div><p>next</p>');
    expect(text).not.toContain("title");
    expect(text).toContain("content");
    expect(text).toContain("next");
  });

  it("removes comments and declarations", () => {
    const text = htmlToText("<!-- <script>alert(1)</script> -->a<!DOCTYPE html><?xml version=\"1.0\"?>b");
    expect(text).not.toContain("alert");
    expect(text).toContain("a");
    expect(text).toContain("b");
  });

  it("keeps comparison text that only looks like markup", () => {
    expect(htmlToText("a < b > c")).toBe("a < b > c");
    expect(htmlToText("2<3 and 4>1")).toBe("2<3 and 4>1");
    expect(htmlToText("< b >x")).toBe("< b >x");
    expect(htmlToText("</ p>y")).toBe("</ p>y");
  });

  it("converts block boundaries and <br> to newlines when requested", () => {
    expect(htmlToText("<p>one</p><p>two</p>", { blockNewlines: true })).toContain("one\n");
    expect(htmlToText("a<br>b", { brNewlines: true })).toBe("a\nb");
    expect(htmlToText("a<br>b", { brNewlines: false })).toBe("a b");
    expect(htmlToText("<p>one</p><p>two</p>", { blockNewlines: false })).toBe(" one  two ");
  });

  it("does not execute or preserve dangerous URL schemes as markup", () => {
    const text = htmlToText('<a href="javascript:alert(1)">click</a>');
    expect(text).toContain("click");
    expect(text).not.toContain("<a");
  });
});

describe("decodeHtmlEntities - named and numeric entities", () => {
  it("decodes named entities", () => {
    expect(decodeHtmlEntities("A&nbsp;B &amp;&lt;&gt;&quot;&apos;")).toBe("A\u00a0B &<>\"'");
    expect(decodeHtmlEntities("Euro &euro; and dash &mdash;")).toBe("Euro \u20ac and dash \u2014");
  });

  it("decodes decimal and hexadecimal entities", () => {
    expect(decodeHtmlEntities("&#x24;100&#x2F;hr")).toBe("$100/hr");
    expect(decodeHtmlEntities("&#65;&#x42;")).toBe("AB");
  });

  it("decodes multiple encoding layers but stays bounded", () => {
    expect(decodeHtmlEntities("&amp;lt;strong&amp;gt;")).toBe("<strong>");
  });

  it("keeps plain ampersands and unknown entities untouched", () => {
    expect(decodeHtmlEntities("AT&T and &unknown; and &bogus;")).toBe("AT&T and &unknown; and &bogus;");
  });

  it("decodes legacy references without semicolon in text but protects URLs", () => {
    expect(decodeHtmlEntities("Tom &amp Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("A&nbsp B")).toBe("A\u00a0 B");
    expect(decodeHtmlEntities("&copy 2024")).toBe("\u00a9 2024");
    expect(decodeHtmlEntities("&AMP; &LT;")).toBe("& <");
    expect(decodeHtmlEntities("?a=1&copy=2&reg=3")).toBe("?a=1&copy=2&reg=3");
  });

  it("rejects invalid numeric code points instead of producing control characters", () => {
    expect(decodeHtmlEntities("&#0;")).toBe("&#0;");
    expect(decodeHtmlEntities("&#xD800;")).toBe("&#xD800;");
    expect(decodeHtmlEntities("&#x110000;")).toBe("&#x110000;");
  });
});
