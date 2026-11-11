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

const CONTINUED_SUFFIX = /\s*(?:[–—\-]\s*)?(?:\((?:fortsetzung|continued)\)|fortsetzung|continued|cont\.?)\s*$/i;
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
  if (/\b(?:zielposition\w*|zielrollen|zielrolle|target roles?|target positions?)\b/.test(value)) return "target-roles";
  if (/\b(?:profil\w*|summary|zusammenfassung|über mich|ueber mich|about me)\b/.test(value)) return "profile";
  if (/\b(?:aws\s*qa\s*lab\w*|qa\s*lab\w*|labor\w*|lab\w*|training|praxisorientierte\w*|cloud-qualifizierung|qualifizierung)\b/.test(value)) return "training";
  if (/\b(?:kernkompetenz\w*|kompetenz\w*|fähigkeit\w*|faehigkeit\w*|kenntnis\w*|skill\w*|competenc\w*|suchbegriff\w*)\b/.test(value)) return "skills";
  if (/\b(?:projekt\w*|project\w*|architektur\w*)\b/.test(value)) return "projects";
  if (/\b(?:weiterbildung\w*|zertifikat\w*|zertifizierung\w*|certification\w*|certificate\w*|fortbildung\w*|further education|continuing education|courses?)\b/.test(value)) return "certificates";
  if (/\b(?:beruflicher werdegang|berufserfahrung\w*|arbeitserfahrung\w*|werdegang|professional experience|work experience|employment history|timeline)\b/.test(value)) return "experience";
  if (/\b(?:ausbildung\w*|education|qualifikation\w*|qualification\w*)\b/.test(value)) return "education";
  if (/\b(?:sprache\w*|language\w*)\b/.test(value)) return "languages";
  if (/\b(?:link\w*|website\w*|portfolio|online profile\w*)\b/.test(value)) return "links";
  if (/\b(?:hinweis\w*|veröffentlichung\w*|veroeffentlichung\w*|publication\w*|notes?)\b/.test(value)) return "document-notes";
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

const EXACT_HEADING_ALIASES = new Set([
  "personal", "personal details", "personal data", "contact", "kontakt", "persönliche daten", "persoenliche daten",
  "profil", "profile", "professional summary", "summary", "berufliches profil", "über mich", "ueber mich", "about me",
  "zielpositionen", "zielrollen", "target roles", "target positions",
  "kernkompetenzen", "kompetenzen", "fähigkeiten", "faehigkeiten", "kenntnisse", "technische kenntnisse",
  "skills", "technical skills", "core skills", "core competencies", "competencies",
  "projekte", "project", "projects", "project experience", "project work", "projektarbeit",
  "selected current projects", "selected projects", "current projects", "key projects", "relevant projects",
  "berufserfahrung", "berufliche erfahrung", "arbeitserfahrung", "beruflicher werdegang", "werdegang",
  "work experience", "professional experience", "employment history", "work history", "experience",
  "ausbildung", "bildung", "bildungsweg", "akademische ausbildung", "education", "academic background",
  "education and qualifications", "education & qualifications", "education & certifications", "qualifications",
  "weiterbildung", "weiterbildungen", "fortbildung", "fortbildungen", "further education", "continuing education",
  "zertifikate", "zertifizierungen", "zertifikatsstatus", "certificates", "certifications", "courses",
  "sprachen", "sprachkenntnisse", "languages", "language skills",
  "links", "websites", "portfolio", "online profiles",
  "hinweise", "veröffentlichungshinweise", "veroeffentlichungshinweise", "document notes", "publication notes", "notes",
  "sonstiges", "weitere angaben", "additional information", "misc",
]);

function headingShapeAllowed(value: string, continued: boolean): boolean {
  if (/@|https?:\/\//i.test(value)) return false;
  if (/^[-•*–—]/.test(value)) return false;
  if (/[;]$/.test(value)) return false;
  if (/\b\d{1,2}[./]\d{4}\b/.test(value) && !uppercaseHeadingLike(value)) return false;
  if (/^\d{4}\s*(?:[-–—]|\|)/.test(value) && !uppercaseHeadingLike(value)) return false;
  if (/^(?:jan|feb|mär|maerz|apr|mai|jun|jul|aug|sep|okt|oct|nov|dez|dec)\w*\.?\s+\d{4}/i.test(value) && !uppercaseHeadingLike(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 14) return false;
  if (uppercaseHeadingLike(value)) return true;
  const normalized = value.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
  return EXACT_HEADING_ALIASES.has(normalized) && (continued || words.length <= 6);
}

export function matchDocumentHeading(text: string): DocumentHeadingMatch | null {
  let value = cleanHeadingText(text);
  if (!value || value.length > 110) return null;
  const continued = CONTINUED_SUFFIX.test(value);
  if (continued) value = value.replace(CONTINUED_SUFFIX, "").trim();
  if (!value || !headingShapeAllowed(value, continued)) return null;
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
    if (!text) {
      lines.push({ block, kind: "content" });
      continue;
    }
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

export interface DetectedDocumentSection {
  id: string;
  category: DocumentCategory;
  categories: DocumentCategory[];
  heading: string;
  headingBlocks: PdfTextBlock[];
  pageStart: number;
  pageEnd: number;
  blocks: PdfTextBlock[];
  timeline?: DetectedTimelineItem[];
  uncertain: boolean;
  continued: boolean;
}

function sameHeading(left: string, right: string): boolean {
  return headingSignature(left) === headingSignature(right);
}

export type TimelineItemKind =
  | "employment"
  | "freelance"
  | "project"
  | "training"
  | "qualification"
  | "unclear";

export interface DetectedTimelineItem {
  id: string;
  kind: TimelineItemKind;
  page: number;
  lines: string[];
  dateText: string;
  current: boolean;
  uncertainDate: boolean;
  parentId?: string;
}

const DATE_RANGE_AT_START = /^\s*((?:(?:0?[1-9]|1[0-2])[./])?(?:19|20)\d{2}\s*(?:[-–—]|bis|to)\s*(?:(?:0?[1-9]|1[0-2])[./])?(?:(?:19|20)\d{2}|heute|present|current|now|ongoing))\b/i;
const SINGLE_DATE_AT_START = /^\s*((?:(?:0?[1-9]|1[0-2])[./])?(?:19|20)\d{2})\s*(?:\||·|–|—)/i;

function startDate(line: string): { dateText: string; current: boolean; uncertain: boolean } | null {
  const range = line.match(DATE_RANGE_AT_START);
  if (range) {
    const current = /heute|present|current|now|ongoing/i.test(range[1]);
    const hasMonthInStart = /^(?:0?[1-9]|1[0-2])[./]/.test(range[1]);
    return { dateText: range[1].trim(), current, uncertain: !hasMonthInStart };
  }
  const single = line.match(SINGLE_DATE_AT_START);
  if (single) return { dateText: single[1].trim(), current: false, uncertain: true };
  return null;
}

function timelineKind(line: string): TimelineItemKind {
  if (/\b(?:freelance|freiberuflich|selbstständig|selbststaendig|self[- ]employed)\b/i.test(line)) return "freelance";
  if (/\b(?:training|kurs|course|workshop|seminar|weiterbildung|fortbildung|lab|labor|zertifizierung\w*|certification\w*)\b/i.test(line)) return "training";
  if (/\b(?:projekt\w*|project\w*|projektphase)\b/i.test(line)) return "project";
  if (/\b(?:ausbildung|studium|bachelor|master|diplom|phd|doktor|zertifikat\w*|qualifikation\w*)\b/i.test(line)) return "qualification";
  return "employment";
}

export function detectTimelineItems(blocks: PdfTextBlock[]): DetectedTimelineItem[] {
  const items: DetectedTimelineItem[] = [];
  let current: DetectedTimelineItem | null = null;
  let itemIndex = 0;
  let lastFreelance: DetectedTimelineItem | null = null;

  const startItem = (block: PdfTextBlock, kind: TimelineItemKind): DetectedTimelineItem => {
    const item: DetectedTimelineItem = {
      id: `timeline-${itemIndex++}`,
      kind,
      page: block.page,
      lines: [block.text],
      dateText: "",
      current: false,
      uncertainDate: true,
    };
    items.push(item);
    current = item;
    return item;
  };

  for (const block of blocks) {
    if (!block.text.trim()) {
      current = null;
      continue;
    }
    const date = startDate(block.text);
    if (date && current && !current.dateText) {
      current.lines.push(block.text);
      current.dateText = date.dateText;
      current.current = date.current;
      current.uncertainDate = date.uncertain;
      current.kind = timelineKind(block.text);
      if (current.kind === "project" && lastFreelance) current.parentId = lastFreelance.id;
      if (current.kind === "freelance") lastFreelance = current;
      if (current.kind !== "freelance" && current.kind !== "project") lastFreelance = null;
      continue;
    }
    if (date) {
      const kind = timelineKind(block.text);
      const item = startItem(block, kind);
      item.dateText = date.dateText;
      item.current = date.current;
      item.uncertainDate = date.uncertain;
      if (kind === "project" && lastFreelance) item.parentId = lastFreelance.id;
      if (kind === "freelance") lastFreelance = item;
      if (kind !== "project" && kind !== "freelance") lastFreelance = null;
      continue;
    }
    if (!current) {
      current = startItem(block, "unclear");
      continue;
    }
    current.lines.push(block.text);
  }
  return items;
}

export function detectDocumentSections(normalized: NormalizedPdfDocument): DetectedDocumentSection[] {
  const sections: DetectedDocumentSection[] = [];
  let current: DetectedDocumentSection | null = null;
  let sectionIndex = 0;

  const startSection = (
    line: NormalizedDocumentLine,
    category: DocumentCategory,
    categories: DocumentCategory[],
    heading: string,
    uncertain: boolean,
    continued: boolean
  ): DetectedDocumentSection => {
    const section: DetectedDocumentSection = {
      id: `section-${sectionIndex++}`,
      category,
      categories,
      heading,
      headingBlocks: [line.block],
      pageStart: line.block.page,
      pageEnd: line.block.page,
      blocks: [],
      uncertain,
      continued,
    };
    sections.push(section);
    return section;
  };

  for (const line of normalized.lines) {
    if (line.kind === "heading") {
      const known = line.heading;
      const category = known?.category ?? "unknown";
      const categories = known?.categories ?? ["unknown"];
      const isContinuation =
        current !== null &&
        current.category === category &&
        (Boolean(known?.continued) || sameHeading(current.heading, line.block.text));
      if (isContinuation && current) {
        current.continued = true;
        current.headingBlocks.push(line.block);
        current.pageEnd = Math.max(current.pageEnd, line.block.page);
        if (known?.uncertain) current.uncertain = true;
        continue;
      }
      current = startSection(
        line,
        category,
        categories,
        line.block.text,
        known?.uncertain ?? true,
        Boolean(known?.continued)
      );
      continue;
    }

    if (!current) {
      current = startSection(line, "personal", ["personal"], "Kopfdaten", false, false);
    }
    current.blocks.push(line.block);
    current.pageEnd = Math.max(current.pageEnd, line.block.page);
  }

  return sections.map((section) =>
    section.category === "experience"
      ? { ...section, timeline: detectTimelineItems(section.blocks) }
      : section
  );
}

export interface DetectedCvDocument {
  pageCount: number;
  sections: DetectedDocumentSection[];
  ignored: IgnoredDocumentBlock[];
  sourceBlocks: PdfTextBlock[];
  unknownBlocks: PdfTextBlock[];
  unusedBlocks: PdfTextBlock[];
  uncertainSections: DetectedDocumentSection[];
}

export function documentFromText(raw: string): PdfDocumentStructure {
  const sourceLines = raw.replace(/\r/g, "").split("\n");
  let order = 0;
  const blocks: PdfTextBlock[] = sourceLines.map((text) => ({
    page: 1,
    order: order++,
    text: text.trim(),
    lines: [text.trim()],
  }));
  return {
    pageCount: 1,
    text: raw.trim(),
    pages: [{ page: 1, text: raw.trim(), blocks }],
    blocks,
  };
}

export function detectCvDocument(source: PdfDocumentStructure): DetectedCvDocument {
  const normalized = normalizePdfDocument(source);
  const sections = detectDocumentSections(normalized);
  const used = new Set<number>();
  for (const section of sections) {
    for (const block of section.headingBlocks) used.add(block.order);
    for (const block of section.blocks) used.add(block.order);
  }
  const ignored = new Set(normalized.ignored.map((entry) => entry.block.order));
  const unknownCategories = new Set<DocumentCategory>([
    "unknown",
    "target-roles",
    "training",
    "document-notes",
    "misc",
  ]);
  return {
    pageCount: source.pageCount,
    sections,
    ignored: normalized.ignored,
    sourceBlocks: source.blocks,
    unknownBlocks: sections
      .filter((section) => unknownCategories.has(section.category))
      .flatMap((section) => section.blocks),
    unusedBlocks: source.blocks.filter((block) => !used.has(block.order) && !ignored.has(block.order)),
    uncertainSections: sections.filter((section) => section.uncertain),
  };
}
