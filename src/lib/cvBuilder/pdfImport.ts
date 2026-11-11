import {
  detectCvDocument,
  documentFromText,
  type DetectedCvDocument,
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

export interface CvBuilderImportResult {
  draft: CvBuilderDraftV1;
  detected: Record<CvBuilderImportSectionId, boolean>;
  uncertain: Record<CvBuilderImportSectionId, boolean>;
  unrecognized: string[];
  structure: DetectedCvDocument;
}

export type CvBuilderImportManualTarget =
  | "ignore"
  | "profile"
  | "skills"
  | "projects"
  | "certificates"
  | "links";

export type CvBuilderImportManualAssignments = Record<number, CvBuilderImportManualTarget>;

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
  const label = kind === "github" ? "GitHub" : kind === "linkedin" ? "LinkedIn" : "Portfolio";
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

function degreeLike(value: string): boolean {
  return /\b(bachelor|master|b\.?sc|m\.?sc|b\.?a|m\.?a|diplom|phd|doktor|doctor|staatsexamen|ausbildung|lehre|abitur|fachwirt|mba)\b/i.test(value);
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
      position = afterParts[0];
      employer = afterParts[1] ?? "";
      after = [...afterParts.slice(2), ...nonEmpty(block.slice(dateIndex + 1))];
      if (!employer) uncertain.add("experience");
    } else if (before.length === 1) {
      if (companyLike(before[0])) employer = before[0];
      else if (titleLike(before[0])) position = before[0];
      else {
        employer = before[0];
        uncertain.add("experience");
      }
    } else if (before.length >= 2) {
      const first = before[0];
      const second = before[1];
      if (companyLike(first) && !companyLike(second)) {
        employer = first;
        position = second;
      } else if (titleLike(first) && !titleLike(second)) {
        position = first;
        employer = second;
      } else {
        employer = first;
        position = second;
      }
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

function parseEducation(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["education"] {
  const entries: CvBuilderDraftV1["education"] = [];
  for (const block of splitBlocks(lines)) {
    const dateIndex = block.findIndex((line) => parseDateRange(line) !== null);
    if (dateIndex < 0) {
      const lines = nonEmpty(block);
      if (!lines.length) continue;
      if (/^(professional development|certifications?|certificates?|further education|weiterbildung|fortbildung)\b/i.test(lines[0])) {
        unrecognized.push(...lines);
        uncertain.add("education");
        continue;
      }
      let institution = "";
      let degree = "";
      if (degreeLike(lines[0])) {
        const split = lines[0].split(/\s+(?:–|—|-|at|an)\s+/i);
        degree = split[0].trim();
        institution = split[1]?.trim() ?? "";
      } else institution = lines[0];
      if (!institution && !degree) {
        unrecognized.push(...lines);
        continue;
      }
      uncertain.add("education");
      const entry = createEducationEntry();
      entries.push({
        ...entry,
        institution,
        degree,
        startMonth: "",
        current: false,
        ...(lines.length > 1 ? { description: lines.slice(1).join("\n") } : {}),
      });
      continue;
    }
    const date = parseDateRange(block[dateIndex]);
    if (!date) continue;
    const dateLine = block[dateIndex];
    const beforeText = dateLine.slice(0, date.matchIndex).replace(/[|,;–—-]\s*$/, "").trim();
    const afterText = dateLine.slice(date.matchIndex).replace(DATE_RANGE, "").replace(SINCE_DATE, "").replace(/^[|,;–—-]\s*/, "").trim();
    const before = [...nonEmpty(block.slice(0, dateIndex)), ...splitLineParts(beforeText)];
    const after = [...(afterText ? [afterText] : []), ...nonEmpty(block.slice(dateIndex + 1))];
    let institution = "";
    let degree = "";
    if (before.length === 1) {
      if (degreeLike(before[0])) degree = before[0];
      else institution = before[0];
    } else if (before.length >= 2) {
      const first = before[0];
      const second = before[1];
      if (degreeLike(first) && !degreeLike(second)) {
        degree = first;
        institution = second;
      } else {
        institution = first;
        degree = second;
      }
    }
    if (!institution || !degree || date.uncertain) uncertain.add("education");
    const entry = createEducationEntry();
    entries.push({
      ...entry,
      institution,
      degree,
      startMonth: date.startMonth,
      ...(date.endMonth ? { endMonth: date.endMonth } : {}),
      current: date.current,
      ...(after.length ? { description: after.join("\n") } : {}),
    });
  }
  return entries;
}

function parseProjects(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["projects"] {
  const entries: CvBuilderDraftV1["projects"] = [];
  for (const block of splitProjectBlocks(lines)) {
    const cleaned = nonEmpty(block);
    if (!cleaned.length) continue;
    const name = cleaned[0];
    if (!name) continue;
    let descriptionLines = cleaned.slice(1);
    const technologies: string[] = [];
    descriptionLines = descriptionLines.filter((line) => {
      const tech = line.match(/^(?:technologien|technologies|tech(?: stack)?|stack|tools)\s*[:\-]\s*(.+)$/i);
      if (tech) {
        technologies.push(
          ...tech[1]
            .split(/[,;|]/)
            .map((item) => item.trim().replace(/[.]+$/, ""))
            .filter(isSkillCandidate)
        );
        return false;
      }
      if (linksInLine(line).length > 0 && line.replace(LINK_RE, "").replace(/[·|:]/g, "").trim().length < 20) {
        return false;
      }
      return true;
    });
    if (!descriptionLines.length && !technologies.length) uncertain.add("projects");
    const entry = createProjectEntry();
    entries.push({
      ...entry,
      name,
      ...(descriptionLines.length ? { description: descriptionLines.join("\n") } : {}),
      technologies,
    });
  }
  if (!entries.length && lines.length) unrecognized.push(...nonEmpty(lines));
  return entries;
}

function parseCertificates(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["certificates"] {
  const entries: CvBuilderDraftV1["certificates"] = [];
  for (const line of nonEmpty(lines)) {
    if (/\b(?:zertifizierungsziel|zertifizierungsstatus|target certification|planned certification|in planung|geplant)\b/i.test(line)) {
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
        personal.fullName = candidate;
      }
    }
    if (!personal.location && /,/.test(line) && !email && !LINK_RE.test(line) && !PHONE_RE.test(line) && line.length <= 100) {
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

const SKILL_CATEGORY_PREFIX = /^(?:architecture|programming(?: languages?)?|languages?|frameworks?|libraries|tools?|platforms?|databases?|cloud|cloud\s*[&+]\s*devops|software\s*[&+]\s*data|data\s*[&+]\s*integration|ai engineering|development|infrastructure|devops|methoden|methodologies|technologien|technologies)\s*[:\-]\s*/i;
const SKILL_SENTENCE_WORDS = /\b(developed|built|implemented|responsible|worked|created|designed|managed|supported|led|maintained|entwickelt|umgesetzt|verantwortlich|betreut|erstellt|konzipiert|unterstützt|geleitet|gewartet|durchgeführt)\b/i;

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
  for (const line of nonEmpty(lines)) {
    const previous = mergedLines[mergedLines.length - 1];
    const continuation =
      previous &&
      !/[.!?]$/.test(previous) &&
      !/:$/.test(previous) &&
      /^[A-ZÄÖÜ]/.test(line) &&
      !SKILL_CATEGORY_PREFIX.test(line) &&
      !SKILL_SENTENCE_WORDS.test(line) &&
      !sectionFor(line);
    if (continuation) mergedLines[mergedLines.length - 1] = `${previous} ${line}`;
    else mergedLines.push(line);
  }
  for (const line of mergedLines) {
    const cleaned = line.replace(SKILL_CATEGORY_PREFIX, "");
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (!cleaned) continue;
    if (words.length > 8 && !/[,;|•]/.test(cleaned)) {
      unrecognized.push(line);
      uncertain.add("skills");
      continue;
    }
    const candidates = cleaned.split(/[,;|•]/).map((value) => value.trim()).filter(Boolean);
    for (const candidate of candidates) {
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
  const document = source ?? documentFromText(preprocessLines(raw).join("\n"));
  const structure = detectCvDocument(document);

  for (const section of structure.sections) {
    const lines = mergeSectionLines(section);
    switch (section.category) {
      case "personal":
        sections.personal.push(...lines);
        break;
      case "profile":
        sections.profile.push(...lines);
        break;
      case "skills":
        sections.skills.push(...lines);
        break;
      case "projects":
        sections.projects.push(...lines);
        break;
      case "education":
        sections.education.push(...lines);
        break;
      case "certificates":
        if (/status|ziel|target|planned|planung|geplant/i.test(section.heading)) {
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
        const timeline = section.timeline ?? [];
        const excluded = timeline.filter((item) => item.kind === "project" || item.kind === "training" || item.kind === "qualification");
        if (excluded.length) uncertainSet.add("experience");
        for (const item of excluded) unrecognized.push(...item.lines);
        const keptItems = timeline.filter((item) => !excluded.includes(item));
        const kept = keptItems.flatMap((item) => [...item.lines, ""]);
        sections.experience.push(...(kept.length ? kept : lines));
        break;
      }
      case "mixed": {
        const languageLines = lines.filter(isLanguageLine);
        const nonLanguageLines = lines.filter((line) => !isLanguageLine(line));
        sections.languages.push(...languageLines);
        sections.education.push(...nonLanguageLines);
        if (languageLines.length && nonLanguageLines.length) uncertainSet.add("education");
        break;
      }
      case "target-roles":
      case "training":
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

  const personal = parsePersonal([...sections.header, ...sections.personal]);
  draft.personal = personal.personal;
  detected.personal = personal.detected;
  if (personal.uncertain && personal.detected) uncertainSet.add("personal");

  const profileLines = nonEmpty(sections.profile);
  if (profileLines.length) {
    draft.profile.headline = profileLines[0];
    if (profileLines.length > 1) draft.profile.summary = profileLines.slice(1).join("\n");
    detected.profile = true;
  }

  draft.experience = parseExperience(sections.experience, uncertainSet, unrecognized);
  detected.experience = draft.experience.length > 0;
  draft.education = parseEducation(sections.education, uncertainSet, unrecognized);
  detected.education = draft.education.length > 0;
  draft.skills = parseSkills(sections.skills, uncertainSet, unrecognized);
  detected.skills = draft.skills.length > 0;
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
  return { draft, detected, uncertain, unrecognized: [...new Set(unrecognized)], structure };
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
  manualAssignments: CvBuilderImportManualAssignments = {}
): CvBuilderDraftV1 {
  const selectedSet = new Set(selected);
  const next = createEmptyCvBuilderDraft();
  if (selectedSet.has("personal")) next.personal = { ...result.draft.personal };
  if (selectedSet.has("profile")) next.profile = { ...result.draft.profile };
  if (selectedSet.has("experience")) next.experience = result.draft.experience.map((entry) => ({ ...entry }));
  if (selectedSet.has("education")) next.education = result.draft.education.map((entry) => ({ ...entry }));
  if (selectedSet.has("skills")) next.skills = [...result.draft.skills];
  if (selectedSet.has("projects")) {
    next.projects = result.draft.projects.map((entry) => ({ ...entry, technologies: [...entry.technologies] }));
  }
  if (selectedSet.has("certificates")) next.certificates = result.draft.certificates.map((entry) => ({ ...entry }));
  if (selectedSet.has("languages")) next.languages = result.draft.languages.map((entry) => ({ ...entry }));
  if (selectedSet.has("links")) next.links = result.draft.links.map((entry) => ({ ...entry }));

  for (const [rawIndex, target] of Object.entries(manualAssignments)) {
    const line = result.unrecognized[Number(rawIndex)];
    if (!line || target === "ignore") continue;
    if (target === "profile") {
      next.profile = {
        ...next.profile,
        summary: [next.profile.summary, line].filter(Boolean).join("\n"),
      };
    } else if (target === "skills") {
      for (const candidate of line.split(/[,;|•]/).map((value) => value.trim()).filter(Boolean)) {
        if (!next.skills.includes(candidate)) next.skills.push(candidate);
      }
    } else if (target === "projects") {
      const entry = createProjectEntry();
      next.projects.push({ ...entry, name: line });
    } else if (target === "certificates") {
      const entry = createCertificateEntry();
      next.certificates.push({ ...entry, name: line });
    } else if (target === "links") {
      for (const entry of collectLinks([line])) {
        if (!next.links.some((existing) => existing.url === entry.url)) next.links.push(entry);
      }
    }
  }
  return next;
}
