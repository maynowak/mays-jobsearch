import DOMPurify from "dompurify";

let decoder: HTMLTextAreaElement | null = null;

function decodeHtmlEntitiesOnce(html: string): string {
  if (!decoder) decoder = document.createElement("textarea");
  decoder.innerHTML = html;
  return decoder.value;
}

export function decodeHtmlEntities(html: string): string {
  if (!html) return "";
  let current = html;
  let iterations = 0;
  while (iterations < 4) {
    const next = decodeHtmlEntitiesOnce(current);
    if (next === current) break;
    current = next;
    iterations += 1;
  }
  return current;
}

function escapeHtmlText(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert plain-text descriptions (for example BA detail text) into safe
 * semantic HTML. Existing HTML descriptions are left untouched by
 * prepareHtmlForRender(), so this only runs for actual plain text.
 */
export function plainTextToHtml(value: string): string {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(`<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = /^[-*•–]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(escapeHtmlText(bullet[1]));
      continue;
    }
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      list.push(escapeHtmlText(numbered[1]));
      continue;
    }
    flushList();
    paragraph.push(escapeHtmlText(line));
  }

  flushParagraph();
  flushList();
  return blocks.join("");
}

function containsHtmlMarkup(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "a",
      "strong",
      "b",
      "em",
      "i",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "blockquote",
      "pre",
      "code",
      "div",
      "span",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ALLOW_DATA_ATTR: false,
  });
}

export function prepareHtmlForRender(html: string | undefined): string {
  if (!html) return "";
  const decoded = decodeHtmlEntities(html);
  return sanitizeHtml(containsHtmlMarkup(decoded) ? decoded : plainTextToHtml(decoded));
}

export function renderSanitizedHtml(
  html: string | undefined,
  lang?: string
): React.ReactElement<{ className: string; lang?: string; translate?: string; dangerouslySetInnerHTML: { __html: string } }> | null {
  if (!html) return null;
  const sanitized = prepareHtmlForRender(html);
  return (
    <div
      className="html-content"
      lang={lang || undefined}
      translate={lang === "en" ? "yes" : undefined}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}