import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../i18n";
import type {
  ATSSearchProfileV1,
  CVSearchProfileV1,
  EmploymentType,
  WorkMode,
} from "../lib/profiles/contractTypes";
import type { PersistentSearchProfiles } from "../lib/usePersistentSearchProfiles";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import SkillChips from "./SkillChips";

interface Props {
  cvId: string;
  cvName: string;
  profiles: PersistentSearchProfiles;
  onClose: () => void;
  onSearch?: (
    cvId: string,
    parent: CVSearchProfileV1,
    ats?: ATSSearchProfileV1
  ) => void | Promise<void>;
}

const split = (value: string): string[] =>
  value.split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean);

const splitSkills = (value: string): string[] =>
  value.split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean);

export default function PersistentCvProfilesOverlay({
  cvId,
  cvName,
  profiles,
  onClose,
  onSearch,
}: Props) {
  const { t } = useLang();
  const [cvProfiles, setCvProfiles] = useState<CVSearchProfileV1[]>([]);
  const [atsByParent, setAtsByParent] = useState<Record<string, ATSSearchProfileV1[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [targetRoles, setTargetRoles] = useState("");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState("");
  const [atsParent, setAtsParent] = useState("");
  const [atsName, setAtsName] = useState("");
  const [atsRoles, setAtsRoles] = useState("");
  const [atsSkills, setAtsSkills] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingCvId, setEditingCvId] = useState<string | null>(null);
  const [editingAtsId, setEditingAtsId] = useState<string | null>(null);
  const [showCvForm, setShowCvForm] = useState(false);
  const [showAtsForm, setShowAtsForm] = useState(false);
  const [expandedAtsParent, setExpandedAtsParent] = useState<string | null>(null);
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [startingSearchKey, setStartingSearchKey] = useState<string | null>(null);

  const grantDurableStorage = async () => {
    if (!profiles.available) return;
    setGrantBusy(true);
    setGrantError(null);
    try {
      await profiles.grantConsent();
    } catch {
      setGrantError(t("searchProfiles.grantError"));
    } finally {
      setGrantBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await profiles.listCv(cvId);
      setCvProfiles(items);
      const entries = await Promise.all(items.map(async (item) => [
        item.searchProfileId,
        await profiles.listAts(item.searchProfileId),
      ] as const));
      setAtsByParent(Object.fromEntries(entries));
      if (!atsParent && items[0]) setAtsParent(items[0].searchProfileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "search_profiles_unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profiles.persistentView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.persistentView, cvId]);

  const searchConfig = () => ({
    skills,
    targetRoles: split(targetRoles),
    city,
    radiusKm: radius.trim() === "" ? null : Number(radius),
    workModes: ["remote", "hybrid"] as WorkMode[],
    employmentTypes: ["full_time"] as EmploymentType[],
  });

  const resetCvForm = () => {
    setEditingCvId(null);
    setName("");
    setDescription("");
    setSkills("");
    setTargetRoles("");
    setCity("");
    setRadius("");
    setShowCvForm(false);
  };

  const resetAtsForm = () => {
    setEditingAtsId(null);
    setAtsName("");
    setAtsRoles("");
    setAtsSkills("");
    setShowAtsForm(false);
  };

  const startNewCv = () => {
    resetCvForm();
    setShowCvForm(true);
    setShowAtsForm(false);
  };

  const startEditCv = (profile: CVSearchProfileV1) => {
    setEditingCvId(profile.searchProfileId);
    setName(profile.name);
    setDescription(profile.description ?? "");
    setSkills(profile.searchConfig.skills);
    setTargetRoles(profile.searchConfig.targetRoles.join(", "));
    setCity(profile.searchConfig.city);
    setRadius(profile.searchConfig.radiusKm === null ? "" : String(profile.searchConfig.radiusKm));
    setShowCvForm(true);
    setShowAtsForm(false);
  };

  const startNewAts = (parentId = cvProfiles[0]?.searchProfileId ?? "") => {
    resetAtsForm();
    setAtsParent(parentId);
    setShowAtsForm(true);
    setShowCvForm(false);
    setExpandedAtsParent(parentId);
  };

  const startEditAts = (parentId: string, profile: ATSSearchProfileV1) => {
    setEditingAtsId(profile.atsSearchProfileId);
    setAtsParent(parentId);
    setAtsName(profile.name);
    setAtsRoles(profile.targetRoles.join(", "));
    setAtsSkills(profile.skills.join(", "));
    setShowAtsForm(true);
    setShowCvForm(false);
    setExpandedAtsParent(parentId);
  };

  const saveCv = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        searchConfig: searchConfig(),
      };
      if (editingCvId) {
        await profiles.updateCv(cvId, editingCvId, input);
      } else {
        await profiles.createCv(cvId, input);
      }
      resetCvForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "search_profile_create_failed");
    } finally {
      setBusy(false);
    }
  };

  const saveAts = async () => {
    if (!atsParent || !atsName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: atsName.trim(),
        targetRoles: split(atsRoles),
        skills: split(atsSkills),
      };
      if (editingAtsId) {
        await profiles.updateAts(atsParent, editingAtsId, input);
      } else {
        await profiles.createAts(atsParent, input);
      }
      const parent = atsParent;
      resetAtsForm();
      setExpandedAtsParent(parent);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ats_profile_create_failed");
    } finally {
      setBusy(false);
    }
  };

  const atsCount = (searchProfileId: string) => atsByParent[searchProfileId]?.length ?? 0;
  const duplicateCvName = name.trim().length > 0 && cvProfiles.some(
    (profile) => profile.searchProfileId !== editingCvId &&
      profile.name.trim().toLocaleLowerCase("de") === name.trim().toLocaleLowerCase("de")
  );
  const duplicateAtsName = atsName.trim().length > 0 && (atsByParent[atsParent] ?? []).some(
    (profile) => profile.atsSearchProfileId !== editingAtsId &&
      profile.name.trim().toLocaleLowerCase("de") === atsName.trim().toLocaleLowerCase("de")
  );
  const toggleAts = (parentId: string) => {
    setExpandedAtsParent((current) => (current === parentId ? null : parentId));
  };
  const startSearch = async (
    parent: CVSearchProfileV1,
    ats?: ATSSearchProfileV1
  ) => {
    if (!onSearch) return;
    const key = ats ? `ats:${ats.atsSearchProfileId}` : `cv:${parent.searchProfileId}`;
    setSearchError(null);
    setStartingSearchKey(key);
    try {
      await onSearch(cvId, parent, ats);
    } catch (err) {
      setSearchError(err instanceof Error && err.message
        ? err.message
        : t("searchProfiles.searchError"));
    } finally {
      setStartingSearchKey(null);
    }
  };
  const totalAts = Object.values(atsByParent).reduce((sum, entries) => sum + entries.length, 0);
  const summary = cvProfiles.length === 0
    ? t("searchProfiles.summaryEmpty")
    : [
        cvProfiles.length === 1
          ? t("searchProfiles.cvCountOne")
          : t("searchProfiles.cvCountMany", { count: cvProfiles.length }),
        totalAts === 1
          ? t("searchProfiles.atsCountOne")
          : t("searchProfiles.atsCountMany", { count: totalAts }),
      ].join(" · ");

  return createPortal(
    <div className="cv-profiles-overlay cv-profile-manager" role="dialog" aria-modal="true" aria-label={cvName}>
      <div className="cv-profiles-overlay__panel">
        <header className="cv-profiles-overlay__header">
          <div>
            <h3>{cvName}</h3>
            <p className="field-hint">{t("searchProfiles.persistentHint")}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>{t("searchProfiles.close")}</Button>
        </header>

        {!profiles.persistentView ? (
          <div className="search-profiles-consent" role="note">
            <p>{profiles.available
              ? t("searchProfiles.consentRequired")
              : t("searchProfiles.unavailable")}</p>
            {profiles.available && (
              <Button
                onClick={() => { void grantDurableStorage(); }}
                disabled={grantBusy || profiles.consent?.grantAllowed !== true}
              >
                {grantBusy ? t("searchProfiles.granting") : t("searchProfiles.grantDurable")}
              </Button>
            )}
            {grantError && <p className="field-error" role="alert">{grantError}</p>}
          </div>
        ) : (
          <>
            {error && (
              <div className="alert alert-error profile-manager__error" role="alert">
                <p>{t("searchProfiles.loadError")}</p>
                <Button variant="ghost" disabled={loading} onClick={() => { void load(); }}>
                  {t("searchProfiles.retry")}
                </Button>
              </div>
            )}
            {searchError && (
              <p className="alert alert-error" role="alert">{searchError}</p>
            )}

            <section className="profile-manager__section" aria-labelledby="persistent-cv-search-title">
              <div className="profile-manager__head">
                <div>
                  <h4 id="persistent-cv-search-title">{t("searchProfiles.cvTitle")}</h4>
                  <p className="field-hint">{t("searchProfiles.mayCvHint")}</p>
                  <p className="profile-manager__summary" role="status" aria-live="polite">
                    {loading ? t("searchProfiles.summaryLoading") : summary}
                  </p>
                </div>
                {profiles.active && !showCvForm && (
                  <Button onClick={startNewCv}>{t("searchProfiles.newCv")}</Button>
                )}
              </div>

              {loading && cvProfiles.length === 0 ? null : cvProfiles.length === 0 ? (
                <p className="field-hint">{t("searchProfiles.cvEmpty")}</p>
              ) : (
                <ul className="profile-card-list">
                  {cvProfiles.map((profile) => (
                    <li key={profile.searchProfileId} className="profile-card">
                      <div className="profile-card__head">
                        <strong>{profile.name}</strong>
                        <Badge tone="active">{t("searchProfiles.persistentStatus")}</Badge>
                      </div>
                      <dl className="profile-card__facts">
                        <div>
                          <dt>{t("searchProfiles.targetRoles")}</dt>
                          <dd>{profile.searchConfig.targetRoles.join(", ") || "—"}</dd>
                        </div>
                        <div>
                          <dt>{t("searchProfiles.skills")}</dt>
                          <dd><SkillChips skills={splitSkills(profile.searchConfig.skills)} /></dd>
                        </div>
                        <div>
                          <dt>{t("searchProfiles.atsTitle")}</dt>
                          <dd>{t("searchProfiles.atsCount", { count: atsCount(profile.searchProfileId) })}</dd>
                        </div>
                      </dl>
                      <div className="profile-card__actions">
                        {onSearch && (
                          <Button
                            className="profile-card__search-action"
                            disabled={busy || startingSearchKey !== null}
                            onClick={() => { void startSearch(profile); }}
                          >
                            {t("searchProfiles.search")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          disabled={busy}
                          aria-expanded={expandedAtsParent === profile.searchProfileId}
                          aria-controls={`ats-list-${profile.searchProfileId}`}
                          onClick={() => toggleAts(profile.searchProfileId)}
                        >
                          {expandedAtsParent === profile.searchProfileId
                            ? t("searchProfiles.hideAts")
                            : t("searchProfiles.showAts")}
                        </Button>
                        {profiles.active && (
                          <Button variant="ghost" disabled={busy} onClick={() => startNewAts(profile.searchProfileId)}>
                            {t("searchProfiles.addAtsFor")}
                          </Button>
                        )}
                        <Button variant="ghost" disabled={busy} onClick={() => startEditCv(profile)}>
                          {t("searchProfiles.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await profiles.deleteCv(cvId, profile.searchProfileId);
                                if (editingCvId === profile.searchProfileId) resetCvForm();
                                await load();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "search_profile_delete_failed");
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          {t("searchProfiles.delete")}
                        </Button>
                      </div>
                      {expandedAtsParent === profile.searchProfileId && (
                        <div id={`ats-list-${profile.searchProfileId}`} className="profile-card__ats">
                          <h5>{t("searchProfiles.atsFor", { name: profile.name })}</h5>
                          {(atsByParent[profile.searchProfileId] ?? []).length === 0 ? (
                            <p className="field-hint">{t("searchProfiles.noAtsFor")}</p>
                          ) : (
                            <ul className="profile-card-list">
                              {(atsByParent[profile.searchProfileId] ?? []).map((ats) => (
                                <li key={ats.atsSearchProfileId} className="profile-card profile-card--ats">
                                  <div className="profile-card__head">
                                    <strong>{ats.name}</strong>
                                    <Badge tone="active">{t("searchProfiles.persistentStatus")}</Badge>
                                  </div>
                                  <dl className="profile-card__facts">
                                    <div>
                                      <dt>{t("searchProfiles.targetRoles")}</dt>
                                      <dd>{ats.targetRoles.join(", ") || "—"}</dd>
                                    </div>
                                    <div>
                                      <dt>{t("searchProfiles.skills")}</dt>
                                      <dd><SkillChips skills={ats.skills} /></dd>
                                    </div>
                                    <div>
                                      <dt>{t("searchProfiles.parent")}</dt>
                                      <dd>{profile.name}</dd>
                                    </div>
                                  </dl>
                                  <div className="profile-card__actions">
                                    {onSearch && (
                                      <Button
                                        className="profile-card__search-action"
                                        disabled={busy || startingSearchKey !== null}
                                        onClick={() => { void startSearch(profile, ats); }}
                                      >
                                        {t("searchProfiles.search")}
                                      </Button>
                                    )}
                                    <Button variant="ghost" disabled={busy} onClick={() => startEditAts(profile.searchProfileId, ats)}>
                                      {t("searchProfiles.edit")}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      disabled={busy}
                                      onClick={() => {
                                        void (async () => {
                                          setBusy(true);
                                          try {
                                            await profiles.deleteAts(profile.searchProfileId, ats.atsSearchProfileId);
                                            await load();
                                          } catch (err) {
                                            setError(err instanceof Error ? err.message : "ats_profile_delete_failed");
                                          } finally {
                                            setBusy(false);
                                          }
                                        })();
                                      }}
                                    >
                                      {t("searchProfiles.delete")}
                                    </Button>
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

              {showCvForm && profiles.active && (
                <div className="profile-form" aria-labelledby="profile-cv-form-title">
                  <h5 id="profile-cv-form-title">
                    {editingCvId ? t("searchProfiles.editCv") : t("searchProfiles.createCv")}
                  </h5>
                  <div className="profile-form__grid">
                    <label className="profile-form__full">{t("searchProfiles.name")}
                      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                    </label>
                    <label className="profile-form__full">{t("searchProfiles.description")}
                      <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
                    </label>
                    <label>{t("searchProfiles.skills")}
                      <input value={skills} onChange={(e) => setSkills(e.target.value)} />
                    </label>
                    <label>{t("searchProfiles.targetRoles")}
                      <input value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)} />
                    </label>
                    <label>{t("searchProfiles.city")}
                      <input value={city} onChange={(e) => setCity(e.target.value)} />
                    </label>
                    <label>{t("searchProfiles.radius")}
                      <input value={radius} onChange={(e) => setRadius(e.target.value)} inputMode="numeric" />
                    </label>
                  </div>
                  {duplicateCvName && (
                    <p className="profile-form__warning" role="status">{t("searchProfiles.duplicateCvName")}</p>
                  )}
                  <div className="profile-form__actions">
                    <Button disabled={busy || !name.trim()} onClick={() => void saveCv()}>
                      {t("searchProfiles.save")}
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={resetCvForm}>
                      {t("searchProfiles.cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {showAtsForm && profiles.active && cvProfiles.length > 0 && (
                <div className="profile-form" aria-labelledby="profile-ats-form-title">
                  <h5 id="profile-ats-form-title">
                    {editingAtsId ? t("searchProfiles.editAts") : t("searchProfiles.createAts")}
                  </h5>
                  <div className="profile-form__grid">
                    <label className="profile-form__full">{t("searchProfiles.parent")}
                      <select value={atsParent} onChange={(e) => setAtsParent(e.target.value)}>
                        {cvProfiles.map((parent) => (
                          <option key={parent.searchProfileId} value={parent.searchProfileId}>
                            {parent.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="profile-form__full">{t("searchProfiles.name")}
                      <input value={atsName} onChange={(e) => setAtsName(e.target.value)} maxLength={120} />
                    </label>
                    <label>{t("searchProfiles.targetRoles")}
                      <input value={atsRoles} onChange={(e) => setAtsRoles(e.target.value)} />
                    </label>
                    <label>{t("searchProfiles.skills")}
                      <input value={atsSkills} onChange={(e) => setAtsSkills(e.target.value)} />
                    </label>
                  </div>
                  {duplicateAtsName && (
                    <p className="profile-form__warning" role="status">{t("searchProfiles.duplicateAtsName")}</p>
                  )}
                  <div className="profile-form__actions">
                    <Button disabled={busy || !atsParent || !atsName.trim()} onClick={() => void saveAts()}>
                      {t("searchProfiles.save")}
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={resetAtsForm}>
                      {t("searchProfiles.cancel")}
                    </Button>
                  </div>
                </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
