# JM-CV-MODEL-UNAVAILABLE-DIAGNOSIS-01

**Art:** CV-Processing / Model-Fehlerdiagnose / Recovery-UX
**Status:** DIAGNOSE ABGESCHLOSSEN — UI-Korrektur implementiert, Providerproblem OPEN
**Datum:** 2026-11-01

## 1. Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `722e9fb` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |

## 2. Befund: Modellfehler nach CV-Anonymisierung

### Produktions-Logs (read-only, Vercel)

Im Production-Deployment wurden für `/api/profile` wiederholt folgende
Provider-Antworten protokolliert:

```text
[ai] provider=openrouter model=nvidia/nemotron-3.5-super-vl:free stage=empty-content status=200
[ai] provider=openrouter model=dots-studio/dots-3-note-preview:free stage=empty-content attempt=2 status=200
[ai] provider=openrouter model=cohere/north-mini-code:free stage=empty-content attempt=3 status=200
[ai] provider=openrouter model=openrouter/free stage=empty-content attempt=3 status=200
```

**Wichtig:** Das sind HTTP-200-Antworten mit leerem Modellinhalt. Die Provider
mappen `empty-content` auf `model_unavailable`; dadurch sieht die UI
„Modell nicht verfügbar“.

### Einordnung

- Die Anonymisierung selbst ist **nicht** die Ursache. Der Provider erhält
  einen gültigen Request, antwortet aber ohne Inhalt.
- Seit Entfernung des CV-Profil-Caches wird bei jeder CV-Verarbeitung erneut
  ein Modell aufgerufen. Vorher konnte ein Cache-Hit den Providerpfad
  überspringen; der Providerfehler fiel dadurch seltener auf.
- Die Client-Fallback-Kette versucht bis zu drei Modelle. In den Logs
  scheiterten mehrere Free-Modelle hintereinander mit `empty-content`.
- Aktuell von `/api/models` empfohlen: `dots-studio/dots-3-note-preview:free`.
  Auch dieses Modell erscheint in den Fehler-Logs.
- Es gibt keinen Nachweis eines App-/Anonymisierungsfehlers; die konkrete
  Modellverfügbarkeit ist ein Provider-/Free-Modell-Problem.

**LIVE PROVIDER TEST: NOT EXECUTED** — es wurden keine neuen echten
Provideraufrufe durchgeführt.

## 3. UI-Problem: Sprung an den Anfang

### Vorher

Bei einem Modellfehler setzte `createProfileFromPdf`:

```text
step = "error"
```

Die UI zeigte den Fehler am Kartenende, der Process-Stepper fiel auf
„Dokument“ zurück, und der Nutzer musste über „Zurück zur Modellauswahl“
zurücknavigieren.

### Nachher

- Modellfehler bleiben im Schritt `model-selection`.
- Der Step bleibt sichtbar; der Fehler erscheint direkt über dem ModelSelector.
- Kein Rücksprung auf „Dokument“.
- Ein Modellwechsel löscht den alten Fehler und erlaubt einen erneuten
  expliziten Versuch.
- `CvProcessingSteps` mappt alte `error`-Zustände mit
  `errorBackStep === "model-selection"` ebenfalls auf `model`.

## 4. Button-Beschriftung

Der Button im Modellschritt heißt jetzt:

- DE: **„Verarbeiten“**
- EN: **„Process“**

Nicht mehr „Weiter“. Der Optionen-Schritt davor behält „Weiter“.

## 5. Tests / Regression

| Prüfung | Ergebnis |
|---|---|
| App-Tests | PASS — 96 Tests |
| ManualSearchProfiles AuthRace | PASS |
| Gesamtsuite | **1097 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Guest-CV-E2E | PASS |
| Cover-Letter-E2E Desktop/Mobil | PASS |
| Neue echte Provideraufrufe | keine |

Die Tests bestätigen:

- Modellfehler bleibt im Modellschritt.
- Kein `.cv-error-state`-Sprung bei Modellfehlern.
- Fehlermeldung ist am ModelSelector sichtbar.
- Modellwechsel + erneutes „Verarbeiten“ funktioniert.
- Der Step-Button heißt „Verarbeiten“.
- Gast-CV-Workflow und Cover-Letter-Workflow bleiben intakt.

## 6. Offene Punkte

1. **Provider-/Free-Modell-Verfügbarkeit:** Die Logs zeigen leere
   Providerantworten über mehrere Modelle. Das ist kein durch diese Änderung
   behebbarer App-Fehler.
2. **Modellkatalog:** `/api/models` listet aktuelle Free-Modelle; die
   Eignung einzelner Modelle für JSON-CV-Profile ist nicht garantiert.
3. **Nächster Schritt:** Ein anderes Modell im Selector wählen und erneut
   „Verarbeiten“. Falls alle Free-Modelle `empty-content` liefern, ist das ein
   Provider-/Katalogproblem (OPEN), kein Anonymisierungsfehler.
4. **Optional:** Modell-Health/`empty_response` später getrennt behandeln;
   keine Änderung in diesem Diagnose-Task.

## 7. Git

- UI-Korrektur: `626739b`
- Dokumentations-Commit: `3338121`
- Kein Deployment, keine AWS-/RIS-/Cognito-Änderung.

## 8. Empfehlung

Die UI-Korrektur ist umgesetzt und getestet. Das Modellproblem bleibt als
**OPEN** dokumentiert: Es ist ein Provider-/Free-Modell-Zustand, nicht die
Anonymisierung. Für einen belastbaren Nachweis wäre ein autorisierter
synthetischer Live-Test mit einem konkreten, funktionierenden Modell nötig;
dieser wurde nicht durchgeführt.
