# API-TARGETROLES-01 — EXECUTION LOG (API-Support für mehrere Zielrollen)

## Current status
FINALIZED — alle Validierungen gruen. Commit steht aus (Nutzerfreigabe).

## Befund (verifiziert)
- Frontend sendet mehrere `targetRole` Query-Parameter (Array)
- API erwartete einzelnen String -> `targetRole.toLowerCase()` fehlgeschlagen -> 500
- Quellen (Apify, Arbeitnow) erwarteten ebenfalls einzelnen `targetRole`

## Umsetzung
- **api/jobs.mjs**: Parst `targetRole` als Array (mehrere Query-Parameter) oder String
- **api/_lib/sources/index.mjs**: `fetchAllJobs` akzeptiert `targetRoles` (Array) mit
  Backward-Compatibility für `targetRole` (String); reicht Array an Strategie weiter
- **api/_lib/searchStrategy.mjs**: `applySearchStrategyWithTargetRole` filtert Jobs,
  die ANY der Zielrollen im Title/Tags enthalten (OR-Query ueber alle Rollen)
- **api/_lib/sources/apify/index.mjs**: `fetchActorJobs` nutzt erste Rolle fuer
  API-Query, alle Rollen fuer Keyword-Matching
- **api/_lib/sources/arbeitnow.mjs**: Analog wie Apify

## Tests
- Bestehende API-Tests (inkl. Apify/Arbeitnow Mocks) angepasst -> alle 511 Tests PASS
- Frontend-Tests unveraendert (nutzen bereits targetRoles Array)

## Files changed
- api/jobs.mjs
- api/_lib/sources/index.mjs
- api/_lib/searchStrategy.mjs
- api/_lib/sources/apify/index.mjs
- api/_lib/sources/arbeitnow.mjs
- docs/reports/API-TARGETROLES-01-EXECUTION_LOG.md (diese Datei)

## Classification
GREEN — API unterstuetzt jetzt mehrere Zielrollen (OR-Query), 500-Fehler behoben.

## Resume point
Abgeschlossen; naechster Schritt: Commit + Push (Nutzerfreigabe liegt vor).