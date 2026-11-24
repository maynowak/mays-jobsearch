import { useState } from "react";
import { useLang } from "../i18n";
import type { CvBuilderProfileV1 } from "../lib/cvBuilder/profileTypes";
import {
  CV_BUILDER_NAME_MAX_LENGTH,
  cvBuilderProfileHasContent,
} from "../lib/cvBuilder/profileTypes";

interface Props {
  profiles: CvBuilderProfileV1[];
  activeCvId?: string | null;
  canAdoptDraft?: boolean;
  assignedCvIds?: string[];
  onCreate: () => void;
  onAdoptDraft?: () => void;
  onEdit: (cvId: string) => void;
  onDuplicate: (cvId: string) => void;
  onRename: (cvId: string, name: string) => void;
  onDelete: (cvId: string) => void;
  onDownload: (cvId: string) => void;
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
}: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const startRename = (profile: CvBuilderProfileV1) => {
    setRenamingId(profile.cvId);
    setRenameValue(profile.name);
    setError("");
  };

  const saveRename = () => {
    if (!renamingId) return;
    try {
      onRename(renamingId, renameValue);
      setRenamingId(null);
      setRenameValue("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error"));
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    try {
      onDelete(deleteId);
      setDeleteId(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cvBuilder.profiles.error"));
    }
  };

  return (
    <section className="cv-builder-profiles" aria-labelledby="cv-builder-profiles-title">
      <div className="cv-builder-profiles__studio-top">
        <span className="cv-builder-profiles__studio-badge">
          <span aria-hidden="true">✦</span> {t("cvBuilder.profiles.studioBadge")}
        </span>
        <span className="cv-builder-profiles__doc-icon" aria-hidden="true">
          <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
            <path
              d="M5 1.75h10l6 6V26.5a1.75 1.75 0 0 1-1.75 1.75H5A1.75 1.75 0 0 1 3.25 26.5V3.5A1.75 1.75 0 0 1 5 1.75Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M15 2v6h6M7.5 14h11M7.5 18h11M7.5 22h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <div className="cv-builder-profiles__head">
        <div className="cv-builder-profiles__heading">
          <h3 id="cv-builder-profiles-title">{t("cvBuilder.profiles.title")}</h3>
          <p>{t("cvBuilder.profiles.hint")}</p>
          <span className="cv-builder-profiles__session">
            {t("cvBuilder.profiles.sessionOnly")}
          </span>
        </div>
        <div className="cv-builder-profiles__create-actions">
          {canAdoptDraft && onAdoptDraft && (
            <button type="button" className="btn-ghost" onClick={onAdoptDraft}>
              {t("cvBuilder.profiles.adoptDraft")}
            </button>
          )}
          <button type="button" className="letter-btn cv-builder-profiles__create" onClick={onCreate}>
            <span className="cv-builder-profiles__create-spark" aria-hidden="true">✦</span>
            {t("cvBuilder.profiles.createCta")}
            <span className="cv-builder-profiles__create-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="cv-builder-profiles__empty">
          <span className="cv-builder-profiles__empty-icon" aria-hidden="true">
            <svg width="34" height="40" viewBox="0 0 34 40" fill="none">
              <path
                d="M7 2h13l8 8v27a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M20 2v8h8M10 18h14M10 23h14M10 28h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <strong>{t("cvBuilder.profiles.emptyTitle")}</strong>
            <p>{t("cvBuilder.profiles.empty")}</p>
            <span className="cv-builder-profiles__session">
              {t("cvBuilder.profiles.sessionOnly")}
            </span>
          </div>
        </div>
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
                            if (event.key === "Enter") saveRename();
                            if (event.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                        />
                      </label>
                      <div className="cv-builder-profiles__rename-actions">
                        <button type="button" className="letter-btn" onClick={saveRename}>
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
                      {!cvBuilderProfileHasContent(profile) && (
                        <span className="cv-builder-profiles__status">
                          {t("cvBuilder.profiles.emptyContent")}
                        </span>
                      )}
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
                          onDuplicate(profile.cvId);
                          setError("");
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
                      <button type="button" className="letter-btn" onClick={confirmDelete}>
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
