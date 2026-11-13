import { useState } from "react";
import { useLang } from "../i18n";
import type { CvBuilderProfileV1 } from "../lib/cvBuilder/profileTypes";
import {
  CV_BUILDER_NAME_MAX_LENGTH,
  cvBuilderProfileHasContent,
} from "../lib/cvBuilder/profileTypes";
import type { DurableProfileStatus } from "../lib/cvBuilder/durableProfileRef";

interface Props {
  profiles: CvBuilderProfileV1[];
  activeCvId?: string | null;
  canAdoptDraft?: boolean;
  assignedCvIds?: string[];
  onCreate: () => void;
  onAdoptDraft?: () => void;
  onEdit: (cvId: string) => void | Promise<void>;
  onDuplicate: (cvId: string) => void | Promise<void>;
  onRename: (cvId: string, name: string) => void | Promise<void>;
  onDelete: (cvId: string) => void | Promise<void>;
  onDownload: (cvId: string) => void;
  durableStates?: Record<string, DurableProfileStatus>;
  structuredStorageEnabled?: boolean;
  structuredStorageReady?: boolean;
  structuredStorageMessage?: string;
  notLoadedCvIds?: string[];
  onSaveDurable?: (cvId: string) => Promise<void> | void;
}

function formatUpdatedAt(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CvBuilderProfileList({
  profiles,
  activeCvId = null,
  canAdoptDraft = false,
  assignedCvIds = [],
  onCreate,
  onAdoptDraft,
  onEdit,
  onDuplicate,
  onRename,
  onDelete,
  onDownload,
  durableStates = {},
  structuredStorageEnabled = false,
  structuredStorageReady = false,
  structuredStorageMessage = "",
  notLoadedCvIds = [],
  onSaveDurable,
}: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savingDurableId, setSavingDurableId] = useState<string | null>(null);

  const startRename = (profile: CvBuilderProfileV1) => {
    setRenamingId(profile.cvId);
    setRenameValue(profile.name);
    setError("");
  };

  const saveRename = () => {
    if (!renamingId) return;
    try {
      const pending = onRename(renamingId, renameValue);
      setRenamingId(null);
      setRenameValue("");
      setError("");
      Promise.resolve(pending).catch((err) => {
        setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error"));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error"));
    }
  };

  const confirmDelete = (profileId = deleteId) => {
    if (!profileId) return;
    try {
      Promise.resolve(onDelete(profileId)).then(() => {
        setDeleteId(null);
        setError("");
      }).catch((err) => {
        setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error"));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error"));
    }
  };

  return (
    <section className="cv-builder-profiles" aria-labelledby="cv-builder-profiles-title">
      <div className="cv-builder-profiles__head">
        <div>
          <h3 id="cv-builder-profiles-title">{t("cvBuilder.profiles.title")}</h3>
          <p>{t("cvBuilder.profiles.hint")}</p>
          {structuredStorageEnabled && structuredStorageMessage && (
            <p className="cv-builder-profiles__consent-note" role="status">
              {structuredStorageMessage}
            </p>
          )}
        </div>
        <div className="cv-builder-profiles__create-actions">
          {canAdoptDraft && onAdoptDraft && (
            <button type="button" className="btn-ghost" onClick={onAdoptDraft}>
              {t("cvBuilder.profiles.adoptDraft")}
            </button>
          )}
          <button type="button" className="letter-btn" onClick={onCreate}>
            + {t("cvBuilder.profiles.create")}
          </button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <p className="cv-builder-profiles__empty">{t("cvBuilder.profiles.empty")}</p>
      ) : (
        <ul className="cv-builder-profiles__list" aria-label={t("cvBuilder.profiles.listAria")}>
          {profiles.map((profile) => {
            const isRenaming = renamingId === profile.cvId;
            return (
              <li
                key={profile.cvId}
                className={`cv-builder-profiles__item${activeCvId === profile.cvId ? " active" : ""}`}
              >
                <div className="cv-builder-profiles__info">
                  {isRenaming ? (
                    <div className="cv-builder-profiles__rename">
                      <label className="letter-field">
                        <span>{t("cvBuilder.profiles.nameLabel")}</span>
                        <input
                          value={renameValue}
                          maxLength={CV_BUILDER_NAME_MAX_LENGTH}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveRename();
                            if (event.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                        />
                      </label>
                      <div className="cv-builder-profiles__rename-actions">
                        <button type="button" className="letter-btn" onClick={() => void saveRename()}>
                          {t("cvBuilder.profiles.renameSave")}
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => setRenamingId(null)}>
                          {t("cvBuilder.profiles.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <strong>{profile.name}</strong>
                      <span>{t(`cvBuilder.template.${profile.template}`)}</span>
                      <span>
                        {t("cvBuilder.profiles.updated", {
                          date: formatUpdatedAt(profile.updatedAt, locale),
                        })}
                      </span>
                      {notLoadedCvIds.includes(profile.cvId) ? (
                        <span className="cv-builder-profiles__status">
                          {t("cvBuilder.profiles.notLoaded")}
                        </span>
                      ) : !cvBuilderProfileHasContent(profile) && (
                        <span className="cv-builder-profiles__status">
                          {t("cvBuilder.profiles.emptyContent")}
                        </span>
                      )}
                      <span className={`cv-builder-profiles__durable-status durable-${durableStates[profile.cvId] ?? "session-only"}`}>
                        {t(`cvBuilder.profiles.durableStatus.${durableStates[profile.cvId] ?? "session-only"}`)}
                      </span>
                    </>
                  )}
                </div>
                {!isRenaming && (
                  <div className="cv-builder-profiles__actions">
                    <button type="button" className="btn-ghost" onClick={() => onEdit(profile.cvId)}>
                      {t("cvBuilder.profiles.edit")}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        try {
                          void Promise.resolve(onDuplicate(profile.cvId))
                            .catch((err) => setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error")));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error"));
                        }
                      }}
                    >
                      {t("cvBuilder.profiles.duplicate")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => startRename(profile)}>
                      {t("cvBuilder.profiles.rename")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => onDownload(profile.cvId)}>
                      {t("cvBuilder.profiles.download")}
                    </button>
                    {structuredStorageEnabled && structuredStorageReady && onSaveDurable
                      && (durableStates[profile.cvId] ?? "session-only") !== "durable"
                      && (durableStates[profile.cvId] ?? "session-only") !== "saving" && (
                      <button
                        type="button"
                        className="btn-ghost cv-builder-profiles__durable-save"
                        disabled={savingDurableId === profile.cvId}
                        aria-busy={savingDurableId === profile.cvId}
                        onClick={() => {
                          setSavingDurableId(profile.cvId);
                          setError("");
                          Promise.resolve(onSaveDurable(profile.cvId))
                            .catch((err) => setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error")))
                            .finally(() => setSavingDurableId(null));
                        }}
                      >
                        {savingDurableId === profile.cvId
                          ? t("cvBuilder.profiles.savingDurable")
                          : t("cvBuilder.profiles.saveDurable")}
                      </button>
                    )}
                    <button type="button" className="btn-ghost" onClick={() => setDeleteId(profile.cvId)}>
                      {t("cvBuilder.profiles.delete")}
                    </button>
                  </div>
                )}
                {deleteId === profile.cvId && (
                  <div className="cv-builder-profiles__confirm" role="alertdialog" aria-label={t("cvBuilder.profiles.delete")}>
                    <p>{t("cvBuilder.profiles.deleteConfirm", { name: profile.name })}</p>
                    {assignedCvIds.includes(profile.cvId) && (
                      <p className="cv-builder-profiles__warning" role="alert">
                        {t("cvBuilder.profiles.deleteAssignedWarning")}
                      </p>
                    )}
                    <div className="cv-builder-profiles__actions">
                      <button type="button" className="letter-btn" onClick={() => void confirmDelete(profile.cvId)}>
                        {t("cvBuilder.profiles.deleteYes")}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setDeleteId(null)}>
                        {t("cvBuilder.profiles.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="letter-review-warning" role="alert">{error}</p>}
    </section>
  );
}
