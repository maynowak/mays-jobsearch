import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import regularFontUrl from "../../assets/fonts/DejaVuSans.ttf?url";
import boldFontUrl from "../../assets/fonts/DejaVuSans-Bold.ttf?url";
import serifFontUrl from "../../assets/fonts/DejaVuSerif.ttf?url";
import serifBoldFontUrl from "../../assets/fonts/DejaVuSerif-Bold.ttf?url";
import {
  isCvBuilderEntryEmpty,
  type CvBuilderDraftV1,
} from "./contractTypes";
import type { CvBuilderTemplate } from "./templates";
import { validateCvBuilderDraft } from "./validation";

const A4 = [595.28, 841.89] as const;
const MONTH_RE = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;

interface FontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
  serifRegular: Uint8Array;
  serifBold: Uint8Array;
}

type PdfLanguage = "de" | "en";

interface PdfLabels {
  present: string;
  profile: string;
  experience: string;
  education: string;
  skills: string;
  projects: string;
  certificates: string;
  languages: string;
  links: string;
  levels: Record<string, string>;
}

const LABELS: Record<PdfLanguage, PdfLabels> = {
  de: {
    present: "heute",
    profile: "Berufliches Kurzprofil",
    experience: "Berufserfahrung",
    education: "Ausbildung",
    skills: "Fähigkeiten",
    projects: "Projekte",
    certificates: "Zertifikate",
    languages: "Sprachen",
    links: "Links",
    levels: {
      basic: "Grundkenntnisse",
      conversational: "Konversationssicher",
      professional: "Beruflich",
      fluent: "Fließend",
      native: "Muttersprache",
    },
  },
  en: {
    present: "Present",
    profile: "Professional profile",
    experience: "Work experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    certificates: "Certificates",
    languages: "Languages",
    links: "Links",
    levels: {
      basic: "Basic",
      conversational: "Conversational",
      professional: "Professional",
      fluent: "Fluent",
      native: "Native",
    },
  },
};

export interface CvBuilderPdfOptions {
  fontBytes?: FontBytes;
  language?: PdfLanguage;
}

interface TemplateStyle {
  margin: number;
  nameSize: number;
  headlineSize: number;
  sectionSize: number;
  bodySize: number;
  metaSize: number;
  lineHeight: number;
  sectionGap: number;
  entryGap: number;
  accent: ReturnType<typeof rgb>;
  classic: boolean;
  compact: boolean;
}

const STYLES: Record<CvBuilderTemplate, TemplateStyle> = {
  classic: {
    margin: 56,
    nameSize: 23,
    headlineSize: 11,
    sectionSize: 10,
    bodySize: 9.5,
    metaSize: 8.5,
    lineHeight: 1.45,
    sectionGap: 16,
    entryGap: 11,
    accent: rgb(0.1, 0.1, 0.1),
    classic: true,
    compact: false,
  },
  modern: {
    margin: 48,
    nameSize: 25,
    headlineSize: 12,
    sectionSize: 10.5,
    bodySize: 9.5,
    metaSize: 8.5,
    lineHeight: 1.5,
    sectionGap: 18,
    entryGap: 12,
    accent: rgb(0.06, 0.45, 0.42),
    classic: false,
    compact: false,
  },
  compact: {
    margin: 38,
    nameSize: 19,
    headlineSize: 9.5,
    sectionSize: 8.6,
    bodySize: 8.2,
    metaSize: 7.5,
    lineHeight: 1.32,
    sectionGap: 10,
    entryGap: 7,
    accent: rgb(0.16, 0.22, 0.29),
    classic: false,
    compact: true,
  },
};

let cachedFonts: Promise<FontBytes> | null = null;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load PDF font (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadFontBytes(): Promise<FontBytes> {
  if (!cachedFonts) {
    cachedFonts = Promise.all([
      fetchBytes(regularFontUrl),
      fetchBytes(boldFontUrl),
      fetchBytes(serifFontUrl),
      fetchBytes(serifBoldFontUrl),
    ])
      .then(([regular, bold, serifRegular, serifBold]) => ({
        regular,
        bold,
        serifRegular,
        serifBold,
      }))
      .catch((error) => {
        cachedFonts = null;
        throw error;
      });
  }
  return cachedFonts;
}

function formatMonth(value: string | undefined): string | null {
  if (!value || !MONTH_RE.test(value)) return null;
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

function formatRange(
  entry: { startMonth: string; endMonth?: string; current: boolean },
  presentLabel: string
): string {
  const start = formatMonth(entry.startMonth);
  if (!start) return "";
  if (entry.current) return `${start} – ${presentLabel}`;
  const end = formatMonth(entry.endMonth);
  if (!end || entry.endMonth! < entry.startMonth) return start;
  return `${start} – ${end}`;
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function nonEmpty(entry: Record<string, unknown>): boolean {
  return !isCvBuilderEntryEmpty(entry);
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of word) {
    const next = current + char;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
      } else {
        const chunks = splitLongWord(word, font, size, maxWidth);
        lines.push(...chunks.slice(0, -1));
        line = chunks.at(-1) ?? "";
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

class PdfWriter {
  readonly doc: PDFDocument;
  readonly style: TemplateStyle;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;

  constructor(doc: PDFDocument, style: TemplateStyle, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.style = style;
    this.regular = regular;
    this.bold = bold;
    this.addPage();
  }

  addPage(): void {
    this.page = this.doc.addPage([A4[0], A4[1]]);
    this.pages.push(this.page);
    this.y = A4[1] - this.style.margin;
  }

  ensure(space: number): void {
    if (this.y - space < this.style.margin) this.addPage();
  }

  line(
    text: string,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      x?: number;
      gapAfter?: number;
      maxWidth?: number;
      preserveEmpty?: boolean;
    } = {}
  ): void {
    const font = options.font ?? this.regular;
    const size = options.size ?? this.style.bodySize;
    const color = options.color ?? rgb(0.14, 0.18, 0.22);
    const maxWidth = options.maxWidth ?? A4[0] - this.style.margin * 2;
    const lines = wrapText(text, font, size, maxWidth);
    const lineHeight = size * this.style.lineHeight;
    for (const line of lines) {
      this.ensure(lineHeight);
      if (line || options.preserveEmpty) {
        this.page.drawText(line, {
          x: options.x ?? this.style.margin,
          y: this.y - size,
          size,
          font,
          color,
        });
      }
      this.y -= lineHeight;
    }
    if (options.gapAfter) this.y -= options.gapAfter;
  }

  section(title: string, firstContentHeight = this.style.bodySize * this.style.lineHeight * 2): void {
    const headingHeight =
      this.style.sectionSize * (this.style.lineHeight + 1) + 12;
    this.ensure(headingHeight + firstContentHeight + this.style.sectionGap);
    this.y -= this.style.sectionGap;
    if (this.style.classic) {
      this.line(title.toUpperCase(), {
        font: this.bold,
        size: this.style.sectionSize,
        color: rgb(0.08, 0.09, 0.11),
        gapAfter: 4,
      });
      this.page.drawLine({
        start: { x: this.style.margin, y: this.y + 1 },
        end: { x: A4[0] - this.style.margin, y: this.y + 1 },
        thickness: 0.6,
        color: rgb(0.65, 0.69, 0.74),
      });
      this.y -= 5;
    } else {
      const barWidth = this.style.compact ? 2 : 3;
      this.page.drawRectangle({
        x: this.style.margin,
        y: this.y - this.style.sectionSize + 1,
        width: barWidth,
        height: this.style.sectionSize + 1,
        color: this.style.accent,
      });
      this.line(title, {
        font: this.bold,
        size: this.style.sectionSize,
        color: this.style.accent,
        x: this.style.margin + barWidth + 6,
        gapAfter: 4,
      });
      this.y -= this.style.compact ? 2 : 4;
    }
  }

  historyEntry(
    title: string,
    subtitle: string,
    range: string,
    description: string | undefined
  ): void {
    const maxWidth = A4[0] - this.style.margin * 2;
    const titleLines = wrapText(title, this.bold, this.style.bodySize + 0.7, maxWidth);
    const subtitleLines = subtitle.trim()
      ? wrapText(subtitle, this.regular, this.style.metaSize, maxWidth)
      : [];
    const bodyLines = description?.trim()
      ? wrapText(description, this.regular, this.style.bodySize, maxWidth)
      : [];
    const headerSpace =
      titleLines.length * (this.style.bodySize + 0.7) * this.style.lineHeight +
      subtitleLines.length * this.style.metaSize * this.style.lineHeight +
      (range ? this.style.metaSize * this.style.lineHeight + 2 : 2) +
      Math.min(bodyLines.length, 2) * this.style.bodySize * this.style.lineHeight +
      this.style.entryGap;
    this.ensure(headerSpace);
    this.line(title, {
      font: this.bold,
      size: this.style.bodySize + 0.7,
      color: rgb(0.08, 0.09, 0.11),
      gapAfter: 1,
    });
    if (subtitle.trim()) {
      this.line(subtitle, {
        size: this.style.metaSize,
        color: rgb(0.28, 0.33, 0.38),
        gapAfter: range ? 0 : 2,
      });
    }
    if (range) {
      this.line(range, {
        size: this.style.metaSize,
        color: this.style.accent,
        gapAfter: 2,
      });
    }
    if (description?.trim()) {
      this.line(description, { size: this.style.bodySize, gapAfter: 0 });
    }
    this.y -= this.style.entryGap;
  }
}

function drawPageNumbers(writer: PdfWriter): void {
  const total = writer.pages.length;
  const size = 7.5;
  writer.pages.forEach((page, index) => {
    const label = `${index + 1} / ${total}`;
    page.drawText(label, {
      x: A4[0] - writer.style.margin - writer.regular.widthOfTextAtSize(label, size),
      y: writer.style.margin - 16,
      size,
      font: writer.regular,
      color: rgb(0.45, 0.49, 0.54),
    });
  });
}

export class CvBuilderPdfError extends Error {
  readonly code: "validation" | "empty" | "generation";

  constructor(code: "validation" | "empty" | "generation", message: string) {
    super(message);
    this.name = "CvBuilderPdfError";
    this.code = code;
  }
}

export async function createCvBuilderPdf(
  draft: CvBuilderDraftV1,
  template: CvBuilderTemplate,
  options: CvBuilderPdfOptions = {}
): Promise<Uint8Array> {
  const errors = validateCvBuilderDraft(draft);
  if (errors.length) throw new CvBuilderPdfError("validation", "The CV data is not valid.");
  const experience = draft.experience.filter((entry) => nonEmpty(entry as unknown as Record<string, unknown>));
  const education = draft.education.filter((entry) => nonEmpty(entry as unknown as Record<string, unknown>));
  const projects = draft.projects.filter((entry) => nonEmpty(entry as unknown as Record<string, unknown>));
  const certificates = draft.certificates.filter((entry) => nonEmpty(entry as unknown as Record<string, unknown>));
  const languages = draft.languages.filter((entry) => entry.language.trim());
  const links = draft.links.filter((entry) => entry.label.trim() && safeHttpUrl(entry.url));
  const hasContent =
    Boolean(
      draft.personal.fullName?.trim() ||
        draft.personal.email?.trim() ||
        draft.personal.phone?.trim() ||
        draft.personal.location?.trim() ||
        draft.profile.headline?.trim() ||
        draft.profile.summary?.trim() ||
        draft.skills.length
    ) ||
    experience.length > 0 ||
    education.length > 0 ||
    projects.length > 0 ||
    certificates.length > 0 ||
    languages.length > 0 ||
    links.length > 0;
  if (!hasContent) throw new CvBuilderPdfError("empty", "There is no CV content to export.");

  const fonts = options.fontBytes ?? (await loadFontBytes());
  const labels = LABELS[options.language ?? "de"];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const isClassic = template === "classic";
  const regular = await doc.embedFont(
    isClassic ? fonts.serifRegular : fonts.regular,
    { subset: true }
  );
  const bold = await doc.embedFont(
    isClassic ? fonts.serifBold : fonts.bold,
    { subset: true }
  );
  const style = STYLES[template];
  const writer = new PdfWriter(doc, style, regular, bold);
  const presentLabel = labels.present;
  const sectionLead = style.bodySize * style.lineHeight * 2;

  const name = draft.personal.fullName?.trim() || "Lebenslauf";
  writer.line(name, {
    font: bold,
    size: style.nameSize,
    color: style.accent,
    gapAfter: 1,
  });
  if (draft.profile.headline?.trim()) {
    writer.line(draft.profile.headline, {
      font: bold,
      size: style.headlineSize,
      color: rgb(0.2, 0.25, 0.3),
      gapAfter: 3,
    });
  }
  const contact = [draft.personal.email, draft.personal.phone, draft.personal.location]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("  ·  ");
  if (contact) writer.line(contact, { size: style.metaSize, color: rgb(0.28, 0.33, 0.38), gapAfter: 8 });
  writer.page.drawLine({
    start: { x: style.margin, y: writer.y },
    end: { x: A4[0] - style.margin, y: writer.y },
    thickness: 0.8,
    color: style.accent,
  });
  writer.y -= 4;

  if (draft.profile.summary?.trim()) {
    writer.section(labels.profile, sectionLead);
    writer.line(draft.profile.summary, { size: style.bodySize, gapAfter: 3 });
  }

  if (experience.length) {
    writer.section(labels.experience, sectionLead);
    experience.forEach((entry) => writer.historyEntry(
      entry.position,
      entry.employer,
      formatRange(entry, presentLabel),
      entry.description
    ));
  }

  if (education.length) {
    writer.section(labels.education, sectionLead);
    education.forEach((entry) => writer.historyEntry(
      entry.degree || entry.institution,
      entry.degree ? entry.institution : "",
      formatRange(entry, presentLabel),
      entry.description
    ));
  }

  if (draft.skills.length) {
    writer.section(labels.skills, sectionLead);
    writer.line(draft.skills.join("  ·  "), { size: style.bodySize, gapAfter: 2 });
  }

  if (projects.length) {
    writer.section(labels.projects, sectionLead);
    projects.forEach((entry) => writer.historyEntry(
      entry.name,
      entry.technologies.join("  · "),
      "",
      entry.description
    ));
  }

  if (certificates.length) {
    writer.section(labels.certificates, sectionLead);
    certificates.forEach((entry) => {
      const date = formatMonth(entry.date);
      writer.line(
        [entry.name, entry.issuer, date].filter(Boolean).join("  ·  "),
        { size: style.bodySize, gapAfter: 2 }
      );
    });
  }

  if (languages.length) {
    writer.section(labels.languages, sectionLead);
    writer.line(
      languages.map((entry) => `${entry.language} — ${labels.levels[entry.level] ?? entry.level}`).join("  ·  "),
      { size: style.bodySize, gapAfter: 2 }
    );
  }

  if (links.length) {
    writer.section(labels.links, sectionLead);
    links.forEach((entry) => {
      writer.line(`${entry.label}: ${entry.url}`, { size: style.bodySize, gapAfter: 2 });
    });
  }

  drawPageNumbers(writer);
  doc.setTitle(`${name} – ${options.language === "en" ? "CV" : "Lebenslauf"}`);
  doc.setProducer("May’s Job Matcher");
  doc.setCreator("May’s Job Matcher CV Builder");
  return doc.save();
}

function safeCvFileNamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*.\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function cvBuilderProfileFileName(name: string): string {
  const safe = safeCvFileNamePart(String(name ?? "").trim() || "Lebenslauf");
  return safe && safe !== "Lebenslauf" ? `Lebenslauf-${safe}.pdf` : "Lebenslauf.pdf";
}

export function cvBuilderFileName(draft: CvBuilderDraftV1): string {
  return cvBuilderProfileFileName(draft.personal.fullName?.trim() || "Lebenslauf");
}

export function downloadCvBuilderPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
