import type {
  NavigatorAdapter,
  NavigatorTarget,
  NavigatorTargetKind,
  NavigatorTargetStatus,
} from "./radarNavigator";

/**
 * CORE-01 contracts only. No CV component is wired to these adapters yet.
 * The future import/editor packages provide the target list and use each
 * target's `activate` hook for filter/page changes or collapsed sections.
 */
export interface CvImportNavigatorAdapter extends NavigatorAdapter {
  /** Import review, detected candidate, pending decision or error target. */
  getTargets: () => NavigatorTarget[];
}

export interface CvEditorNavigatorAdapter extends NavigatorAdapter {
  /** Editor section, validation or completion/action target. */
  getTargets: () => NavigatorTarget[];
}

export const CV_IMPORT_NAVIGATOR_KINDS = ["section", "review", "error", "action"] as const;
export const CV_EDITOR_NAVIGATOR_SECTIONS = [
  "personal",
  "profile",
  "experience",
  "education",
  "skills",
  "projects",
  "certificates",
  "languages",
  "validation",
  "actions",
] as const;

export type CvEditorNavigatorSection = typeof CV_EDITOR_NAVIGATOR_SECTIONS[number];

export interface CvNavigatorTargetOptions {
  status?: NavigatorTargetStatus;
  kind?: NavigatorTargetKind;
  element?: HTMLElement | null;
  getElement?: () => HTMLElement | null;
  activate?: () => void | Promise<void>;
}

export function createCvSectionTarget(
  id: string,
  title: string,
  section: CvEditorNavigatorSection,
  options: CvNavigatorTargetOptions = {}
): NavigatorTarget {
  return {
    id,
    title,
    kind: options.kind ?? (section === "validation" ? "error" : section === "actions" ? "action" : "section"),
    status: options.status ?? "normal",
    activate: options.activate,
    getElement: options.getElement,
    element: options.element ?? options.getElement?.() ?? null,
  };
}

export function createCvImportTarget(
  id: string,
  title: string,
  kind: NavigatorTargetKind,
  options: CvNavigatorTargetOptions = {}
): NavigatorTarget {
  return {
    id,
    title,
    kind: options.kind ?? kind,
    status: options.status ?? "normal",
    activate: options.activate,
    getElement: options.getElement,
    element: options.element ?? options.getElement?.() ?? null,
  };
}
