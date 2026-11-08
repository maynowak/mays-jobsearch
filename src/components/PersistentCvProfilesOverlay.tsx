import { useEffect, useState } from "react";
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

interface Props {
  cvId: string;
  cvName: string;
  profiles: PersistentSearchProfiles;
  onClose: () => void;
}

const split = (value: string): string[] =>
  value.split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean);

export default function PersistentCvProfilesOverlay({
  cvId,
  cvName,
  profiles,
  onClose,
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
    if (!profiles.active) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.active, cvId]);

  const searchConfig = () => ({
    skills,
    targetRoles: split(targetRoles),
    city,
    radiusKm: radius.trim() === "" ? null : Number(radius),
    workModes: ["remote", "hybrid"] as WorkMode[],
    employmentTypes: ["full_time"] as EmploymentType[],
  });

  const createCv = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await profiles.createCv(cvId, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        searchConfig: searchConfig(),
      });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "search_profile_create_failed");
    } finally {
      setBusy(false);
    }
  };

  const createAts = async () => {
    if (!atsParent || !atsName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await profiles.createAts(atsParent, {
        name: atsName.trim(),
        targetRoles: split(atsRoles),
        skills: split(atsSkills),
      });
      setAtsName("");
      setAtsRoles("");
      setAtsSkills("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ats_profile_create_failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cv-profiles-overlay" role="dialog" aria-modal="true" aria-label={cvName}>
      <div className="cv-profiles-overlay__panel">
        <header className="cv-profiles-overlay__header">
          <div>
            <h3>{cvName}</h3>
            <p className="field-hint">{t("searchProfiles.persistentHint")}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>{t("searchProfiles.close")}</Button>
        </header>

        {!profiles.active ? (
          <p role="note">{t("searchProfiles.consentRequired")}</p>
        ) : (
          <>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            {loading ? <p role="status">{t("searchProfiles.loading")}</p> : null}

            <section aria-labelledby="persistent-cv-search-title">
              <h4 id="persistent-cv-search-title">{t("searchProfiles.cvTitle")}</h4>
              {cvProfiles.length === 0 ? (
                <p className="field-hint">{t("searchProfiles.cvEmpty")}</p>
              ) : (
                <ul>
                  {cvProfiles.map((profile) => (
                    <li key={profile.searchProfileId}>
                      <strong>{profile.name}</strong>
                      <Badge tone="active">{t("searchProfiles.persistentBadge")}</Badge>
                      <span className="field-hint"> {profile.searchConfig.targetRoles.join(", ")}</span>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          void (async () => {
                            setBusy(true);
                            try {
                              await profiles.deleteCv(cvId, profile.searchProfileId);
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
                    </li>
                  ))}
                </ul>
              )}

              <div className="cv-profiles-overlay__form">
                <h5>{t("searchProfiles.createCv")}</h5>
                <label>{t("searchProfiles.name")}
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </label>
                <label>{t("searchProfiles.description")}
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
                <Button disabled={busy || !name.trim()} onClick={() => void createCv()}>
                  {t("searchProfiles.save")}
                </Button>
              </div>
            </section>

            <section aria-labelledby="persistent-ats-title">
              <h4 id="persistent-ats-title">{t("searchProfiles.atsTitle")}</h4>
              {cvProfiles.length === 0 ? (
                <p className="field-hint">{t("searchProfiles.atsNeedsCv")}</p>
              ) : (
                <>
                  {cvProfiles.map((parent) => (
                    <div key={parent.searchProfileId}>
                      <strong>{parent.name}</strong>
                      {(atsByParent[parent.searchProfileId] ?? []).length === 0 ? (
                        <p className="field-hint">{t("searchProfiles.atsEmpty")}</p>
                      ) : (
                        <ul>
                          {(atsByParent[parent.searchProfileId] ?? []).map((ats) => (
                            <li key={ats.atsSearchProfileId}>
                              <span>{ats.name}</span>
                              <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  void (async () => {
                                    setBusy(true);
                                    try {
                                      await profiles.deleteAts(parent.searchProfileId, ats.atsSearchProfileId);
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
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  <div className="cv-profiles-overlay__form">
                    <h5>{t("searchProfiles.createAts")}</h5>
                    <label>{t("searchProfiles.parent")}
                      <select value={atsParent} onChange={(e) => setAtsParent(e.target.value)}>
                        {cvProfiles.map((parent) => (
                          <option key={parent.searchProfileId} value={parent.searchProfileId}>
                            {parent.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>{t("searchProfiles.name")}
                      <input value={atsName} onChange={(e) => setAtsName(e.target.value)} maxLength={120} />
                    </label>
                    <label>{t("searchProfiles.targetRoles")}
                      <input value={atsRoles} onChange={(e) => setAtsRoles(e.target.value)} />
                    </label>
                    <label>{t("searchProfiles.skills")}
                      <input value={atsSkills} onChange={(e) => setAtsSkills(e.target.value)} />
                    </label>
                    <Button disabled={busy || !atsParent || !atsName.trim()} onClick={() => void createAts()}>
                      {t("searchProfiles.save")}
                    </Button>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
