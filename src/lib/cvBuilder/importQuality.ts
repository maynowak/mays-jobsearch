import {
  createCertificateEntry,
  createEducationEntry,
  createExperienceEntry,
  createLinkEntry,
  createProjectEntry,
  type CvBuilderDraftV1,
} from "./contractTypes";
import type {
  CvBuilderImportManualTarget,
  CvBuilderImportResult,
  CvBuilderImportSectionId,
  CvBuilderImportUnassignedReason,
} from "./pdfImport";

export type ManualReviewStatus = "pending" | "accepted" | "ignored";

export interface ManualReviewDecision {
  target: CvBuilderImportManualTarget;
  status: ManualReviewStatus;
  text: string;
  original: string;
  edited: boolean;
}

export interface CvBuilderImportReviewItem {
  id: string;
  index: number;
  text: string;
  original: string;
  edited: boolean;
  target: CvBuilderImportManualTarget;
  status: ManualReviewStatus;
  applied?: boolean;
  page?: number;
  sectionHeading?: string;
  reason: CvBuilderImportUnassignedReason;
  suggestedTarget: CvBuilderImportManualTarget;
}

export interface CvBuilderImportReviewSummary {
  total: number;
  pending: number;
  accepted: number;
  ignored: number;
  items?: CvBuilderImportReviewItem[];
  skills?: {
    total: number;
    selected: number;
    unselected: number;
    limited: boolean;
  };
  pageCount?: number;
  sourceName?: string;
  pendingAcknowledged?: boolean;
  selectedSections?: CvBuilderImportSectionId[];
}

function itemId(index: number, page: number | undefined): string {
  return `review-${index}-${page ?? 1}`;
}

export function buildCvBuilderImportReport(
  result: CvBuilderImportResult,
  decisions: Record<number, ManualReviewDecision>,
  selected: Set<CvBuilderImportSectionId>,
  selectedSkills: Set<string>,
  pendingAcknowledged: boolean,
  sourceName: string
): CvBuilderImportReviewSummary {
  const items: CvBuilderImportReviewItem[] = result.unrecognized.map((line, index) => {
    const detail = result.unrecognizedDetails[index];
    const decision = decisions[index];
    const original = detail?.line ?? line;
    const target = decision?.target ?? detail?.suggestedTarget ?? "ignore";
    const status = decision?.status ?? "pending";
    return {
      id: itemId(index, detail?.page),
      index,
      text: decision?.text ?? original,
      original,
      edited: Boolean(decision?.edited),
      target,
      status,
      ...(detail?.page ? { page: detail.page } : {}),
      ...(detail?.sectionHeading ? { sectionHeading: detail.sectionHeading } : {}),
      reason: detail?.reason ?? "ambiguous",
      suggestedTarget: detail?.suggestedTarget ?? "ignore",
    };
  });
  const skills = result.draft.skills.length;
  return {
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    accepted: items.filter((item) => item.status === "accepted").length,
    ignored: items.filter((item) => item.status === "ignored").length,
    items,
    skills: {
      total: skills,
      selected: [...selectedSkills].filter((skill) => result.draft.skills.includes(skill)).length,
      unselected: skills - [...selectedSkills].filter((skill) => result.draft.skills.includes(skill)).length,
      limited: skills > 25,
    },
    pageCount: result.structure.pageCount,
    sourceName,
    pendingAcknowledged,
    selectedSections: [...selected],
  };
}

export function updateCvBuilderImportReviewItem(
  report: CvBuilderImportReviewSummary,
  id: string,
  patch: Partial<Pick<CvBuilderImportReviewItem, "text" | "target" | "status" | "applied">>
): CvBuilderImportReviewSummary {
  const items = (report.items ?? []).map((item) => item.id === id
    ? { ...item, ...patch, ...(patch.text !== undefined ? { edited: true, applied: false } : {}) }
    : item);
  return {
    ...report,
    items,
    pending: items.filter((item) => item.status === "pending").length,
    accepted: items.filter((item) => item.status === "accepted").length,
    ignored: items.filter((item) => item.status === "ignored").length,
  };
}

/** Adds an explicitly accepted review item without changing the CV schema. */
export interface ApplyImportReviewItemResult {
  draft: CvBuilderDraftV1;
  applied: boolean;
  error?: "invalid-experience" | "invalid-education" | "invalid-link";
}

/** Adds an explicitly accepted review item without changing the CV schema. */
export function applyImportReviewItem(
  draft: CvBuilderDraftV1,
  item: CvBuilderImportReviewItem
): ApplyImportReviewItemResult {
  const text = item.text.trim();
  if (!text) return { draft, applied: false };
  const key = text.toLocaleLowerCase("de");
  switch (item.target) {
    case "skills":
      if (draft.skills.some((skill) => skill.toLocaleLowerCase("de") === key)) return { draft, applied: true };
      return { draft: { ...draft, skills: [...draft.skills, text] }, applied: true };
    case "experience": {
      const parts = text.split(/\s*(?:\||–|—)\s*/).map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) return { draft, applied: false, error: "invalid-experience" };
      const position = parts[0];
      const employer = parts[1];
      if (draft.experience.some((entry) => entry.position.toLocaleLowerCase("de") === position.toLocaleLowerCase("de") && entry.employer.toLocaleLowerCase("de") === employer.toLocaleLowerCase("de"))) {
        return { draft, applied: true };
      }
      return {
        draft: {
          ...draft,
          experience: [...draft.experience, { ...createExperienceEntry(), position, employer }],
        },
        applied: true,
      };
    }
    case "education": {
      const parts = text.split(/\s*(?:\||–|—)\s*/).map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) return { draft, applied: false, error: "invalid-education" };
      const institution = parts.at(-1) ?? "";
      const degree = parts[0];
      if (draft.education.some((entry) => entry.institution.toLocaleLowerCase("de") === institution.toLocaleLowerCase("de") && entry.degree.toLocaleLowerCase("de") === degree.toLocaleLowerCase("de"))) {
        return { draft, applied: true };
      }
      return {
        draft: {
          ...draft,
          education: [...draft.education, { ...createEducationEntry(), institution, degree }],
        },
        applied: true,
      };
    }
    case "projects":
      if (draft.projects.some((project) => project.name.toLocaleLowerCase("de") === key)) return { draft, applied: true };
      return { draft: { ...draft, projects: [...draft.projects, { ...createProjectEntry(), name: text }] }, applied: true };
    case "certificates":
      if (draft.certificates.some((certificate) => certificate.name.toLocaleLowerCase("de") === key)) return { draft, applied: true };
      return { draft: { ...draft, certificates: [...draft.certificates, { ...createCertificateEntry(), name: text }] }, applied: true };
    case "profile":
      if (draft.profile.summary?.toLocaleLowerCase("de").includes(key)) return { draft, applied: true };
      return {
        draft: {
          ...draft,
          profile: {
            ...draft.profile,
            summary: [draft.profile.summary, text].filter(Boolean).join("\n").slice(0, 4000),
          },
        },
        applied: true,
      };
    case "links": {
      if (!/^https?:\/\//i.test(text)) return { draft, applied: false, error: "invalid-link" };
      if (draft.links.some((link) => link.url === text)) return { draft, applied: true };
      return { draft: { ...draft, links: [...draft.links, { ...createLinkEntry(), label: text, url: text }] }, applied: true };
    }
    case "ignore":
    default:
      return { draft, applied: false };
  }
}

export interface CvBuilderImportReviewStore {
  get(cvId: string): CvBuilderImportReviewSummary | null;
  set(cvId: string, report: CvBuilderImportReviewSummary): void;
  delete(cvId: string): void;
  clear(): void;
}

/** Session-only profile → import report mapping. Never persisted. */
export function createCvBuilderImportReviewStore(): CvBuilderImportReviewStore {
  const reports = new Map<string, CvBuilderImportReviewSummary>();
  return {
    get(cvId) { return reports.get(cvId) ?? null; },
    set(cvId, report) { reports.set(cvId, report); },
    delete(cvId) { reports.delete(cvId); },
    clear() { reports.clear(); },
  };
}
