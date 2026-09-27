# CV-UPLOAD-UX-10 — EXECUTION LOG (Suche startet erst mit gewaehltem Profil)

## Current status
FINALIZED — alle Validierungen gruen. Commit steht aus (Nutzerfreigabe).

## Umsetzung (final)
- "Job-Suche starten" ist deaktiviert, solange kein Suchprofil gewaehlt ist;
  zusaetzlicher Hinweistext (cv.startSearchHint, de/en). Handler wehrt
  zusaetzlich defensiv ab (kein Start ohne Entry).
- Konsistenz-Fixes aus ATS-PROFILE-INVESTIGATION-01: Reset der Auswahl-IDs
  bei Doc-Wechsel (useEffect auf Quelldokument) und bei "CV-Daten entfernen".
- Auto-Selektion nach dem Speichern (aus UX-08) bleibt: Standardablauf hat
  nach dem Speichern sofort einen Start-faehigen Zustand.

## Tests
- Neuer Flow-Test: Start gesperrt mit Hinweis bei Placeholder; kein
  fetchJobs-Call ohne Auswahl; nach Auswahl aktiv + Call mit dem Profil.
- Suite: 43 Files / 510 Tests PASS; TSC PASS; Build PASS; diff --check CLEAN.

## Files changed
- src/App.tsx, src/i18n.tsx, src/styles.css, src/App.test.tsx,
  docs/reports/CV-UPLOAD-UX-10-EXECUTION_LOG.md (diese Datei),
  docs/reports/ATS-PROFILE-INVESTIGATION-01-EXECUTION_LOG.md

## Consent-/Privacy-/Contract-Bezug
Keine Aenderung (lokale Session-Listen + 12h-TTL unveraendert).

## Classification
GREEN

## Resume point
Abgeschlossen; naechster Schritt: Commit nach Nutzerfreigabe.
