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

function renderInlineMarkdown(value: string): string {
  let text = escapeHtmlText(value);
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_match, label: string, url: string) =>
      `<a href="${escapeHtmlText(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  return text;
}

/**
 * Convert plain-text or Markdown descriptions (for example BA detail text)
 * into safe semantic HTML. Existing HTML descriptions are left untouched by
 * prepareHtmlForRender(), so this only runs for actual text.
 */
export function plainTextToHtml(value: string): string {
  let text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  // Some BA descriptions contain Markdown bullet markers without line
  // breaks (e.g. "Vergütungspaket- Attraktive ...- Zugang ..."). Normalize
  // those separators before block parsing. Hyphenated words without a
  // following space remain untouched.
  text = text
    .replace(/(?<=\S)-\s+(?=[A-ZÄÖÜ0-9])/g, "\n- ")
    .replace(/(?<=[.:!?])\s*-\s+(?=[A-ZÄÖÜ0-9])/g, "\n- ")
    .replace(/(?<=\*\*)\s*-\s+(?=[A-ZÄÖÜ0-9])/g, "\n- ");

  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listTag: "ul" | "ol" = "ul";

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(`<${listTag}>${list.map((item) => `<li>${item}</li>`).join("")}</${listTag}>`);
    list = [];
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^[-*•–]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (listTag !== "ul") flushList();
      listTag = "ul";
      list.push(renderInlineMarkdown(bullet[1]));
      continue;
    }
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (listTag !== "ol") flushList();
      listTag = "ol";
      list.push(renderInlineMarkdown(numbered[1]));
      continue;
    }
    flushList();
    paragraph.push(renderInlineMarkdown(line));
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