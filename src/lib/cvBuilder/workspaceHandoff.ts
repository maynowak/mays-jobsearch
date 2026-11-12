import type { CvBuilderDraftV1 } from "./contractTypes";
import type { CvBuilderTemplate } from "./templates";
import type { CvBuilderProfileV1 } from "./profileTypes";
import type { CvBuilderProfileRepository } from "./profileRepository";
import type { CvBuilderImportResult, CvBuilderImportSectionId } from "./pdfImport";
import type { ManualReviewDecision, CvBuilderImportReviewSummary } from "./importQuality";

export const WORKSPACE_PATH = "/cv-builder/workspace";
const HANDOFF_PARAM = "handoff";
const MESSAGE_SOURCE = "mays-cv-workspace";
const READY_TIMEOUT_MS = 20_000;
const RETURN_TIMEOUT_MS = 10_000;

export type CvBuilderWorkspaceReturnStatus =
  | "applied"
  | "conflict"
  | "identity_changed"
  | "session_ended"
  | "error";

export type CvBuilderWorkspaceOpenResult =
  | { ok: true }
  | { ok: false; reason: "blocked" | "timeout" | "closed" | "invalid" };

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
  | { source: typeof MESSAGE_SOURCE; type: "accepted"; handoffId: string }
  | { source: typeof MESSAGE_SOURCE; type: "session-ended"; handoffId: string }
  | { source: typeof MESSAGE_SOURCE; type: "return"; handoffId: string; payload: CvBuilderWorkspaceReturnPayload }
  | { source: typeof MESSAGE_SOURCE; type: "return-result"; handoffId: string; result: CvBuilderWorkspaceReturnStatus }
  | { source: typeof MESSAGE_SOURCE; type: "return-timeout"; handoffId: string };

interface ActiveHandoff {
  accepted: boolean;
  invalidate: () => void;
}

const activeHandoffs = new Map<string, ActiveHandoff>();

export function invalidateWorkspaceHandoffs(): void {
  for (const handoff of [...activeHandoffs.values()]) handoff.invalidate();
  activeHandoffs.clear();
}

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
 * Opens a same-origin workspace tab and resolves only after the new tab has
 * confirmed receipt and hydration of the handoff. A successful `window.open`
 * or `postMessage` alone is not acceptance.
 */
export function openCvBuilderWorkspace(
  payload: CvBuilderWorkspaceOpenPayload,
  onReturn: (payload: CvBuilderWorkspaceReturnPayload) => CvBuilderWorkspaceReturnStatus | Promise<CvBuilderWorkspaceReturnStatus>
): Promise<CvBuilderWorkspaceOpenResult> {
  if (typeof window === "undefined") return Promise.resolve({ ok: false, reason: "blocked" });
  invalidateWorkspaceHandoffs();
  const handoffId = createHandoffId();
  const child = window.open(workspaceUrl(handoffId), "_blank");
  if (!child) return Promise.resolve({ ok: false, reason: "blocked" });

  return new Promise((resolve) => {
    let delivered = false;
    let accepted = false;
    let settled = false;
    let disposed = false;
    let readyTimer = 0;
    let closedTimer = 0;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(readyTimer);
      window.clearInterval(closedTimer);
      window.removeEventListener("message", handleMessage);
      activeHandoffs.delete(handoffId);
    };
    const fail = (reason: "timeout" | "closed" | "invalid") => {
      if (settled) {
        cleanup();
        return;
      }
      settled = true;
      cleanup();
      try { child.close(); } catch { /* ignore */ }
      resolve({ ok: false, reason });
    };
    const respond = (result: CvBuilderWorkspaceReturnStatus) => {
      postTo(child, { source: MESSAGE_SOURCE, type: "return-result", handoffId, result });
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
      if (event.data.type === "accepted" && !settled) {
        accepted = true;
        settled = true;
        window.clearTimeout(readyTimer);
        resolve({ ok: true });
        return;
      }
      if (event.data.type === "return" && !accepted) {
        respond("error");
        return;
      }
      if (event.data.type === "return" && isWorkspaceReturnPayload(event.data.payload)) {
        void Promise.resolve(onReturn(event.data.payload))
          .then((result) => respond(result))
          .catch(() => respond("error"));
      }
    };
    window.addEventListener("message", handleMessage);
    activeHandoffs.set(handoffId, {
      get accepted() { return accepted; },
      invalidate: () => {
        if (!accepted) {
          fail("closed");
          return;
        }
        postTo(child, { source: MESSAGE_SOURCE, type: "session-ended", handoffId });
        cleanup();
      },
    } as ActiveHandoff);
    readyTimer = window.setTimeout(() => {
      if (!accepted) fail("timeout");
    }, READY_TIMEOUT_MS);
    closedTimer = window.setInterval(() => {
      if (!child.closed) return;
      if (!accepted) fail("closed");
      else cleanup();
    }, 500);
  });
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
 * The workspace confirms that the payload has been accepted and hydrated.
 * Only after this message may the source close its import/editor state.
 */
export function acceptWorkspaceHandoff(
  handoffId: string,
  onSessionEnded: () => void
): () => void {
  const opener = window.opener as Window | null;
  if (!opener || opener.closed) return () => undefined;
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("message", handleMessage);
  };
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== opener) return;
    if (!isRecord(event.data) || event.data.source !== MESSAGE_SOURCE) return;
    if (event.data.handoffId !== handoffId) return;
    if (event.data.type === "session-ended") {
      cleanup();
      onSessionEnded();
    }
  };
  window.addEventListener("message", handleMessage);
  postTo(opener, { source: MESSAGE_SOURCE, type: "accepted", handoffId });
  return cleanup;
}

/**
 * Explicit return only. The workspace must wait for the source result. A
 * successful `postMessage` is not success: only `applied` is.
 */
export function sendWorkspaceReturn(
  handoffId: string,
  payload: CvBuilderWorkspaceReturnPayload,
  timeoutMs = RETURN_TIMEOUT_MS
): Promise<CvBuilderWorkspaceReturnStatus | "timeout" | "unreachable" | "invalid"> {
  const opener = window.opener as Window | null;
  if (!opener || opener.closed) return Promise.resolve("unreachable");
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
      if (event.data.handoffId !== handoffId) return;
      if (event.data.type !== "return-result") return;
      const result = event.data.result;
      if (result !== "applied" && result !== "conflict" && result !== "identity_changed" && result !== "session_ended" && result !== "error") {
        cleanup();
        resolve("invalid");
        return;
      }
      cleanup();
      resolve(result);
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      cleanup();
      resolve("timeout");
    }, timeoutMs);
    window.addEventListener("message", handleMessage);
    postTo(opener, { source: MESSAGE_SOURCE, type: "return", handoffId, payload });
  });
}

export interface CvBuilderWorkspaceOwnership {
  identityKey: string | null;
  epoch: number;
  cvGeneration: number;
}

export function workspaceOwnershipRejection(
  payloadIdentity: string | null,
  expected: CvBuilderWorkspaceOwnership,
  current: CvBuilderWorkspaceOwnership
): "identity_changed" | "session_ended" | null {
  if (payloadIdentity !== current.identityKey || current.identityKey !== expected.identityKey) {
    return "identity_changed";
  }
  if (current.epoch !== expected.epoch || current.cvGeneration !== expected.cvGeneration) {
    return "session_ended";
  }
  return null;
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
