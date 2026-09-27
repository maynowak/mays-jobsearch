# CV-UPLOAD-UX-07 — EXECUTION LOG (ATS-Skills = speichern + schliessen; Profil-Auswahl im CV-Bereich)

## Current status
FINALIZED — alle Validierungen gruen. Commit steht aus (Nutzerfreigabe).

## Git state (Ende / Hinweis)
- Basis: main @ 58309c5 (gepusht). ACHTUNG: Teile der UX-07-Aenderungen an
  src/App.test.tsx (Test-Anpassungen) und src/styles.css (.cv-saved-profiles)
  wurden versehentlich dem MODEL-SELECT-01-Commit 58309c5 beigegeben
  (Working-Tree-Mischung beim Staging). HEAD ist dennoch konsistent:
  komplette Suite 504/504 PASS. Diese Notiz dokumentiert die Zuordnung;
  keine History-Korrektur.

## Audit date/time
2026-09-26 (nach MODEL-SELECT-01-Fix; HEAD 1de217d gepusht)

## Git state (Start)
- Branch: main, HEAD 1de217d, synchron mit origin/main

## Task / Purpose (User-Request)
1. Nach der Auswahl der ATS-Skills gilt der Eintrag als GESPEICHERT und der
   Workflow (Overlay) SCHLIESST zurueck zum CV-Upload-Bereich — keine
   automatische Analyse-Ausfuehrung mehr an dieser Stelle.
2. Im CV-Upload-Bereich (ueber/unter der Suchmaske): Auswahl des gespeicherten
   Suchprofils ("CV-Profil") und darunter ein ATS-Profil dieses CVs.

## Design-Entscheidungen
- ATS-Ziel im Skills-Step: bestaetigte Skills werden als benanntes ATS-Profil
  gespeichert (bestehend, CV-PROFILE-LISTS-01) UND der Workflow schliesst
  (Step document-selected) + Status-Hinweis. Die eigentliche ATS-Analyse
  laeuft weiterhin pro Treffer-Job (AtsOverlay) — jetzt optional mit dem
  gewaehlten ATS-Profil.
- Die Tiefen-Analyse im Workflow (ats-processing/-complete, Improvement-
  Schleife, Re-Analyse, Match Impact) bleibt im Code, wird aber vom
  Skill-Confirm nicht mehr automatisch betreten (ruhend; Reaktivierung ueber
  ATS-Profil als Folgetask notiert).
- CV-Bereich: oberhalb der Dokumentliste zwei Selects — Suchprofil (befuellt
  die Suchmaske mit dem gespeicherten Profil) und ATS-Profil (wird aktiv;
  per-Job-ATS nutzt dann dessen Skills/Zielrolle).
- Quelle der Listen: erstes ausgewaehltes Dokument (Fallback: erstes
  Dokument) ueber dessen Inhalts-Hash.

## Umsetzung (final)
- ATS-Ziel im Skills-Step: bestaetigte Skills werden als benanntes ATS-Profil
  gespeichert, Workflow schliesst (document-selected) + Status "gespeichert".
  Kein automatischer in-Workflow-ATS-Lauf mehr (ruhend, siehe unten).
- CV-Bereich (document-selected, oberhalb der Dokumentliste): zwei Selects —
  Suchprofil (befuellt die Suchmaske) und ATS-Profil (wird aktiv).
- Per-Job-ATS (AtsOverlay) nutzt bei Auswahl das ATS-Profil
  (Skills/Zielrolle) statt des allgemeinen Suchprofils.
- i18n: cv.atsProfileSaved, cv.chooseSearchProfile, cv.chooseAtsProfile,
  cv.choosePlaceholder, cv.profilesRegionAria (de/en).
- Ruhender Code (bewusst nicht geloescht): Workflow-Steps ats-processing/
  ats-complete/ats-model-recovery + runAtsProcessing (Tiefen-Analyse,
  Improvement, Re-Analyse, Match Impact) — Reaktivierung als Folgetask
  notiert.

## Tests
- Angepasst (neue Speichern+Schliessen-Semantik): BROWSER-BUG-14..19,
  BROWSER-BUG-20, BROWSER-BUG-22, CV-PROFILE-LISTS-Flows, CV-UPLOAD-UX-06
  (Bulk) — DOM-nahe Assertions auf die neuen Selects/Scoped-Lookups.
- Neu abgedeckt: ATS-Profil im Select waehlbar, Details enthalten nur die
  gewaehlten Skills, Status-Hinweis erscheint, keine Sofort-Analyse.

## Files changed
- src/App.tsx (handleSkillSelectionConfirm ATS, Selects, ATS-Verdrahtung)
- src/i18n.tsx, src/App.test.tsx, src/styles.css —
  *Teile davon liefen im Commit 58309c5 mit (siehe Hinweis oben).*
- docs/reports/CV-UPLOAD-UX-07-EXECUTION_LOG.md (diese Datei)

## Checks (final)
- npx vitest run: 43 Files / 504 Tests — PASS
- npx tsc -b — PASS; npm run build — PASS; git diff --check — CLEAN

## Consent-/Privacy-/Contract-Bezug
Keine Aenderung: Speicherung bleibt lokal/Session+12h (LISTS-02); ATS-Calls
laufen unveraendert unter Consent.

## Classification
GREEN — ATS-Skills-Auswahl speichert + schliesst; Profile im CV-Bereich
auswaehlbar.
