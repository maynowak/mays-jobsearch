# CV-UPLOAD-UX-08 — EXECUTION LOG (Auswahl-Box unter Upload + Edit-Spruenge + Upsert + Stil)

## Current status
FINALIZED — alle Validierungen gruen. Commit steht aus (Nutzerfreigabe).

## Audit date/time
2026-09-26 (nach CV-UPLOAD-UX-07; Start-HEAD 181d235, gepusht)

## Task / Purpose (User-Request)
1. Auswahlverfahren (Suchprofil + ATS-Profil) in eine Box UNTER dem
   CV-Upload-Bereich, mit einem Job-Search-Startbutton darunter.
2. Der "Verarbeitungsstatus"-Bereich unten bekommt denselben Stil wie die
   CV-Hochladen-Box (Dropzone-Look).
3. Auswahlboxen duerfen unausgewaehlt bleiben (Placeholder).
4. Neben den Comboboxen kleine "Bearbeiten"-Buttons: Sprung direkt in den
   jeweiligen Bearbeitungs-Step, vorbefuellt, mit Edit-Moeglichkeit.
5. Gleiche Namensgebung beim Speichern -> vorhandener Eintrag wird
   ueberschrieben (Upsert pro Name, ID bleibt stabil).

## Umsetzung (final)
- Auswahl-Box (.cv-saved-profiles) von der Dokument-Karte in die Search-Card
  direkt unter SearchForm/CvUpload verlegt; enthaelt Suchprofil-Select,
  ATS-Profil-Select (darunter), je mit kleinem "Bearbeiten"-Button
  (deaktiviert solange kein Eintrag gewaehlt), und darunter den Button
  "Job-Suche starten" (nutzt gewaehltes Profil, sonst aktuelle Maske).
- Edit-Sprung Suchprofil -> profile-ready, vorbefuellt (Name/Felder,
  editingSearchName-State); Edit-Sprung ATS -> skill-selection, Name +
  Skills vorbefuellt. Steps laufen im selben Overlay (Pfad B).
- Store: saveCvSearchProfile/saveCvAtsProfile sind jetzt Upserts pro Name
  (gleicher Name ueberschreibt; ID bleibt, Eintrag wandert nach vorn).
- Stil: Verarbeitungsstatus-Karte + Auswahl-Box im Dropzone-Stil (dashed
  Border, warmes Gradient-Feld, identischer Shadow/Radius).
- Beim Speichern wird das Suchprofil in der Box automatisch selektiert.
- Nach dem Edit-Speichern landet der Fluss wie bisher auf goal-selection;
  Zurueck-Navigationspfade unveraendert.

## Files changed
- src/lib/cvProfileStore.ts (Upsert by Name)
- src/App.tsx (Box-Verlagerung, Edit-Handler, Start-Button, States)
- src/styles.css (.cv-saved-profiles Dropzone-Look, .cv-processing-card
  Restyle, Zeilen-Layout)
- src/i18n.tsx (cv.editShort, cv.startSearch; de/en)
- src/lib/cvProfileStore.test.ts (+Upsert-Test)
- src/App.test.tsx (+2 Flow-Tests: Edit-Sprung/Ueberschreiben, Start-Button)
- docs/reports/CV-UPLOAD-UX-08-EXECUTION_LOG.md (diese Datei)

## Checks (final)
- npx vitest run: 43 Files / 507 Tests — PASS
- npx tsc -b — PASS; npm run build — PASS; git diff --check — CLEAN

## Consent-/Privacy-/Contract-Bezug
Keine Aenderung (Listen weiterhin lokal/Session+12h, Upsert pro Name;
ATS-Analyse unveraendert per-Job mit Consent).

## Classification
GREEN

## Resume point
Abgeschlossen; naechster Schritt: Commit nach Nutzerfreigabe.
