# BROWSER-BUG-22 — ATS MODEL SELECTION + MODEL-UNAVAILABLE RECOVERY

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-25
- Task: BROWSER-BUG-22
- Purpose: ATS-Analyse des CV-Workflows unterstuetzt jetzt eine optionale
  Modellauswahl und eine ATS-spezifische Recovery bei Modell-
  Verfuegbarkeitsfehlern (kein Ruecksprung zum CV-Anfang mehr).
- AI component / endpoint affected:
  - api/ats-analysis.mjs (POST /api/ats-analysis)
  - api/_lib/ats.mjs formulateCVText (Aufrufpfad zu providers chat({ model }))
  - src/components/AtsOverlay.tsx (bestehende Modell-Radio-Auswahl, bisher
    inert, jetzt an analyzeATS angeschlossen)
  - src/App.tsx runAtsProcessing (sendet effectiveModel mit; Recovery-Step)
- Model selection mechanism:
  - Neues OPTIONALES Feld `ai.model` im Request von /api/ats-analysis.
  - Wenn gesetzt: wird bis chat({ model }) durchgereicht (providers/index.mjs).
  - Wenn nicht gesetzt: unveraendertes Server-Default (getModelInfo(provider)).
  - Frontend-Quelle: bestehender ModelSelector/useAvailableModels/effectiveModel
    im CV-Workflow; im AtsOverlay die vorhandene Radio-Auswahl (selectedModel).
- Purpose of AI processing: ATS-Anforderungsanalyse + sichere KI-
  Umformulierungsvorschlaege (safety-validated formulations), unveraendert.
- Input/Output data flow:
  - Input: job (title/tags/slug), profile.skills (bereits anonymisierter CV-Text
    aus dem CV-Workflow), ai { enabled, consent, model? }.
  - Output (unveraendert): analysis, recommendations, ai { provider, model,
    consentGiven, privacyStatus, dataCategories, formulations, ... }.
- Consent: unveraendert — KI-Formulierung laeuft nur bei ai.enabled &&
  ai.consent; ConsentGate/PrivacyNotice bleiben bestehen.
- Anonymization: unveraendert — anonymisierter Text kommt weiterhin aus
  createProfileFromPdf (cvState.anonymizationMode), keine neuen PII-Fluesse.
- Fallback / error behavior:
  - Neuer ATS-spezifischer Recovery-State cvState.step === "ats-model-recovery"
    bei isModelUnavailable-Fehlern waehrend ATS: Benutzer waehlt anderes
    verfuegbares Modell im Overlay und startet NUR die ATS-Analyse erneut
    (Dokumente, Consent, cvProfile, suggestedProfile, selectedSkills bleiben
    erhalten). Andere Fehler behalten das bisherige Recovery
    (errorBackStep/-Handling aus BROWSER-BUG-21). Keine Aenderung an
    withModelFallback ausserhalb des ATS-Pfades.
- AI contract change: optionales Feld `ai.model` in POST /api/ats-analysis
  (rueckwaertskompatibel; Default-Verhalten ohne Feld unveraendert).
- Files changed: api/ats-analysis.mjs, src/App.tsx, src/api.ts,
  src/components/AtsOverlay.tsx, src/types.ts, src/i18n.tsx,
  src/App.test.tsx, tests/api/ats-model-selection.test.mjs (neu),
  docs/AI_AUDITLOG.md
- Tests: Backend-Vertragstests A–E (ohne model unveraendert / mit model in
  Antwort / model erreicht formulateCVText -> chat({model}) / ohne model
  Server-Default), Frontend-Recovery-Test (error -> ats-model-recovery ->
  Modellwechsel -> nur ATS erneut)
- Browser verification: Desktop 1280 / Tablet 834 / Mobile 390 — Recovery-Flow
  verifiziert; Netzwerk-Assertion bestaetigt ai.model=model-y beim Retry
- Classification: GREEN — Implementierung abgeschlossen, Validierung bestanden
