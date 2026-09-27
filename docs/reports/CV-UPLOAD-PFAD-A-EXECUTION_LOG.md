# CV-UPLOAD PFAD A — CONSENT VOR AI-CALL + MODELL-RECOVERY

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-Upload Pfad-A-Privacy + Fehler-Recovery (User-Befund)
- Purpose: Consent-Grenze (wie Pfad B 'Einwilligung') vor dem ersten externen
  Modell-Aufruf im Quick-Upload; bei Modellausfall Recovery an Ort mit
  Modellauswahl statt Ruecksprung an den Anfang (kein erneuter Upload).
- AI component / data flow:
  - CvUpload: nach Extraktion + lokaler Anonymisierung (Privacy Boundary) +
    Cache-Check erscheint das bestehende CvConsentGate; erst nach Zustimmung
    erfolgt createProfile. Bei Modell-Ausfall (model_unavailable/
    model_not_free/model_invalid) startet kein erneuter Upload, sondern eine
    Recovery-Ansicht mit ModelSelector + 'Mit gewaehltem Modell erneut
    versuchen'. Der anonymisierte Text bleibt lokal erhalten (kein Re-Extract,
    kein Re-Anonymize).
  - Workflow-Consent (Pfad B, cvState.consentGiven, Overlay, dismiss/reopen)
    bleibt unveraendert — Consents der Pfade sind getrennt, um bestehendes
    Verhalten nicht zu regressieren.
- Consent-Bezug: Consent nun auch Pflicht im Quick-Upload (cache-hit ohne
  AI-Call braucht keinen erneuten Consent).
- Anonymisierungsstatus: unveraendert lokal vor jedem externen Modell-Call
  (siehe Eintrag PRIVACY-BOUNDARY).
- Fallback/Fehlerverhalten: withModelFallback-Semantik unveraendert
  (free_quota stoppt); Recovery erneut menschengesteuert am Punkt.
- Files changed: src/components/CvUpload.tsx, src/components/SearchForm.tsx,
  src/App.tsx, src/App.test.tsx, src/i18n.tsx, docs/AI_AUDITLOG.md
- Tests: 490/490 unit/integration PASS; Browser 26/26 PASS (inkl. neuem
  Quick-Upload Consent+Recovery Test)
- Classification: GREEN
