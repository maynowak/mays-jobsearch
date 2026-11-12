import type { CvBuilderDraftV1 } from "./contractTypes";
import type { CvBuilderTemplate } from "./templates";
import type { CvBuilderProfileV1 } from "./profileTypes";
import type { CvBuilderProfileRepository } from "./profileRepository";
import type { CvBuilderImportResult, CvBuilderImportSectionId } from "./pdfImport";
import type { ManualReviewDecision } from "../../components/CvBuilderImportReview";
import type { CvBuilderImportReviewSummary } from "../../components/CvBuilderImportReview";

export const WORKSPACE_PATH = "/cv-builder/workspace";
const HANDOFF_PARAM = "handoff";
const MESSAGE_SOURCE = "mays-cv-workspace";
const READY_TIMEOUT_MS = 60_000;

export type CvBuilderImportStep = "source" | "preview" | "summary";

export interface CvBuilderImportSession {
  step: CvBuilderImportStep;
  result: CvBuilderImportResult | null;
  sourceName: string;
  selected: CvBuilderImportSectionId[];
  manualDecisions: Record<number, ManualReviewDecision>;
  selectedSkills: string[];
  summaryDraft: CvBuilderDraftV1 | null;
  pendingAcknowledged: boolean;
}

export interface CvBuilderWorkspaceEditorSnapshot {
  draft: CvBuilderDraftV1;
  template: CvBuilderTemplate;
  profile: CvBuilderProfileV1 | null;
  baseVersion: number | null;
  pendingName: string;
  importReview: CvBuilderImportReviewSummary | null;
  dirty: boolean;
}

export type CvBuilderWorkspaceOpenPayload =
  | {
      kind: "import";
      identityKey: string | null;
      session: CvBuilderImportSession;
    }
  | {
      kind: "editor";
      identityKey: string | null;
      editor: CvBuilderWorkspaceEditorSnapshot;
    };

export interface CvBuilderWorkspaceReturnPayload {
  identityKey: string | null;
  editor: CvBuilderWorkspaceEditorSnapshot;
}

type WorkspaceMessage =
  | { source: typeof MESSAGE_SOURCE; type: "ready"; handoffId: string }
  | { source: typeof MESSAGE_SOURCE; type: "handoff"; handoffId: string; payload: CvBuilderWorkspaceOpenPayload }
  | { source: typeof MESSAGE_SOURCE; type: "ack"; handoffId: string }
  | { source: typeof MESSAGE_SOURCE; type: "return"; handoffId: string; payload: CvBuilderWorkspaceReturnPayload };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDraft(value: unknown): value is CvBuilderDraftV1 {
  return isRecord(value) && value.schemaVersion === 1 && isRecord(value.personal) && Array.isArray(value.skills);
}

function isImportSession(value: unknown): value is CvBuilderImportSession {
  if (!isRecord(value)) return false;
  if (value.step !== "source" && value.step !== "preview" && value.step !== "summary") return false;
  if (value.result !== null && !isRecord(value.result)) return false;
  if (typeof value.sourceName !== "string") return false;
  if (!Array.isArray(value.selected) || !value.selected.every((entry) => typeof entry === "string")) return false;
  if (!isRecord(value.manualDecisions)) return false;
  if (!Array.isArray(value.selectedSkills) || !value.selectedSkills.every((entry) => typeof entry === "string")) return false;
  if (value.summaryDraft !== null && !isDraft(value.summaryDraft)) return false;
  return typeof value.pendingAcknowledged === "boolean";
}

function isProfile(value: unknown): value is CvBuilderProfileV1 {
  return isRecord(value) &&
    typeof value.cvId === "string" &&
    typeof value.name === "string" &&
    typeof value.version === "number" &&
    isDraft(value.cvData) &&
    typeof value.template === "string";
}

function isEditorSnapshot(value: unknown): value is CvBuilderWorkspaceEditorSnapshot {
  if (!isRecord(value)) return false;
  if (!isDraft(value.draft)) return false;
  if (typeof value.template !== "string") return false;
  if (value.profile !== null && !isProfile(value.profile)) return false;
  if (value.baseVersion !== null && typeof value.baseVersion !== "number") return false;
  if (typeof value.pendingName !== "string" || typeof value.dirty !== "boolean") return false;
  return value.importReview === null || isRecord(value.importReview);
}

export function isWorkspaceOpenPayload(value: unknown): value is CvBuilderWorkspaceOpenPayload {
  if (!isRecord(value)) return false;
  if (value.kind === "import") {
    return (value.identityKey === null || typeof value.identityKey === "string") && isImportSession(value.session);
  }
  if (value.kind === "editor") {
    return (value.identityKey === null || typeof value.identityKey === "string") && isEditorSnapshot(value.editor);
  }
  return false;
}

export function isWorkspaceReturnPayload(value: unknown): value is CvBuilderWorkspaceReturnPayload {
  return isRecord(value) &&
    (value.identityKey === null || typeof value.identityKey === "string") &&
    isEditorSnapshot(value.editor);
}

function postTo(source: Window, message: WorkspaceMessage): void {
  source.postMessage(message, window.location.origin);
}

export function createHandoffId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export function workspaceUrl(handoffId: string): string {
  const url = new URL(WORKSPACE_PATH, window.location.origin);
  url.searchParams.set(HANDOFF_PARAM, handoffId);
  return url.toString();
}

export function readHandoffId(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get(HANDOFF_PARAM);
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/**
 * Opens a same-origin workspace tab and delivers the CV snapshot only after the
 * new tab proves that it is the expected window. The URL contains only the
 * random handoff id. Returns false when the browser blocks the popup.
 */
export function openCvBuilderWorkspace(
  payload: CvBuilderWorkspaceOpenPayload,
  onReturn: (payload: CvBuilderWorkspaceReturnPayload) => void
): boolean {
  if (typeof window === "undefined") return false;
  const handoffId = createHandoffId();
  const child = window.open(workspaceUrl(handoffId), "_blank");
  if (!child) return false;

  let delivered = false;
  let closed = false;
  let readyTimer = 0;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    window.clearTimeout(readyTimer);
    window.removeEventListener("message", handleMessage);
  };
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== child) return;
    if (!isRecord(event.data) || event.data.source !== MESSAGE_SOURCE) return;
    if (event.data.handoffId !== handoffId) return;
    if (event.data.type === "ready" && !delivered) {
      delivered = true;
      window.clearTimeout(readyTimer);
      postTo(child, {
        source: MESSAGE_SOURCE,
        type: "handoff",
        handoffId,
        payload,
      });
      return;
    }
    if (event.data.type === "return" && isWorkspaceReturnPayload(event.data.payload)) {
      onReturn(event.data.payload);
      cleanup();
    }
  };
  window.addEventListener("message", handleMessage);
  readyTimer = window.setTimeout(() => {
    if (delivered) return;
    cleanup();
    try { child.close(); } catch { /* ignore */ }
  }, READY_TIMEOUT_MS);
  return true;
}

/**
 * Called by the workspace tab. It only accepts messages from the original
 * opener, same origin, matching random handoff id and a valid payload.
 */
export function requestWorkspaceHandoff(
  handoffId: string,
  timeoutMs = 8_000
): Promise<CvBuilderWorkspaceOpenPayload | null> {
  const opener = window.opener as Window | null;
  if (!opener || opener.closed) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    };
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (settled) return;
      if (event.origin !== window.location.origin) return;
      if (event.source !== opener) return;
      if (!isRecord(event.data) || event.data.source !== MESSAGE_SOURCE) return;
      if (event.data.handoffId !== handoffId || event.data.type !== "handoff") return;
      if (!isWorkspaceOpenPayload(event.data.payload)) {
        cleanup();
        resolve(null);
        return;
      }
      cleanup();
      postTo(opener, { source: MESSAGE_SOURCE, type: "ack", handoffId });
      resolve(event.data.payload);
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      cleanup();
      resolve(null);
    }, timeoutMs);
    window.addEventListener("message", handleMessage);
    postTo(opener, { source: MESSAGE_SOURCE, type: "ready", handoffId });
  });
}

/**
 * Explicit return only. If the original tab is gone, this returns false and
 * the workspace must stay local rather than pretending a successful transfer.
 */
export function sendWorkspaceReturn(
  handoffId: string,
  payload: CvBuilderWorkspaceReturnPayload
): boolean {
  const opener = window.opener as Window | null;
  if (!opener || opener.closed) return false;
  postTo(opener, { source: MESSAGE_SOURCE, type: "return", handoffId, payload });
  return true;
}

export type CvBuilderWorkspaceApplyResult =
  | { status: "conflict" }
  | { status: "draft" }
  | { status: "created" | "updated"; profile: CvBuilderProfileV1 };

/**
 * Applies a returned workspace state to the source session repository. A
 * changed source profile is never overwritten: the base version must match.
 */
export function applyWorkspaceEditorReturn(
  repository: CvBuilderProfileRepository,
  editor: CvBuilderWorkspaceEditorSnapshot,
  fallbackName: string
): CvBuilderWorkspaceApplyResult {
  if (!editor.profile) return { status: "draft" };
  const current = repository.get(editor.profile.cvId);
  if (current) {
    if (editor.baseVersion === null || current.version !== editor.baseVersion) {
      return { status: "conflict" };
    }
    const updated = repository.update(current.cvId, current.version, {
      cvData: editor.draft,
      template: editor.template,
    });
    return { status: "updated", profile: updated };
  }
  const created = repository.create({
    name: editor.profile.name || editor.pendingName || fallbackName,
    cvData: editor.draft,
    template: editor.template,
  });
  return { status: "created", profile: created };
}

export function hasWorkspaceOpener(): boolean {
  return Boolean(window.opener && !window.opener.closed);
}
