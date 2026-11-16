# JM-TRANSLATION-MODEL-SELECTION-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL — NO MAIN MERGE / NO PRODUCTION DEPLOY`

**Date:** 2026-11-16
**Baseline:** `origin/main` `154c698333682afd0b68454666738abc9713f194`
**Branch:** `feature/jm-translation-model-selection-01`

## 1. Bestehender Modell-Router

- `/api/models` liefert die freien, vom bestehenden OpenRouter-/EdenAI-Router
  unterstützten Modelle.
- `api/_lib/providers/index.mjs` `chat()` validiert ein übergebenes Modell
  über `assertFreeModel()` und nutzt den bestehenden Provider.
- `/api/job-details?action=translate` verwendete bisher **kein Modell** und
  damit den Router-Default.

## 2. Änderung

### API

`api/job-details.mjs` akzeptiert im Übersetzungsrequest optional:

```json
{ "model": "vendor/model:free" }
```

Das Modell wird nur als String mit maximal 200 Zeichen übernommen und an
`chat({ model })` übergeben. Die bestehende serverseitige Prüfung
`assertFreeModel()` bleibt die Freigabegrenze; keine neuen Provider, Keys oder
Modelllisten.

### Client

`translateJobDescription()` überträgt das ausgewählte Modell optional.

`RemainingCard`:

- hält das ausgewählte Modell im lokalen Anzeigezustand,
- bindet den Übersetzungs-Cache an Modell + Job,
- zeigt bei Fehlern eine verständliche Meldung,
- bietet bei `model_unavailable`, `model_not_free` oder `model_invalid` den
  vorhandenen `ModelSelector` über `TranslationModelPicker` an,
- startet die Übersetzung erst nach erneutem Klick mit dem ausgewählten
  Modell,
- behält den Originaltext bei jedem Fehler sichtbar.

`TranslationModelPicker` verwendet `useAvailableModels()` und den bestehenden
`ModelSelector`; es wird erst im Fehlerfall gemountet. Dadurch entstehen keine
Modell-Requests für normale Karten.

## 3. Cache / Original / ATS

- Der Übersetzungszustand enthält das verwendete Modell.
- Ein Ready-Cache wird nur verwendet, wenn das aktuelle Modell übereinstimmt.
- Ein Modellwechsel invalidiert den bisherigen Übersetzungstext.
- Originaltext bleibt separat; `job.description`/`descriptionPlain` werden
  nicht verändert.
- ATS-Verhalten, ATS-Dateien und Scoring bleiben unverändert.
- Keine CV-/Bewerbungsdaten im Request; nur der öffentliche Anzeigentext.

## 4. Tests

```text
npx vitest run tests/api/job-translation.test.js \
  src/components/RemainingCard.test.tsx
# 30 PASS

npm run build
# PASS

npx vitest run --no-file-parallelism
# 1930 PASS / 11 skipped
```

Abgedeckt:

- ausgewähltes Modell wird an den Provider weitergegeben
- Modellfehler zeigt Modellauswahl
- Wechsel zu einem anderen Modell
- erneuter Übersetzungsversuch
- Cache bindet an das Modell
- Original bleibt sichtbar
- keine zusätzlichen CV-/Bewerbungsdaten
- ATS-Verhalten unverändert

## 5. Einschränkungen

- Der Provider kann weiterhin temporär `model_unavailable` liefern; dann bleibt
  der Originaltext sichtbar und die Auswahl wird angeboten.
- Es werden nur Modelle angeboten, die `/api/models` als freie, kompatible
  Modelle liefert; die endgültige Freigabe prüft `chat()` serverseitig.
- Kein Main-Merge, kein Production-Deployment.
