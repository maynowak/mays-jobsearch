/**
 * Dependency-free helpers that turn untrusted HTML into readable text.
 *
 * SECURITY CONTRACT
 * This module is *not* a sanitizer and must never be used as an HTML safety
 * boundary. Its output is only consumed in text contexts (React text nodes,
 * AI prompts, plain-text previews) or it is sanitized afterwards with
 * DOMPurify. It exists because regex-based "HTML filtering" is not a reliable
 * way to reason about tags (see CodeQL js/bad-tag-filter), so tag handling is
 * done with a small state-machine scanner instead.
 */

const NAMED_ENTITIES = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  AMP: "&",
  LT: "<",
  GT: ">",
  QUOT: '"',
  COPY: "\u00a9",
  REG: "\u00ae",
  nbsp: "\u00a0",
  thinsp: "\u2009",
  ensp: "\u2002",
  emsp: "\u2003",
  shy: "\u00ad",
  hellip: "\u2026",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201a",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bdquo: "\u201e",
  laquo: "\u00ab",
  raquo: "\u00bb",
  bull: "\u2022",
  middot: "\u00b7",
  dagger: "\u2020",
  Dagger: "\u2021",
  permil: "\u2030",
  euro: "\u20ac",
  pound: "\u00a3",
  yen: "\u00a5",
  cent: "\u00a2",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  deg: "\u00b0",
  plusmn: "\u00b1",
  times: "\u00d7",
  divide: "\u00f7",
  frac12: "\u00bd",
  frac14: "\u00bc",
  frac34: "\u00be",
  sup2: "\u00b2",
  sup3: "\u00b3",
  micro: "\u00b5",
  para: "\u00b6",
  sect: "\u00a7",
  szlig: "\u00df",
  auml: "\u00e4",
  ouml: "\u00f6",
  uuml: "\u00fc",
  Auml: "\u00c4",
  Ouml: "\u00d6",
  Uuml: "\u00dc",
  eacute: "\u00e9",
  egrave: "\u00e8",
  aacute: "\u00e1",
  agrave: "\u00e0",
  oacute: "\u00f3",
  iacute: "\u00ed",
  uacute: "\u00fa",
  ntilde: "\u00f1",
  ccedil: "\u00e7",
});

/** Elements whose entire content is not readable text. */
const RAW_TEXT_ELEMENTS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "svg",
  "math",
  "textarea",
  "title",
  "head",
]);

/** Elements that never have content or an end tag. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Elements that visually start a new block. */
const BLOCK_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const ENTITY_PATTERN = /&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,31}));/g;

/**
 * Legacy named references that browsers also decode without a terminating
 * semicolon in text ("Tom &amp Jerry", "&nbsp text"). Kept to the safe core
 * set and not applied before "-"/"=" or word characters so that URL query
 * strings such as "?a=1&copy=2" stay intact.
 */
const LEGACY_ENTITY_PATTERN = /&(amp|AMP|lt|LT|gt|GT|quot|QUOT|nbsp|copy|COPY|reg|REG)(?!;)(?![\w=])/g;

function decodeEntityMatch(match, decimal, hex, name) {
  if (name) return NAMED_ENTITIES[name] ?? match;
  const codePoint = decimal ? Number.parseInt(decimal, 10) : Number.parseInt(hex, 16);
  if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return match;
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return match;
  return String.fromCodePoint(codePoint);
}

/**
 * Decodes named and numeric HTML entities. A small number of rounds matches
 * the previous behaviour for double- and triple-encoded descriptions while
 * staying bounded.
 */
export function decodeHtmlEntities(value) {
  let text = String(value ?? "");
  for (let round = 0; round < 4; round += 1) {
    const next = text
      .replace(ENTITY_PATTERN, decodeEntityMatch)
      .replace(LEGACY_ENTITY_PATTERN, (match, name) => NAMED_ENTITIES[name] ?? match);
    if (next === text) break;
    text = next;
  }
  return text;
}

function findTagEnd(input, start) {
  let quote = "";
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index;
  }
  return -1;
}

function parseTag(raw) {
  // HTML start/end tags have the name directly after "<" or "</". Keeping
  // this strict avoids treating ordinary comparison text ("a < b > c") as
  // markup.
  let index = 0;
  let closing = false;
  if (raw[index] === "/") {
    closing = true;
    index += 1;
  }
  const nameStart = index;
  while (index < raw.length && /[A-Za-z0-9:-]/.test(raw[index])) index += 1;
  const name = raw.slice(nameStart, index).toLowerCase();
  if (!/^[a-z][a-z0-9:-]*$/.test(name)) return null;
  // HTML parsers ignore a trailing "/" on non-void elements, so "<script/>"
  // still opens a raw-text element. Only void elements are self-closing.
  const selfClosing = VOID_ELEMENTS.has(name);
  return { name, closing, selfClosing };
}

function isClosingTagAt(input, index, name) {
  if (input[index] !== "<" || input[index + 1] !== "/") return false;
  for (let offset = 0; offset < name.length; offset += 1) {
    const char = input[index + 2 + offset];
    if (char === undefined || char.toLowerCase() !== name[offset]) return false;
  }
  const after = input[index + 2 + name.length];
  return after === undefined || after === ">" || after === "/" || /\s/.test(after);
}

function findRawTextEnd(input, from, name) {
  // Case-insensitive scan without lowercasing the whole input per candidate:
  // keeps this linear for adversarial "</scriptx</scriptx…" payloads and
  // avoids offset drift from characters whose lowercase form is longer.
  let index = input.indexOf("</", from);
  while (index !== -1) {
    if (isClosingTagAt(input, index, name)) {
      const end = findTagEnd(input, index + 2);
      return end === -1 ? input.length : end + 1;
    }
    index = input.indexOf("</", index + 2);
  }
  return input.length;
}

/**
 * Extracts readable text from untrusted HTML.
 *
 * @param {string | null | undefined} value
 * @param {{ blockNewlines?: boolean, brNewlines?: boolean }} [options]
 * @returns {string}
 */
export function htmlToText(value, options = {}) {
  const blockNewlines = options.blockNewlines ?? true;
  const brNewlines = options.brNewlines ?? true;
  const input = String(value ?? "");
  let output = "";
  let index = 0;

  while (index < input.length) {
    const tagStart = input.indexOf("<", index);
    if (tagStart === -1) {
      output += input.slice(index);
      break;
    }
    output += input.slice(index, tagStart);
    index = tagStart;

    if (input.startsWith("<!--", index)) {
      const commentEnd = input.indexOf("-->", index + 4);
      index = commentEnd === -1 ? input.length : commentEnd + 3;
      output += " ";
      continue;
    }
    if (input.startsWith("<!", index) || input.startsWith("<?", index)) {
      const declarationEnd = findTagEnd(input, index + 2);
      index = declarationEnd === -1 ? input.length : declarationEnd + 1;
      output += " ";
      continue;
    }

    const tagEnd = findTagEnd(input, index + 1);
    if (tagEnd === -1) {
      output += input.slice(index);
      break;
    }
    const tag = parseTag(input.slice(index + 1, tagEnd));
    if (!tag) {
      // Not a tag (for example "2 < 3"): keep the character as text.
      output += "<";
      index += 1;
      continue;
    }
    index = tagEnd + 1;

    if (!tag.closing && !tag.selfClosing && !VOID_ELEMENTS.has(tag.name) && RAW_TEXT_ELEMENTS.has(tag.name)) {
      index = findRawTextEnd(input, index, tag.name);
      output += " ";
      continue;
    }
    if (tag.name === "br") {
      output += brNewlines ? "\n" : " ";
      continue;
    }
    if (blockNewlines && BLOCK_ELEMENTS.has(tag.name)) {
      output += "\n";
      continue;
    }
    output += " ";
  }

  return output;
}
