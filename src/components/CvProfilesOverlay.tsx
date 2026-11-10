import { useState } from "react";
import { useLang } from "../i18n";
import { readCvProfileLists } from "../lib/cvProfileStore";
import type { CvAtsProfileEntry, CvSearchProfileEntry } from "../lib/cvProfileStore";
import SkillChips from "./SkillChips";

// CV-PROFILE-LISTS-01: Profil-Overlay pro CV. Titel = CV-Name; Button
// "Profil anzeigen" (neustes gespeichertes Suchprofil); darunter zwei
// Tabellen nebeneinander (Suchprofile | ATS-Profile) mit Auswahl pro Zeile;
// darunter der Detailbereich des gewaehlten Eintrags (wechselt je nach Thema).

interface Props {
  docName: string;
  docHash: string | null;
  onClose: () => void;
  onAssignUnassigned?: (atsSessionId: string, targetSearchProfileId: string) => Promise<void>;
}

type Selection =
  | { kind: "search"; entry: CvSearchProfileEntry }
  | { kind: "ats"; entry: CvAtsProfileEntry }
  | null;

export default function CvProfilesOverlay({ docName, docHash, onClose, onAssignUnassigned }: Props) {
  const { t, lang } = useLang();
  // Re-read je Render: Eintraege, die waehrend geoeffnetem Overlay
  // gespeichert werden, erscheinen sofort.
  const lists = readCvProfileLists(docHash);
  const [showProfile, setShowProfile] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [assignTargets, setAssignTargets] = useState<Record<string, string>>({});
  const [pendingAtsId, setPendingAtsId] = useState<string | null>(null);
  const [assignNotice, setAssignNotice] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [expandedAtsParents, setExpandedAtsParents] = useState<Set<string>>(new Set());
  const unassigned = lists.atsProfiles.filter((entry) => !entry.searchProfileId);

  const assign = async (atsSessionId: string) => {
    const target = assignTargets[atsSessionId] ?? "";
    if (!onAssignUnassigned || !target || pendingAtsId) return;
    setPendingAtsId(atsSessionId);
    setAssignError(null);
    setAssignNotice(null);
    try {
      await onAssignUnassigned(atsSessionId, target);
      setAssignNotice(t("cv.unassignedAssigned"));
      setAssignTargets((prev) => ({ ...prev, [atsSessionId]: "" }));
    } catch (error) {
      if ((error as { code?: string })?.code === "session_ended") {
        return;
      }
      setAssignError(
        (error as { code?: string })?.code === "capacity_exceeded"
          ? t("cv.unassignedCapacity")
          : t("cv.unassignedError")
      );
    } finally {
      setPendingAtsId(null);
    }
  };

  const latestSearchProfile = lists.searchProfiles[0] ?? null;
  const toggleAts = (parentId: string) => {
    setExpandedAtsParents((current) => {
      const next = new Set(current);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };
  const locale = lang === "de" ? "de-DE" : "en-US";
  const formatSavedAt = (savedAt: number) =>
    new Date(savedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-box cv-profiles-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t("cv.profilesAriaLabel", { name: docName })}
      >
        <div className="modal-head">
          <h3 className="cv-profiles-overlay__title">{docName}</h3>
          <button
            type="button"
            className="modal-close"
            aria-label={t("cv.profilesClose")}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* CV-PROFILE-LISTS-02 (Privacy): Transparenz-Hinweis — Listen leben
            nur im Session-Speicher und werden nach 12 h automatisch geleert. */}
        <p className="cv-profiles-overlay__note">{t("cv.profilesPrivacyNote")}</p>
        <p className="cv-profiles-overlay__note cv-profiles-overlay__may">
          {t("cv.sessionProfilesMayHint")}
        </p>

        <div className="cv-profiles-overlay__profile">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowProfile((prev) => !prev)}
            aria-expanded={showProfile}
          >
            {showProfile ? t("cv.hideProfile") : t("cv.showProfile")}
          </button>
          {showProfile &&
            (latestSearchProfile ? (
              <dl className="cv-profiles-overlay__profile-detail">
                <dt>{t("cv.targetRoles")}</dt>
                <dd>{(latestSearchProfile.profile.targetRoles ?? []).join(", ") || "—"}</dd>
                <dt>{t("cv.skills")}</dt>
                <dd>{latestSearchProfile.profile.skills || "—"}</dd>
                <dt>{t("cv.location")}</dt>
                <dd>{latestSearchProfile.profile.city || "—"}</dd>
                <dt>{t("search.radius")}</dt>
                <dd>
                  {latestSearchProfile.profile.radiusKm
                    ? t("search.radiusOption", { km: latestSearchProfile.profile.radiusKm })
                    : t("search.radiusNone")}
                </dd>
              </dl>
            ) : (
              <p className="cv-profiles-overlay__empty">{t("cv.noProfilesSaved")}</p>
            ))}
        </div>

        <div className="cv-profiles-overlay__tables">
          <section className="cv-profiles-overlay__table" aria-labelledby="cv-search-profiles-title">
            <h4 id="cv-search-profiles-title">{t("cv.searchProfilesTitle")}</h4>
            {lists.searchProfiles.length === 0 ? (
              <p className="cv-profiles-overlay__empty">{t("cv.noProfilesSaved")}</p>
            ) : (
              <ul className="profile-card-list">
                {lists.searchProfiles.map((entry) => (
                  <li
                    key={entry.id}
                    className={`profile-card${selection?.kind === "search" && selection.entry.id === entry.id ? " profile-card--selected" : ""}`}
                  >
                    <div className="profile-card__head">
                      <strong>{entry.name}</strong>
                      <span className="field-hint">{formatSavedAt(entry.savedAt)}</span>
                    </div>
                    <div className="profile-card__actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        aria-expanded={expandedAtsParents.has(entry.id)}
                        aria-controls={`session-ats-${entry.id}`}
                        onClick={() => toggleAts(entry.id)}
                      >
                        {expandedAtsParents.has(entry.id)
                          ? t("searchProfiles.hideAts")
                          : t("searchProfiles.showAts")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost cv-profiles-overlay__select"
                        aria-pressed={
                          selection?.kind === "search" && selection.entry.id === entry.id
                        }
                        onClick={() => setSelection({ kind: "search", entry })}
                      >
                        {t("cv.showDetails")}
                      </button>
                    </div>
                    {expandedAtsParents.has(entry.id) && (
                      <div id={`session-ats-${entry.id}`} className="profile-card__ats">
                        <h5>{t("searchProfiles.atsFor", { name: entry.name })}</h5>
                        {lists.atsProfiles.filter((ats) => ats.searchProfileId === entry.id).length === 0 ? (
                          <p className="field-hint">{t("searchProfiles.noAtsFor")}</p>
                        ) : (
                          <ul className="profile-card-list">
                            {lists.atsProfiles
                              .filter((ats) => ats.searchProfileId === entry.id)
                              .map((ats) => (
                                <li key={ats.id} className="profile-card profile-card--ats">
                                  <div className="profile-card__head">
                                    <strong>{ats.name}</strong>
                                  </div>
                                  <dl className="profile-card__facts">
                                    <div>
                                      <dt>{t("searchProfiles.targetRoles")}</dt>
                                      <dd>{(ats.targetRoles ?? []).join(", ") || "—"}</dd>
                                    </div>
                                    <div>
                                      <dt>{t("searchProfiles.skills")}</dt>
                                      <dd><SkillChips skills={ats.skills} /></dd>
                                    </div>
                                  </dl>
                                  <div className="profile-card__actions">
                                    <button
                                      type="button"
                                      className="btn-ghost cv-profiles-overlay__select"
                                      aria-pressed={selection?.kind === "ats" && selection.entry.id === ats.id}
                                      onClick={() => setSelection({ kind: "ats", entry: ats })}
                                    >
                                      {t("cv.showDetails")}
                                    </button>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {unassigned.length > 0 && (
          <section className="cv-profiles-overlay__unassigned" aria-labelledby="cv-unassigned-ats-title">
            <h4 id="cv-unassigned-ats-title">{t("cv.unassignedTitle")}</h4>
            <p className="cv-profiles-overlay__note">{t("cv.unassignedHint")}</p>
            {lists.searchProfiles.length === 0 ? (
              <p className="cv-profiles-overlay__empty">{t("cv.unassignedNoParent")}</p>
            ) : (
              <ul className="cv-profiles-overlay__unassigned-list">
                {unassigned.map((entry) => (
                  <li key={entry.id} className="cv-profiles-overlay__unassigned-item">
                    <div>
                      <strong>{entry.name}</strong>
                      <span className="cv-profiles-overlay__unassigned-status">
                        {t("cv.unassignedStatus")}
                      </span>
                      <p className="cv-profiles-overlay__unassigned-meta">
                        {(entry.targetRoles ?? []).join(", ") || "—"} · {entry.skills.join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="cv-profiles-overlay__unassigned-action">
                      <label htmlFor={`assign-ats-${entry.id}`}>{t("cv.unassignedTarget")}</label>
                      <select
                        id={`assign-ats-${entry.id}`}
                        value={assignTargets[entry.id] ?? ""}
                        onChange={(event) =>
                          setAssignTargets((prev) => ({ ...prev, [entry.id]: event.target.value }))
                        }
                        disabled={pendingAtsId !== null}
                      >
                        <option value="">{t("cv.choosePlaceholder")}</option>
                        {lists.searchProfiles.map((searchProfile) => (
                          <option key={searchProfile.id} value={searchProfile.id}>
                            {searchProfile.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => void assign(entry.id)}
                        disabled={
                          !onAssignUnassigned ||
                          pendingAtsId !== null ||
                          !(assignTargets[entry.id] ?? "")
                        }
                      >
                        {t("cv.unassignedAssign")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {assignNotice && (
          <p className="cv-profiles-overlay__note" role="status">
            {assignNotice}
          </p>
        )}
        {assignError && (
          <p className="field-error" role="alert">
            {assignError}
          </p>
        )}

        {/* Austauschbarer Detailbereich: Inhalt haengt vom gewaehlten Thema
            (Suchprofil vs. ATS-Profil) ab */}
        {selection && (
          <div className="cv-profiles-overlay__details" role="region" aria-live="polite">
            <h4>
              {selection.kind === "search"
                ? t("cv.detailTitleSearch", { name: selection.entry.name })
                : t("cv.detailTitleAts", { name: selection.entry.name })}
            </h4>
            {selection.kind === "search" ? (
              <dl className="cv-profiles-overlay__profile-detail">
                <dt>{t("cv.targetRoles")}</dt>
                <dd>{(selection.entry.profile.targetRoles ?? []).join(", ") || "—"}</dd>
                <dt>{t("cv.skills")}</dt>
                <dd>{selection.entry.profile.skills || "—"}</dd>
                <dt>{t("cv.location")}</dt>
                <dd>{selection.entry.profile.city || "—"}</dd>
                <dt>{t("search.radius")}</dt>
                <dd>
                  {selection.entry.profile.radiusKm
                    ? t("search.radiusOption", { km: selection.entry.profile.radiusKm })
                    : t("search.radiusNone")}
                </dd>
              </dl>
            ) : (
              <div>
                <p>
                  <strong>{t("cv.targetRoles")}:</strong> {(selection.entry.targetRoles ?? []).join(", ") || "—"}
                </p>
                <ul className="cv-profiles-overlay__skills">
                  {selection.entry.skills.map((skill) => (
                    <li key={skill} className="tag">
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
