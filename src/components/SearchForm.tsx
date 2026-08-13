import { useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "../types";
import { useLang } from "../i18n";

type Phase = "idle" | "searching" | "scoring";

interface Props {
  phase: Phase;
  onSubmit: (profile: Profile) => void;
}

export default function SearchForm({ phase, onSubmit }: Props) {
  const { t } = useLang();
  const [skills, setSkills] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [city, setCity] = useState("");

  const busy = phase !== "idle";
  const label =
    phase === "searching"
      ? t("search.searching")
      : phase === "scoring"
        ? t("search.scoring")
        : t("search.button");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ skills: skills.trim(), targetRole: targetRole.trim(), city: city.trim() });
  };

  return (
    <form id="search-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="skills">{t("search.skills")}</label>
          <input
            id="skills"
            type="text"
            placeholder={t("search.skillsPh")}
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="targetRole">{t("search.targetRole")}</label>
            <input
              id="targetRole"
              type="text"
              placeholder={t("search.targetRolePh")}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="city">{t("search.city")}</label>
            <input
              id="city"
              type="text"
              placeholder={t("search.cityPh")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <button id="find-btn" type="submit" disabled={busy}>
          <span className="btn-label">{label}</span>
          {busy && <span className="spinner" />}
        </button>
      </form>
  );
}