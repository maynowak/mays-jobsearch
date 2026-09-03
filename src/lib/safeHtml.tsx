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
  return sanitizeHtml(decoded);
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