import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useLang } from "../i18n";
import {
  createCvBuilderProfileRepository,
  type CvBuilderProfileRepository,
} from "../lib/cvBuilder/profileRepository";
import { hasCvBuilderContent } from "../lib/cvBuilder/contractTypes";
import type { CvBuilderDraftV1 } from "../lib/cvBuilder/contractTypes";
import type { CvBuilderTemplate } from "../lib/cvBuilder/templates";
import type { CvBuilderImportReviewSummary } from "./CvBuilderImportReview";
import CvBuilderImportDialog from "./CvBuilderImportDialog";
import CvBuilderEditor from "./CvBuilderEditor";
import {
  WORKSPACE_PATH,
  acceptWorkspaceHandoff,
  hasWorkspaceOpener,
  readHandoffId,
  requestWorkspaceHandoff,
  sendWorkspaceReturn,
  type CvBuilderImportSession,
  type CvBuilderWorkspaceEditorSnapshot,
  type CvBuilderWorkspaceOpenPayload,
  type CvBuilderWorkspaceReturnPayload,
} from "../lib/cvBuilder/workspaceHandoff";
import { deriveAuthProfileKey } from "../lib/authIdentity";
import { cloneCvBuilderDraft, cloneCvBuilderProfile } from "../lib/cvBuilder/profileTypes";

type Mode = "loading" | "start" | "import" | "editor" | "error";

const emptyDraft = (): CvBuilderDraftV1 => ({
  schemaVersion: 1,
  personal: {},
  profile: {},
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certificates: [],
  languages: [],
  links: [],
});

function defaultName(t: (key: string, vars?: Record<string, string | number>) => string, count = 1): string {
  return t("cvBuilder.profiles.defaultName", { count });
}

export default function CvBuilderWorkspacePage() {
  const { t, lang, setLang } = useLang();
  const auth = useAuth() ?? { isAuthenticated: false, user: undefined, isLoading: false };
  const currentIdentity = deriveAuthProfileKey(auth.isAuthenticated, auth.user?.profile);
  const handoffId = readHandoffId();
  const activeHandoffIdRef = useRef<string | null>(handoffId);
  const [mode, setMode] = useState<Mode>(handoffId ? "loading" : "start");
  const [handoffError, setHandoffError] = useState("");
  const [handoffIdentity, setHandoffIdentity] = useState<string | null | undefined>(undefined);
  const directIdentityRef = useRef<string | null | undefined>(undefined);
  const [initialImportSession, setInitialImportSession] = useState<CvBuilderImportSession | null>(null);
  const [session, setSession] = useState<CvBuilderImportSession | null>(null);
  const [draft, setDraft] = useState<CvBuilderDraftV1>(emptyDraft);
  const [template, setTemplate] = useState<CvBuilderTemplate>("classic");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [importReview, setImportReview] = useState<CvBuilderImportReviewSummary | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const repoRef = useRef<CvBuilderProfileRepository | null>(null);
  const requestedRef = useRef(false);
  const handoffCleanupRef = useRef<(() => void) | null>(null);

  if (!repoRef.current) {
    repoRef.current = createCvBuilderProfileRepository();
  }

  const hydrateEditor = (editor: CvBuilderWorkspaceEditorSnapshot) => {
    repoRef.current?.invalidate();
    repoRef.current = createCvBuilderProfileRepository({
      initial: editor.profile ? [cloneCvBuilderProfile(editor.profile)] : [],
    });
    setDraft(cloneCvBuilderDraft(editor.draft));
    setTemplate(editor.template);
    setProfileId(editor.profile?.cvId ?? null);
    setProfileName(editor.profile?.name ?? editor.pendingName);
    setBaseVersion(editor.baseVersion);
    setImportReview(editor.importReview);
    setDirty(editor.dirty);
    setSaved(!editor.dirty && Boolean(editor.profile));
    setSaveError("");
    setMode("editor");
  };

  const clearWorkspaceData = (message: string) => {
    handoffCleanupRef.current?.();
    handoffCleanupRef.current = null;
    repoRef.current?.invalidate();
    repoRef.current = createCvBuilderProfileRepository();
    setInitialImportSession(null);
    setSession(null);
    setDraft(emptyDraft());
    setTemplate("classic");
    setProfileId(null);
    setProfileName("");
    setBaseVersion(null);
    setImportReview(null);
    setDirty(false);
    setSaved(false);
    setSaving(false);
    setSaveError("");
    setWorkspaceMessage("");
    setHandoffError(message);
    setMode("error");
  };

  useEffect(() => () => {
    handoffCleanupRef.current?.();
    handoffCleanupRef.current = null;
  }, []);

  useEffect(() => {
    if (!handoffId) {
      // The initial direct-route mode is already "start"; auth loading must not
      // reset an active direct workspace back to the start view.
      return;
    }
    if (auth.isLoading) return;
    if (requestedRef.current) return;
    requestedRef.current = true;
    void requestWorkspaceHandoff(handoffId).then((payload: CvBuilderWorkspaceOpenPayload | null) => {
      if (!payload) {
        setHandoffError(t("cvBuilder.workspace.handoffExpired"));
        setMode("error");
        return;
      }
      if (payload.identityKey !== currentIdentity) {
        setHandoffError(t("cvBuilder.workspace.identityChanged"));
        setMode("error");
        return;
      }
      setHandoffIdentity(payload.identityKey);
      activeHandoffIdRef.current = handoffId;
      window.history.replaceState({}, "", WORKSPACE_PATH);
      handoffCleanupRef.current = acceptWorkspaceHandoff(handoffId, () => {
        clearWorkspaceData(t("cvBuilder.workspace.sessionEnded"));
      });
      if (payload.kind === "import") {
        setInitialImportSession(payload.session);
        setSession(payload.session);
        setMode("import");
        return;
      }
      hydrateEditor(payload.editor);
    });
    // currentIdentity is checked again below after auth settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffId, auth.isLoading]);

  useEffect(() => {
    // Handoff mode has a declared identity and is checked by the handoff effect.
    if (auth.isLoading || handoffIdentity !== undefined) return;
    // Direct mode has no handoff identity. Capture a baseline only after the
    // initial auth load, so an initial guest/loading state is not mistaken for
    // a user switch. Any later change clears all local CV data.
    if (directIdentityRef.current === undefined) {
      directIdentityRef.current = currentIdentity;
      return;
    }
    if (directIdentityRef.current !== currentIdentity) {
      directIdentityRef.current = currentIdentity;
      clearWorkspaceData(t("cvBuilder.workspace.identityChanged"));
    }
  }, [auth.isLoading, currentIdentity, handoffIdentity, t]);

  useEffect(() => {
    if (handoffIdentity === undefined) return;
    if (handoffIdentity !== currentIdentity) {
      clearWorkspaceData(t("cvBuilder.workspace.identityChanged"));
    }
  }, [currentIdentity, handoffIdentity, t]);

  const handleStartEmpty = () => {
    setDraft(emptyDraft());
    setTemplate("classic");
    setProfileId(null);
    setProfileName(defaultName(t, 1));
    setBaseVersion(null);
    setImportReview(null);
    setInitialImportSession(null);
    setSession(null);
    setDirty(true);
    setSaved(false);
    setSaveError("");
    setWorkspaceMessage("");
    setMode("editor");
  };

  const handleImported = (
    imported: CvBuilderDraftV1,
    sourceName: string,
    reviewSummary?: CvBuilderImportReviewSummary
  ) => {
    setDraft(cloneCvBuilderDraft(imported));
    setTemplate("classic");
    setProfileId(null);
    setProfileName(
      sourceName
        ? t("cvBuilder.import.defaultName", { name: sourceName })
        : defaultName(t, 1)
    );
    setBaseVersion(null);
    setImportReview(reviewSummary ?? null);
    setDirty(true);
    setSaved(false);
    setSaveError("");
    setInitialImportSession(null);
    setSession(null);
    setMode("editor");
  };

  const handleSave = async () => {
    const repository = repoRef.current;
    if (!repository) return;
    setSaving(true);
    setSaveError("");
    try {
      const name = profileName.trim() || defaultName(t, 1);
      if (profileId) {
        const current = repository.get(profileId);
        if (!current) throw new Error(t("cvBuilder.profiles.error"));
        const updated = repository.update(current.cvId, current.version, {
          cvData: draft,
          template,
        });
        setProfileId(updated.cvId);
        setProfileName(updated.name);
        setDraft(cloneCvBuilderDraft(updated.cvData));
        setTemplate(updated.template);
      } else {
        const created = repository.create({ name, cvData: draft, template });
        setProfileId(created.cvId);
        setProfileName(created.name);
        setDraft(cloneCvBuilderDraft(created.cvData));
        setTemplate(created.template);
      }
      setDirty(false);
      setSaved(true);
      setSaveError("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("cvBuilder.profiles.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseEditor = () => {
    if (dirty) {
      setDraft(emptyDraft());
      setTemplate("classic");
      setProfileId(null);
      setProfileName("");
      setBaseVersion(null);
      setImportReview(null);
      setDirty(false);
      setSaved(false);
    }
    setMode("start");
  };

  const handleReturnToApp = async () => {
    const activeHandoffId = activeHandoffIdRef.current;
    if (!activeHandoffId) {
      setWorkspaceMessage(t("cvBuilder.workspace.returnUnavailable"));
      return;
    }
    if (!hasWorkspaceOpener()) {
      setWorkspaceMessage(t("cvBuilder.workspace.returnUnavailable"));
      return;
    }
    const profile = profileId ? repoRef.current?.get(profileId) ?? null : null;
    const payload: CvBuilderWorkspaceReturnPayload = {
      identityKey: handoffIdentity ?? null,
      editor: {
        draft: cloneCvBuilderDraft(draft),
        template,
        profile,
        baseVersion,
        pendingName: profileName,
        importReview,
        dirty,
      },
    };
    const result = await sendWorkspaceReturn(activeHandoffId, payload);
    if (result === "applied") {
      setWorkspaceMessage(t("cvBuilder.workspace.returnSuccess"));
      return;
    }
    if (result === "conflict") {
      setWorkspaceMessage(t("cvBuilder.workspace.conflict"));
      return;
    }
    if (result === "identity_changed") {
      clearWorkspaceData(t("cvBuilder.workspace.identityChanged"));
      return;
    }
    if (result === "session_ended") {
      clearWorkspaceData(t("cvBuilder.workspace.sessionEnded"));
      return;
    }
    if (result === "unreachable") {
      setWorkspaceMessage(t("cvBuilder.workspace.returnUnavailable"));
      return;
    }
    if (result === "timeout") {
      setWorkspaceMessage(t("cvBuilder.workspace.returnNotConfirmed"));
      return;
    }
    setWorkspaceMessage(t("cvBuilder.workspace.returnError"));
  };

  const header = (
    <header className="cv-workspace-header">
      <a className="cv-workspace-brand" href="/search">May’s Job Matcher</a>
      <div>
        <span className="cv-workspace-kicker">{t("cvBuilder.workspace.title")}</span>
        <div className="cv-workspace-lang" role="group" aria-label={t("lang.aria")}>
          <button type="button" aria-pressed={lang === "de"} onClick={() => setLang("de")}>DE</button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
        </div>
      </div>
    </header>
  );

  if (mode === "loading") {
    return (
      <div className="cv-workspace-page">
        {header}
        <main className="cv-workspace-main" aria-live="polite">
          <div className="cv-workspace-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>{t("cvBuilder.workspace.loading")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (mode === "import") {
    return (
      <div className="cv-workspace-page">
        {header}
        <main className="cv-workspace-main cv-workspace-main--import">
          <CvBuilderImportDialog
            open
            layoutMode="fullpage"
            initialSession={initialImportSession}
            onSessionChange={(next) => setSession(next)}
            onClose={() => {
              setInitialImportSession(null);
              setSession(null);
              setMode("start");
            }}
            onCreateEmpty={handleStartEmpty}
            risAvailable={false}
            persistentCvs={[]}
            onDownloadRis={async () => {
              throw new Error("RIS import is not available in the workspace");
            }}
            onImported={handleImported}
          />
          {session && <p className="visually-hidden" aria-live="polite">{t("cvBuilder.import.subtitle")}</p>}
        </main>
      </div>
    );
  }

  if (mode === "editor") {
    return (
      <div className="cv-workspace-page">
        {header}
        <main className="cv-workspace-main cv-workspace-main--editor">
          {handoffId ? null : <p className="cv-workspace-local-note">{t("cvBuilder.workspace.localOnly")}</p>}
          <CvBuilderEditor
            draft={draft}
            onChange={(next) => { setDraft(next); setDirty(true); }}
            onClose={handleCloseEditor}
            layoutMode="fullpage"
            initialTemplate={template}
            onTemplateChange={(next) => { setTemplate(next); setDirty(true); }}
            onSave={handleSave}
            dirty={dirty}
            saved={saved}
            saving={saving}
            saveError={saveError}
            importReview={importReview}
            onReturnToApp={handleReturnToApp}
          />
          {workspaceMessage && <p className="cv-workspace-local-note" role="status">{workspaceMessage}</p>}
        </main>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="cv-workspace-page">
        {header}
        <main className="cv-workspace-main">
          <section className="cv-workspace-start" aria-labelledby="cv-workspace-error-title">
            <h1 id="cv-workspace-error-title">{t("cvBuilder.workspace.title")}</h1>
            <p className="alert alert-error" role="alert">{handoffError || t("cvBuilder.workspace.handoffInvalid")}</p>
            <button type="button" className="letter-btn" onClick={() => setMode("import")}>{t("cvBuilder.workspace.import")}</button>
            <button type="button" className="btn-ghost" onClick={handleStartEmpty}>{t("cvBuilder.workspace.empty")}</button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="cv-workspace-page">
      {header}
      <main className="cv-workspace-main">
        <section className="cv-workspace-start" aria-labelledby="cv-workspace-title">
          <h1 id="cv-workspace-title">{t("cvBuilder.workspace.startTitle")}</h1>
          <p>{t("cvBuilder.workspace.startText")}</p>
          <p className="cv-workspace-local-note">{t("cvBuilder.workspace.directNote")}</p>
          <div className="cv-workspace-start__actions">
            <button type="button" className="letter-btn" onClick={() => { setInitialImportSession(null); setSession(null); setMode("import"); }}>
              {t("cvBuilder.workspace.import")}
            </button>
            <button type="button" className="btn-ghost" onClick={handleStartEmpty}>
              {t("cvBuilder.workspace.empty")}
            </button>
            {hasCvBuilderContent(draft) && (
              <button type="button" className="btn-ghost" onClick={() => setMode("editor")}>
                {t("cvBuilder.workspace.resume")}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
