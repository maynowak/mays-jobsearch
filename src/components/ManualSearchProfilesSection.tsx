import { useEffect, useId, useRef, useState } from "react";
import type { EmploymentType, Profile, WorkMode } from "../types";
import { EMPLOYMENT_TYPES, RADIUS_KM_OPTIONS, WORK_MODES } from "../types";
import { useLang } from "../i18n";
import { formatSkills, parsePhraseList, parseTargetRoles, formatTargetRoles } from "../lib/skills";
import {
  formatManualProfileTermList,
  parseManualProfileTermList,
  validateManualSearchProfileDraft,
} from "../lib/manualSearchProfiles";
import type {
  ManualSearchProfile,
  ManualSearchProfileDraft,
  ManualSearchProfilePreferences,
} from "../lib/manualSearchProfiles";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { ProfileSessionEndedError } from "../lib/profiles/sessionRepositories";

// MAYS-SEARCH-PROFILE-MANUAL-01:
// Manuelle Suchprofile unter "Job-Praferenzen".
//
// Diese Oberflaeche ist bewusst modellfrei: Erstellen, Bearbeiten, Speichern,
// Auswaehlen, Duplizieren und Loeschen arbeiten ausschliesslich auf lokalen,
// vom Benutzer eingegebenen Werten. Es wird kein CV verarbeitet und keine
// KI-/Matching-Anfrage ausgeloest — "Damit suchen" startet ausschliesslich die
// bestehende Stellensuche (separater, ausdruecklicher Schritt).
//
// Die Speicherung erfolgt nur fuer die laufende Sitzung; das wird sprachlich
// eindeutig kommuniziert ("Fuer diese Sitzung speichern").

interface Props {
  profiles: readonly ManualSearchProfile[];
  busy?: boolean;
  onSave: (draft: ManualSearchProfileDraft, existingId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onSearch: (profile: ManualSearchProfile) => void;
}

interface FormState {
  id: string | null;
  name: string;
  description: string;
  targetRolesText: string;
  keywordsText: string;
  requiredText: string;
  preferredText: string;
  excludedText: string;
  city: string;
  radiusKm: string;
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
}

const emptyForm = (): FormState => ({
  id: null,
  name: "",
  description: "",
  targetRolesText: "",
  keywordsText: "",
  requiredText: "",
  preferredText: "",
  excludedText: "",
  city: "",
  radiusKm: "",
  workModes: [],
  employmentTypes: ["full_time"],
});

const formFromProfile = (profile: ManualSearchProfile): FormState => ({
  id: profile.id,
  name: profile.name,
  description: profile.description ?? "",
  targetRolesText: formatTargetRoles(profile.searchConfig.targetRoles ?? []),
  keywordsText: formatSkills(parsePhraseList(profile.searchConfig.skills ?? "")),
  requiredText: formatManualProfileTermList(profile.matchingPreferences.requiredSkills),
  preferredText: formatManualProfileTermList(profile.matchingPreferences.preferredSkills),
  excludedText: formatManualProfileTermList(profile.matchingPreferences.excludedTerms),
  city: profile.searchConfig.city ?? "",
  radiusKm: profile.searchConfig.radiusKm === null || profile.searchConfig.radiusKm === undefined
    ? ""
    : String(profile.searchConfig.radiusKm),
  workModes: [...(profile.searchConfig.workModes ?? [])],
  employmentTypes: [...(profile.searchConfig.employmentTypes ?? [])],
});

const toggleIn = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

export default function ManualSearchProfilesSection({
  profiles,
  busy = false,
  onSave,
  onDelete,
  onDuplicate,
  onSearch,
}: Props) {
  const { t } = useLang();
  const formId = useId();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const restoreFocusRef = useRef(false);

  // Nach Speichern/Abbrechen liegt der Fokus sonst auf <body>, weil der
  // auslösende Button beim Schließen des Formulars entfernt wird.
  useEffect(() => {
    if (form || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    document.getElementById(`${formId}-new`)?.focus();
  }, [form, formId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const startCreate = () => {
    setError(null);
    setNotice(null);
    setPendingDeleteId(null);
    setForm(emptyForm());
  };

  const startEdit = (profile: ManualSearchProfile) => {
    setError(null);
    setNotice(null);
    setPendingDeleteId(null);
    setForm(formFromProfile(profile));
  };

  const cancelForm = () => {
    setError(null);
    setPendingDeleteId(null);
    restoreFocusRef.current = true;
    setForm(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || pendingAction) return;

    const searchConfig: Profile = {
      skills: formatSkills(parsePhraseList(form.keywordsText)),
      targetRoles: parseTargetRoles(form.targetRolesText),
      city: form.city.trim(),
      radiusKm: form.radiusKm === "" ? null : Number(form.radiusKm),
      workModes: [...form.workModes],
      employmentTypes: form.employmentTypes.length > 0 ? [...form.employmentTypes] : ["full_time"],
    };
    const matchingPreferences: ManualSearchProfilePreferences = {
      requiredSkills: parseManualProfileTermList(form.requiredText),
      preferredSkills: parseManualProfileTermList(form.preferredText),
      excludedTerms: parseManualProfileTermList(form.excludedText),
    };
    const draft: ManualSearchProfileDraft = {
      name: form.name,
      description: form.description,
      searchConfig,
      matchingPreferences,
    };

    const validationError = validateManualSearchProfileDraft(draft);
    if (validationError) {
      setError(validationError === "name" ? t("manualProfiles.error.name") : t("manualProfiles.error.search"));
      return;
    }

    setPendingAction("save");
    try {
      await onSave(draft, form.id);
      setError(null);
      restoreFocusRef.current = true;
      setForm(null);
      setNotice(t("manualProfiles.notice.saved"));
    } catch (error) {
      if (error instanceof ProfileSessionEndedError) {
        setError(null);
        setNotice(null);
        setForm(null);
        return;
      }
      setError(t("manualProfiles.error.save"));
    } finally {
      setPendingAction(null);
    }
  };

  const confirmDelete = async (id: string) => {
    if (pendingAction) return;
    setError(null);
    setPendingAction(`delete:${id}`);
    try {
      await onDelete(id);
      setPendingDeleteId(null);
      setNotice(t("manualProfiles.notice.deleted"));
    } catch (error) {
      if (error instanceof ProfileSessionEndedError) {
        setError(null);
        setNotice(null);
        setPendingDeleteId(null);
        return;
      }
      setError(t("manualProfiles.error.delete"));
    } finally {
      setPendingAction(null);
    }
  };

  const duplicateProfile = async (id: string) => {
    if (pendingAction) return;
    setError(null);
    setPendingAction(`duplicate:${id}`);
    try {
      await onDuplicate(id);
      setNotice(t("manualProfiles.notice.duplicated"));
    } catch (error) {
      if (error instanceof ProfileSessionEndedError) {
        setError(null);
        setNotice(null);
        return;
      }
      setError(t("manualProfiles.error.duplicate"));
    } finally {
      setPendingAction(null);
    }
  };

  const panelTitle = form?.id ? t("manualProfiles.form.editTitle") : t("manualProfiles.form.newTitle");

  const renderSummaryValue = (values: string[]) =>
    values.length > 0 ? values.join(" · ") : t("manualProfiles.none");

  return (
    <section
      className="dashboard-v2__cv-section dashboard-v2__manual-profiles"
      aria-labelledby="dashboard-v2-manual-profiles-title"
    >
      <div className="dashboard-v2__card-heading">
        <div>
          <h2 id="dashboard-v2-manual-profiles-title">{t("manualProfiles.title")}</h2>
          <p>{t("manualProfiles.description")}</p>
        </div>
        <Badge tone="soon">{t("manualProfiles.sessionBadge")}</Badge>
      </div>

      <div className="dashboard-v2__cv-boundary" role="note">
        {t("manualProfiles.sessionNote")}
      </div>

      <div className="dashboard-v2__manual-toolbar">
        <Button id={`${formId}-new`} onClick={startCreate} disabled={busy || pendingAction !== null || Boolean(form)}>
          {t("manualProfiles.new")}
        </Button>
        {!form && profiles.length > 0 && (
          <span className="field-hint">{t("manualProfiles.listHint")}</span>
        )}
      </div>

      {notice && (
        <p className="dashboard-v2__manual-notice" role="status">
          {notice}
        </p>
      )}

      {form && (
        <form
          className="dashboard-v2__manual-form"
          onSubmit={handleSubmit}
          aria-labelledby={`${formId}-legend`}
          noValidate
        >
          <h3 id={`${formId}-legend`}>{panelTitle}</h3>

          <div className="dashboard-v2__manual-form-grid">
            <div className="field">
              <label htmlFor={`${formId}-name`}>{t("manualProfiles.form.name")}</label>
              <input
                id={`${formId}-name`}
                type="text"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder={t("manualProfiles.form.namePh")}
                autoComplete="off"
                disabled={busy}
                autoFocus
                required
              />
            </div>

            <div className="field">
              <label htmlFor={`${formId}-description`}>{t("manualProfiles.form.description")}</label>
              <input
                id={`${formId}-description`}
                type="text"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder={t("manualProfiles.form.descriptionPh")}
                autoComplete="off"
                disabled={busy}
              />
            </div>

            <div className="field field--full">
              <label htmlFor={`${formId}-roles`}>{t("manualProfiles.form.targetRoles")}</label>
              <input
                id={`${formId}-roles`}
                type="text"
                value={form.targetRolesText}
                onChange={(event) => update("targetRolesText", event.target.value)}
                placeholder={t("manualProfiles.form.targetRolesPh")}
                autoComplete="off"
                disabled={busy}
                aria-describedby={`${formId}-roles-help`}
              />
              <p className="field-hint" id={`${formId}-roles-help`}>
                {t("manualProfiles.form.targetRolesHelp")}
              </p>
            </div>

            <div className="field field--full">
              <label htmlFor={`${formId}-keywords`}>{t("manualProfiles.form.keywords")}</label>
              <input
                id={`${formId}-keywords`}
                type="text"
                value={form.keywordsText}
                onChange={(event) => update("keywordsText", event.target.value)}
                placeholder={t("manualProfiles.form.keywordsPh")}
                autoComplete="off"
                disabled={busy}
                aria-describedby={`${formId}-keywords-help`}
              />
              <p className="field-hint" id={`${formId}-keywords-help`}>
                {t("manualProfiles.form.keywordsHelp")}
              </p>
            </div>

            <div className="field field--full">
              <label htmlFor={`${formId}-required`}>{t("manualProfiles.form.required")}</label>
              <textarea
                id={`${formId}-required`}
                value={form.requiredText}
                onChange={(event) => update("requiredText", event.target.value)}
                placeholder={t("manualProfiles.form.requiredPh")}
                rows={4}
                disabled={busy}
                aria-describedby={`${formId}-terms-help`}
              />
            </div>

            <div className="field field--full">
              <label htmlFor={`${formId}-preferred`}>{t("manualProfiles.form.preferred")}</label>
              <textarea
                id={`${formId}-preferred`}
                value={form.preferredText}
                onChange={(event) => update("preferredText", event.target.value)}
                placeholder={t("manualProfiles.form.preferredPh")}
                rows={4}
                disabled={busy}
                aria-describedby={`${formId}-terms-help`}
              />
            </div>

            <div className="field field--full">
              <label htmlFor={`${formId}-excluded`}>{t("manualProfiles.form.excluded")}</label>
              <textarea
                id={`${formId}-excluded`}
                value={form.excludedText}
                onChange={(event) => update("excludedText", event.target.value)}
                placeholder={t("manualProfiles.form.excludedPh")}
                rows={3}
                disabled={busy}
                aria-describedby={`${formId}-terms-help`}
              />
              <p className="field-hint" id={`${formId}-terms-help`}>
                {t("manualProfiles.form.termsHelp")}
              </p>
            </div>

            <div className="field">
              <label htmlFor={`${formId}-city`}>{t("manualProfiles.form.city")}</label>
              <input
                id={`${formId}-city`}
                type="text"
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                placeholder={t("manualProfiles.form.cityPh")}
                autoComplete="off"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor={`${formId}-radius`}>{t("manualProfiles.form.radius")}</label>
              <select
                id={`${formId}-radius`}
                value={form.radiusKm}
                onChange={(event) => update("radiusKm", event.target.value)}
                disabled={busy}
              >
                <option value="">{t("search.radiusNone")}</option>
                {RADIUS_KM_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    {t("search.radiusOption", { km })}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span className="field-label">{t("manualProfiles.form.workModes")}</span>
              <div className="check-group" role="group" aria-label={t("manualProfiles.form.workModes")}>
                {WORK_MODES.map((mode) => (
                  <label key={mode} className="check-item">
                    <input
                      type="checkbox"
                      checked={form.workModes.includes(mode)}
                      onChange={() => update("workModes", toggleIn(form.workModes, mode))}
                      disabled={busy}
                    />
                    <span>{t(`workMode.${mode}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">{t("manualProfiles.form.employmentTypes")}</span>
              <div className="check-group" role="group" aria-label={t("manualProfiles.form.employmentTypes")}>
                {EMPLOYMENT_TYPES.map((type) => (
                  <label key={type} className="check-item">
                    <input
                      type="checkbox"
                      checked={form.employmentTypes.includes(type)}
                      onChange={() => {
                        // Mindestens eine Beschaeftigungsart bleibt gewaehlt
                        // (gleiche Regel wie in der bestehenden Suchmaske).
                        const next = toggleIn(form.employmentTypes, type);
                        update("employmentTypes", next.length > 0 ? next : form.employmentTypes);
                      }}
                      disabled={busy}
                    />
                    <span>{t(`employmentType.${type}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <div className="dashboard-v2__manual-form-actions">
            <Button type="submit" disabled={busy || pendingAction === "save"}>
              {t("manualProfiles.saveSession")}
            </Button>
            <Button variant="ghost" onClick={cancelForm} disabled={busy || pendingAction === "save"}>
              {t("manualProfiles.cancel")}
            </Button>
          </div>
        </form>
      )}

      {!form && profiles.length === 0 && (
        <p className="dashboard-v2__cv-empty">{t("manualProfiles.empty")}</p>
      )}

      {!form && profiles.length > 0 && (
        <ul className="dashboard-v2__manual-list" role="list">
          {profiles.map((profile) => {
            const keywords = parsePhraseList(profile.searchConfig.skills ?? "");
            const roles = profile.searchConfig.targetRoles ?? [];
            const workModes = (profile.searchConfig.workModes ?? []).map((mode) => t(`workMode.${mode}`));
            const employmentTypes = (profile.searchConfig.employmentTypes ?? []).map((type) =>
              t(`employmentType.${type}`)
            );
            const radius = profile.searchConfig.radiusKm
              ? t("search.radiusOption", { km: profile.searchConfig.radiusKm })
              : t("search.radiusNone");

            return (
              <li key={profile.id} className="dashboard-v2__manual-item">
                <div className="dashboard-v2__manual-item-head">
                  <div>
                    <h3>{profile.name}</h3>
                    {profile.description && <p>{profile.description}</p>}
                  </div>
                  <Badge tone="neutral">{t("manualProfiles.sessionBadge")}</Badge>
                </div>

                <p className="dashboard-v2__manual-summary">
                  <strong>{t("manualProfiles.summary.roles")}:</strong> {renderSummaryValue(roles)}
                </p>
                <p className="dashboard-v2__manual-summary">
                  <strong>{t("manualProfiles.summary.keywords")}:</strong> {renderSummaryValue(keywords)}
                </p>
                <p className="dashboard-v2__manual-summary">
                  <strong>{t("manualProfiles.summary.required")}:</strong>{" "}
                  {renderSummaryValue(profile.matchingPreferences.requiredSkills)}
                </p>
                <p className="dashboard-v2__manual-summary">
                  <strong>{t("manualProfiles.summary.preferred")}:</strong>{" "}
                  {renderSummaryValue(profile.matchingPreferences.preferredSkills)}
                </p>
                <p className="dashboard-v2__manual-summary">
                  <strong>{t("manualProfiles.summary.excluded")}:</strong>{" "}
                  {renderSummaryValue(profile.matchingPreferences.excludedTerms)}
                </p>
                <p className="dashboard-v2__manual-summary">
                  <strong>{t("manualProfiles.summary.search")}:</strong>{" "}
                  {[
                    profile.searchConfig.city || t("manualProfiles.none"),
                    radius,
                    ...workModes,
                    ...employmentTypes,
                  ].join(" · ")}
                </p>

                <div className="dashboard-v2__manual-actions">
                  <Button variant="ghost" onClick={() => startEdit(profile)} disabled={busy || pendingAction !== null}>
                    {t("manualProfiles.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void duplicateProfile(profile.id)}
                    disabled={busy || pendingAction !== null}
                  >
                    {t("manualProfiles.duplicate")}
                  </Button>
                  <Button onClick={() => onSearch(profile)} disabled={busy || pendingAction !== null}>
                    {t("manualProfiles.search")}
                  </Button>
                  {pendingDeleteId === profile.id ? (
                    <>
                      <span className="field-hint" role="alert">
                        {t("manualProfiles.deleteConfirm")}
                      </span>
                      <Button variant="danger" onClick={() => void confirmDelete(profile.id)} disabled={busy || pendingAction !== null}>
                        {t("manualProfiles.deleteConfirmButton")}
                      </Button>
                      <Button variant="ghost" onClick={() => setPendingDeleteId(null)} disabled={busy || pendingAction !== null}>
                        {t("manualProfiles.cancel")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setNotice(null);
                        setPendingDeleteId(profile.id);
                      }}
                      disabled={busy || pendingAction !== null}
                    >
                      {t("manualProfiles.delete")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
