# LIVE PRODUCTION BROWSER E2E — 2026-11-10

**Status:** `LIVE PRODUCTION READ-ONLY PASS`  
**Ziel:** `https://www.mays-job-matcher.app`  
**Production Build:** `Version 2.2.0 · production · main · f0bbf1b`
**Deployment:** `dpl_6T5qztbRD5XMcwcDFUpKVvNcStPP`  
**Ausführung:** manueller Login im sichtbaren Chrome, danach automatisierter read-only Lauf.

## Ergebnis

| Prüfung | Ergebnis |
| --- | --- |
| Angemeldete Dashboard-Ansichten | **PASS** |
| Ansichten | overview, profile, cv, applications, preferences, settings |
| Breiten | 320 / 390 / 430 / 768 / 1024 / 1440 px |
| Checks gesamt | **36** |
| Horizontale Overflows | **0** |
| Schreiboperationen | **keine** |
| RIS-/Cognito-/AWS-Mutation | **keine** |
| Zugangsdaten/Tokens im Report | **keine** |

Die Screenshots und `live-results.json` liegen bewusst außerhalb des
Repositories:

```text
/tmp/opencode/live-production-browser-e2e/2026-11-10T11-06-10-993Z/
```

Grund: Angemeldete Ansichten können Kontodaten enthalten. Es wurden keine
Screenshots mit möglichen Kontodaten committed.

## Deployment-Abgrenzung

Der Branch wurde per Fast-Forward auf `main` `f0bbf1b` gemergt und als
`dpl_6T5qztbRD5XMcwcDFUpKVvNcStPP` nach Production deployt. Der Live-Lauf
bestätigt damit genau den neuen Production-Build. Die zuvor dokumentierten
Vorher-Punkte (stale Suchprofil-Sitzungstexte, große Job-Präferenzen-Badges,
Profilaktionen unter 44 px) sind im neuen Build nicht mehr sichtbar.

Read-only bleibt bewusst read-only: keine Profil-, CV-, Consent- oder
Bewerbungs-Schreiboperation. Für den authentifizierten RIS-Write-/Reload-Test
ist weiterhin ein separater synthetischer Testlauf mit Cleanup erforderlich.

## Durchführung

1. `npm run test:e2e:live-browser -- open`
2. Im sichtbaren Chrome-Fenster manuell mit dem freigegebenen Testkonto anmelden.
3. `npm run test:e2e:live-browser -- run`

Der Lauf ist read-only: Navigation, Rendering, Overflow- und Touch-Prüfung.
Es werden keine Profile, CVs, Bewerbungen oder Consents erstellt, geändert oder
gelöscht.

## Evidence

- Runbook: `docs/reports/LIVE-PRODUCTION-BROWSER-E2E-RUNBOOK.md`
- Harness: `tests/e2e/live-production-browser.mjs`
- Externe Evidenz: `/tmp/opencode/live-production-browser-e2e/2026-11-10T11-06-10-993Z/`
- Keine Kontodaten, Tokens oder Cookies in diesem Report.
