# JM-MARKETING-01C — SEO Production Release & Search Console Onboarding

**Status:** `PRODUCTION SEO VERIFIED — SEARCH CONSOLE PENDING`
**Datum:** 2026-11-13 (Europe/Berlin)
**Repository:** `maynowak/mays-jobsearch`
**Website:** https://www.mays-job-matcher.app
**Release-Commit:** `b3b8525dc5373d111801ca3af987bdbda9b95827`
**Main-Basis vor Release:** `a0dc1ecddf42f739e9a7211371fabcd6f3557ceb`

Kein Force-Push, keine History-Rewrite, keine Branch-Löschung, keine
RIS-/AWS-/Cognito-/Terraform-Änderung, keine Payment-/Auth-/Consent-Änderung,
keine neuen Secrets, keine Search-Console-Einreichung ohne Zugriff.

---

## 1. Release-Reconciliation

| Prüfung | Ergebnis |
|---|---|
| Feature-Branch | `feature/jm-marketing-01a-seo-foundation` |
| Remote-Feature-HEAD | `b3b8525` |
| `origin/main` vor Release | `a0dc1ec` (unverändert seit 01B) |
| Merge-Base | `a0dc1ec` |
| 01A-/01B-Commits | vollständig vorhanden |
| Diff `origin/main...origin/feature` | ausschließlich SEO-Scope (17 Dateien, +1.521/−14) |
| `git diff --check` | PASS |
| Untracked Fremddateien | 4, unverändert |

`origin/main` hatte sich seit `a0dc1ec` **nicht** verändert. Kein
Reconciliation-STOP.

### Lokaler `main`-Branch

Der lokale `main`-Branch war bereits vor 01A divergiert
(`05a0e3e`, vier lokale Commits, u. a. ein nicht übernommener
RIS-Consent-Gate-Commit). Er wurde nicht als Release-Quelle verwendet.
Zur Erfüllung des Release-Gates wurde der alte Tip ohne Löschung gesichert:

```text
backup/local-main-pre-01c-05a0e3e = 05a0e3e
main = origin/main = b3b8525
```

Kein Branch wurde gelöscht, kein Force-Push ausgeführt.

## 2. Release-Readiness

| Gate | Ergebnis |
|---|---|
| SEO-Preview (01B) | VERIFIED WITH MINOR FINDINGS |
| Deployment-Identität Preview | PASS (`93bdfe7`) |
| Canonical / robots / sitemap / App-Noindex | PASS |
| React-Routing | PASS |
| Security Review | keine Blocker |
| Build | PASS (`tsc -b && vite build`, 1,25 s) |
| Tests (`--maxWorkers=2`) | 1864 PASS / 5 SKIPPED |
| Git-Diff | nur freigegebener SEO-Scope |

Der bekannte Standard-Test-Flake aus 01B
(`ManualSearchProfiles.integration.test.tsx`, 5-s-Timeout unter voller
Parallelität) bleibt dokumentiert. Isoliert und mit `--maxWorkers=2` PASS.

## 3. Controlled Main Merge

Der Merge erfolgte als Fast-Forward vom geprüften Feature-Branch auf
`origin/main`:

```text
git push origin feature/jm-marketing-01a-seo-foundation:main
a0dc1ec..b3b8525  feature/jm-marketing-01a-seo-foundation -> main
```

Nachweis:

```text
origin/main    = b3b8525dc5373d111801ca3af987bdbda9b95827
feature branch = b3b8525dc5373d111801ca3af987bdbda9b95827
local main     = b3b8525dc5373d111801ca3af987bdbda9b95827
```

Kein Merge-Commit, keine fremden Änderungen, kein Force-Push.

## 4. Production Deployment

Der Push auf `main` löste genau ein Production-Deployment aus. Es wurde kein
zusätzliches `vercel --prod` ausgeführt.

| Feld | Wert |
|---|---|
| Deployment-ID | `dpl_DyLwwPbW1zLQT8v4X8vJv5QLzZJx` |
| Deployment-URL | https://mays-job-matcher-p14jr7m9q-maymilly.vercel.app |
| Environment | `production` |
| Status | `READY` |
| Source-Branch | `main` |
| Git-Commit | `b3b8525dc5373d111801ca3af987bdbda9b95827` |
| Build-Dauer | ca. 25,8 s |
| Aliases | `www.mays-job-matcher.app`, `mays-job-matcher.app`, `mays-job-matcher.vercel.app`, `mays-job-matcher-maymilly.vercel.app`, `mays-job-matcher-git-main-maymilly.vercel.app` |
| Footer-Build-Identity | `Version 2.2.0 · production · main · b3b8525` |

Deployment-Commit = Git-Main-HEAD = Footer-Build-SHA. **PASS.**

### Vorheriger Production-Stand (Recovery-Referenz)

| Feld | Wert |
|---|---|
| Deployment-ID | `dpl_C26fHGZUgu36cuzvoTm2xXPGUJFc` |
| URL | https://mays-job-matcher-ewnjq71me-maymilly.vercel.app |
| Commit / Branch | `a0dc1ec` / `main` |
| Footer | `Version 2.2.0 · production · main · a0dc1ec` |

Dieser Stand ist der dokumentierte Wiederherstellungspunkt. Es wurde **kein**
automatischer Rollback durchgeführt.

## 5. Production HTTP SEO Verification

Geprüft gegen `https://www.mays-job-matcher.app` mit vollständigen
GET-Requests, Headern und Browser.

### Landingpage `/`

| Merkmal | Wert |
|---|---|
| HTTP | `200` |
| Content-Type | `text/html; charset=utf-8` |
| `X-Robots-Tag` | **nicht vorhanden** |
| Meta-Robots | `index,follow,max-image-preview:large` |
| `lang` | `de` |
| Title | `KI-gestützte Jobsuche & Job Matching | May's Job Matcher` |
| Description | `Finde passende Stellen mit individuellen Suchprofilen, KI-gestütztem Job Matching und Lebenslaufanalyse. Organisiere deine Jobsuche mit May's Job Matcher.` |
| Canonical | genau 1: `https://www.mays-job-matcher.app/` |
| `og:type` / `og:url` | `website` / `https://www.mays-job-matcher.app/` |
| `og:title` / `og:description` | vollständig |
| `og:image` | `https://www.mays-job-matcher.app/job-matcher-next-step.webp` |
| Twitter | `summary_large_image`, Title/Description/Image vollständig |

**Kritisches Gate erfüllt:** Die öffentliche Startseite ist auf
HTTP-Header- und HTML-Ebene indexierbar.

### Private und technische Routen

Alle folgenden Routen: `200`, `text/html`, `X-Robots-Tag: noindex, nofollow`,
`meta robots = noindex,nofollow`, **kein Canonical**, **keine `og:url`**,
keine privaten Inhalte im initialen HTML:

```text
/search
/cv-builder/workspace
/cv-builder/workspace?handoff=synthetic-test
/landingspage2
/registrieren
/anmelden
/auth/callback
/profil
/email-bestaetigen
/impressum
/datenschutz
/datenschutzprinzipien
/app.html
```

- `/cv-builder/workspace?handoff=synthetic-test` umgeht den Header nicht.
- `/datenschutzprinzipien` wird aus der statischen Seite ausgeliefert und
  trägt `noindex,nofollow` im HTML.
- `/dev/dashboard` liefert `404` mit `X-Robots-Tag: noindex, nofollow`.

### Header-Übersicht

| Route | Status | Content-Type | `X-Robots-Tag` | Canonical |
|---|---|---|---|---|
| `/` | 200 | text/html | – | 1 |
| `/search` | 200 | text/html | `noindex, nofollow` | 0 |
| `/cv-builder/workspace` | 200 | text/html | `noindex, nofollow` | 0 |
| `/cv-builder/workspace?handoff=synthetic-test` | 200 | text/html | `noindex, nofollow` | 0 |
| `/landingspage2` | 200 | text/html | `noindex, nofollow` | 0 |
| `/registrieren` | 200 | text/html | `noindex, nofollow` | 0 |
| `/anmelden` | 200 | text/html | `noindex, nofollow` | 0 |
| `/auth/callback` | 200 | text/html | `noindex, nofollow` | 0 |
| `/profil` | 200 | text/html | `noindex, nofollow` | 0 |
| `/email-bestaetigen` | 200 | text/html | `noindex, nofollow` | 0 |
| `/impressum` | 200 | text/html | `noindex, nofollow` | 0 |
| `/datenschutz` | 200 | text/html | `noindex, nofollow` | 0 |
| `/datenschutzprinzipien` | 200 | text/html | `noindex, nofollow` | 0 |
| `/app.html` | 200 | text/html | `noindex, nofollow` | 0 |
| `/dev/dashboard` | 404 | text/plain | `noindex, nofollow` | – |

### `robots.txt`

```text
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.mays-job-matcher.app/sitemap.xml
```

HTTP 200, `text/plain; charset=utf-8`, keine globale Crawling-Sperre.

### `sitemap.xml`

HTTP 200, `application/xml`, valides XML (`urlset`, korrekter Namespace),
genau eine URL:

```text
https://www.mays-job-matcher.app/
```

Keine Preview-URL, keine Auth-/Profil-/API-/Workspace-Route.

### Redirects

| Prüfung | Ergebnis |
|---|---|
| `http://www.mays-job-matcher.app/` | `308` → HTTPS, final 200, 1 Redirect |
| `http://mays-job-matcher.app/` | 2 Redirects → `https://www.mays-job-matcher.app/`, final 200 |
| `https://mays-job-matcher.app/` | `308` → `https://www.mays-job-matcher.app/`, final 200 |
| Redirect-Loops | keine |
| Doppelte Canonicals | keine |
| Canonical-Domain | konsistent `https://www.mays-job-matcher.app/` |

### `og:image`

HTTP 200, `image/webp`, 114.688 Bytes, ohne Authentifizierung öffentlich
abrufbar. Externe Social-Validatoren wurden nicht ausgeführt; WebP wird von
den großen Plattformen unterstützt, ein JPG/PNG-Derivat bleibt optionales
Hardening.

## 6. Production Browser Smoke

Playwright/Chromium, ohne echte Benutzerkonten oder Bewerbungsdaten.

| Route | Ergebnis | Console-/Page-Errors | Failed Requests |
|---|---|---|---|
| `/` | Landingpage sichtbar | 0 | 0 |
| `/search` | Suchoberfläche sichtbar | 0 | 0 |
| `/registrieren` | Registrierung sichtbar | 0 | 0 |
| `/anmelden` | Login-Ansicht sichtbar | 0 | 0 |
| `/auth/callback` | erwartetes Gastverhalten | 0 | 0 |
| `/profil` | „Du bist nicht angemeldet.“ | 0 | 0 |
| `/impressum` | öffentlich erreichbar | 0 | 0 |
| `/datenschutz` | öffentlich erreichbar | 0 | 0 |
| `/datenschutzprinzipien` | öffentlich erreichbar | 0 | 0 |
| `/cv-builder/workspace` | Workspace-Startseite | 0 | 0 |

Footer-Build-Identity auf allen geprüften App-Seiten:
`Version 2.2.0 · production · main · b3b8525`.

## 7. API- und Regressionsprüfung

| Prüfung | Ergebnis |
|---|---|
| `/api/ris/router` | `307` → `/404` |
| `/api/ris/applications` (ohne Auth) | `401` JSON `unauthenticated`, kein HTML-Fallback |
| `/api/ris/cvs` (ohne Auth) | `401` JSON `unauthenticated`, kein HTML-Fallback |
| Functions / Cron / Redirects | unverändert |
| SPA-Rewrites | unverändert, Ziel `/app.html` |
| Auth-/Consent-/Payment-Logik | nicht verändert |

## 8. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| `npm run build` | PASS (1,25 s) |
| `git diff --check` | PASS |
| `npx vitest run --maxWorkers=2` | 178 Dateien PASS, 3 skipped; 1864 Tests PASS, 5 skipped |
| Standard-`npm test` | 1–2 Timeouts ausschließlich in `ManualSearchProfiles.integration.test.tsx` unter Vollparallelität |
| Isolierter Lauf der betroffenen Datei | 8/8 PASS |

Der 5-s-Timeout-Flake ist vorbestehend und dokumentiert; kein Produkt- oder
SEO-Fehler. Es wurden keine fremden Tests oder Produktlogik geändert.

## 9. Google Search Console

**Status:** `SEARCH CONSOLE OWNERSHIP VERIFICATION PENDING`

| Prüfung | Ergebnis |
|---|---|
| GSC-/Google-API-Credentials | nicht vorhanden (`GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GSC_CREDENTIALS` absent) |
| `gcloud`-Authentifizierung | nicht verfügbar |
| DNS-TXT `google-site-verification` | nicht vorhanden für `mays-job-matcher.app` oder `www` |
| Verifikationsdatei im Repo/`public/` | nicht vorhanden |
| Bestehende Property | ohne Kontozugriff nicht feststellbar |
| Sitemap-Einreichung | **nicht ausgeführt** |
| URL Inspection | **nicht ausgeführt** |
| Indexierung | **nicht behauptet** |

Eigentumsbestätigung und Einreichung erfordern einen manuellen, berechtigten
Google-Kontozugriff. Empfohlener Weg:

1. Domain-Property `mays-job-matcher.app` in der Google Search Console
   anlegen (bevorzugt) oder URL-Prefix `https://www.mays-job-matcher.app/`.
2. Domain-Property per DNS-TXT verifizieren. Nur einen neuen
   `google-site-verification=…`-TXT-Eintrag hinzufügen; bestehende
   SPF-/MX-/DKIM-Einträge nicht verändern.
3. Nach bestätigtem Eigentum
   `https://www.mays-job-matcher.app/sitemap.xml` einreichen.
4. Status getrennt dokumentieren: eingereicht ≠ verarbeitet ≠ URLs entdeckt ≠
   indexiert.
5. URL Inspection für `https://www.mays-job-matcher.app/` erst nach
   bestätigtem Zugriff durchführen.

Es wird ausdrücklich **keine** erfolgreiche Search-Console-Einreichung oder
Google-Indexierung behauptet.

## 10. Findings

| ID | Schwere | Finding | Status |
|---|---|---|---|
| F1 | MINOR | Standard-`npm test`-Flake in `ManualSearchProfiles.integration` unter Vollparallelität | vorbestehend, isoliert/seriell PASS |
| F2 | MINOR | Search-Console-Eigentum und Sitemap-Einreichung benötigen manuellen Google-Zugriff | PENDING |
| F3 | MINOR | `og:image` ist WebP; externe Social-Validatoren nicht ausgeführt | nicht blockierend |
| F4 | MINOR | Rechtsseiten bleiben vorläufig `noindex` | Produktentscheidung offen |
| F5 | INFO | Report-Commit liegt nach dem Release auf dem Feature-Branch; `main` bleibt auf dem deployten Produkt-Commit `b3b8525` | bewusst, kein Docs-only-Prod-Deploy |
| F6 | INFO | Lokaler `main` war divergiert; alter Tip als `backup/local-main-pre-01c-05a0e3e` gesichert | kein Datenverlust |

Keine BLOCKER, keine MAJOR-Findings.

## 11. Release-Endstatus

**B — PRODUCTION SEO VERIFIED — SEARCH CONSOLE PENDING**

- Production-Deployment `dpl_DyLwwPbW1zLQT8v4X8vJv5QLzZJx` ist READY und unter
  `https://www.mays-job-matcher.app` aktiv.
- Deployment-Commit und Build Identity (`b3b8525`) stimmen überein.
- Landingpage ist indexierbar; private Routen sind `noindex, nofollow`;
  robots.txt und Sitemap sind korrekt; Redirects und Routing funktionieren.
- Google Search Console ist mangels Zugriff/Eigentumsbestätigung offen.
- Kein Rollback ausgeführt; Wiederherstellungspunkt dokumentiert.
- Kein zusätzlicher Production-Deploy für Dokumentation.

**Report-HEAD vs. deployter Produkt-Commit:** Dieses Dokument wird auf dem
Feature-Branch committed, damit kein Docs-only-Deployment auf `main`
ausgelöst wird. `main` und Production bleiben auf `b3b8525`; der Report-HEAD
ist ein späterer Docs-Commit und nicht Teil des deployten Artefakts.
