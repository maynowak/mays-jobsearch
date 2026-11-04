import { anonymizeText } from "../anonymize";
import {
  isCvBuilderEntryEmpty,
  type CvBuilderDraftV1,
  type CvBuilderEducationV1,
  type CvBuilderExperienceV1,
  type CvBuilderPersonalV1,
} from "./contractTypes";

export type CvBuilderTextLanguage = "de" | "en";

const LABELS = {
  de: {
    profile: "Berufliches Profil",
    experience: "Berufserfahrung",
    education: "Ausbildung",
    skills: "Fähigkeiten",
    projects: "Projekte",
    certificates: "Zertifikate",
    languages: "Sprachen",
    present: "heute",
  },
  en: {
    profile: "Professional profile",
    experience: "Work experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    certificates: "Certificates",
    languages: "Languages",
    present: "Present",
  },
} as const;

function text(value: string | undefined): string {
  return String(value ?? "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactKnownPersonalData(
  value: string,
  personal: CvBuilderPersonalV1
): string {
  let result = value;
  const replacements: Array<[string | undefined, string]> = [
    [personal.fullName, "[NAME]"],
    [personal.email, "[E-MAIL]"],
    [personal.phone, "[TELEFON]"],
    [personal.location, "[ORT]"],
  ];
  for (const [term, placeholder] of replacements) {
    const normalized = text(term);
    if (!normalized) continue;
    result = result.replace(new RegExp(escapeRegExp(normalized), "giu"), placeholder);
  }
  return result
    .replace(/\bhttps?:\/\/[^\s]+/giu, "[LINK]")
    .replace(/\bwww\.[^\s]+/giu, "[LINK]");
}

function safeFreeText(
  value: string | undefined,
  personal: CvBuilderPersonalV1
): string {
  const normalized = text(value);
  if (!normalized) return "";
  return redactKnownPersonalData(anonymizeText(normalized), personal).trim();
}

function formatMonth(value: string | undefined): string {
  if (!value || !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(value)) return "";
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
  return end ? `${start} – ${end}` : start;
}

function historyLine(
  entry: CvBuilderExperienceV1 | CvBuilderEducationV1,
  presentLabel: string,
  personal: CvBuilderPersonalV1
): string[] {
  if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return [];
  const primary = redactKnownPersonalData(
    "position" in entry ? text(entry.position) : text(entry.degree),
    personal
  );
  const secondary = redactKnownPersonalData(
    "employer" in entry ? text(entry.employer) : text(entry.institution),
    personal
  );
  const range = formatRange(entry, presentLabel);
  const head = [primary, secondary].filter(Boolean).join(" @ ");
  const lines = [head, range].filter(Boolean);
  const description = safeFreeText(entry.description, personal);
  if (description) lines.push(description);
  return lines.length ? [lines.join(" · ")] : [];
}

/**
 * Deterministic, data-minimising CV text for the existing cover-letter flow.
 *
 * Contact fields (name, e-mail, phone, location), links/URLs and unknown fields
 * are deliberately excluded. Free-text fields pass through the existing
 * anonymizer; this remains a risk reduction, not a guarantee of anonymity.
 */
export function hasCvBuilderTextContent(draft: CvBuilderDraftV1): boolean {
  if (text(draft.profile.headline) || text(draft.profile.summary)) return true;
  if (draft.skills.some((skill) => text(skill))) return true;
  return (
    draft.experience.some((entry) =>
      !isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)
    ) ||
    draft.education.some((entry) =>
      !isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)
    ) ||
    draft.projects.some((entry) =>
      !isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)
    ) ||
    draft.certificates.some((entry) =>
      !isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)
    ) ||
    draft.languages.some((entry) => text(entry.language))
  );
}

export function cvBuilderToAnonymizedText(
  draft: CvBuilderDraftV1,
  language: CvBuilderTextLanguage = "de"
): string {
  const labels = LABELS[language];
  const sections: string[] = [];

  const headline = redactKnownPersonalData(
    text(draft.profile.headline),
    draft.personal
  );
  const summary = safeFreeText(draft.profile.summary, draft.personal);
  if (headline || summary) {
    sections.push(
      [labels.profile, headline, summary].filter(Boolean).join("\n")
    );
  }

  const experience = draft.experience.flatMap((entry) =>
    historyLine(entry, labels.present, draft.personal)
  );
  if (experience.length) {
    sections.push([labels.experience, ...experience].join("\n"));
  }

  const education = draft.education.flatMap((entry) =>
    historyLine(entry, labels.present, draft.personal)
  );
  if (education.length) {
    sections.push([labels.education, ...education].join("\n"));
  }

  const skills = draft.skills.map(text).filter(Boolean);
  if (skills.length) {
    sections.push(`${labels.skills}\n${skills.join(", ")}`);
  }

  const projects = draft.projects.flatMap((entry) => {
    if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return [];
    const name = redactKnownPersonalData(text(entry.name), draft.personal);
    const technologies = entry.technologies
      .map((technology) => redactKnownPersonalData(text(technology), draft.personal))
      .filter(Boolean);
    const description = safeFreeText(entry.description, draft.personal);
    const head = [name, technologies.length ? `(${technologies.join(", ")})` : ""]
      .filter(Boolean)
      .join(" ");
    return head || description
      ? [[head, description].filter(Boolean).join(" · ")]
      : [];
  });
  if (projects.length) {
    sections.push([labels.projects, ...projects].join("\n"));
  }

  const certificates = draft.certificates.flatMap((entry) => {
    if (isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)) return [];
    const name = redactKnownPersonalData(text(entry.name), draft.personal);
    const issuer = redactKnownPersonalData(text(entry.issuer), draft.personal);
    const date = formatMonth(entry.date);
    const line = [name, issuer, date].filter(Boolean).join(" · ");
    return line ? [line] : [];
  });
  if (certificates.length) {
    sections.push([labels.certificates, ...certificates].join("\n"));
  }

  const languages = draft.languages.flatMap((entry) => {
    const language = redactKnownPersonalData(text(entry.language), draft.personal);
    return language ? [`${language} (${entry.level})`] : [];
  });
  if (languages.length) {
    sections.push([labels.languages, ...languages].join("\n"));
  }

  return sections.join("\n\n").trim();
}
