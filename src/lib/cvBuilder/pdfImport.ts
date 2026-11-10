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
  projects: ["projekte", "project experience", "projects", "project work"],
  certificates: [
    "zertifikate", "zertifizierungen", "weiterbildungen", "certificates", "certifications", "courses",
  ],
  languages: ["sprachen", "sprachkenntnisse", "languages", "language skills"],
  links: ["links", "websites", "portfolio", "profile links", "online profiles"],
};

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

function normalizedHeading(line: string): string {
  return line
    .replace(/^[-•*]\s*/, "")
    .replace(/[:：]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de");
}

function sectionFor(line: string): CvBuilderImportSectionId | null {
  const normalized = normalizedHeading(line);
  for (const section of CV_BUILDER_IMPORT_SECTIONS) {
    if (SECTION_ALIASES[section].includes(normalized)) return section;
  }
  return null;
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

function parseExperience(lines: string[], uncertain: Set<CvBuilderImportSectionId>, unrecognized: string[]): CvBuilderDraftV1["experience"] {
  const entries: CvBuilderDraftV1["experience"] = [];
  for (const block of splitBlocks(lines)) {
    const dateIndex = block.findIndex((line) => parseDateRange(line) !== null);
    if (dateIndex < 0) {
      unrecognized.push(...nonEmpty(block));
      continue;
    }
    const date = parseDateRange(block[dateIndex]);
    if (!date) continue;
    const dateLine = block[dateIndex];
    const beforeText = dateLine.slice(0, date.matchIndex).replace(/[|,;–—-]\s*$/, "").trim();
    const afterText = dateLine.slice(date.matchIndex).replace(DATE_RANGE, "").replace(SINCE_DATE, "").replace(/^[|,;–—-]\s*/, "").trim();
    const before = [...nonEmpty(block.slice(0, dateIndex)), ...splitLineParts(beforeText)];
    const after = [...(afterText ? [afterText] : []), ...nonEmpty(block.slice(dateIndex + 1))];
    let employer = "";
    let position = "";
    if (before.length === 1) {
      if (companyLike(before[0])) employer = before[0];
      else if (titleLike(before[0])) position = before[0];
      else employer = before[0];
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
    if (!employer || !position || date.uncertain) uncertain.add("experience");
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
      unrecognized.push(...nonEmpty(block));
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
  for (const block of splitBlocks(lines)) {
    const cleaned = nonEmpty(block);
    if (!cleaned.length) continue;
    const name = cleaned[0];
    if (!name) continue;
    let descriptionLines = cleaned.slice(1);
    const technologies: string[] = [];
    descriptionLines = descriptionLines.filter((line) => {
      const tech = line.match(/^(?:technologien|technologies|tech(?: stack)?|stack|tools)\s*[:\-]\s*(.+)$/i);
      if (!tech) return true;
      technologies.push(...tech[1].split(/[,;|]/).map((item) => item.trim()).filter(Boolean));
      return false;
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

function parseCertificates(lines: string[], uncertain: Set<CvBuilderImportSectionId>): CvBuilderDraftV1["certificates"] {
  const entries: CvBuilderDraftV1["certificates"] = [];
  for (const line of nonEmpty(lines)) {
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
    const match = line.match(/^([^:–—()\-]+?)\s*(?:[:–—(]|\s-\s)\s*(.+?)\)?$/);
    if (!match) {
      unrecognized.push(line);
      continue;
    }
    const language = cleanLine(match[1]);
    const levelText = match[2];
    const level = LANGUAGE_LEVELS.find(([pattern]) => pattern.test(levelText))?.[1];
    if (!language || !level) {
      unrecognized.push(line);
      uncertain.add("languages");
      continue;
    }
    const entry = createLanguageEntry();
    entries.push({ ...entry, language, level });
  }
  return entries;
}

function parseLinks(lines: string[], unrecognized: string[]): CvBuilderDraftV1["links"] {
  const entries: CvBuilderDraftV1["links"] = [];
  const seen = new Set<string>();
  for (const line of nonEmpty(lines)) {
    const match = line.match(LINK_RE);
    if (!match) {
      unrecognized.push(line);
      continue;
    }
    let url = match[1];
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const lower = url.toLocaleLowerCase("en");
    const kind = lower.includes("github") ? "github" : lower.includes("linkedin") ? "linkedin" : "portfolio";
    const label = kind === "github" ? "GitHub" : kind === "linkedin" ? "LinkedIn" : "Portfolio";
    const entry = createLinkEntry();
    entries.push({ ...entry, kind, label, url });
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

function splitSkills(lines: string[]): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const line of nonEmpty(lines)) {
    const cleaned = line.replace(/^(skills?|fähigkeiten|kenntnisse)\s*[:\-]\s*/i, "");
    for (const item of cleaned.split(/[,;|•]/).map((value) => value.trim()).filter(Boolean)) {
      const key = item.toLocaleLowerCase("de");
      if (!seen.has(key)) {
        seen.add(key);
        skills.push(item);
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

export function parseCvBuilderImportText(raw: string): CvBuilderImportResult {
  const draft = createEmptyCvBuilderDraft();
  const detected = emptyDetected();
  const uncertain = emptyUncertain();
  const uncertainSet = new Set<CvBuilderImportSectionId>();
  const unrecognized: string[] = [];
  const sections: Record<WorkingSection, string[]> = {
    header: [], misc: [], personal: [], profile: [], experience: [], education: [], skills: [], projects: [], certificates: [], languages: [], links: [],
  };
  let current: WorkingSection = "header";
  for (const rawLine of raw.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      sections[current].push("");
      continue;
    }
    const normalized = normalizedHeading(line);
    if (["sonstiges", "weitere angaben", "additional information", "other", "misc"].includes(normalized)) {
      current = "misc";
      continue;
    }
    const section = sectionFor(line);
    if (section) {
      current = section;
      detected[section] = true;
      continue;
    }
    sections[current].push(line);
  }

  const personal = parsePersonal([...sections.header, ...sections.personal]);
  draft.personal = personal.personal;
  detected.personal = detected.personal || personal.detected;
  if (personal.uncertain && personal.detected) uncertainSet.add("personal");

  const profileLines = nonEmpty(sections.profile);
  if (profileLines.length) {
    draft.profile.headline = profileLines[0];
    if (profileLines.length > 1) draft.profile.summary = profileLines.slice(1).join("\n");
    detected.profile = true;
  }

  draft.experience = parseExperience(sections.experience, uncertainSet, unrecognized);
  detected.experience = detected.experience || draft.experience.length > 0;
  draft.education = parseEducation(sections.education, uncertainSet, unrecognized);
  detected.education = detected.education || draft.education.length > 0;
  draft.skills = splitSkills(sections.skills);
  detected.skills = detected.skills || draft.skills.length > 0;
  draft.projects = parseProjects(sections.projects, uncertainSet, unrecognized);
  detected.projects = detected.projects || draft.projects.length > 0;
  draft.certificates = parseCertificates(sections.certificates, uncertainSet);
  detected.certificates = detected.certificates || draft.certificates.length > 0;
  draft.languages = parseLanguages(sections.languages, uncertainSet, unrecognized);
  detected.languages = detected.languages || draft.languages.length > 0;
  draft.links = parseLinks(sections.links, unrecognized);
  detected.links = detected.links || draft.links.length > 0;

  unrecognized.push(...nonEmpty(sections.misc));
  for (const section of uncertainSet) uncertain[section] = true;
  if (!CV_BUILDER_IMPORT_SECTIONS.some((section) => detected[section])) {
    unrecognized.push(...nonEmpty(raw.split("\n")));
  }
  return { draft, detected, uncertain, unrecognized: [...new Set(unrecognized)] };
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
  includeUnrecognized = false
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
  if (includeUnrecognized && result.unrecognized.length) {
    const extra = `Weitere Angaben aus dem Import:\n${result.unrecognized.join("\n")}`;
    next.profile = {
      ...next.profile,
      summary: [next.profile.summary, extra].filter(Boolean).join("\n\n"),
    };
  }
  return next;
}
