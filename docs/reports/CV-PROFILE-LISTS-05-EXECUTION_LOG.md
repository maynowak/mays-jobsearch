# CV-PROFILE-LISTS-05 — NAMENSFELD OBEN + VORSCHLAG "<BASIS> - PROFIL<N>"

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-PROFILE-LISTS-05 (User-Request)
- Purpose:
  1. Namensfelder ("Name für dieses Suchprofil" / "Name für dieses
     ATS-Profil") ganz nach oben in die Eingabereihenfolge ihrer Steps.
  2. Vorschlagsnamen im Format "<Zielrolle> - Profil1", spaeter
     "<Zielrolle> - Profil2"/"Profil3", …; ATS analog
     "<Zielrolle> - ATS1", "<Zielrolle> - ATS2", …
  3. Klick ins Feld markiert weiterhin den ganzen Text (aus 03).
- Umsetzung:
  - CvProfileResult: Namensfeld jetzt erstes Eingabefeld des Steps;
    defaultName = "<suggestedProfile.targetRoles[0]> - Profil<Zaehler>"
    (Zaehler = Anzahl vorhandener Suchprofile dieses CVs + 1).
  - Skills-Step (ATS): Namensfeld steht oberhalb der Skills-Liste;
    Vorschlag = "<cvProfile.targetRole|targetRoles[0]> - ATS<Zaehler>"
    (Zaehler = Anzahl vorhandener ATS-Profile dieses CVs + 1), beim
    "Ziel ausführen" vorbefuellt.
  - Beide Felder behalten onFocus select-all (Text beim Draufklicken
    komplett markiert).
- Files changed: src/components/CvProfileResult.tsx, src/App.tsx,
  src/App.test.tsx, docs/AI_AUDITLOG.md,
  docs/reports/CV-PROFILE-LISTS-02-EXECUTION_LOG.md
- Tests: 503/503 PASS (Assertions: Default-Werte, Feld-Position oben,
  select-all bei Fokus); TypeScript PASS; Build PASS; diff --check CLEAN
- Classification: GREEN
