# CV-UPLOAD PRODUCTION-BEFUND — MODELL-DEFAULT & FEHLER-MELDUNG

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-Upload Fehleranalyse + Fix ('konnte gerade nicht ausgewertet werden')
- Root Cause (Production, per Browser-Repro + curl nachgewiesen):
  1. Deployment-Config: defaultModel = openai/gpt-4o-mini (ENV
     OPENROUTER_MODEL/Repo-Default) ist kein Free-Modell → /api/profile liefert
     400 model_not_free bzw. im Default-Pfad 502 model_unavailable (das
     aufgeloeste Free-Fallback-Modell meldete 502 Upstream).
  2. UI-Mappte model_not_free/model_invalid faelschlich auf den generischen
     cv.processError (falsche Fehleraussage an falscher Stelle).
- Fixes (Code):
  - api/models.mjs: defaultModel wird nun auf ein kompatibles freies Modell
    aufgeloest (getCompatibleFallback), wenn das konfigurierte Modell nicht
    frei ist (verhindert systematisches model_not_free fuer Default-Calls).
  - CvUpload-Fehlermeldung: model_not_free/model_invalid → model.unavailable-
    Hinweis (statt generischem Verarbeitungsfehler). Fallback-Semantik von
    withModelFallback (free_quota stoppt) unveraendert.
- Consent/Anonymisierung: unveraendert (Privacy Boundary aus vorherigem
  Eintrag gilt weiterhin vor jedem Modell-Call).
- Hinweis fuer Betrieb: OPENROUTER_MODEL in Vercel auf ein verfuegbares
  Free-Modell setzen oder entfernen (Recommendation siehe /api/models).
- Files changed: api/models.mjs, src/components/CvUpload.tsx,
  src/App.test.tsx, tests/api/models-default.test.mjs (neu),
  docs/AI_AUDITLOG.md
- Tests: 490/490 PASS; Browser-Suite 24/24 PASS; TypeScript PASS; Build PASS.
- Classification: GREEN — Produktionsbefund reproduziert, Root Cause
  behoben; ausstehende Deployment-Empfehlung dokumentiert.
