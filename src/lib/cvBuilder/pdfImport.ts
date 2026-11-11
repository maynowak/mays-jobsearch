import {
  detectCvDocument,
  documentFromText,
  type DetectedCvDocument,
  type DetectedDocumentSection,
  type PdfDocumentStructure,
} from "./documentStructure";
import {
  createCertificateEntry,
  createEducationEntry,
  createExperienceEntry,
  createLanguageEntry,
  createLinkEntry,
  createProjectEntry,
  createEmptyCvBuilderDraft,
  type CvBuilderDateMonth,
  type CvBuilderDraftV1,
  type CvBuilderLanguageLevel,
} from "./contractTypes";

export type CvBuilderImportSectionId =
  | "personal"
  | "profile"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certificates"
  | "languages"
  | "links";

export const CV_BUILDER_IMPORT_SECTIONS: CvBuilderImportSectionId[] = [
  "personal",
  "profile",
  "experience",
  "education",
  "skills",
  "projects",
  "certificates",
  "languages",
  "links",
];

export type CvBuilderImportConfidence = "confirmed" | "partial" | "uncertain";

export type CvBuilderImportUnassignedReason =
  | "unknown-section"
  | "training"
  | "certification-goal"
  | "target-roles"
  | "document-notes"
  | "incomplete-experience"
  | "incomplete-education"
  | "incomplete-language"
  | "project-reference"
  | "ambiguous";

export interface CvBuilderImportSectionMapping {
  sectionId: string;
  category: string;
  heading: string;
  pageStart: number;
  pageEnd: number;
  targets: Array<CvBuilderImportSectionId | "manual" | "ignored">;
  confidence: CvBuilderImportConfidence;
  itemCount: number;
  notes: string[];
}

export interface CvBuilderImportTimelineMapping {
  itemId: string;
  kind: string;
  parentId?: string;
  page: number;
  dateText: string;
  entryIndex?: number;
  included: boolean;
  reason?: CvBuilderImportUnassignedReason;
}

export interface CvBuilderImportUnassignedDetail {
  line: string;
  page?: number;
  sectionId?: string;
  sectionHeading?: string;
  category?: string;
  suggestedTarget: CvBuilderImportManualTarget;
  reason: CvBuilderImportUnassignedReason;
}

export interface CvBuilderImportMapping {
  sections: CvBuilderImportSectionMapping[];
  timeline: CvBuilderImportTimelineMapping[];
}

export interface CvBuilderImportResult {
  draft: CvBuilderDraftV1;
  detected: Record<CvBuilderImportSectionId, boolean>;
  uncertain: Record<CvBuilderImportSectionId, boolean>;
  unrecognized: string[];
  unrecognizedDetails: CvBuilderImportUnassignedDetail[];
  mapping: CvBuilderImportMapping;
  structure: DetectedCvDocument;
}

export type CvBuilderImportManualTarget =
  | "ignore"
  | "profile"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certificates"
  | "links";

export type CvBuilderImportManualStatus = "pending" | "accepted" | "ignored";

export interface CvBuilderImportManualDecision {
  target: CvBuilderImportManualTarget;
  status?: CvBuilderImportManualStatus;
  text?: string;
}

export type CvBuilderImportManualAssignments = Record<
  number,
  CvBuilderImportManualTarget | CvBuilderImportManualDecision
>;

export interface CvBuilderImportSelectionOptions {
  selectedSkills?: Iterable<string>;
}

type WorkingSection = CvBuilderImportSectionId | "header" | "misc";

const SECTION_ALIASES: Record<CvBuilderImportSectionId, string[]> = {
  personal: [
    "persönliche daten", "persoenliche daten", "persönliches", "kontakt", "personal details", "personal data", "contact",
  ],
  profile: [
    "profil", "profilzusammenfassung", "berufliches profil", "über mich", "ueber mich", "summary", "profile", "about me", "professional summary",
  ],
  experience: [
    "berufserfahrung", "berufliche erfahrung", "arbeitserfahrung", "beruflicher werdegang", "werdegang", "work experience", "experience", "employment history", "professional experience",
  ],
  education: [
    "ausbildung", "bildung", "bildungsweg", "akademische ausbildung", "education", "academic background", "qualifications",
  ],
  skills: [
    "fähigkeiten", "faehigkeiten", "kenntnisse", "technische kenntnisse", "skills", "technical skills", "competencies", "core skills",
  ],
  projects: ["projekte", "project experience", "projects", "project work", "project experience / projects"],
  certificates: [
    "zertifikate", "zertifizierungen", "weiterbildungen", "weiterbildung", "fortbildung", "fortbildungen",
    "certificates", "certifications", "courses", "further education", "continuing education",
  ],
  languages: ["sprachen", "sprachkenntnisse", "languages", "language skills"],
  links: ["links", "websites", "portfolio", "profile links", "online profiles"],
};

const SECTION_PATTERNS: Array<[RegExp, CvBuilderImportSectionId]> = [
  [/^(?:selected|current|key|relevant)(?:\s+current)?\s+projects?$/i, "projects"],
  [/^(?:projects?|project experience|project work|projekte|projektarbeit)$/i, "projects"],
  [/^(?:professional|work|employment)\s+(?:experience|history)$/i, "experience"],
  [/^(?:work history|employment history|berufserfahrung|berufliche erfahrung|arbeitserfahrung|beruflicher werdegang|werdegang)$/i, "experience"],
  [/^(?:education(?: and qualifications)?|education\s*[&+]\s*certifications?|academic background|ausbildung|bildung|bildungsweg|akademische ausbildung)$/i, "education"],
  [/^(?:further education|continuing education|weiterbildung|fortbildung|weiterbildungen|schulungen?)$/i, "certificates"],
  [/^(?:technical skills|core competencies|key skills|technical competencies|skills|fähigkeiten|faehigkeiten|kenntnisse|technische kenntnisse|cloud\s*[&+]\s*devops)$/i, "skills"],
  [/^(?:certificates?|certifications?|zertifikate|zertifizierungen)$/i, "certificates"],
  [/^(?:languages?|language skills|sprachen|sprachkenntnisse)$/i, "languages"],
  [/^(?:links?|websites?|portfolios?|online profiles?)$/i, "links"],
];

const MONTHS: Record<string, string> = {
  jan: "01", januar: "01", january: "01",
  feb: "02", februar: "02", february: "02",
  mar: "03", mär: "03", maerz: "03", märz: "03", march: "03",
  apr: "04", april: "04",
  mai: "05", may: "05",
  jun: "06", juni: "06", june: "06",
  jul: "07", juli: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  okt: "10", oktober: "10", october: "10", oct: "10",
  nov: "11", november: "11",
  dez: "12", dezember: "12", december: "12", dec: "12",
};

const MONTH_TOKEN = "(?:jan(?:uar)?|feb(?:ruar)?|mär(?:z)?|maerz|apr(?:il)?|mai|may|jun(?:i)?|jul(?:i)?|aug(?:ust)?|sep(?:t|tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)";
const DATE_POINT = `(?:${MONTH_TOKEN}\\.?\\s+\\d{4}|\\d{1,2}[./]\\d{4}|\\d{4}-\\d{2}|\\d{4})`;
const DATE_END = `(?:${DATE_POINT}|present|heute|current|now|ongoing|bis heute)`;
const DATE_RANGE = new RegExp(`(${DATE_POINT})\\s*(?:-|–|—|bis|to)\\s*(${DATE_END})`, "i");
const SINCE_DATE = new RegExp(`^(?:seit|since)\\s+(${DATE_POINT})`, "i");
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d ()/.-]{6,}\d)/;
const LINK_RE = /(https?:\/\/[^\s<>()]+|(?:www\.)?(?:github|linkedin)\.com\/[^\s<>()]+)/i;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

function linksInLine(line: string): string[] {
  return [...line.matchAll(new RegExp(LINK_RE.source, "gi"))]
    .map((match) => match[1])
    .filter(Boolean);
}

function linkEntry(url: string): CvBuilderDraftV1["links"][number] {
  let normalized = url.replace(/[.,;)]$/, "");
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  const lower = normalized.toLocaleLowerCase("en");
  const kind = lower.includes("github") ? "github" : lower.includes("linkedin") ? "linkedin" : "portfolio";
  let label: string;
  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (kind === "github") {
      label = segments.length >= 2 ? `GitHub · ${segments[0]}/${segments[1]}` : `GitHub · ${parsed.hostname}`;
    } else if (kind === "linkedin") {
      const profile = segments[0] === "in" ? segments[1] : segments[0];
      label = profile ? `LinkedIn · ${profile}` : `LinkedIn · ${parsed.hostname}`;
    } else {
      label = `Portfolio · ${parsed.hostname}${segments.length ? `/${segments.at(-1)}` : ""}`;
    }
  } catch {
    label = kind === "github" ? "GitHub" : kind === "linkedin" ? "LinkedIn" : "Portfolio";
  }
  const entry = createLinkEntry();
  return { ...entry, kind, label, url: normalized };
}

function normalizedHeading(line: string): string {
  return line
    .replace(/^[-•*]\s*/, "")
    .replace(/[:：]\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\((?:continued|fortsetzung)\)\s*$/i, "")
    .trim()
    .toLocaleLowerCase("de");
}

function sectionFor(line: string): CvBuilderImportSectionId | null {
  const candidates = [line, line.split(/\s{2,}/)[0]];
  for (const candidate of candidates) {
    const normalized = normalizedHeading(candidate);
    if (!normalized || normalized.length > 80) continue;
    for (const section of CV_BUILDER_IMPORT_SECTIONS) {
      if (SECTION_ALIASES[section].includes(normalized)) return section;
    }
    for (const [pattern, section] of SECTION_PATTERNS) {
      if (pattern.test(normalized)) return section;
    }
  }
  return null;
}

function preprocessLines(raw: string): string[] {
  const lines = raw.replace(/\r/g, "").split("\n").map((line) => line.trim());
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (!line || sectionFor(line)) continue;
    const key = normalizedHeading(line);
    if (key.length <= 80) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = new Set(
    [...counts.entries()]
      .filter(([line, count]) => count >= 3 && line.length < 80)
      .map(([line]) => line)
  );
  return lines.filter((line) => {
    if (!line) return true;
    if (/^\d{1,3}$/.test(line)) return false;
    if (/^(seite|page)\s+\d+(\s*(von|of)\s*\d+)?$/i.test(line)) return false;
    if (/^(curriculum vitae|lebenslauf)$/i.test(line) && (counts.get(normalizedHeading(line)) ?? 0) > 1) return false;
    if (/^(?:.*\s[·|]\s)?(?:professional cv|professional profile|curriculum vitae)\s+\d+$/i.test(line)) return false;
    if (/^(?:seite|page)\s+\d+$/i.test(line)) return false;
    return !repeated.has(normalizedHeading(line));
  });
}

function mergeWrappedLines(lines: string[]): string[] {
  const merged: string[] = [];
  for (const line of lines) {
    if (!line) {
      merged.push("");
      continue;
    }
    const previous = merged[merged.length - 1];
    const startsLikeContinuation = /^[a-zäöüß]/.test(line);
    const isBullet = /^[-•*–—]/.test(line);
    if (
      previous &&
      startsLikeContinuation &&
      !isBullet &&
      !sectionFor(previous) &&
      !LINK_RE.test(previous) &&
      !LINK_RE.test(line) &&
      !EMAIL_RE.test(line) &&
      !PHONE_RE.test(line) &&
      !/[.!?:]$/.test(previous) &&
      previous.length < 180
    ) {
      merged[merged.length - 1] = `${previous} ${line}`;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

function cleanLine(line: string): string {
  return line.replace(/^[-•*–—]\s*/, "").replace(/\s+/g, " ").trim();
}

function nonEmpty(lines: string[]): string[] {
  return lines.map(cleanLine).filter(Boolean);
}

function emptyDetected(): Record<CvBuilderImportSectionId, boolean> {
  return Object.fromEntries(CV_BUILDER_IMPORT_SECTIONS.map((section) => [section, false])) as Record<CvBuilderImportSectionId, boolean>;
}

function emptyUncertain(): Record<CvBuilderImportSectionId, boolean> {
  return Object.fromEntries(CV_BUILDER_IMPORT_SECTIONS.map((section) => [section, false])) as Record<CvBuilderImportSectionId, boolean>;
}

function splitBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function isProjectStart(line: string): boolean {
  return /^\d{4}(?:\s*[-–—]\s*\d{4})?\s*(?:\||[–—])\s*/.test(cleanLine(line));
}

function splitProjectBlocks(lines: string[]): string[][] {
  const nonEmptyLines = lines.filter((line) => line.trim());
  const starts = nonEmptyLines.filter(isProjectStart).length;
  if (starts < 2) return splitBlocks(lines);
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (isProjectStart(line) && current.length) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function splitLineParts(line: string): string[] {
  return line.split(/\s*(?:\||·|–|—| - )\s*/).map(cleanLine).filter(Boolean);
}

function parseMonthToken(token: string): CvBuilderDateMonth | null {
  const value = token.trim().toLocaleLowerCase("de").replace(/\.$/, "");
  if (/^\d{4}$/.test(value)) return "";
  const iso = value.match(MONTH_RE);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const numeric = value.match(/^(\d{1,2})[./](\d{4})$/);
  if (numeric) {
    const month = Number(numeric[1]);
    return month >= 1 && month <= 12 ? `${numeric[2]}-${String(month).padStart(2, "0")}` : "";
  }
  const named = value.match(/^([a-zä]+)\.?\s+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[1]];
    return month ? `${named[2]}-${month}` : "";
  }
  return null;
}

function parseDateRange(line: string): {
  startMonth: CvBuilderDateMonth;
  endMonth?: CvBuilderDateMonth;
  current: boolean;
  uncertain: boolean;
  matchIndex: number;
} | null {
  const range = line.match(DATE_RANGE);
  if (range && range.index !== undefined) {
    const startMonth = parseMonthToken(range[1]);
    const endToken = range[2].trim().toLocaleLowerCase("de");
    const current = /present|heute|current|now|ongoing|bis heute/.test(endToken);
    const endMonth = current ? undefined : parseMonthToken(range[2]);
    return {
      startMonth: startMonth ?? "",
      endMonth: endMonth ?? undefined,
      current,
      uncertain: !startMonth || (!current && !endMonth),
      matchIndex: range.index,
    };
  }
  const since = line.match(SINCE_DATE);
  if (since && since.index !== undefined) {
    const startMonth = parseMonthToken(since[1]);
    return {
      startMonth: startMonth ?? "",
      current: true,
      uncertain: !startMonth,
      matchIndex: since.index,
    };
  }
  return null;
}

function companyLike(value: string): boolean {
  return /\b(gmbh|ag|inc|ltd|llc|corp|company|kg|ug|ohg|gbr|universität|university|hochschule|college|school|akademie|institut)\b/i.test(value);
}

function titleLike(value: string): boolean {
  return /\b(engineer|developer|manager|consultant|analyst|designer|architect|architekt|leiter|leitung|spezialist|specialist|praktikant|intern|assistant|berater|referent|director|lead|head|scientist|techniker|pflegefachkraft)\b/i.test(value);
}

function roleLike(value: string): boolean {
  return titleLike(value) || /\b(devops|sre|cloud|platform|integration|e-commerce|ecommerce|web services|software|data|operations|administrator|architektur|architecture)\b/i.test(value);
}

function classifyExperiencePair(first: string, second: string): { employer: string; position: string; uncertain: boolean } {
  if (companyLike(first) && !companyLike(second)) return { employer: first, position: second, uncertain: !roleLike(second) };
  if (roleLike(first) && !roleLike(second)) return { employer: second, position: first, uncertain: !second };
  if (roleLike(second) && !roleLike(first)) return { employer: first, position: second, uncertain: false };
  return { employer: first, position: second, uncertain: !roleLike(second) };
}

function degreeLike(value: string): boolean {
  return /\b(bachelor|master|b\.?sc|m\.?sc|b\.?a|m\.?a|diplom|phd|doktor|doctor|staatsexamen|ausbildung|lehre|abitur|fachwirt|mba|vocational qualification|berufsqualifikation|berufsausbildung)\b/i.test(value);
}

const NON_EMPLOYMENT_RE = /\b(lab|labor|bootcamp|course|kurs|training|schulung|seminar|workshop|weiterbildung|fortbildung|certification|zertifizierung|universität|universitaet|university|hochschule|college|school|studium|education)\b/i;

function parseExperience(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["experience"] {
  const entries: CvBuilderDraftV1["experience"] = [];
  for (const block of splitBlocks(lines)) {
    const dateIndex = block.findIndex((line) => parseDateRange(line) !== null || /^\s*\d{4}\s*\|/.test(line));
    if (dateIndex < 0) {
      unrecognized.push(...nonEmpty(block));
      continue;
    }
    const dateLine = block[dateIndex];
    let date = parseDateRange(dateLine);
    let singlePrefix = "";
    if (!date) {
      const single = dateLine.match(new RegExp(`^\s*(${DATE_POINT})\s*\|\s*`, "i"));
      if (!single) {
        unrecognized.push(...nonEmpty(block));
        continue;
      }
      singlePrefix = single[0];
      const startMonth = parseMonthToken(single[1]);
      date = {
        startMonth: startMonth ?? "",
        current: false,
        uncertain: true,
        matchIndex: 0,
      };
    }
    const beforeText = singlePrefix ? "" : dateLine.slice(0, date.matchIndex).replace(/[|,;–—-]\s*$/, "").trim();
    const afterText = singlePrefix
      ? dateLine.slice(singlePrefix.length).trim()
      : dateLine.slice(date.matchIndex).replace(DATE_RANGE, "").replace(SINCE_DATE, "").replace(/^[|,;–—-]\s*/, "").trim();
    const before = [...nonEmpty(block.slice(0, dateIndex)), ...splitLineParts(beforeText)];
    const afterParts = afterText ? splitLineParts(afterText) : [];
    let after = [...afterParts.slice(2), ...nonEmpty(block.slice(dateIndex + 1))];
    const headerText = [...nonEmpty(block.slice(0, dateIndex + 1)), ...afterParts.slice(0, 2)].join(" ");
    if (NON_EMPLOYMENT_RE.test(headerText) && !before.some(companyLike)) {
      uncertain.add("experience");
      unrecognized.push(...nonEmpty(block));
      continue;
    }
    let employer = "";
    let position = "";
    if (!before.length && afterParts.length) {
      if (afterParts.length >= 2) {
        const pair = classifyExperiencePair(afterParts[0], afterParts[1]);
        employer = pair.employer;
        position = pair.position;
        if (pair.uncertain) uncertain.add("experience");
        after = [...afterParts.slice(2), ...nonEmpty(block.slice(dateIndex + 1))];
      } else {
        position = afterParts[0];
        employer = "";
        after = nonEmpty(block.slice(dateIndex + 1));
        uncertain.add("experience");
      }
    } else if (before.length === 1) {
      if (companyLike(before[0])) employer = before[0];
      else if (roleLike(before[0])) position = before[0];
      else {
        employer = before[0];
        uncertain.add("experience");
      }
    } else if (before.length >= 2) {
      const pair = classifyExperiencePair(before[0], before[1]);
      employer = pair.employer;
      position = pair.position;
      if (pair.uncertain) uncertain.add("experience");
    }
    if (!employer && /self[- ]employed|freelance/i.test(position)) {
      employer = /freelance/i.test(position) ? "Freelance" : "Self-Employed";
    }
    if (!employer || !position) {
      uncertain.add("experience");
      unrecognized.push(...nonEmpty(block));
      continue;
    }
    if (date.uncertain) uncertain.add("experience");
    const entry = createExperienceEntry();
    entries.push({
      ...entry,
      employer,
      position,
      startMonth: date.startMonth,
      ...(date.endMonth ? { endMonth: date.endMonth } : {}),
      current: date.current,
      ...(after.length ? { description: after.join("\n") } : {}),
    });
  }
  return entries;
}

function mapExperienceSection(
  section: DetectedDocumentSection,
  uncertain: Set<CvBuilderImportSectionId>,
  unrecognized: string[],
  reasonHints?: Map<string, CvBuilderImportUnassignedReason>
): { entries: CvBuilderDraftV1["experience"]; timeline: CvBuilderImportTimelineMapping[] } {
  const entries: CvBuilderDraftV1["experience"] = [];
  const timeline: CvBuilderImportTimelineMapping[] = [];
  const byItem = new Map<string, CvBuilderImportTimelineMapping>();
  const timelineItems = section.timeline ?? [];
  if (!timelineItems.length) {
    const local: string[] = [];
    const parsed = parseExperience(mergeWrappedLines(section.blocks.map((block) => block.text)), uncertain, local);
    unrecognized.push(...local);
    entries.push(...parsed);
    return { entries, timeline };
  }

  for (const item of timelineItems) {
    const isProject = item.kind === "project";
    const parent = item.parentId ? byItem.get(item.parentId) : undefined;
    if (isProject && parent?.included && parent.entryIndex !== undefined) {
      const entry = entries[parent.entryIndex];
      if (entry) {
        entry.description = [entry.description, item.lines.join("\n")].filter(Boolean).join("\n");
        const mapping: CvBuilderImportTimelineMapping = {
          itemId: item.id,
          kind: item.kind,
          parentId: item.parentId,
          page: item.page,
          dateText: item.dateText,
          entryIndex: parent.entryIndex,
          included: true,
        };
        timeline.push(mapping);
        byItem.set(item.id, mapping);
        continue;
      }
    }
    if (isProject || item.kind === "training" || item.kind === "qualification") {
      const reason: CvBuilderImportUnassignedReason =
        item.kind === "training"
          ? "training"
          : item.kind === "qualification"
            ? "incomplete-education"
            : "project-reference";
      unrecognized.push(...item.lines);
      for (const line of item.lines) reasonHints?.set(line, reason);
      const mapping: CvBuilderImportTimelineMapping = {
        itemId: item.id,
        kind: item.kind,
        ...(item.parentId ? { parentId: item.parentId } : {}),
        page: item.page,
        dateText: item.dateText,
        included: false,
        reason,
      };
      timeline.push(mapping);
      byItem.set(item.id, mapping);
      continue;
    }
    const local: string[] = [];
    const parsed = parseExperience([...item.lines, ""], uncertain, local);
    if (parsed.length) {
      const entryIndex = entries.length;
      entries.push(...parsed);
      const mapping: CvBuilderImportTimelineMapping = {
        itemId: item.id,
        kind: item.kind,
        ...(item.parentId ? { parentId: item.parentId } : {}),
        page: item.page,
        dateText: item.dateText,
        entryIndex,
        included: true,
      };
      timeline.push(mapping);
      byItem.set(item.id, mapping);
    } else {
      const failed = local.length ? local : item.lines;
      unrecognized.push(...failed);
      for (const line of failed) reasonHints?.set(line, "incomplete-experience");
      const mapping: CvBuilderImportTimelineMapping = {
        itemId: item.id,
        kind: item.kind,
        ...(item.parentId ? { parentId: item.parentId } : {}),
        page: item.page,
        dateText: item.dateText,
        included: false,
        reason: "incomplete-experience",
      };
      timeline.push(mapping);
      byItem.set(item.id, mapping);
    }
  }
  return { entries, timeline };
}

function educationInstitutionLike(value: string): boolean {
  return companyLike(value) || /\b(universität|universitaet|university|hochschule|college|school|akademie|institut|institute|fachhochschule)\b/i.test(value);
}

function buildEducationEntry(
  candidateLines: string[],
  date: {
    startMonth: CvBuilderDateMonth;
    endMonth?: CvBuilderDateMonth;
    current: boolean;
    uncertain: boolean;
  } | null,
  uncertain: Set<CvBuilderImportSectionId>,
  unrecognized: string[]
): CvBuilderDraftV1["education"][number] | null {
  const lines = nonEmpty(candidateLines);
  if (!lines.length) return null;
  if (/^(professional development|certifications?|certificates?|further education|weiterbildung|fortbildung)\b/i.test(lines[0])) {
    unrecognized.push(...lines);
    uncertain.add("education");
    return null;
  }

  const degreeLine = lines.find((line) => degreeLike(line));
  const institutionLine = lines.find((line) => educationInstitutionLike(line));
  let institution = institutionLine ?? "";
  let degree = degreeLine ?? "";
  const used = new Set<string>([degreeLine, institutionLine].filter((line): line is string => Boolean(line)));
  const remaining = lines.filter((line) => !used.has(line));

  if (degreeLine && remaining.length) {
    const fieldLine = remaining.find((line) =>
      line.split(/\s+/).length <= 6 &&
      !/[.!?]$/.test(line) &&
      !/^\d/.test(line) &&
      !educationInstitutionLike(line)
    );
    if (fieldLine) {
      degree = `${fieldLine} – ${degree}`;
      used.add(fieldLine);
    }
  }

  if (!institution && !degree) {
    institution = lines[0];
    used.add(lines[0]);
  }
  const description = lines.filter((line) => !used.has(line));
  if (!institution || !degree || !date || date.uncertain) uncertain.add("education");
  const entry = createEducationEntry();
  return {
    ...entry,
    institution,
    degree,
    startMonth: date?.startMonth ?? "",
    ...(date?.endMonth ? { endMonth: date.endMonth } : {}),
    current: date?.current ?? false,
    ...(description.length ? { description: description.join("\n") } : {}),
  };
}

function parseEducation(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["education"] {
  const entries: CvBuilderDraftV1["education"] = [];
  for (const block of splitBlocks(lines)) {
    const dateIndex = block.findIndex((line) => parseDateRange(line) !== null);
    if (dateIndex < 0) {
      const lines = nonEmpty(block);
      const degreeLines = lines.filter((line) => degreeLike(line));
      if (degreeLines.length > 1) {
        const institution = lines.find((line) => educationInstitutionLike(line)) ?? "";
        degreeLines.forEach((degreeLine, index) => {
          const start = lines.indexOf(degreeLine);
          const nextDegree = degreeLines[index + 1];
          const end = nextDegree ? lines.indexOf(nextDegree) : lines.length;
          const description = lines
            .slice(start + 1, end)
            .filter((line) => line !== institution && !degreeLike(line));
          const entry = createEducationEntry();
          entries.push({
            ...entry,
            institution,
            degree: degreeLine,
            startMonth: "",
            current: false,
            ...(description.length ? { description: description.join("\n") } : {}),
          });
        });
        continue;
      }
      const entry = buildEducationEntry(block, null, uncertain, unrecognized);
      if (entry) entries.push(entry);
      continue;
    }
    const date = parseDateRange(block[dateIndex]);
    if (!date) continue;
    const dateLine = block[dateIndex];
    const beforeText = dateLine.slice(0, date.matchIndex).replace(/[|,;–—-]\s*$/, "").trim();
    const afterText = dateLine.slice(date.matchIndex).replace(DATE_RANGE, "").replace(SINCE_DATE, "").replace(/^[|,;–—-]\s*/, "").trim();
    const before = [...nonEmpty(block.slice(0, dateIndex)), ...splitLineParts(beforeText)];
    const after = [...(afterText ? splitLineParts(afterText) : []), ...nonEmpty(block.slice(dateIndex + 1))];
    const candidates = [...before, ...after];
    const degreeLines = nonEmpty(candidates).filter((line) => degreeLike(line));
    if (degreeLines.length > 1) {
      const institution = nonEmpty(candidates).find((line) => educationInstitutionLike(line)) ?? "";
      const allLines = nonEmpty(candidates);
      degreeLines.forEach((degreeLine, index) => {
        const start = allLines.indexOf(degreeLine);
        const nextDegree = degreeLines[index + 1];
        const end = nextDegree ? allLines.indexOf(nextDegree) : allLines.length;
        const description = allLines
          .slice(start + 1, end)
          .filter((line) => line !== institution && !degreeLike(line));
        const entry = createEducationEntry();
        entries.push({
          ...entry,
          institution,
          degree: degreeLine,
          startMonth: date.startMonth,
          ...(date.endMonth ? { endMonth: date.endMonth } : {}),
          current: date.current,
          ...(description.length ? { description: description.join("\n") } : {}),
        });
      });
      continue;
    }
    const entry = buildEducationEntry(candidates, date, uncertain, unrecognized);
    if (entry) entries.push(entry);
  }
  return entries;
}

const KNOWN_TECH_RE = /\b(?:AWS|Lambda|SQS|Dynamo(?:DB)|IAM|Cognito|CloudWatch|CloudTrail|Terraform|Docker|Kubernetes|Serverless|API Gateway|React|TypeScript|JavaScript|Java|Spring Boot|Node\.js|PostgreSQL|MySQL|Oracle|Vercel|OpenRouter|EdenAI|LLM|LLMs|GitHub Actions|Git|Jenkins|Vite|PHP|HTML|CSS|Microservices|REST APIs)\b/gi;

function knownTechnologiesInLine(line: string): string[] {
  const matches = line.match(KNOWN_TECH_RE) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const key = match.toLocaleLowerCase("de");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
  }
  return unique.length >= 2 ? unique : [];
}

function splitProjectName(value: string): { name: string; period?: string } {
  const match = value.match(/^((?:19|20)\d{2}(?:\s*[-–—]\s*(?:19|20)\d{2})?)\s*(?:\||[-–—])\s*(.+)$/);
  if (!match) return { name: value.trim() };
  return { name: match[2].trim(), period: match[1].trim() };
}

function technologiesInLine(line: string): string[] {
  const match = line.match(/\b(?:technologien|technologies|tech(?: stack)?|stack|tools|mit|using|based on|auf basis von)\b\s*[:\-]?\s*(.+)$/i);
  if (!match) return [];
  return match[1]
    .split(/\s*(?:,|;|\||\/|\bund\b|\band\b)\s*/i)
    .map((entry) => entry.trim().replace(/[.]+$/, ""))
    .filter(isSkillCandidate);
}

function parseProjects(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["projects"] {
  const entries: CvBuilderDraftV1["projects"] = [];
  for (const block of splitProjectBlocks(lines)) {
    const cleaned = nonEmpty(block);
    if (!cleaned.length) continue;
    const parsedName = splitProjectName(cleaned[0]);
    if (!parsedName.name) continue;
    let descriptionLines = cleaned.slice(1);
    const technologies: string[] = [];
    const seenTechnologies = new Set<string>();
    if (parsedName.period) descriptionLines = [`Zeitraum: ${parsedName.period}`, ...descriptionLines];
    descriptionLines = descriptionLines.filter((line) => {
      const tech = line.match(/^(?:technologien|technologies|tech(?: stack)?|stack|tools)\s*[:\-]\s*(.+)$/i);
      if (tech) {
        for (const item of tech[1].split(/[,;|]/).map((entry) => entry.trim().replace(/[.]+$/, ""))) {
          if (!isSkillCandidate(item)) continue;
          const key = item.toLocaleLowerCase("de");
          if (seenTechnologies.has(key)) continue;
          seenTechnologies.add(key);
          technologies.push(item);
        }
        return false;
      }
      if (linksInLine(line).length > 0 && line.replace(LINK_RE, "").replace(/[·|:]/g, "").trim().length < 20) {
        return false;
      }
      for (const candidate of [...technologiesInLine(line), ...knownTechnologiesInLine(line)]) {
        const key = candidate.toLocaleLowerCase("de");
        if (seenTechnologies.has(key)) continue;
        seenTechnologies.add(key);
        technologies.push(candidate);
      }
      return true;
    });
    if (!descriptionLines.length && !technologies.length) uncertain.add("projects");
    const entry = createProjectEntry();
    entries.push({
      ...entry,
      name: parsedName.name,
      ...(descriptionLines.length ? { description: descriptionLines.join("\n") } : {}),
      technologies,
    });
  }
  if (!entries.length && lines.length) unrecognized.push(...nonEmpty(lines));
  return entries;
}

const CERTIFICATION_GOAL_RE = /\b(?:zertifizierungsziel|zertifizierungsstatus|target certification|planned certification|in preparation|preparing for|planned|in progress|pursuing|geplant|in vorbereitung|angestrebt|not yet acquired|noch nicht erworben)\b/i;

function parseCertificates(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["certificates"] {
  const entries: CvBuilderDraftV1["certificates"] = [];
  for (const line of nonEmpty(lines)) {
    if (CERTIFICATION_GOAL_RE.test(line)) {
      uncertain.add("certificates");
      unrecognized.push(line);
      continue;
    }
    const parts = line.split(/\s*(?:\||;|·)\s*/).map(cleanLine).filter(Boolean);
    if (!parts.length) continue;
    const date = parseDateRange(line);
    const singleDate = line.match(new RegExp(`(${DATE_POINT})`, "i"));
    const singleMonth = singleDate ? parseMonthToken(singleDate[1]) : null;
    const name = parts[0];
    if (!name) continue;
    const issuer = parts.find((part, index) => index > 0 && !parseDateRange(part) && part !== parts[0]);
    if (!issuer || (!date && !singleMonth) || (date?.uncertain) || singleMonth === "") {
      uncertain.add("certificates");
    }
    const entry = createCertificateEntry();
    entries.push({
      ...entry,
      name,
      ...(issuer ? { issuer } : {}),
      ...(date?.startMonth
        ? { date: date.startMonth }
        : singleMonth
          ? { date: singleMonth }
          : {}),
    });
  }
  return entries;
}

const LANGUAGE_LEVELS: Array<[RegExp, CvBuilderLanguageLevel]> = [
  [/muttersprache|native|mother tongue/i, "native"],
  [/fließend|fluent|verhandlungssicher/i, "fluent"],
  [/beruflich|professional|business|gute kenntnisse/i, "professional"],
  [/konversation|conversational|mittelstufe|intermediate/i, "conversational"],
  [/grundkenntnisse|basic|anfänger|beginner|a1|a2/i, "basic"],
];

function parseLanguages(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["languages"] {
  const entries: CvBuilderDraftV1["languages"] = [];
  for (const line of nonEmpty(lines)) {
    const segments = line.split(/\s*\|\s*/).map(cleanLine).filter(Boolean);
    for (const segment of segments) {
      const match = segment.match(/^([^:–—()\-]+?)\s*(?:[:–—(]|\s-\s)\s*(.+?)\)?$/);
      if (!match) {
        unrecognized.push(segment);
        uncertain.add("languages");
        continue;
      }
      const language = cleanLine(match[1]);
      const levelText = match[2];
      const level = LANGUAGE_LEVELS.find(([pattern]) => pattern.test(levelText))?.[1];
      if (!language || !level) {
        unrecognized.push(segment);
        uncertain.add("languages");
        continue;
      }
      const entry = createLanguageEntry();
      entries.push({ ...entry, language, level });
    }
  }
  return entries;
}

function parseLinks(lines: string[], unrecognized: string[]): CvBuilderDraftV1["links"] {
  const entries: CvBuilderDraftV1["links"] = [];
  const seen = new Set<string>();
  for (const line of nonEmpty(lines)) {
    const urls = linksInLine(line);
    if (!urls.length) {
      unrecognized.push(line);
      continue;
    }
    for (const url of urls) {
      const entry = linkEntry(url);
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      entries.push(entry);
    }
  }
  return entries;
}

function collectLinks(lines: string[]): CvBuilderDraftV1["links"] {
  const entries: CvBuilderDraftV1["links"] = [];
  const seen = new Set<string>();
  for (const line of nonEmpty(lines)) {
    for (const url of linksInLine(line)) {
      const entry = linkEntry(url);
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      entries.push(entry);
    }
  }
  return entries;
}

function parsePersonal(lines: string[]): { personal: CvBuilderDraftV1["personal"]; uncertain: boolean; detected: boolean } {
  const personal: CvBuilderDraftV1["personal"] = {};
  let uncertain = false;
  const labeled: Record<string, keyof CvBuilderDraftV1["personal"]> = {
    name: "fullName", "vollständiger name": "fullName", "full name": "fullName",
    email: "email", "e-mail": "email", mail: "email",
    telefon: "phone", phone: "phone", mobil: "phone", mobile: "phone", tel: "phone",
    ort: "location", stadt: "location", location: "location", adresse: "location", address: "location",
  };
  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    const label = line.match(/^([^:]{2,30})\s*:\s*(.+)$/);
    if (label) {
      const key = labeled[label[1].trim().toLocaleLowerCase("de")];
      if (key) {
        personal[key] = label[2].trim();
        continue;
      }
    }
    const email = line.match(EMAIL_RE);
    if (email && !personal.email) personal.email = email[0];
    const phone = line.match(PHONE_RE);
    if (phone && !personal.phone) personal.phone = phone[0].trim();
    if (!personal.fullName && !email && !LINK_RE.test(line) && !PHONE_RE.test(line) && !line.includes(":")) {
      const candidate = line.replace(/^(herr|frau|mr|mrs|ms)\.?\s+/i, "").trim();
      if (
        candidate.length >= 2 &&
        candidate.length <= 80 &&
        candidate.split(/\s+/).length >= 2 &&
        candidate.split(/\s+/).length <= 4 &&
        !/[.!?]$/.test(candidate) &&
        !titleLike(candidate) &&
        !companyLike(candidate) &&
        !/\b(professional|profile|profil|summary|experience|erfahrung|curriculum)\b/i.test(candidate) &&
        /[a-zäöüß]/i.test(candidate)
      ) {
        personal.fullName = candidate === candidate.toLocaleUpperCase("de")
          ? candidate.toLocaleLowerCase("de").replace(/(^|\s)(\p{L})/gu, (_match, space: string, letter: string) => `${space}${letter.toLocaleUpperCase("de")}`)
          : candidate;
      }
    }
    const locationPart = line
      .split(/\s*[|•]\s*/)
      .map((part) => part.trim())
      .find((part) => /,/.test(part) && !EMAIL_RE.test(part) && !PHONE_RE.test(part) && !LINK_RE.test(part) && part.length <= 100);
    if (!personal.location && locationPart) {
      personal.location = locationPart;
    }
    if (
      !personal.location &&
      line !== personal.fullName &&
      line.toLocaleUpperCase("de") !== personal.fullName?.toLocaleUpperCase("de") &&
      !email &&
      !PHONE_RE.test(line) &&
      !LINK_RE.test(line) &&
      !line.includes(":") &&
      line.length <= 100 &&
      line.split(/\s+/).length <= 5 &&
      !/[.!?]$/.test(line) &&
      !/^\d/.test(line) &&
      !titleLike(line) &&
      !companyLike(line)
    ) {
      personal.location = line;
    }
  }
  if (!personal.fullName) uncertain = true;
  return {
    personal,
    uncertain,
    detected: Object.values(personal).some(Boolean),
  };
}

const SKILL_CATEGORY_PREFIX = /^(?:architecture|programming(?: languages?)?|languages?|frameworks?|libraries|tools?|platforms?|databases?|cloud|cloud\s*[&+]\s*devops|software\s*[&+]\s*architektur|software\s*[&+]\s*data|aws\s*[&+]\s*infrastruktur|web\s*[&+]\s*daten|data\s*[&+]\s*integration|ai engineering|development|infrastructure|devops|methoden|methodologies|technologien|technologies)\s*[:\-]\s*/i;
const SKILL_SENTENCE_WORDS = /\b(developed|built|implemented|responsible|worked|created|designed|managed|supported|led|maintained|entwickelt|umgesetzt|verantwortlich|betreut|erstellt|konzipiert|unterstützt|geleitet|gewartet|durchgeführt)\b/i;
const SKILL_GROUP_LABEL_RE = /^(?:architecture\s*&\s*cloud|ai engineering|technical skills|technologies|infrastructure|focus areas|data\s*&\s*integration|professional development|additional aws hands-on practice|selected professional strengths|profile note)$/i;

function isSkillCandidate(value: string): boolean {
  const item = value.replace(/^[-•*–—]\s*/, "").replace(/[,;|]+$/, "").trim();
  if (item.length < 2 || item.length > 60) return false;
  if (EMAIL_RE.test(item) || LINK_RE.test(item)) return false;
  if (/\b(19|20)\d{2}\b/.test(item)) return false;
  if (/[.!?]$/.test(item) || /[.!?]\s/.test(item)) return false;
  if (item.split(/\s+/).length > 6) return false;
  if (!/[A-Z]/.test(item) && item.split(/\s+/).length > 2) return false;
  if (SKILL_SENTENCE_WORDS.test(item)) return false;
  if (/^(and|or|with|und|oder|mit|sowie)$/i.test(item)) return false;
  if (/^\d+$/.test(item)) return false;
  return /[a-zäöüß0-9]/i.test(item);
}

function parseSkills(
  lines: string[],
  uncertain: Set<CvBuilderImportSectionId>,
  unrecognized: string[]
): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  const mergedLines: string[] = [];
  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) {
      mergedLines.push("");
      continue;
    }
    const previous = mergedLines[mergedLines.length - 1];
    const continuation =
      previous &&
      !/[.!?]$/.test(previous) &&
      !/:$/.test(previous) &&
      (/^[a-zäöüß]/.test(line) || /[,;\/]$/.test(previous)) &&
      !SKILL_CATEGORY_PREFIX.test(line) &&
      !SKILL_SENTENCE_WORDS.test(line) &&
      !sectionFor(line);
    if (continuation) mergedLines[mergedLines.length - 1] = `${previous} ${line}`;
    else mergedLines.push(line);
  }
  for (const line of mergedLines) {
    if (!line) continue;
    const cleaned = line.replace(SKILL_CATEGORY_PREFIX, "");
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (!cleaned) continue;
    if (words.length > 8 && !/[,;|•]/.test(cleaned)) {
      unrecognized.push(line);
      uncertain.add("skills");
      continue;
    }
    const candidates = cleaned.split(/[,;|•·]|\s+\/\s+/).map((value) => value.trim()).filter(Boolean);
    for (const candidate of candidates) {
      if (SKILL_GROUP_LABEL_RE.test(candidate)) continue;
      if (!isSkillCandidate(candidate)) {
        unrecognized.push(candidate);
        uncertain.add("skills");
        continue;
      }
      const key = candidate.toLocaleLowerCase("de");
      if (!seen.has(key)) {
        seen.add(key);
        skills.push(candidate);
      }
    }
  }
  return skills;
}

function hasSectionContent(draft: CvBuilderDraftV1, section: CvBuilderImportSectionId): boolean {
  switch (section) {
    case "personal": return Object.values(draft.personal).some(Boolean);
    case "profile": return Boolean(draft.profile.headline || draft.profile.summary);
    case "experience": return draft.experience.length > 0;
    case "education": return draft.education.length > 0;
    case "skills": return draft.skills.length > 0;
    case "projects": return draft.projects.length > 0;
    case "certificates": return draft.certificates.length > 0;
    case "languages": return draft.languages.length > 0;
    case "links": return draft.links.length > 0;
    default: return false;
  }
}

const LANGUAGE_NAME_RE = /\b(?:deutsch|englisch|französisch|franzoesisch|spanisch|italienisch|portugiesisch|russisch|polnisch|türkisch|tuerkisch|niederländisch|niederlaendisch|chinesisch|japanisch|arabisch|german|english|french|spanish|italian|portuguese|russian|polish|turkish|dutch|chinese|japanese|arabic)\b/i;
const LANGUAGE_LEVEL_RE = /\b(?:muttersprache|native|fließend|fliessend|fluent|verhandlungssicher|professional|business|gute kenntnisse|konversation|conversational|intermediate|mittelstufe|grundkenntnisse|basic|anfänger|anfaenger|beginner|a1|a2|b1|b2|c1|c2)\b/i;

function isLanguageLine(line: string): boolean {
  return LANGUAGE_NAME_RE.test(line) && (LANGUAGE_LEVEL_RE.test(line) || /^(?:deutsch|englisch|german|english)\b/i.test(cleanLine(line)));
}

function mergeSectionLines(section: { blocks: Array<{ text: string }> }): string[] {
  return mergeWrappedLines(section.blocks.map((block) => block.text));
}

function sectionTargets(category: string): Array<CvBuilderImportSectionId | "manual" | "ignored"> {
  switch (category) {
    case "personal":
    case "profile":
    case "experience":
    case "education":
    case "skills":
    case "projects":
    case "certificates":
    case "languages":
    case "links":
      return [category];
    case "mixed":
      return ["education", "languages"];
    case "target-roles":
      return ["profile"];
    case "training":
      return ["education"];
    default:
      return ["manual"];
  }
}

function sectionConfidence(category: string, uncertain: boolean): CvBuilderImportConfidence {
  if (["unknown", "training", "target-roles", "document-notes", "misc"].includes(category)) return "uncertain";
  if (category === "mixed" || uncertain) return "partial";
  return "confirmed";
}

function buildSectionMappings(sections: DetectedCvDocument["sections"]): CvBuilderImportSectionMapping[] {
  return sections.map((section) => ({
    sectionId: section.id,
    category: section.category,
    heading: section.heading,
    pageStart: section.pageStart,
    pageEnd: section.pageEnd,
    targets: sectionTargets(section.category),
    confidence: sectionConfidence(section.category, section.uncertain),
    itemCount: section.blocks.length,
    notes: [
      ...(section.continued ? ["continued"] : []),
      ...(section.uncertain ? ["review-recommended"] : []),
    ],
  }));
}

function findSourceLine(
  line: string,
  structure: DetectedCvDocument
): { page?: number; sectionId?: string; sectionHeading?: string; category?: string } {
  for (const section of structure.sections) {
    if (section.blocks.some((block) => block.text === line)) {
      return {
        page: section.blocks.find((block) => block.text === line)?.page,
        sectionId: section.id,
        sectionHeading: section.heading,
        category: section.category,
      };
    }
  }
  for (const section of structure.sections) {
    if (section.blocks.some((block) => block.text.includes(line) || line.includes(block.text))) {
      const block = section.blocks.find((candidate) => candidate.text.includes(line) || line.includes(candidate.text));
      return {
        page: block?.page,
        sectionId: section.id,
        sectionHeading: section.heading,
        category: section.category,
      };
    }
  }
  return {};
}

function unassignedReason(line: string, category?: string, heading?: string): CvBuilderImportUnassignedReason {
  if (
    CERTIFICATION_GOAL_RE.test(line) ||
    (heading && CERTIFICATION_GOAL_RE.test(heading))
  ) {
    return "certification-goal";
  }
  if (category === "training") return "training";
  if (category === "target-roles") return "target-roles";
  if (category === "document-notes") return "document-notes";
  if (category === "unknown" || category === "misc") return "unknown-section";
  if (category === "experience") return "incomplete-experience";
  if (category === "education") return "incomplete-education";
  if (category === "languages") return "incomplete-language";
  if (category === "projects") return "project-reference";
  return "ambiguous";
}

function suggestedTargetFor(reason: CvBuilderImportUnassignedReason): CvBuilderImportManualTarget {
  switch (reason) {
    case "target-roles":
      return "profile";
    case "training":
    case "incomplete-education":
      return "education";
    case "incomplete-experience":
      return "experience";
    case "incomplete-language":
      return "ignore";
    case "project-reference":
      return "projects";
    case "certification-goal":
    case "document-notes":
    case "unknown-section":
    case "ambiguous":
    default:
      return "ignore";
  }
}

function buildUnassignedDetails(
  lines: string[],
  structure: DetectedCvDocument,
  reasonHints: Map<string, CvBuilderImportUnassignedReason> = new Map()
): CvBuilderImportUnassignedDetail[] {
  return lines.map((line) => {
    const source = findSourceLine(line, structure);
    const reason = reasonHints.get(line) ?? unassignedReason(line, source.category, source.sectionHeading);
    return {
      line,
      ...(source.page ? { page: source.page } : {}),
      ...(source.sectionId ? { sectionId: source.sectionId } : {}),
      ...(source.sectionHeading ? { sectionHeading: source.sectionHeading } : {}),
      ...(source.category ? { category: source.category } : {}),
      suggestedTarget: suggestedTargetFor(reason),
      reason,
    };
  });
}

export function parseCvBuilderImportText(
  raw: string,
  source?: PdfDocumentStructure
): CvBuilderImportResult {
  const draft = createEmptyCvBuilderDraft();
  const detected = emptyDetected();
  const uncertain = emptyUncertain();
  const uncertainSet = new Set<CvBuilderImportSectionId>();
  const unrecognized: string[] = [];
  const sections: Record<WorkingSection, string[]> = {
    header: [], misc: [], personal: [], profile: [], experience: [], education: [], skills: [], projects: [], certificates: [], languages: [], links: [],
  };
  const profileSummaryLines: string[] = [];
  const experienceEntries: CvBuilderDraftV1["experience"] = [];
  const timelineMappings: CvBuilderImportTimelineMapping[] = [];
  const reasonHints = new Map<string, CvBuilderImportUnassignedReason>();
  const document = source ?? documentFromText(preprocessLines(raw).join("\n"));
  const structure = detectCvDocument(document);

  for (const section of structure.sections) {
    const lines = mergeSectionLines(section);
    switch (section.category) {
      case "personal":
        sections.personal.push(...lines);
        break;
      case "profile":
        if (/summary|zusammenfassung|strengths/i.test(section.heading)) {
          profileSummaryLines.push(...lines);
        } else {
          sections.profile.push(...lines);
        }
        break;
      case "skills":
        sections.skills.push(...lines, "");
        break;
      case "projects":
        sections.projects.push(...lines);
        break;
      case "education":
        sections.education.push(...lines, "");
        break;
      case "certificates":
        if (CERTIFICATION_GOAL_RE.test(section.heading)) {
          uncertainSet.add("certificates");
          unrecognized.push(...lines);
          break;
        }
        sections.certificates.push(...lines);
        break;
      case "languages":
        sections.languages.push(...lines);
        break;
      case "links":
        sections.links.push(...lines);
        break;
      case "experience": {
        const mapped = mapExperienceSection(section, uncertainSet, unrecognized, reasonHints);
        experienceEntries.push(...mapped.entries);
        timelineMappings.push(...mapped.timeline);
        if (mapped.timeline.some((item) => !item.included)) uncertainSet.add("experience");
        break;
      }
      case "mixed": {
        const languageLines = lines.filter(isLanguageLine);
        const nonLanguageLines = lines.filter((line) => !isLanguageLine(line));
        sections.languages.push(...languageLines);
        sections.education.push(...nonLanguageLines, "");
        if (languageLines.length && nonLanguageLines.length) uncertainSet.add("education");
        break;
      }
      case "training":
        sections.education.push(section.heading, ...lines, "");
        uncertainSet.add("education");
        break;
      case "target-roles":
      case "document-notes":
      case "unknown":
      case "misc":
        unrecognized.push(...lines);
        if (section.category === "unknown") uncertainSet.add("profile");
        break;
      default:
        unrecognized.push(...lines);
    }
  }

  const ignoredHeaderNames = structure.ignored
    .filter((entry) => entry.reason === "page-header")
    .map((entry) => entry.block.text.split(/\s*[•|]\s*/)[0]?.trim())
    .filter((value): value is string => Boolean(value));
  const personal = parsePersonal([...ignoredHeaderNames, ...sections.header, ...sections.personal]);
  draft.personal = personal.personal;
  detected.personal = personal.detected;
  if (personal.uncertain && personal.detected) uncertainSet.add("personal");

  const profileLines = nonEmpty(sections.profile);
  const summaryLines = nonEmpty(profileSummaryLines);
  if (profileLines.length) {
    draft.profile.headline = profileLines[0];
    if (profileLines.length > 1) draft.profile.summary = profileLines.slice(1).join("\n");
  }
  if (summaryLines.length) {
    draft.profile.summary = [draft.profile.summary, summaryLines.join("\n")].filter(Boolean).join("\n");
  }
  if (!draft.profile.headline) {
    const role = [...sections.personal, ...ignoredHeaderNames]
      .map(cleanLine)
      .find((line) => titleLike(line) && !EMAIL_RE.test(line) && !PHONE_RE.test(line) && !LINK_RE.test(line) && line.length <= 120);
    if (role) draft.profile.headline = role;
  }
  detected.profile = Boolean(draft.profile.headline || draft.profile.summary);

  draft.experience = experienceEntries;
  detected.experience = draft.experience.length > 0;
  draft.education = parseEducation(sections.education, uncertainSet, unrecognized);
  detected.education = draft.education.length > 0;
  draft.skills = parseSkills(sections.skills, uncertainSet, unrecognized);
  if (draft.personal.fullName) {
    const name = draft.personal.fullName.toLocaleLowerCase("de");
    draft.skills = draft.skills.filter((skill) => skill.toLocaleLowerCase("de") !== name);
  }
  detected.skills = draft.skills.length > 0;
  if (draft.skills.length > 25) uncertainSet.add("skills");
  draft.projects = parseProjects(sections.projects, uncertainSet, unrecognized);
  detected.projects = draft.projects.length > 0;
  draft.certificates = parseCertificates(sections.certificates, uncertainSet, unrecognized);
  detected.certificates = draft.certificates.length > 0;
  draft.languages = parseLanguages(sections.languages, uncertainSet, unrecognized);
  detected.languages = draft.languages.length > 0;
  draft.links = parseLinks(sections.links, unrecognized);
  const linksOutsideSections = collectLinks(Object.values(sections).flat());
  for (const entry of linksOutsideSections) {
    if (!draft.links.some((existing) => existing.url === entry.url)) draft.links.push(entry);
  }
  detected.links = draft.links.length > 0;

  unrecognized.push(...nonEmpty(sections.misc));
  for (const section of uncertainSet) uncertain[section] = true;
  if (!CV_BUILDER_IMPORT_SECTIONS.some((section) => detected[section])) {
    unrecognized.push(...nonEmpty(raw.split("\n")));
  }
  const finalUnrecognized = [...new Set(unrecognized)];
  return {
    draft,
    detected,
    uncertain,
    unrecognized: finalUnrecognized,
    unrecognizedDetails: buildUnassignedDetails(finalUnrecognized, structure, reasonHints),
    mapping: {
      sections: buildSectionMappings(structure.sections).map((section) =>
        section.category === "skills" && draft.skills.length > 25
          ? { ...section, notes: [...section.notes, "skill-candidates-review"] }
          : section
      ),
      timeline: timelineMappings,
    },
    structure,
  };
}

export function hasCvBuilderImportContent(
  result: CvBuilderImportResult,
  section: CvBuilderImportSectionId
): boolean {
  return hasSectionContent(result.draft, section);
}

export function selectCvBuilderImportDraft(
  result: CvBuilderImportResult,
  selected: Iterable<CvBuilderImportSectionId>,
  manualAssignments: CvBuilderImportManualAssignments = {},
  options: CvBuilderImportSelectionOptions = {}
): CvBuilderDraftV1 {
  const selectedSet = new Set(selected);
  const next = createEmptyCvBuilderDraft();
  if (selectedSet.has("personal")) next.personal = { ...result.draft.personal };
  if (selectedSet.has("profile")) next.profile = { ...result.draft.profile };
  if (selectedSet.has("experience")) next.experience = result.draft.experience.map((entry) => ({ ...entry }));
  if (selectedSet.has("education")) next.education = result.draft.education.map((entry) => ({ ...entry }));
  if (selectedSet.has("skills")) {
    const allowed = options.selectedSkills === undefined ? null : new Set(options.selectedSkills);
    next.skills = result.draft.skills.filter((skill) => !allowed || allowed.has(skill));
  }
  if (selectedSet.has("projects")) {
    next.projects = result.draft.projects.map((entry) => ({ ...entry, technologies: [...entry.technologies] }));
  }
  if (selectedSet.has("certificates")) next.certificates = result.draft.certificates.map((entry) => ({ ...entry }));
  if (selectedSet.has("languages")) next.languages = result.draft.languages.map((entry) => ({ ...entry }));
  if (selectedSet.has("links")) next.links = result.draft.links.map((entry) => ({ ...entry }));

  for (const [rawIndex, assignment] of Object.entries(manualAssignments)) {
    const line = result.unrecognized[Number(rawIndex)];
    const decision = typeof assignment === "string"
      ? { target: assignment, status: assignment === "ignore" ? "ignored" as const : "accepted" as const }
      : assignment;
    const target = decision.target;
    const status = decision.status ?? (target === "ignore" ? "ignored" : "accepted");
    const text = (decision.text === undefined ? line : decision.text).trim();
    if (!line || !text || target === "ignore" || status !== "accepted") continue;
    if (target === "profile") {
      next.profile = {
        ...next.profile,
        summary: [next.profile.summary, text].filter(Boolean).join("\n"),
      };
    } else if (target === "skills") {
      for (const candidate of text.split(/[,;|•]/).map((value) => value.trim()).filter(Boolean)) {
        if (!next.skills.includes(candidate)) next.skills.push(candidate);
      }
    } else if (target === "projects") {
      const entry = createProjectEntry();
      next.projects.push({ ...entry, name: text });
    } else if (target === "experience") {
      const entry = createExperienceEntry();
      next.experience.push({ ...entry, position: text, employer: "", startMonth: "", current: false });
    } else if (target === "education") {
      const entry = createEducationEntry();
      next.education.push({ ...entry, institution: text, degree: "", startMonth: "", current: false });
    } else if (target === "certificates") {
      const entry = createCertificateEntry();
      next.certificates.push({ ...entry, name: text });
    } else if (target === "links") {
      for (const entry of collectLinks([text])) {
        if (!next.links.some((existing) => existing.url === entry.url)) next.links.push(entry);
      }
    }
  }
  return next;
}
