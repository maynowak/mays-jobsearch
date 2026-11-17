# JM-CV-UX-06 — Workspace Navigation & Draft Lifecycle

**Status:** `IMPLEMENTATION COMPLETE — LOCAL/BROWSER VERIFIED — NOT MERGED/DEPLOYED`

- **Branch:** `feature/jm-cv-ux-06-navigation-drafts`
- **Basis:** `origin/main` @ `154c698`
- **Scope:** CV workspace close/return, unsaved-draft decisions, RIS blocker display.
- **Not changed:** `api/**`, RIS, AWS, Terraform, Cognito, consent, ATS/matching, translation pipeline.

## 1. Ausgangsproblem

Der Production-Test zeigte drei getrennte UX-Probleme:

1. Das X im separaten CV-Tab schloss nur die Editoransicht, nicht den Tab.
2. „Zum Hauptfenster zurück“ übertrug Daten, ließ den Tab aber offen.
3. Ein vorhandener ungespeicherter Entwurf blockierte neue Erstellung/Import mit einer Fehlermeldung, ohne eine Entscheidung anzubieten.

## 2. Umsetzung

### Separater Tab: Schließen und Zurückgeben

- `CvBuilderEditor` hat einen optionalen `onRequestClose`-Pfad. Modal und Fullpage behalten ihr bisheriges Verhalten; nur der Workspace nutzt den externen Schließfluss.
- Das X und der Footer-Schließen-Button im Workspace öffnen bei ungespeicherten Änderungen einen expliziten Dialog:
  - **Zum Hauptfenster zurück** (nur mit erreichbarem Hauptfenster)
  - **Verwerfen und schließen**
  - **Weiter bearbeiten**
- Bei direkter Workspace-Nutzung ohne Hauptfenster:
  - **Entwurf in Sitzungsliste übernehmen**
  - **Verwerfen und schließen**
  - **Weiter bearbeiten**
- Nach bestätigter Übernahme wird das Hauptfenster fokussiert und der separate Tab per `window.close()` geschlossen.
- Verweigert der Browser das Schließen, bleibt der Tab mit den bereits übertragenen Daten offen und zeigt eine klare manuelle Anleitung.
- Ist das Hauptfenster nicht erreichbar, werden keine Daten verworfen; die lokale Bearbeitung und Sitzungsspeicherung bleiben möglich.
- Es wurde keine zweite Kommunikationsarchitektur eingeführt; der bestehende `workspaceHandoff`-Vertrag wird unverändert verwendet.
- Screenshot-Modus bleibt unverändert nutzbar; der bestehende 03A-Browserlauf prüft Ein-/Ausstieg und Datenstabilität weiterhin.

### Entwurfsblockade

- Neuer kleiner Dialog `CvBuilderDraftPrompt` mit vier expliziten Entscheidungen:
  - Vorhandenen Entwurf weiter bearbeiten
  - Entwurf in die Sitzungsliste übernehmen
  - Entwurf verwerfen und neu beginnen
  - Abbrechen
- Der App-Import-/Erstellungsweg zeigt keine Sackgassen-Fehlermeldung mehr, sondern diese Auswahl.
- Der direkte Workspace prüft denselben Zustand vor „Leeren Lebenslauf erstellen“ und „PDF importieren“.
- Verwerfen erfolgt ausschließlich nach ausdrücklicher Bestätigung. Es werden keine Entwürfe automatisch gelöscht, keine Sitzungsprofile überschrieben und keine dauerhafte Structured-CV-Speicherung eingeführt.

### RIS-Speicherbutton

- Das deaktivierte „PDF dauerhaft speichern“ bleibt unverändert und umgeht keine Consent-/Auth-Gates.
- Sperrgründe werden jetzt als Liste angezeigt, wenn mehrere gleichzeitig gelten:
  - Feldvalidierung
  - Anmeldung / CV-Speicherfreigabe / Speicherstatus
  - leerer Lebenslauf
- Keine Änderung an RIS- oder Backend-APIs.

## 3. Geänderte Dateien

- `src/App.tsx`
- `src/components/CvBuilderEditor.tsx`
- `src/components/CvBuilderWorkspacePage.tsx`
- `src/components/CvBuilderDraftPrompt.tsx` (neu)
- `src/i18n.tsx` (DE/EN UI-Texte)
- `src/styles.css`
- `src/App.test.tsx`
- `src/components/CvBuilderWorkspacePage.test.tsx`
- `tests/e2e/cv-builder-ux-06-navigation-drafts.mjs` (neu)
- `tests/e2e/cv-builder-full-page-workspace-03a.mjs` (nur veraltete UI-Labels aktualisiert)
- `package.json` (E2E-Skript)
- `docs/AI_AUDITLOG.md`
- `docs/reports/JM-CV-UX-06-REPORT.md`
- `docs/reports/assets/JM-CV-UX-06/`

## 4. Verifikation

### Fokussiert

- `CvBuilderWorkspacePage.test.tsx`: **7/7 PASS**
  - X bei ungespeicherten Änderungen
  - Abbrechen ohne Datenverlust
  - bewusstes Verwerfen
  - Übernahme in Sitzungsliste
  - gleichzeitige Validierungs- und Login-Sperre
  - bestehende Identitäts-/RIS-Gates
- Neue App-Dialogtests: **2/2 PASS**
  - Auswahl bei vorhandenem Entwurf
  - Abbrechen, Verwerfen, Übernehmen in die Sitzungsliste

### Vollsuite / Build

- `npx vitest run --maxWorkers=2`: **1934 PASS / 11 skipped**, 180 Testdateien bestanden, 4 skipped, 0 FAIL.
- `npm run build`: **PASS** (`tsc -b && vite build`, 1,30 s).
- `git diff --check`: **PASS**.

### Browser-E2E

Neuer Lauf `npm run test:e2e:cv-builder-ux-06`:

- **PASS**
- Zwei echte Tabs / `window.opener`-Handoff.
- X ohne Änderungen schließt den Tab.
- X mit Änderungen fragt nach; „Weiter bearbeiten“ erhält Daten.
- „Zum Hauptfenster zurück“ überträgt, fokussiert das Hauptfenster und schließt den Tab.
- Blockiertes `window.close()` zeigt die manuelle Anleitung; Daten sind bereits übertragen.
- Geschlossenes Hauptfenster: lokale Daten bleiben erhalten; Sitzungsspeicherung ist explizit wählbar.
- Direkter Workspace: Abbrechen erhält Daten; Verwerfen schließt den Editor bewusst.
- 0 Page-/Console-Errors.

Bestehender Regressionstest `npm run test:e2e:cv-builder-full-page-workspace-03a`: **PASS** (Handoff, Screenshot-Modus, Return, Konflikt, direkte Route, Popup-Blocker, geschlossene Quelle).

Evidence:

- `docs/reports/assets/JM-CV-UX-06/close-blocked.png`
- `docs/reports/assets/JM-CV-UX-06/direct-workspace-closed.png`

## 5. AI-/Privacy-/Data-Flow-Bewertung

- Keine neuen externen Datenflüsse, keine neuen Speicherorte, keine neuen Berechtigungen.
- Der Tab-Rückgabeweg nutzt ausschließlich den bestehenden same-origin-Handoff.
- Der neue Dialog trifft nur lokale UI-Entscheidungen; er löscht nichts automatisch.
- Kein RIS-/AWS-/Cognito-/Consent-Zugriff, keine Credentials, keine Serverless-Änderung.

## 6. Grenzen

- Der authentifizierte CV-Editor-Modalpfad wurde nicht separat live geprüft; er ist von den Änderungen nur über den optionalen `onRequestClose`-Prop berührt und bleibt im Modal ohne diesen Prop unverändert.
- RIS-/S3-Live-Speicherung wurde nicht ausgeführt; der Speicherbutton und die Consent-Gates wurden nicht verändert.
- Kein Main-Merge, kein Production-Deployment, keine Branch-Löschung.
