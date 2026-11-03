export const CV_BUILDER_SCHEMA_VERSION = 1 as const;

export type CvBuilderDateMonth = string; // YYYY-MM, intentionally no day/time zone.
export type CvBuilderLanguageLevel = "basic" | "conversational" | "professional" | "fluent" | "native";
export type CvBuilderLinkKind = "portfolio" | "github" | "linkedin" | "other";

export interface CvBuilderPersonalV1 {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
}

export interface CvBuilderProfileV1 {
  headline?: string;
  summary?: string;
}

export interface CvBuilderExperienceV1 {
  id: string;
  employer: string;
  position: string;
  startMonth: CvBuilderDateMonth;
  endMonth?: CvBuilderDateMonth;
  current: boolean;
  description?: string;
}

export interface CvBuilderEducationV1 {
  id: string;
  institution: string;
  degree: string;
  startMonth: CvBuilderDateMonth;
  endMonth?: CvBuilderDateMonth;
  current: boolean;
  description?: string;
}

export interface CvBuilderProjectV1 {
  id: string;
  name: string;
  description?: string;
  technologies: string[];
}

export interface CvBuilderCertificateV1 {
  id: string;
  name: string;
  issuer?: string;
  date?: CvBuilderDateMonth;
}

export interface CvBuilderLanguageV1 {
  id: string;
  language: string;
  level: CvBuilderLanguageLevel;
}

export interface CvBuilderLinkV1 {
  id: string;
  kind: CvBuilderLinkKind;
  label: string;
  url: string;
}

export interface CvBuilderDraftV1 {
  schemaVersion: typeof CV_BUILDER_SCHEMA_VERSION;
  personal: CvBuilderPersonalV1;
  profile: CvBuilderProfileV1;
  experience: CvBuilderExperienceV1[];
  education: CvBuilderEducationV1[];
  skills: string[];
  projects: CvBuilderProjectV1[];
  certificates: CvBuilderCertificateV1[];
  languages: CvBuilderLanguageV1[];
  links: CvBuilderLinkV1[];
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyCvBuilderDraft(): CvBuilderDraftV1 {
  return {
    schemaVersion: CV_BUILDER_SCHEMA_VERSION,
    personal: {},
    profile: {},
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certificates: [],
    languages: [],
    links: [],
  };
}

export function createExperienceEntry(): CvBuilderExperienceV1 {
  return {
    id: newId("exp"),
    employer: "",
    position: "",
    startMonth: "",
    current: false,
  };
}

export function createEducationEntry(): CvBuilderEducationV1 {
  return {
    id: newId("edu"),
    institution: "",
    degree: "",
    startMonth: "",
    current: false,
  };
}

export function createProjectEntry(): CvBuilderProjectV1 {
  return { id: newId("project"), name: "", technologies: [] };
}

export function createCertificateEntry(): CvBuilderCertificateV1 {
  return { id: newId("cert"), name: "" };
}

export function createLanguageEntry(): CvBuilderLanguageV1 {
  return { id: newId("lang"), language: "", level: "professional" };
}

export function createLinkEntry(): CvBuilderLinkV1 {
  return { id: newId("link"), kind: "portfolio", label: "", url: "" };
}

export function hasCvBuilderContent(draft: CvBuilderDraftV1): boolean {
  const personal = Object.values(draft.personal).some((value) => String(value ?? "").trim());
  const profile = Object.values(draft.profile).some((value) => String(value ?? "").trim());
  return (
    personal ||
    profile ||
    draft.skills.length > 0 ||
    draft.experience.length > 0 ||
    draft.education.length > 0 ||
    draft.projects.length > 0 ||
    draft.certificates.length > 0 ||
    draft.languages.length > 0 ||
    draft.links.length > 0
  );
}

export function isCvBuilderEntryEmpty(entry: Record<string, unknown>): boolean {
  return !Object.entries(entry).some(([key, value]) => {
    if (key === "id" || key === "current") return false;
    if (key === "kind" || key === "level") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return value;
    return String(value ?? "").trim().length > 0;
  });
}
