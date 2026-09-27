import { useState } from "react";
import { useLang } from "../i18n";
import { readCvProfileLists } from "../lib/cvProfileStore";
import type { CvAtsProfileEntry, CvSearchProfileEntry } from "../lib/cvProfileStore";

// CV-PROFILE-LISTS-01: Profil-Overlay pro CV. Titel = CV-Name; Button
// "Profil anzeigen" (neustes gespeichertes Suchprofil); darunter zwei
// Tabellen nebeneinander (Suchprofile | ATS-Profile) mit Auswahl pro Zeile;
// darunter der Detailbereich des gewaehlten Eintrags (wechselt je nach Thema).

interface Props {
  docName: string;
  docHash: string | null;
  onClose: () => void;
}

type Selection =
  | { kind: "search"; entry: CvSearchProfileEntry }
  | { kind: "ats"; entry: CvAtsProfileEntry }
  | null;

export default function CvProfilesOverlay({ docName, docHash, onClose }: Props) {
  const { t, lang } = useLang();
  // Re-read je Render: Eintraege, die waehrend geoeffnetem Overlay
  // gespeichert werden, erscheinen sofort.
  const lists = readCvProfileLists(docHash);
  const [showProfile, setShowProfile] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);

  const latestSearchProfile = lists.searchProfiles[0] ?? null;
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
                <dd>{latestSearchProfile.profile.targetRole || "—"}</dd>
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
              <table>
                <thead>
                  <tr>
                    <th>{t("cv.colName")}</th>
                    <th>{t("cv.colSavedAt")}</th>
                    <th className="visually-hidden">{t("cv.colSelect")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.searchProfiles.map((entry) => (
                    <tr
                      key={entry.id}
                      className={
                        selection?.kind === "search" && selection.entry.id === entry.id
                          ? "cv-profiles-overlay__row--selected"
                          : undefined
                      }
                    >
                      <td>{entry.name}</td>
                      <td>{formatSavedAt(entry.savedAt)}</td>
                      <td>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="cv-profiles-overlay__table" aria-labelledby="cv-ats-profiles-title">
            <h4 id="cv-ats-profiles-title">{t("cv.atsProfilesTitle")}</h4>
            {lists.atsProfiles.length === 0 ? (
              <p className="cv-profiles-overlay__empty">{t("cv.noProfilesSaved")}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t("cv.colName")}</th>
                    <th>{t("cv.colSavedAt")}</th>
                    <th className="visually-hidden">{t("cv.colSelect")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.atsProfiles.map((entry) => (
                    <tr
                      key={entry.id}
                      className={
                        selection?.kind === "ats" && selection.entry.id === entry.id
                          ? "cv-profiles-overlay__row--selected"
                          : undefined
                      }
                    >
                      <td>{entry.name}</td>
                      <td>{formatSavedAt(entry.savedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost cv-profiles-overlay__select"
                          aria-pressed={selection?.kind === "ats" && selection.entry.id === entry.id}
                          onClick={() => setSelection({ kind: "ats", entry })}
                        >
                          {t("cv.showDetails")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

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
                <dd>{selection.entry.profile.targetRole || "—"}</dd>
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
                  <strong>{t("cv.targetRoles")}:</strong> {selection.entry.targetRole || "—"}
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
