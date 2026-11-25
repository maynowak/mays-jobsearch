import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useLang } from "../i18n";

interface Props {
  value: string;
  storageMode: "session" | "remote";
  busy?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (text: string) => Promise<void>;
}

export interface ApplicationOwnLetterEditorHandle {
  save: () => void;
  discard: () => void;
  focus: () => void;
  open: () => void;
}

const ApplicationOwnLetterEditor = forwardRef<ApplicationOwnLetterEditorHandle, Props>(function ApplicationOwnLetterEditor({
  value,
  storageMode,
  busy = false,
  onDirtyChange,
  onSave,
}, ref) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = editing && draft !== value;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const discard = () => {
    setDraft(value);
    setError("");
    setNotice("");
    setEditing(false);
  };

  const open = () => {
    setDraft(value);
    setError("");
    setNotice("");
    setEditing(true);
    window.requestAnimationFrame(() => document.getElementById("applications-own-letter-text")?.focus());
  };

  const save = async () => {
    if (busy || saving || !dirty) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onSave(draft);
      setNotice(t("applications.ownLetter.saved"));
      setEditing(false);
    } catch {
      setError(t("applications.ownLetter.saveError"));
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: () => { void save(); },
    discard,
    focus: () => {
      if (editing) document.getElementById("applications-own-letter-text")?.focus();
      else document.getElementById("applications-own-letter-title")?.focus();
    },
    open,
  }), [busy, dirty, draft, editing, onSave, saving, t, value]);

  return (
    <section id="applications-own-letter" className="applications-own-letter" aria-labelledby="applications-own-letter-title">
      <div className="applications-own-letter__head">
        <h4 id="applications-own-letter-title" tabIndex={-1}>{t("applications.ownLetter.title")}</h4>
        {!editing && (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={open}
          >
            {value.trim() ? t("applications.ownLetter.edit") : t("applications.ownLetter.write")}
          </button>
        )}
      </div>
      <p className="applications-own-letter__storage-note">
        {t(storageMode === "remote" ? "applications.ownLetter.storageRemote" : "applications.ownLetter.storageSession")}
      </p>

      {editing ? (
        <div className="applications-own-letter__editor">
          <label className="letter-field" htmlFor="applications-own-letter-text">
            <span>{t("applications.ownLetter.textLabel")}</span>
            <textarea
              id="applications-own-letter-text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
                setNotice("");
              }}
              rows={10}
              maxLength={50_000}
              disabled={busy || saving}
            />
          </label>
          <div className="applications-own-letter__preview" role="group" aria-label={t("applications.ownLetter.previewLabel")}>
            <strong>{t("applications.ownLetter.previewTitle")}</strong>
            {draft.trim()
              ? <pre className="applications-cover-letter">{draft}</pre>
              : <p>{t("applications.ownLetter.emptyPreview")}</p>}
          </div>
          {error && <p className="applications-new__error" role="alert">{error}</p>}
          <div className="applications-own-letter__actions">
            <button type="button" className="letter-btn" onClick={() => void save()} disabled={busy || saving || !dirty}>
              {saving ? t("applications.ownLetter.saving") : t("applications.ownLetter.save")}
            </button>
            <button type="button" className="btn-ghost" onClick={discard} disabled={busy || saving}>
              {t("applications.ownLetter.discard")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {value.trim()
            ? <pre className="applications-cover-letter applications-own-letter__saved-text">{value}</pre>
            : <p className="applications-own-letter__empty">{t("applications.ownLetter.empty")}</p>}
          {notice && <p role="status" className="applications-own-letter__notice">{notice}</p>}
          {error && <p role="alert" className="applications-new__error">{error}</p>}
        </>
      )}
    </section>
  );
});

export default ApplicationOwnLetterEditor;
