# CV-UPLOAD-UX-03 — SCHRITT-REIHENFOLGE: ANONYMISIERUNG VOR MODELLWAHL

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-UPLOAD-UX-03 (Follow-up-Befund zu CV-UPLOAD-UX-01/02)
- User-Befund: Die Schritt-Anzeige zeigte "Dokument → Einwilligung → Modell →
  Anonymisierung → Profil …". Die Anonymisierung muss aber vor dem ersten
  Modell-Call liegen (Privacy Boundary) — die Anzeige erweckte den
  gegenteiligen Eindruck.
- Befund zur Ist-Verarbeitung: Die ANONYMISIERUNG selbst lief bereits immer
  lokal vor dem ersten Modell-Call (createProfileFromPdf, Step anonymizing).
  ABER: (a) die Anzeigereihenfolge stellte "Modell" vor "Anonymisierung";
  (b) der Optionen-Step (creating-profile, enthaelt die Anonymisierungs-
  Auswahl) mappte faelschlich auf "Profil"; (c) profile-ready fiel ohne
  Mapping auf den Default "document" zurueck.
- Umsetzung (Ablauf + Anzeige synchronisiert, Reihenfolge wahrheitsgemaess):
  - Neuer Ablauf nach Einwilligung: Optionen inkl. ANONYMISIERUNGS-Modus
    (creating-profile) -> Modellwahl (model-selection) -> Ausfuehrung
    (anonymizing: lokale Anonymisierung + erster Modell-Call) ->
    Profil-Vorschau (profile-ready). Konsistent fuer beide Eintraege
    (Consent-Accept und "Ausgewählten CV verarbeiten" landen jetzt beide
    auf creating-profile).
  - Anzeige (CvProcessingSteps): Dokument → Einwilligung → ANONYMISIERUNG →
    MODELL → Profil → Zielrolle → Skills → Verarbeitung → Abgeschlossen …
    Mapping: creating-profile→anonymization, model-selection→model,
    anonymizing/profile-ready→profile (profile-ready-Fallback behoben).
  - Navigation: model-selection "Weiter" startet jetzt direkt die
    Verarbeitung; neuer Zurueck-Weg model-selection → creating-profile
    ("Zurück zu den Optionen", neuer i18n-Key cv.backToOptions de/en);
    creating-profile zurueck → Dokumentliste. Modell-Recovery
    (errorBackStep "model-selection") unveraendert.
- Consent-/Privacy-/Contract-Bezug: Consent weiterhin vor jedem externen
  Modell-Call; Anonymisierung lokal vor jedem Call; kein API-/Vertrags-
  Unterschied. Historische Eintraege unveraendert.
- Files changed: src/App.tsx, src/components/CvProcessingSteps.tsx,
  src/i18n.tsx (1 neuer Key), src/App.test.tsx, docs/AI_AUDITLOG.md,
  docs/reports/CV-UPLOAD-UX-01-EXECUTION_LOG.md (aktualisiert)
- Tests: 490/490 PASS; TypeScript PASS; Build PASS; git diff --check CLEAN
- Classification: GREEN — Anzeige und Ablauf zeigen die Anonymisierung jetzt
  nachweislich vor dem ersten Modell-Call.
