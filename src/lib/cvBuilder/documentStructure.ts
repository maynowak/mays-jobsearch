export interface PdfSourceLine {
  text: string;
  order: number;
  fontSize?: number;
}

export interface PdfSourcePage {
  page: number;
  text: string;
  lines: PdfSourceLine[];
}

export interface PdfTextBlock {
  page: number;
  order: number;
  text: string;
  lines: string[];
  fontSize?: number;
}

export interface PdfDocumentPage {
  page: number;
  text: string;
  blocks: PdfTextBlock[];
}

export interface PdfDocumentStructure {
  pageCount: number;
  text: string;
  pages: PdfDocumentPage[];
  blocks: PdfTextBlock[];
}

export function buildPdfDocument(pages: PdfSourcePage[]): PdfDocumentStructure {
  let order = 0;
  const documentPages: PdfDocumentPage[] = pages.map((page) => {
    const sourceLines: PdfSourceLine[] = page.lines.length
      ? page.lines
      : page.text
          .split("\n")
          .map((text, index) => ({ text, order: index }))
          .filter((line) => line.text.trim());
    const blocks: PdfTextBlock[] = sourceLines
      .filter((line) => line.text.trim())
      .map((line) => {
        const text = line.text.trim();
        return {
          page: page.page,
          order: order++,
          text,
          lines: [text],
          ...(Number.isFinite(line.fontSize) ? { fontSize: line.fontSize } : {}),
        };
      });
    return {
      page: page.page,
      text: page.text.trim(),
      blocks,
    };
  });
  return {
    pageCount: documentPages.length,
    text: documentPages.map((page) => page.text).join("\n\n").trim(),
    pages: documentPages,
    blocks: documentPages.flatMap((page) => page.blocks),
  };
}

export type DocumentCategory =
  | "personal"
  | "profile"
  | "target-roles"
  | "skills"
  | "projects"
  | "experience"
  | "education"
  | "certificates"
  | "languages"
  | "links"
  | "document-notes"
  | "training"
  | "mixed"
  | "misc"
  | "unknown";

export interface DocumentHeadingMatch {
  category: DocumentCategory;
  categories: DocumentCategory[];
  continued: boolean;
  uncertain: boolean;
}

export type IgnoredDocumentReason =
  | "page-number"
  | "page-header"
  | "page-footer";

export interface IgnoredDocumentBlock {
  block: PdfTextBlock;
  reason: IgnoredDocumentReason;
}

export interface NormalizedDocumentLine {
  block: PdfTextBlock;
  kind: "heading" | "content";
  heading?: DocumentHeadingMatch;
}

export interface NormalizedPdfDocument {
  source: PdfDocumentStructure;
  lines: NormalizedDocumentLine[];
  ignored: IgnoredDocumentBlock[];
}

const CONTINUED_SUFFIX = /\s*(?:[–—\-]\s*)?(?:fortsetzung|continued|cont(?:inued)?\.?)\s*$/i;
const PAGE_NUMBER_LINE = /^(?:seite|page|p\.?)\s*\d+(?:\s*(?:von|of|\/)\s*\d+)?$/i;
const PAGE_NUMBER_SUFFIX = /\b(?:seite|page)\s+\d+(?:\s*(?:von|of|\/)\s*\d+)?\s*$/i;
const BARE_PAGE_NUMBER = /^\d{1,3}(?:\s*\/\s*\d{1,3})?$/;

function cleanHeadingText(text: string): string {
  return text
    .replace(/^[-•*–—]\s*/, "")
    .replace(/[:：]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingSignature(text: string): string {
  return cleanHeadingText(text)
    .toLocaleLowerCase("de")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPurePageNumberLine(text: string): boolean {
  const line = cleanHeadingText(text);
  return PAGE_NUMBER_LINE.test(line) || BARE_PAGE_NUMBER.test(line);
}

export function isPageNumberLine(text: string): boolean {
  return isPurePageNumberLine(text) || PAGE_NUMBER_SUFFIX.test(cleanHeadingText(text));
}

function categoryForPart(part: string): DocumentCategory | null {
  const value = part.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
  if (!value) return null;
  if (/\b(?:zielposition|zielrollen|zielrolle|target role|target position)\b/.test(value)) return "target-roles";
  if (/\b(?:profil|profile|summary|zusammenfassung|über mich|about me)\b/.test(value)) return "profile";
  if (/\b(?:aws\s*qa\s*lab|qa\s*lab|labor|lab|training|praxisorientierte|cloud-qualifizierung|qualifizierung)\b/.test(value)) return "training";
  if (/\b(?:kernkompetenz|kompetenz|fähigkeit|faehigkeit|kenntnis|skill|competenc|suchbegriff)\b/.test(value)) return "skills";
  if (/\b(?:projekt|project|architektur)\b/.test(value)) return "projects";
  if (/\b(?:weiterbildung|zertifikat|zertifizierung|certification|certificate|fortbildung)\b/.test(value)) return "certificates";
  if (/\b(?:beruflicher werdegang|berufserfahrung|arbeitserfahrung|werdegang|professional experience|work experience|employment history|timeline)\b/.test(value)) return "experience";
  if (/\b(?:ausbildung|education|qualifikation|qualification)\b/.test(value)) return "education";
  if (/\b(?:sprache|sprachen|language|languages)\b/.test(value)) return "languages";
  if (/\b(?:link|links|website|websites|portfolio|online profile)\b/.test(value)) return "links";
  if (/\b(?:hinweis|hinweise|veröffentlichung|veroeffentlichung|publication|notes?)\b/.test(value)) return "document-notes";
  if (/\b(?:sonstiges|weitere angaben|additional information|misc)\b/.test(value)) return "misc";
  return null;
}

function headingParts(text: string): string[] {
  return text
    .split(/\s*(?:&|\+|,|\/|\bund\b|\band\b)\s*/i)
    .flatMap((part) => part.split(/\s+[–—]\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
}

export function matchDocumentHeading(text: string): DocumentHeadingMatch | null {
  let value = cleanHeadingText(text);
  if (!value || value.length > 110) return null;
  const continued = CONTINUED_SUFFIX.test(value);
  if (continued) value = value.replace(CONTINUED_SUFFIX, "").trim();
  if (!value) return null;
  const parts = headingParts(value);
  const categories = [...new Set(parts.map(categoryForPart).filter((part): part is DocumentCategory => Boolean(part)))];
  if (!categories.length) return null;
  const category = categories.length > 1 ? "mixed" : categories[0];
  return {
    category,
    categories,
    continued,
    uncertain: category === "mixed" || category === "training" || category === "unknown",
  };
}

function uppercaseHeadingLike(text: string): boolean {
  const value = cleanHeadingText(text);
  const letters = [...value].filter((character) => /\p{L}/u.test(character));
  if (letters.length < 3) return false;
  const upperRatio = letters.filter((character) => character === character.toLocaleUpperCase("de")).length / letters.length;
  return upperRatio >= 0.78;
}

export function isLikelyUnknownHeading(text: string): boolean {
  const value = cleanHeadingText(text);
  if (!value || value.length > 100) return false;
  if (!uppercaseHeadingLike(value)) return false;
  if (/^[-•*–—]/.test(text)) return false;
  if (/[.!?]$/.test(value)) return false;
  if (/@|https?:\/\//i.test(value)) return false;
  if (/\b(?:gmbh|ag|inc|ltd|llc|corp|kg|ug|ohg|gbr)\b/i.test(value)) return false;
  if (/^(?:seite|page)\s+\d+/i.test(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return (
    value.length >= 20 ||
    /[&,–—/]/.test(value) ||
    /\b(?:schwerpunkt|station|stationen|übersicht|uebersicht|status|profil|kompetenz|qualifikation|hinweis|projekt|erfahrung|ausbildung|sprache|zertifikat|weiterbildung)\b/i.test(value)
  );
}

interface EdgeLine {
  block: PdfTextBlock;
  edge: "top" | "bottom";
  signature: string;
}

function edgeLines(source: PdfDocumentStructure): EdgeLine[] {
  const result: EdgeLine[] = [];
  for (const page of source.pages) {
    const blocks = page.blocks.filter((block) => block.text.trim());
    for (const block of blocks.slice(0, 2)) {
      result.push({ block, edge: "top", signature: headingSignature(block.text) });
    }
    for (const block of blocks.slice(-2)) {
      result.push({ block, edge: "bottom", signature: headingSignature(block.text) });
    }
  }
  return result;
}

export function normalizePdfDocument(source: PdfDocumentStructure): NormalizedPdfDocument {
  const edges = edgeLines(source);
  const signatures = new Map<string, Set<number>>();
  for (const edge of edges) {
    const pages = signatures.get(edge.signature) ?? new Set<number>();
    pages.add(edge.block.page);
    signatures.set(edge.signature, pages);
  }
  const repeatedSignatures = new Set(
    source.pageCount >= 2
      ? [...signatures.entries()]
          .filter(([, pages]) => pages.size >= 2)
          .map(([signature]) => signature)
      : []
  );
  const ignored: IgnoredDocumentBlock[] = [];
  const lines: NormalizedDocumentLine[] = [];
  for (const block of source.blocks) {
    const text = block.text.trim();
    if (!text) continue;
    if (isPurePageNumberLine(text)) {
      ignored.push({ block, reason: "page-number" });
      continue;
    }
    if (PAGE_NUMBER_SUFFIX.test(text)) {
      ignored.push({ block, reason: "page-header" });
      continue;
    }
    const knownHeading = matchDocumentHeading(text);
    const unknownHeading = !knownHeading && isLikelyUnknownHeading(text);
    const edge = edges.find((candidate) => candidate.block.order === block.order);
    if (edge && repeatedSignatures.has(edge.signature) && !knownHeading) {
      ignored.push({
        block,
        reason: edge.edge === "top" ? "page-header" : "page-footer",
      });
      continue;
    }
    lines.push({
      block,
      kind: knownHeading || unknownHeading ? "heading" : "content",
      ...(knownHeading ? { heading: knownHeading } : {}),
    });
  }
  return { source, lines, ignored };
}
