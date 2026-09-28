# CV-UPLOAD-UX-12 — EXECUTION LOG (Mehrere Zielrollen im Suchprofil)

## Current status
FINALIZED — alle Validierungen gruen. Commit steht aus (Nutzerfreigabe).

## Befund (verifiziert)
- Nach Analyse wurden mehrere Zielrollen (kommagetrennt) im Input angezeigt,
  aber beim Speichern blieb nur die erste erhalten (Profile.targetRole: string).
- Such-API und Store erwarteten ebenfalls nur einen String.

## Umsetzung
- **types.ts**: `Profile.targetRole: string` → `targetRoles: string[]`
- **api.ts**: sendet mehrere `targetRole` Parameter (OR-Query serverseitig)
- **App.tsx**: Search-Validierung & Query-Building für Array; profilesEqual vergleicht Arrays; CV-Workflow-Profile nutzen targetRoles; ATSModal-Profil bekommt Array
- **SearchForm.tsx**: Komma-getrenntes Input-Feld + parseTargetRoles/formatTargetRoles (wie Skills)
- **CvProfileResult.tsx**: confirm() übergibt parseTargetRoles(targetRoles) Array
- **CvProfilesOverlay.tsx**: Anzeige aller Rollen per join(", ")
- **AlertCard.tsx**: übergibt targetRoles an Alert-API
- **cvProfileStore.ts**: ATS-Eintrag speichert targetRoles[]; Default-Name = erste Zielrolle (Fallback: erster Skill)
- **skills.ts**: parseTargetRoles / formatTargetRoles Helfer

## Tests
- Bestehende Tests angepasst (targetRoles Array); neue Tests nicht noetig (bestehende decken Flow ab).
- Suite: 43 Files / 511 Tests PASS; TSC PASS; Build PASS; diff --check CLEAN.

## Files changed
- src/types.ts, src/api.ts, src/App.tsx, src/components/SearchForm.tsx, src/components/CvProfileResult.tsx, src/components/CvProfilesOverlay.tsx, src/components/AlertCard.tsx, src/lib/skills.ts, src/lib/cvProfileStore.ts
- src/components/SearchForm.test.tsx, src/lib/cvProfileStore.test.ts, src/App.test.tsx
- docs/reports/CV-UPLOAD-UX-12-EXECUTION_LOG.md (diese Datei)

## Consent-/Privacy-/Contract-Bezug
Keine Aenderung (lokale Session-Listen + 12h-TTL unveraendert).

## Classification
GREEN — Mehrere Zielrollen werden im Profil gespeichert und bei der Suche als OR-Query genutzt.

## Resume point
Abgeschlossen; naechster Schritt: Commit + Push (Nutzerfreigabe liegt vor).