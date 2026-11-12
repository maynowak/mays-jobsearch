import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWorkspaceEditorReturn,
  isWorkspaceOpenPayload,
  isWorkspaceReturnPayload,
  readHandoffId,
  sendWorkspaceReturn,
  workspaceOwnershipRejection,
  workspaceUrl,
  type CvBuilderWorkspaceOpenPayload,
  type CvBuilderWorkspaceReturnPayload,
} from "./workspaceHandoff";
import { createCvBuilderProfileRepository } from "./profileRepository";

const draft = {
  schemaVersion: 1 as const,
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

const session = {
  step: "source" as const,
  result: null,
  sourceName: "synthetic.pdf",
  selected: [],
  manualDecisions: {},
  selectedSkills: [],
  summaryDraft: null,
  pendingAcknowledged: false,
};

const openImport: CvBuilderWorkspaceOpenPayload = {
  kind: "import",
  identityKey: null,
  session,
};

const openEditor: CvBuilderWorkspaceOpenPayload = {
  kind: "editor",
  identityKey: null,
  editor: {
    draft,
    template: "classic",
    profile: null,
    baseVersion: null,
    pendingName: "Synthetic CV",
    importReview: null,
    dirty: true,
  },
};

const returned: CvBuilderWorkspaceReturnPayload = {
  identityKey: null,
  editor: openEditor.kind === "editor" ? openEditor.editor : {
    draft,
    template: "classic",
    profile: null,
    baseVersion: null,
    pendingName: "",
    importReview: null,
    dirty: false,
  },
};

describe("CV-BUILDER-03A workspace handoff", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/cv-builder/workspace");
  });

  it("uses only the random handoff id in the workspace URL", () => {
    const url = workspaceUrl("24f6c5c3-7e5d-4a0b-9c9f-0b48ba5e75d2");
    expect(url).toContain("/cv-builder/workspace?handoff=");
    expect(url).not.toMatch(/nora|example\.invalid|skills|draft/);
    expect(new URL(url).searchParams.get("handoff")).toBe("24f6c5c3-7e5d-4a0b-9c9f-0b48ba5e75d2");
  });

  it("reads only valid handoff ids", () => {
    window.history.replaceState({}, "", "/cv-builder/workspace?handoff=24f6c5c3-7e5d-4a0b-9c9f-0b48ba5e75d2");
    expect(readHandoffId()).toBe("24f6c5c3-7e5d-4a0b-9c9f-0b48ba5e75d2");
    window.history.replaceState({}, "", "/cv-builder/workspace?handoff=not-an-id");
    expect(readHandoffId()).toBeNull();
  });

  it("accepts valid import/editor payloads and rejects malformed payloads", () => {
    expect(isWorkspaceOpenPayload(openImport)).toBe(true);
    expect(isWorkspaceOpenPayload(openEditor)).toBe(true);
    expect(isWorkspaceOpenPayload({ ...openImport, session: null })).toBe(false);
    expect(isWorkspaceOpenPayload({ ...openEditor, editor: { ...openEditor.editor, draft: null } })).toBe(false);
    expect(isWorkspaceOpenPayload({ kind: "unknown", identityKey: null })).toBe(false);
  });

  it("validates return payloads", () => {
    expect(isWorkspaceReturnPayload(returned)).toBe(true);
    expect(isWorkspaceReturnPayload({ ...returned, editor: { ...returned.editor, baseVersion: "1" } })).toBe(false);
    expect(isWorkspaceReturnPayload({ ...returned, identityKey: 1 })).toBe(false);
  });

  it("reports an unreachable opener instead of pretending a transfer", async () => {
    await expect(sendWorkspaceReturn("24f6c5c3-7e5d-4a0b-9c9f-0b48ba5e75d2", returned)).resolves.toBe("unreachable");
  });

  it("returns false when the popup is blocked", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const modulePromise = import("./workspaceHandoff").then((module) => module.openCvBuilderWorkspace(openImport, () => "applied"));
    return modulePromise.then((result) => {
      expect(result).toEqual({ ok: false, reason: "blocked" });
      open.mockRestore();
    });
  });
});


describe("CV-BUILDER-03A workspace return ownership", () => {
  const profile = {
    schemaVersion: 1 as const,
    cvId: "cvb-03a-version",
    name: "Synthetic CV",
    cvData: draft,
    template: "classic" as const,
    createdAt: "2026-11-12T00:00:00.000Z",
    updatedAt: "2026-11-12T00:00:00.000Z",
    version: 1,
  };
  const editor = {
    draft,
    template: "classic" as const,
    profile,
    baseVersion: 1,
    pendingName: "Synthetic CV",
    importReview: null,
    dirty: true,
  };

  it("updates only when the expected source version matches", () => {
    const repository = createCvBuilderProfileRepository({ initial: [profile] });
    const result = applyWorkspaceEditorReturn(repository, editor, "Fallback");
    expect(result.status).toBe("updated");
    expect(repository.get(profile.cvId)?.version).toBe(2);
  });

  it("returns a conflict without overwriting a newer source version", () => {
    const repository = createCvBuilderProfileRepository({ initial: [profile] });
    repository.rename(profile.cvId, 1, "Changed in the source");
    const result = applyWorkspaceEditorReturn(repository, editor, "Fallback");
    expect(result.status).toBe("conflict");
    expect(repository.get(profile.cvId)?.name).toBe("Changed in the source");
    expect(repository.get(profile.cvId)?.version).toBe(2);
  });

  it("creates a new source profile for an unknown workspace profile", () => {
    const repository = createCvBuilderProfileRepository();
    const result = applyWorkspaceEditorReturn(repository, editor, "Fallback");
    expect(result.status).toBe("created");
    expect(result.status === "created" ? result.profile.name : "").toBe("Synthetic CV");
  });

  it("keeps an unsaved workspace draft as a source draft", () => {
    const repository = createCvBuilderProfileRepository();
    const result = applyWorkspaceEditorReturn(repository, { ...editor, profile: null, baseVersion: null }, "Fallback");
    expect(result.status).toBe("draft");
  });
});

describe("CV-BUILDER-03A workspace ownership checks", () => {
  const expected = { identityKey: "issuer|user-a", epoch: 3, cvGeneration: 7 };

  it("accepts the same identity and session generation", () => {
    expect(workspaceOwnershipRejection("issuer|user-a", expected, expected)).toBeNull();
  });

  it("rejects a different current identity", () => {
    expect(workspaceOwnershipRejection("issuer|user-a", expected, { ...expected, identityKey: "issuer|user-b" })).toBe("identity_changed");
  });

  it("rejects a payload from an old identity", () => {
    expect(workspaceOwnershipRejection("issuer|user-b", expected, expected)).toBe("identity_changed");
  });

  it("rejects a changed session epoch or CV session generation", () => {
    expect(workspaceOwnershipRejection("issuer|user-a", expected, { ...expected, epoch: 4 })).toBe("session_ended");
    expect(workspaceOwnershipRejection("issuer|user-a", expected, { ...expected, cvGeneration: 8 })).toBe("session_ended");
  });
});
