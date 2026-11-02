# JM-COVER-LETTER-MODEL-FALLBACK-01

**Art:** Anschreiben-Generierung / Modell-Fallback / Provider-Routing
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Live-Provider-Test, kein Deployment
**Datum:** 2026-11-02
**Branch:** `fix/cover-letter-model-fallback`
**Baseline:** `origin/main` @ `e1f0347`
**Grenzen:** Keine echten KI-/Apify-/Provider-Aufrufe, keine Env-/Secret-Änderung, kein Deployment.

## 1. Befund

Beobachtung aus der Produktion:

- Die ersten `/api/cover-letter`-Versuche lieferten HTTP 502.
- Ein späterer Versuch (zweiter oder dritter) lieferte HTTP 200 mit einem gültigen
  `letter`-Body.
- Dieser erfolgreiche Body wurde nicht als Ergebnis verwendet; es wurde ein
  weiteres Modell befragt.

Die Analyse trennt zwei Ebenen:

1. **Server-Provider-Router:** Ein modellbezogener Fehler
   (`model_unavailable`/`bad_ai_response`) wurde bisher nicht als
   Provider-Wechselgrund behandelt. Der Router wechselte nur bei
   Quota-/Limit-Fehlern zum nächsten Provider. Ein vorhandener zweiter
   Free-Provider mit nutzbarem Ergebnis wurde dadurch nicht verwendet.
2. **Client-Fallback:** `withModelFallback` verarbeitet einen erfolgreichen
   zweiten oder dritten Versuch bereits korrekt und beendet die Kette sofort.
   Dies wurde mit einem echten Fallback-Integrationstest abgesichert.

## 2. Änderung

### Server

`api/_lib/providers/errors.mjs`

- Neue typisierte Prüfung `isRetryableModelError` für:
  - `model_unavailable`
  - `bad_ai_response`
- Client-/Konfigurationsfehler und Quota-/Limit-Fehler bleiben unverändert.

`api/_lib/providers/index.mjs`

- `chat()` erhält den optionalen Schalter `fallbackOnModelError`.
- Standard bleibt `false`; Matching/Profile/ATS-Verhalten wird nicht verändert.
- Bei `fallbackOnModelError: true` wird ein modellbezogener Fehler als
  wiederholbar behandelt und der nächste aktivierte Provider mit einem
  kompatiblen Modell versucht.
- Das erste erfolgreiche Provider-Ergebnis wird sofort zurückgegeben.

`api/cover-letter.mjs`

- Übergibt `fallbackOnModelError: true` an `chat()`.
- Ein 502/leeres Modellergebnis eines Providers verwirft damit kein Ergebnis
  eines anderen konfigurierten Free-Providers mehr.

### Client / Regression

`src/components/LetterModal.fallback.test.tsx` (neu)

- Testet die tatsächliche UI-Kette mit dem echten `withModelFallback`.
- Erster Versuch 502, zweiter Versuch 200 → das Anschreiben wird angezeigt;
  es wird **kein** dritter Versuch gestartet.
- Zusätzlicher CV-Modus-Test: erster/zweiter Versuch 502, dritter Versuch 200
  → das Anschreiben wird angezeigt.

`tests/api/providers.test.mjs`

- Test für den neuen Provider-Fallback bei `fallbackOnModelError: true`.
- Der bestehende Test für das Standardverhalten ohne Provider-Wechsel bleibt
  erhalten.

`tests/api/cover-letter.test.mjs`

- Prüft, dass `/api/cover-letter` den Schalter aktiviert.

## 3. Verifikation

| Prüfung | Ergebnis |
|---|---|
| Gezielte Tests (Provider + Cover-Letter-API + LetterModal-Fallback) | **33 passed** |
| Gesamtsuite | **1176 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| E2E Cover Letter Desktop 1440 | PASS |
| E2E Cover Letter Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Live-Provider-Aufruf | **nicht ausgeführt** |

Die E2E-Tests verwenden lokale Mocks. Es wurden keine echten OpenRouter-,
EdenAI-, Apify- oder anderen externen Aufrufe ausgelöst.

## 4. Statusabgrenzung

**IMPLEMENTED**

- Provider-Fallback für modellbezogene Cover-Letter-Fehler
- Client-Fallback-Regression für erfolgreichen zweiten/dritten Versuch
- CV-Modus-Regression

**VERIFIED**

- Gezielte Tests, Gesamtsuite, TypeScript, Build, `git diff --check`
- Desktop-/Mobil-E2E mit lokalen Mocks

**OPEN**

- Produktive Live-Verifikation nach Deployment
- Bestätigung, ob der beobachtete 200-Body nach dem Fix bereits im ersten
  `/api/cover-letter`-Request entsteht
- Weitere Provider-/Modell-Kombinationen und Quota-Zustände

**BLOCKED**

- Keine belastbare Live-Diagnose der konkreten Produktions-Providerlogs ohne
  Deployment und ohne freigegebenen Live-Provider-Test.

**NOT DEPLOYED**

- Kein Deployment; die Produktionsdomain bleibt unverändert.

## 5. Grenzen

- Keine Änderung an Matching-, Profil- oder ATS-Fallback-Semantik.
- Keine Änderung an Modellkatalogen, Free-Model-Filtern, Timeouts oder Quotas.
- Keine neuen Abhängigkeiten.
- Keine Speicherung von Prompt-, CV- oder Anschreiben-Inhalten.
