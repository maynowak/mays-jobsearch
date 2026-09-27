# CV-UPLOAD-UX-01 — EXECUTION LOG

## Current status
FINALIZED (CV-UPLOAD-UX-01) + FOLLOW-UPS CV-UPLOAD-UX-02 (committet
06e1ace), CV-UPLOAD-UX-03 (committet 3c6d468), CV-UPLOAD-UX-04 (committet
271e10d) und CV-UPLOAD-UX-05 (Schritt-Labels DE/EN) — alle Validierungen
gruen. Offen (uncommitted): UX-05 + docs/AI_TEAM.md (Team-Eintrag Kimi K3);
Commit erfolgt auf Nutzerfreigabe.

## Audit date/time
- Start: 2026-09-26 12:34 CEST
- Final: 2026-09-26 13:25 CEST
- Follow-up CV-UPLOAD-UX-02: 2026-09-26 (Mobile-Overlay), Commit 06e1ace, gepusht
- Follow-up CV-UPLOAD-UX-03: 2026-09-26 (Schritt-Reihenfolge), Commit 3c6d468, gepusht
- Follow-up CV-UPLOAD-UX-04: 2026-09-26 (Skills vor ATS), Commit 271e10d, gepusht
- Follow-up CV-UPLOAD-UX-05: 2026-09-26 (Schritt-Labels DE/EN)

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

## Follow-up CV-UPLOAD-UX-05 (Schritt-Labels DE/EN)
- User-Befund: Schritt-Anzeige verwirrend (u. a. doppeltes "Abgeschlossen").
- Befund: DE-Labels um einen Schritt verschoben (step6 "Zielrolle"/"Goal",
  step7 falsch "Verarbeitung", step8 falsch "Abgeschlossen" statt
  "Verarbeitung"); cv.processingStep10 ungenutzt; Mapping schickte
  improvement/reanalysis/match-impact pauschal auf "target".
- Fix: Labels entzerrt (DE: Ziel / Analyse / Verarbeitung / Abgeschlossen;
  EN step7 "Analysis"), toten Key entfernt, Mapping auf dedizierte Steps
  (improvement/reanalysis/match-impact).
- Files: src/i18n.tsx, src/App.tsx, docs/AI_AUDITLOG.md (UX-05-Eintrag).
- Checks: 490/490 Tests PASS, TSC PASS, Build PASS, diff --check CLEAN.

## Follow-up CV-UPLOAD-UX-04 (Skills vor ATS-Analyse)
- User-Befund: ATS-Analyse direkt nach dem Upload ohne erkennbare Basis;
  faktisch pruefte sie den CV gegen ein synthetisches Job-Objekt aus den
  eigenen CV-Skills.
- Fix: Zielwahl -> Skills-Bestaetigung -> Ausfuehrung (fuer BEIDE Ziele);
  ATS nutzt cvState.selectedSkills als Anforderungsbasis; zielabhaengige
  Beschriftung der Skills-Auswahl (Neue Keys cv.skillSelectTitleAts /
  cv.skillSelectDescriptionAts). Kein API-/Consent-Unterschied.
- Files: src/App.tsx, src/i18n.tsx, src/App.test.tsx, docs/AI_AUDITLOG.md.
- Checks: 490/490 Tests PASS, TSC PASS, Build PASS, diff --check CLEAN.

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

---

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

### CV-UPLOAD-UX-01 — UPLOAD STARTET PFAD B IM OVERLAY (CONSENT-OVERLAP-FIX)
- Date: 2026-09-26
- Task: CV-UPLOAD-UX-01 (User-Befund + UX-Umstellung nach Verbindungsabbruch)
- User-Befund: Die Dateinamen-Anzeige des Quick-Uploads (Pfad A, inline in
  der Suchmaske) ueberlappte den Rahmen des Consent-Menues
  "CV-Verarbeitung erlauben". Gewuenscht: Prozess B nach dem Upload im
  Overlay zeigen; nach dem Schliessen liegt das Menue unter der Suchmaske.
- Umsetzung (Pfad-Vereinheitlichung):
  - CvUpload ist jetzt reiner Upload-Einstieg: lokale Validierung
    (PDF-Typ, max. 10 MB) + Drag&Drop/Tastatur, danach Uebergabe der Datei
    an den CV-Workflow. Kein Inline-Consent, keine Inline-Profil-Vorschau,
    kein eigener Modell-Recovery und kein lokaler Profil-Cache mehr
    in CvUpload (Overlap-Ursache entfernt).
  - App: neuer Handler handleCvUploadStart(file) — legt das Dokument an
    (ausgewaehlt, max. 10) und oeffnet das Workflow-Overlay direkt:
    consent-required (kein Consent in Sitzung) bzw. creating-profile
    (Consent bereits erteilt). Pfad B uebernimmt Einwilligung, Modellwahl,
    lokale Anonymisierung (anonymizing) und Profil-Erstellung einheitlich.
  - Overlay-Close-Pfade landen auf document-selected bzw. consentDismissed;
    die CV-Dokumentliste rendert dann inline UNTER der Suchmaske
    (cvProcessingUI in .search-sidebar, bestehende Struktur).
  - Pfad-B-Recovery erweitert: model_not_free/model_invalid (nicht
    transient, von withModelFallback nicht intern weitergereicht) fuehren
    jetzt ebenfalls zur Modellauswahl-Recovery (errorBackStep
    "model-selection" + model.unavailable-Hinweis; konsistent zu 573266d).
  - "Mit ausgewaehlten suchen" nutzt als Basis jetzt cvState.cvProfile
    (bestaetigtes Workflow-Profil) vor Legacy cvState.profile — Uploads ohne
    Inline-Profil liefern ihre Skills ueber den Workflow.
  - Beibehalten aus der abgebrochenen Vorarbeit: runCvSearch akzeptiert
    submittedOverride (Stale-Closure-Fix), baseProfile-Fallback
    cvProfile ?? profile in der Skill-Bestaetigung.
- Consent-Bezug: Es gibt nur noch EINEN Consent (Pfad B), der vor dem ersten
  externen Modell-Call liegt. Die 813f0bb dokumentierte Trennung
  (lokaler Upload-Consent vs. Workflow-Consent) entfaellt — historischer
  Eintrag bleibt unveraendert.
- Anonymization status: unveraendert erzwungen — Pfad B anonymisiert lokal
  (createProfileFromPdf, Step anonymizing) vor jedem externen Modell-Call.
- Files changed: src/components/CvUpload.tsx, src/App.tsx,
  src/components/SearchForm.tsx, src/App.test.tsx,
  src/components/SearchForm.test.tsx, src/i18n.tsx (5 ungenutzte Keys
  entfernt: cv.reading, cv.creating, cv.noAiConfigured,
  cv.consentPurposeProfile, cv.retryWithModel), docs/AI_AUDITLOG.md
- Tests: 490/490 PASS (15 Upload-/Workflow-Tests auf den Overlay-Fluss
  umgestellt; Consent-Pflicht, Recovery ohne Neustart, Privacy Boundary,
  Search-Clearing und Overlay-Kontext weiter abgedeckt)
- TypeScript: PASS; Build: PASS; git diff --check: CLEAN
- Execution log: docs/reports/CV-UPLOAD-UX-01-EXECUTION_LOG.md
- Classification: GREEN — Overlap-Ursache beseitigt, Upload startet Pfad B
  im Overlay, Menue nach dem Schliessen inline unter der Suchmaske.
