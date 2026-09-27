# CV-UPLOAD-UX-11 — EXECUTION LOG (Zielrolle im Suchprofil nicht entfernbar)

## Current status
FINALIZED — gefixt, validiert, committet + gepusht (auf Nutzeranweisung).

## Befund (verifiziert)
- CvProfileResult.confirm() nutzte immer `suggested.targetRoles[0]` und
  ignorierte das bearbeitete Zielrolle-Feld komplett — Editieren/Entfernen
  hatte keine Wirkung auf das gespeicherte Profil.

## Umsetzung
- confirm() nutzt jetzt das bearbeitete Feld: erste komma-getrennte Rolle,
  getrimmt; leer bleibt leer (kein stiller Fallback).

## Files changed
- src/components/CvProfileResult.tsx
- src/App.test.tsx (+1 Test: leeren + speichern + Overlay zeigt "—")
- docs/reports/CV-UPLOAD-UX-11-EXECUTION_LOG.md (diese Datei)

## Checks (final)
- npx vitest run: 43 Files / 511 Tests — PASS
- npx tsc -b — PASS; npm run build — PASS; git diff --check — CLEAN

## Consent-/Privacy-/Contract-Bezug
Keine Aenderung (reine Formular-Korrektheit).

## Classification
GREEN — Zielrolle editier-/entfernbar; gespeicherter Wert entspricht dem
sichtbaren Feld (WYSIWYG).
