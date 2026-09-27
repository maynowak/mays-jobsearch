# CV-PROFILE-LISTS-03 — NAMENSVORSCHLAEGE + KLICK MARKIERT ALLES

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-PROFILE-LISTS-03 (User-Request)
- Purpose: Das vorgeschlagene Suchprofil (und ATS-Profil) soll einen Namen
  vorgeschlagen bekommen ("Profil1", "Profil2", …; ATS analog
  "ATS-Profil1", …); Klick in das Feld markiert den ganzen Text.
- Umsetzung:
  - Vorschlag = Anzahl bestehender Eintraege in der Liste DIESES CVs + 1
    (Suchprofile: readCvProfileLists(hash).searchProfiles; ATS: bei
    "Ziel ausführen" vorbefuellt via atsProfileName-State).
  - CvProfileResult: neue Prop defaultName; ATS-Namensfeld im Skills-Step.
  - Beide Namensfelder: onFocus markiert den kompletten Text
    (ueberschreiben ohne manuelles Loeschen).
- Files changed: src/components/CvProfileResult.tsx, src/App.tsx,
  src/App.test.tsx (Assertions Profil1/ATS-Profil1 + Fokus-Markierung)
- Tests: 503/503 PASS; TypeScript PASS; Build PASS; diff --check CLEAN
- Classification: GREEN
