# JM-MANUAL-APPLICATION-DRAFT-MAIN-01

**Art:** Merge-Review / lokale Main-Integration / Regression
**Status:** **INTEGRATED LOCAL MAIN**; **LOCAL MAIN: VERIFIED**; **PRODUCTION: BLOCKED**
**Datum:** 2026-11-04
**Branch:** `main`
**Integrations-/Fix-HEAD:** `a359907`
**Feature-Branch:** `feature/jm-manual-application-draft-01` @ `b4dfdcf`
**`origin/main`:** unverändert `4364eab`

> Kein Push, kein Deployment, keine RIS-/AWS-/Cognito-/CloudFront-Änderung.
> Keine dauerhafte Speicherung, keine neuen Produktfunktionen.

## 1. Git-Baseline und Preflight

| Prüfung | Ergebnis |
|---|---|
| Working Tree vor Merge | clean |
| Worktrees | `Mays-Jobsearch` auf `fix/cover-letter-model-fallback`; `mays-jobsearch-consolidation` auf Feature |
| `main` vor Merge | `99e4105` |
| Feature-Branch | `feature/jm-manual-application-draft-01` |
| Feature-HEAD | `b4dfdcf` |
| `origin/main` | `4364eab` |
| Merge-Basis | `99e4105` |
| Divergenz `main...feature` | 0 behind / 3 ahead |
| `main` Ancestor | ja |
| Fast-Forward | erfolgreich |
| Diff-Check | PASS |

## 2. Lokale Main-Integration

```text
git switch main
git merge --ff-only feature/jm-manual-application-draft-01
```

Ergebnis:

- Fast-Forward `99e4105..b4dfdcf`
- keine Konflikte
- kein Merge-Commit
- keine History-Rewrites
- 3 Feature-Commits integriert

Nach der Integration fiel ein TypeScript-Fehler im neuen Test auf:
`crypto.randomUUID`-Mock war kein gültiger UUID-Typ. Der Test wurde auf eine
gültige UUID umgestellt; der Korrektur-Commit `a359907` liegt auf `main`.
Es wurden keine Produktfunktionen geändert.

## 3. Funktionale Prüfung

| Funktion | Ergebnis |
|---|---|
| Neue Bewerbung / manuelles Formular | PASS |
| „Als Entwurf anlegen“ | PASS |
| Entwurf ohne Anschreiben/Version | PASS |
| Bewerbungsübersicht / Details | PASS |
| Dokumenten-Tab | PASS |
| „Anschreiben erstellen“ | PASS |
| Wiedereinstieg in bestehendes `LetterModal` | PASS |
| Stabile `manual:<id>` | PASS |
| Spätere Adoption | PASS |
| Erste Version genau einmal | PASS |
| Weitere Adoption / Historie | PASS |
| Fehlender Beschreibungskontext | PASS; erneute Eingabe |
| Gastmodus | PASS; keine Entwurfs-/Adoptionsaktion |
| Session-Wechsel | PASS; keine Fremdmutation |

## 4. Regression auf main

### Gesamtsuite

```text
npm test -- --run --maxWorkers=2
```

- **1384 passed**
- **5 skipped**
- **132 Testdateien passed, 3 skipped**

Hinweis: Ein erster vollständiger Lauf zeigte einen einzelnen
Timing-Flake in `ApplicationsSection.test.tsx`
(„asks explicitly before marking a draft as submitted“). Der Test bestand
isoliert und in einem vollständigen zweiten Lauf. Der Flake wird als
bestehende Test-Intermittenz dokumentiert, nicht als Produktfehler.

### Build / Syntax

- `npm run build` — PASS nach `a359907`
- `node --check api/cover-letter.mjs` — PASS
- `node --check tests/e2e/manual-application-draft.mjs` — PASS
- `git diff --check` — PASS

### E2E

- Manual-Application-Draft: 6 Auth-/5 Gast-Viewports — PASS
- Direct-Cover-Letter: 11 Viewports — PASS
- Applications — PASS
- Cover Letter — PASS
- CV Builder — PASS
- CV PDF — PASS
- Search Results — PASS
- Mobile Navigation — PASS
- Profile/Storage Consent — PASS

Keine Console-Errors; keine echten Provider-/KI-/AWS-/RIS-/Apify-Aufrufe.

## 5. Datenschutzgrenzen

Unverändert:

- Entwürfe ausschließlich im Session-Repository.
- Keine dauerhafte Bewerbungsspeicherung.
- Keine `localStorage`-/IndexedDB-Speicherung.
- Keine automatische Gastdatenmigration.
- Keine RIS-Consent-API-Aktivierung.
- Keine Einwilligung durch Entwurfserstellung.
- Keine KI-Anfrage beim Entwurf.
- Keine erfundene Beschreibung nach Reload.

## 6. Offene Findings

1. Session-Daten können bei Reload verloren gehen.
2. Exactly-once über mehrere Tabs/Clients ist nicht garantiert.
3. Kein dauerhafter Wiedereinstieg ohne vorhandenen Stellenkontext.
4. RIS-Unterstützung für manuelle Stellenreferenzen steht noch aus.
5. Keine Live-Provider-/RIS-/AWS-Verifikation.
6. Bekannte intermittierende ApplicationsSection-Testzeitüberschreitung.

## 7. Git-Abschluss

| Prüfung | Ergebnis |
|---|---|
| Integrations-/Fix-HEAD | `a359907` |
| `main` | `a359907` |
| `origin/main` | `4364eab` (unverändert) |
| Feature-Branch | `b4dfdcf` |
| Working Tree | clean |
| Push | keiner |
| Deployment | keines |

## 8. Abschlussentscheidung

**MANUAL APPLICATION DRAFT: INTEGRATED.**

**LOCAL MAIN: VERIFIED.**

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Kein Push, kein Deployment, keine RIS-/AWS-/Cognito-/CloudFront-
Änderungen, keine dauerhafte Speicherung, keine neuen Produktfunktionen.**
