# JM-DIRECT-COVER-LETTER-MAIN-01

**Art:** Final Merge Review / kontrollierte lokale Main-Integration / Regression
**Status:** **INTEGRATED LOCAL MAIN**; **PRODUCTION: BLOCKED**
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `main`
**Finaler lokaler Main-HEAD:** `f36def7`
**Unveränderter Remote-Main-HEAD:** `4364eab`

> Kein Push, kein Deployment, keine RIS-Persistenz, keine AWS-/Cognito-/
> CloudFront-Änderung. Es wurden keine echten Provider-/KI-/Apify-/RIS-Aufrufe
> ausgeführt.

## 1. Git-Baseline und Preflight

| Prüfung | Ergebnis |
|---|---|
| Working Tree vor Merge | clean |
| Worktrees | `Mays-Jobsearch` auf `fix/cover-letter-model-fallback`; `mays-jobsearch-consolidation` auf Feature |
| Lokaler `main` vor Merge | `7a4a64e` |
| Feature-Branch | `feature/jm-direct-cover-letter-01c` |
| Feature-HEAD vor Merge | `f148b3f` |
| Feature-HEAD nach Docs-Whitespace-Cleanup | `f36def7` |
| `origin/feature/...` | `b229bf3` (Phase-D-Commits nicht gepusht) |
| `origin/main` | `4364eab` |
| Merge-Basis | `7a4a64e` |
| Divergenz `main...feature` | 0 behind / 14 ahead vor Cleanup |
| `main` Ancestor | ja |
| Fast-Forward | erfolgreich |

### Abweichung zum gemeldeten Commit-Zähler

Der Feature-Branch enthielt die 14 gemeldeten Phase-A–D-Commits. Beim
fachlichen Diff-Check wurde zusätzlich ein einzelner Docs-Trailing-Whitespace
im Phase-D-Report gefunden. Dieser wurde als separater Dokumentations-Cleanup
`f36def7` committed, bevor der Fast-Forward durchgeführt wurde.

**Integriert:** 15 Commits  
**Davon:** 14 Feature-/QA-Commits + 1 Docs-Whitespace-Cleanup  
Keine Produktfunktion wurde dadurch verändert.

## 2. Merge-Review

Geprüft:

- keine fremden Änderungen im Working Tree,
- keine Änderungen an RIS-/AWS-/Cognito-/CloudFront-/DNS-/Deployment-Dateien,
- nur erwartete Jobsearch-Dateien,
- keine Konflikte,
- `main` ist Ancestor des Feature-Branches,
- `git diff --check main...feature` nach Cleanup PASS.

Die fachliche Prüfung umfasst:

- manuellen Job-Vertrag (`jobOrigin`, optionale URL),
- Formular und Description-Review,
- LetterModal-Handoff,
- Adoption und Versionierung,
- Session-Repository-Erweiterung,
- Refresh/Navigation,
- SourceBadge,
- Tests und E2E-Skripte.

## 3. Lokale Main-Integration

```text
git switch main
git merge --ff-only feature/jm-direct-cover-letter-01c
```

Ergebnis:

- Fast-Forward `7a4a64e..f36def7`
- keine Konflikte
- kein Merge-Commit
- keine History-Rewrites
- Working Tree clean

Finaler lokaler `main`: `f36def7d8895274138607e10936ad033995dd0e8`.

## 4. Funktionale Integritätsprüfung

| Funktion | Ergebnis |
|---|---|
| Neue Bewerbung / manuelles Formular | PASS |
| Vollständige Stellenbeschreibung | PASS |
| Optionale URL / keine Fake-URL | PASS |
| LetterModal / bestehende KI-Pipeline | PASS |
| Authentifizierte Adoption | PASS |
| Gastadoption gesperrt | PASS |
| Erste Anschreibenversion genau einmal | PASS |
| Zweite Version / Historie erweitert | PASS |
| Keine Bewerbungsduplikate | PASS |
| Applications-Refresh ohne Reload | PASS |
| Dokumenten-Navigation richtige Bewerbung | PASS |
| Session-Isolation | PASS |
| Consent unverändert | PASS |
| RIS-Persistenz nicht aktiviert | PASS |

## 5. Regression auf main

### Gesamtsuite

```text
npm test -- --run --maxWorkers=2
```

- **1378 passed**
- **5 skipped**
- **132 Testdateien passed, 3 skipped**

### Build / Syntax

- `npm run build` — PASS
- `node --check api/cover-letter.mjs` — PASS
- `node --check tests/e2e/direct-cover-letter.mjs` — PASS
- `git diff --check` — PASS

### E2E

- Direct-Cover-Letter: 11 Viewports — PASS  
  - Auth: 1440/1024/768/430/390/320
  - Gast: 1024/768/430/390/320
- Applications — PASS
- Cover Letter — PASS
- CV Builder — PASS
- CV PDF — PASS (klassisch/modern/kompakt/mobil/englisch/auth)
- Search Results — PASS
- Mobile Navigation — PASS
- Profile/Storage-Consent — PASS (1440/390, Gast, 1024/768/430/320)

Keine Console-Errors; keine echten Provider-/KI-/AWS-/RIS-/Apify-Aufrufe.

## 6. Offene Findings

Diese Einschränkungen bleiben ausdrücklich bestehen:

1. Exactly-once über mehrere Tabs/Browser/Clients ist mit dem In-Memory-
   Session-Repository nicht garantiert.
2. Manuelle Stellenbeschreibungen bleiben sessionbezogen.
3. Nach Reload kann der Beschreibungskontext fehlen.
4. „Als Entwurf anlegen“ ist noch offen.
5. RIS benötigt später Unterstützung für `jobOrigin: "manual"` und optionale
   `originalUrl`.
6. Keine Live-Provider-Verifikation.
7. Vollständiger Auth-Wechsel mitten in der Adoption wurde nicht als
   Browser-E2E geprüft; Repository-Invalidierung und Session-Epoch sind
   getestet, das Restrisiko bleibt dokumentiert.

## 7. Git-Abschluss

| Prüfung | Ergebnis |
|---|---|
| Finaler lokaler `main` | `f36def7` |
| `origin/main` | `4364eab` (unverändert) |
| Feature-Branch | `f36def7` |
| `origin/feature/...` | `b229bf3` (nicht aktualisiert) |
| Working Tree | clean |
| Push | keiner |
| Deployment | keines |
| Merge-Commit | keiner (Fast-Forward) |

## 8. Abschlussentscheidung

**DIRECT-COVER-LETTER: INTEGRATED.**

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Kein Push, kein Deployment, keine RIS-Persistenz, keine
AWS-/Cognito-/CloudFront-Änderungen, keine weiteren Produktfunktionen.**
