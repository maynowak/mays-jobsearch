# LIVE PRODUCTION BROWSER E2E — 2026-11-10

**Status:** `LIVE PRODUCTION READ-ONLY PASS / BRANCH NOT DEPLOYED`  
**Ziel:** `https://www.mays-job-matcher.app`  
**Production Build:** `Version 2.2.0 · production · main · 3bfe391`  
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
/tmp/opencode/live-production-browser-e2e/2026-11-10T10-52-33-021Z/
```

Grund: Angemeldete Ansichten können Kontodaten enthalten. Es wurden keine
Screenshots mit möglichen Kontodaten committed.

## Wichtige Abgrenzung

Production läuft weiterhin auf `3bfe391` (Stand vor dem Mobile-Polish-Branch).
Der Live-Lauf bestätigt daher **die aktuelle Production-App**, nicht die neuen
Mobile-Änderungen. Auf der Live-Seite sind die bereits dokumentierten
Vorher-Punkte noch sichtbar, u. a.:

- „Suchprofile bleiben vorerst sitzungsbezogen“ trotz aktiver Freigabe
- große Job-Präferenzen-Badges
- Profilaktionen unter 44 px

Der Branch `feature/profile-ux-consolidation-01-mobile-polish` wurde nicht
gemergt oder deployt. Für die Verifikation der neuen Mobile-Änderungen ist ein
separater Merge-/Deployment-Freigabeschritt und anschließend ein erneuter
Live-Lauf erforderlich.

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
- Externe Evidenz: `/tmp/opencode/live-production-browser-e2e/2026-11-10T10-52-33-021Z/`
- Keine Kontodaten, Tokens oder Cookies in diesem Report.
