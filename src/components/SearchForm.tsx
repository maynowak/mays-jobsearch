import { useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "../types";

type Phase = "idle" | "searching" | "scoring";

interface Props {
  phase: Phase;
  onSubmit: (profile: Profile) => void;
}

export default function SearchForm({ phase, onSubmit }: Props) {
  const [skills, setSkills] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [city, setCity] = useState("");

  const busy = phase !== "idle";
  const label =
    phase === "searching"
      ? "Searching the job board…"
      : phase === "scoring"
        ? "Scoring your matches with AI…"
        : "Find my matches";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ skills: skills.trim(), targetRole: targetRole.trim(), city: city.trim() });
  };

  return (
    <form id="search-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="skills">Skills</label>
          <input
            id="skills"
            type="text"
            placeholder="e.g. JavaScript, React, Node.js, SQL"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="targetRole">Target role</label>
            <input
              id="targetRole"
              type="text"
              placeholder="e.g. Frontend Developer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input
              id="city"
              type="text"
              placeholder="e.g. Berlin, München, Hamburg"
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