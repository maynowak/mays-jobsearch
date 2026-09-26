# CV-UPLOAD-UX-01 — EXECUTION LOG

## Current status
FINALIZED (CV-UPLOAD-UX-01) + FOLLOW-UPS CV-UPLOAD-UX-02 (Overlay auf allen
Viewports; committet in 06e1ace + gepusht) und CV-UPLOAD-UX-03
(Schritt-Reihenfolge) abgeschlossen — alle Validierungen gruen.
Commit von UX-03 steht aus (erfolgt auf Nutzerfreigabe).

## Audit date/time
- Start: 2026-09-26 12:34 CEST
- Final: 2026-09-26 13:25 CEST
- Follow-up CV-UPLOAD-UX-02: 2026-09-26 (nach User-Befund Mobile-Inline),
  committet als 06e1ace und gepusht
- Follow-up CV-UPLOAD-UX-03: 2026-09-26 (Schritt-Reihenfolge)

## Git state
- Start: Branch main, HEAD 813f0bb (CV-UPLOAD PFAD A), 4 uncommittete
  Dateien (abgebrochene Vorarbeit: Auto-Uebergang am profile-ready).
- Final: HEAD 813f0bb + uncommittete Aenderungen der UX-Umstellung
  (ersetzen die Vorarbeit; siehe Dateiliste unten). Kein Commit erfolgt.

## Task / Purpose
User-Befund: Dateinamen-Anzeige des Quick-Uploads ueberlappte den Rahmen
des Consent-Menues "CV-Verarbeitung erlauben" (Inline-Darstellung im
cv-panel der Suchmaske). Gewuenscht und umgesetzt:
1. Nach dem Upload startet Prozess B (CV-Workflow) im OVERLAY —
   inkl. Einwilligung, Modellwahl, Anonymisierung, Profil-Erstellung.
2. Nach dem Schliessen des Overlays liegt das Menue (CV-Dokumentliste)
   inline unter der Suchmaske.

## Completed sections
- [x] Rekonstruktion nach Verbindungsabbruch (letzter geloggter Task
      813f0bb abgeschlossen; Vorarbeit-Tauglichkeit verifiziert)
- [x] Ist-Analyse: Overlap-Ursache = Inline-Consent des Quick-Uploads in der
      Suchmaske; Pfad B besitzt denselben Consent bereits im Overlay
- [x] CvUpload vereinfacht: nur Validierung + Uebergabe an Pfad B
- [x] handleCvUploadStart in App: Dokument anlegen (ausgewaehlt, max 10) +
      Overlay oeffnen (consent-required | creating-profile)
- [x] Pfad-B-Recovery um model_not_free/model_invalid erweitert
      (errorBackStep "model-selection")
- [x] "Mit ausgewaehlten suchen": Basis cvState.cvProfile (Workflow-Profil)
- [x] 15 Tests auf den Overlay-Fluss umgestellt (inkl. Auto-Auswahl des
      Upload-Dokuments, wegfallender Doppel-Consent)
- [x] 5 ungenutzte i18n-Keys entfernt (beide locales)
- [x] Validierung + Audit-Eintrag

## Findings (verifiziert)
1. Overlap-Ursache: CvConsentGate renderte bei phase==="consent" INLINE im
   .cv-panel der Search-Card; Dateiname kollidierte mit dem Gate-Rahmen.
   -> Behoben durch Umzug der gesamten Verarbeitung ins Pfad-B-Overlay.
2. Pfad B war bereits vollstaendig (consent-required -> model-selection ->
   creating-profile -> anonymizing -> profile-ready -> goal-selection ...);
   Pfad A duplizierte Consent/Profil/Recovery — jetzt vereinheitlicht.
3. Privacy Boundary gewahrt: Consent VOR erstem AI-Call; Anonymisierung
   lokal vor jedem externen Modell-Call (unveraendert, Pfad B).
4. Consent-Trennung (lokal vs. Workflow) aus 813f0bb entfaellt — genau EIN
   Consent (Pfad B). Historischer Eintrag nicht veraendert.
5. withModelFallback reicht model_not_free/model_invalid nicht intern weiter
   (nicht transient) -> explizite Modellauswahl-Recovery in Pfad B ergaenzt.
6. Lokaler Profil-Cache (localStorage mj-cv-profile:*) der Quick-Upload-
   Strecke entfaellt; Server-Cache via Text-Hash bleibt im createProfile-
   Pfad bestehen.

## Follow-up CV-UPLOAD-UX-03 (Schritt-Reihenfolge)
- User-Befund: Anzeige "Modell vor Anonymisierung" widersprach der Privacy
  Boundary (Anonymisierung vor dem ersten Modell-Call).
- Befund: Verarbeitung war bereits korrekt (anonymizing vor createProfile);
  Anzeige/Mapping falsch (creating-profile→profile, profile-ready→document-
  Fallback, Listenreihenfolge Modell vor Anonymisierung).
- Fix: Ablauf getauscht — Optionen inkl. Anonymisierungs-Modus
  (creating-profile) VOR Modellwahl; erste Ausfuehrung mit Modell-Call
  erst im anonymizing-Step. Anzeige: Dokument → Einwilligung →
  Anonymisierung → Modell → Profil → …; neuer Zurueck-Weg
  model-selection→creating-profile (neuer Key cv.backToOptions).
- Files: src/App.tsx, src/components/CvProcessingSteps.tsx, src/i18n.tsx,
  src/App.test.tsx, docs/AI_AUDITLOG.md (UX-03-Eintrag).
- Checks: 490/490 Tests PASS, TSC PASS, Build PASS, diff --check CLEAN.

## Follow-up CV-UPLOAD-UX-02 (nachtraeglich, gleicher Branch-Stand)
- User-Befund: Nach der Einwilligung erschien die Inline-Maske
  "Verarbeitungsstatus" statt des Overlays.
- Root Cause: .cv-workflow-overlay nur ab 768px gestylt (BUG-14..19
  Mobile-Inline-Entscheidung); kein Logikfehler im Overlay-State.
- Fix: Overlay auf allen Viewports (Mobile = Vollbild-Sheet, Desktop =
  zentrierter Dialog); Step-Fokus-Effekt vereinfacht (Fokus statt Mobile-
  scrollIntoView). Inline bleiben: document-selected, consent-dismissed,
  ats-complete.
- Files: src/styles.css, src/App.tsx, docs/AI_AUDITLOG.md (UX-02-Eintrag).
- Checks: 490/490 Tests PASS, TSC PASS, Build PASS, diff --check CLEAN.

## Files changed
- src/components/CvUpload.tsx (auf reinen Upload-Einstieg vereinfacht)
- src/App.tsx (handleCvUploadStart, Modell-Recovery-Erweiterung,
  cvProfile-Basis in handleSearchWithSelectedCvs, Schlankheits-Imports)
- src/components/SearchForm.tsx (Props verschlankt: keine
  Modell-/CV-Listen-Props mehr; onWorkflowStart(file))
- src/App.test.tsx (15 Tests auf Overlay-Fluss umgestellt)
- src/components/SearchForm.test.tsx (Prop-Shape angepasst)
- src/i18n.tsx (5 ungenutzte Keys entfernt)
- docs/AI_AUDITLOG.md (Eintrag CV-UPLOAD-UX-01)
- docs/reports/CV-UPLOAD-UX-01-EXECUTION_LOG.md (diese Datei)

## Checks executed (final)
- npx vitest run: 42 Files / 490 Tests — PASS
- npx tsc -b — PASS
- npm run build — PASS (nur bekannte Chunk-Size-Hinweise)
- git diff --check — CLEAN

## Classification
GREEN — User-Befund behoben, Pfad vereinheitlicht, alle Validierungen
bestanden; kein Commit ohne Nutzerfreigabe.

## Open questions / Risks
- Browser-/E2E-Suite existiert nicht im Repo (nur vitest) — visuelle
  Verifikation des Overlays ggf. manuell/nach Deploy.
- Verhaltensdelta: Quick-Upload erstellt kein Sofort-Profil mehr; Profil
  entsteht erst im Overlay-Workflow (gewollt).

## Recommended next actions
1. Commit nach Nutzerfreigabe (z. B. "fix: CV-Upload UX - Workflow-Overlay
   direkt nach Upload statt Inline-Consent").
2. Optionale visuelle Verifikation im Browser (Upload -> Overlay ->
   Abbrechen -> Menue unter Suchmaske).

## Resume point
Abgeschlossen; Resume nicht noetig. Bei Fortsetzung: git status zeigt den
validierten, uncommitteten Endstand.
