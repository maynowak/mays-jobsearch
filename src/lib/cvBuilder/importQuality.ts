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
  patch: Partial<Pick<CvBuilderImportReviewItem, "text" | "target" | "status">>
): CvBuilderImportReviewSummary {
  const items = (report.items ?? []).map((item) => item.id === id
    ? { ...item, ...patch, ...(patch.text !== undefined ? { edited: true } : {}) }
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
export function applyImportReviewItem(
  draft: CvBuilderDraftV1,
  item: CvBuilderImportReviewItem
): CvBuilderDraftV1 {
  const text = item.text.trim();
  if (!text) return draft;
  const key = text.toLocaleLowerCase("de");
  switch (item.target) {
    case "skills":
      if (draft.skills.some((skill) => skill.toLocaleLowerCase("de") === key)) return draft;
      return { ...draft, skills: [...draft.skills, text] };
    case "experience":
      return {
        ...draft,
        experience: [
          ...draft.experience,
          { ...createExperienceEntry(), position: text, employer: "" },
        ],
      };
    case "education":
      return {
        ...draft,
        education: [
          ...draft.education,
          { ...createEducationEntry(), institution: "", degree: text },
        ],
      };
    case "projects":
      if (draft.projects.some((project) => project.name.toLocaleLowerCase("de") === key)) return draft;
      return { ...draft, projects: [...draft.projects, { ...createProjectEntry(), name: text }] };
    case "certificates":
      if (draft.certificates.some((certificate) => certificate.name.toLocaleLowerCase("de") === key)) return draft;
      return { ...draft, certificates: [...draft.certificates, { ...createCertificateEntry(), name: text }] };
    case "profile":
      return {
        ...draft,
        profile: {
          ...draft.profile,
          summary: [draft.profile.summary, text].filter(Boolean).join("\n").slice(0, 4000),
        },
      };
    case "links": {
      if (!/^https?:\/\//i.test(text)) return draft;
      if (draft.links.some((link) => link.url === text)) return draft;
      return {
        ...draft,
        links: [...draft.links, { ...createLinkEntry(), label: text, url: text }],
      };
    }
    case "ignore":
    default:
      return draft;
  }
}
