# PRIVACY-BOUNDARY — ANONYMISIERUNG VOR JEDEM EXTERNEN MODELL-CALL

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: Privacy-Boundary Korrektur (ATS/CV-Workflow) + Step-Reihenfolge
- Purpose: Keine externe AI-/Modell-Invokation darf erfolgen, bevor
  personenbezogene Daten lokal anonymisiert wurden. Die Privacy-Grenze muss
  VOR dem Modell-Call liegen.
- Findings (historisch dokumentiert, jetzt behoben):
  1. Quick-Upload-Pfad (CvUpload, 'Lebenslauf hochladen'-Tab) rief
     createProfile mit dem ROHEN, nicht-anonymisierten CV-Text auf.
  2. Die visuelle Schrittanzeige (CvProcessingSteps) zeigte 'Profil' vor
     'Anonymisierung' — entgegen der tatsaechlichen Verarbeitungsreihenfolge
     (anonymizing laeuft vor dem Modell-Aufruf).
- AI component / data flow:
  - createProfile(normalizedText) erhaelt jetzt im Quick-Pfad denselben
    anonymisierten + normalisierten Text wie im CV-Workflow-Pfad
    (createProfileFromPdf), der dies bereits korrekt tat.
  - Anonymisierung via src/lib/anonymize.ts (anonymizeText) ist lokal im
    Browser und keine AI-Operation (unveraendert zu API_CONTRACT.md §13).
  - ATS/Cover-Letter/Match-Pfade verarbeiten nur bestehende Profildaten;
    kein Roh-CV-Fluss zu externen Modellen.
- Consent-Bezug: unveraendert (CvConsentGate bleibt); im Quick-Pfad ohne
  Modusauswahl gilt privacy-by-default = anonymisiert.
- Anonymization status: vor jedem externen Modell-Call erzwungen.
- Files changed: src/components/CvUpload.tsx,
  src/components/CvProcessingSteps.tsx, src/i18n.tsx, src/App.test.tsx,
  docs/AI_AUDITLOG.md
- Tests: +1 Privacy-Boundary-Test (PII nicht im an die AI gesendeten Text;
  [E-MAIL]/[NAME]-Platzhalter nachgewiesen)
- Classification: GREEN — Privacy Boundary durchgesetzt, visuelle
  Schrittanzeige mit tatsaechlicher Reihenfolge synchronisiert.
