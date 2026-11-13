# JM-MARKETING-01B — SEO Preview & Google Discoverability Verification

**Status:** `PREVIEW VERIFIED WITH FINDINGS — READY FOR PRODUCTION REVIEW`
**Datum:** 2026-11-13 (Europe/Berlin)
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-marketing-01a-seo-foundation`
**Getesteter Produkt-Commit:** `93bdfe7824aad36df8388e393afc88796bd0e682` (`93bdfe7`)
**Main-Basis:** `a0dc1ecddf42f739e9a7211371fabcd6f3557ceb` (`a0dc1ec`)

Kein Merge nach `main`, kein Production-Deployment, keine Branch-Löschung,
keine RIS-/AWS-/Cognito-/Terraform-Änderung, keine Produktionsdaten, keine
Secrets.

---

## 1. Git-Reconciliation

| Prüfung | Ergebnis |
|---|---|
| Aktiver Branch | `feature/jm-marketing-01a-seo-foundation` |
| Lokaler HEAD | `93bdfe7` |
| `origin/main` | `a0dc1ec` |
| 01A-Commits vorhanden | `afb5bf1`, `0a99b1f`, `1822674`, `b93c8c2`, `93bdfe7` |
| Working Tree | nur die vier bereits vorher vorhandenen untracked Fremddateien unter `docs/` |
| Fremddateien verändert | nein |
| Abstand zu `origin/main` | 5 voraus, 0 dahinter |

Die vier untracked Fremddateien wurden nicht gelesen, verändert oder committed.

## 2. Controlled Push

```text
git push -u origin feature/jm-marketing-01a-seo-foundation
```

- Kein Force-Push.
- Remote-Branch neu angelegt.
- Lokaler HEAD = Remote-HEAD = `93bdfe7824aad36df8388e393afc88796bd0e682`.
- `git ls-remote --heads` bestätigt denselben SHA.

## 3. Preview-Deployment

| Feld | Wert |
|---|---|
| Deployment-ID | `dpl_FRzzqvtQsq79pqKxdQvCoyGMzHBH` |
| URL | https://mays-job-matcher-4vbbu98uc-maymilly.vercel.app |
| Git-Alias | https://mays-job-matcher-git-feature-jm-marketing-01a-s-669c4d-maymilly.vercel.app |
| Environment | `preview` |
| Status | `READY` |
| Build-Dauer | 32 s |
| Git-Commit | `93bdfe7824aad36df8388e393afc88796bd0e682` |
| Git-Branch | `feature/jm-marketing-01a-seo-foundation` |
| Git-Repo | `mays-jobsearch` |
| Git-Message | `docs(seo): add JM-MARKETING-01A execution report and audit entry` |

Der Deployment-Commit stimmt mit dem getesteten Branch-HEAD überein.

### Build Identity im Artefakt

Footer der Preview (Browser):

```text
Version 2.2.0 · preview · feature/jm-marketing-01a-seo-foundation · 93bdfe7
```

Zusätzlich im ausgelieferten JS-Bundle:

```text
version: 2.2.0, env: preview, commitSha: 93bdfe7,
branch: feature/jm-marketing-01a-seo-foundation
```

Deployment-Commit = Build Identity = getesteter Git-HEAD. **PASS.**

## 4. HTTP-SEO-Verifikation

Alle Prüfungen gegen die Preview-URL, vollständige GET-Requests plus Header.

### Landingpage `/`

| Merkmal | Wert |
|---|---|
| HTTP | `200` |
| Content-Type | `text/html; charset=utf-8` |
| Title | `KI-gestützte Jobsuche & Job Matching | May's Job Matcher` |
| Description | `Finde passende Stellen mit individuellen Suchprofilen, KI-gestütztem Job Matching und Lebenslaufanalyse. Organisiere deine Jobsuche mit May's Job Matcher.` |
| `lang` | `de` |
| Canonical | `https://www.mays-job-matcher.app/` (genau 1) |
| Meta-Robots | `index,follow,max-image-preview:large` |
| `og:type` | `website` |
| `og:title` | wie Title |
| `og:description` | wie Description |
| `og:url` | `https://www.mays-job-matcher.app/` |
| `og:image` | `https://www.mays-job-matcher.app/job-matcher-next-step.webp` |
| `twitter:card` | `summary_large_image` |
| `twitter:title` / `twitter:description` / `twitter:image` | vorhanden |
| `X-Robots-Tag` | `noindex` — **Vercel-Preview-Schutz, nicht aus unserer Config** |

**Wichtige Unterscheidung:** Die Preview-Plattform setzt automatisch
`X-Robots-Tag: noindex` auf jede Preview-Antwort. Das ist der gewünschte
Schutz davor, dass eine Preview als öffentliche Website indexiert wird. Die
Landing-Metadaten im HTML bleiben `index,follow`. Die deployte
`vercel.json` enthält **keine** Header-Regel für `/` (siehe Abschnitt 8).
Die aktuelle Production-Antwort (alter Build) hat keinen `X-Robots-Tag`.
Ein Production-Nachweis für den neuen Build ist erst nach 01C möglich.

### Anwendungsrouten

Alle folgenden Routen lieferten `200`, `text/html`, **kein Canonical**, keine
`og:url`, `X-Robots-Tag: noindex, nofollow` und `meta robots =
noindex,nofollow`:

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

Ergänzend:

- `/cv-builder/workspace?handoff=synthetic-test` liefert dieselbe
  `app.html`-Shell; die Query umgeht den `X-Robots-Tag` nicht.
- `/datenschutzprinzipien` wird wegen Dateisystem-Priorität aus der
  statischen Seite `public/datenschutzprinzipien/index.html` ausgeliefert
  (5.341 Bytes), nicht aus `app.html`. Sie trägt `noindex,nofollow` im HTML
  und den `X-Robots-Tag`-Header.
- `/dev/dashboard` liefert `404` (kein Dev-Route-Rewrite in Production) und
  trägt dennoch den konfigurierten `X-Robots-Tag: noindex, nofollow`.
- `/index.html` liefert die Landing-Shell mit Canonical und
  `index,follow`; Preview-Header bleibt `noindex` (Plattform).

**Keine privaten Inhalte im initialen HTML:** Die App-Routen liefern nur die
statische Shell (628 Bytes). Keine Benutzerkennung, kein Profil, keine
Bewerbungsdaten, keine Tokens.

### Header-Zusammenfassung

| Route | Status | Content-Type | `X-Robots-Tag` | Canonical |
|---|---|---|---|---|
| `/` | 200 | text/html | `noindex` (Plattform) | 1 |
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
| `/robots.txt` | 200 | text/plain | `noindex` (Plattform) | – |
| `/sitemap.xml` | 200 | application/xml | `noindex` (Plattform) | – |

## 5. robots.txt und Sitemap

### `/robots.txt`

```text
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.mays-job-matcher.app/sitemap.xml
```

- HTTP 200, `text/plain; charset=utf-8`.
- `/api/` ausgeschlossen.
- Sitemap-Referenz auf die Produktionsdomain.

### `/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.mays-job-matcher.app/</loc>
  </url>
</urlset>
```

- HTTP 200, `application/xml`, gültig geparst (kein `parsererror`,
  Namespace `http://www.sitemaps.org/schemas/sitemap/0.9`).
- Genau eine URL: die Produktions-Landingpage.
- Keine Preview-URL, keine Auth-, Profil-, API- oder Workspace-Route.

### Preview- vs. Production-Indexierung

- **Preview:** Vercel setzt `X-Robots-Tag: noindex` auf alle Antworten.
  Zusätzlich sind die App-Routen per Config `noindex, nofollow`. Eine
  Indexierung der Preview ist damit nicht zu erwarten.
- **Production (aktueller alter Build, read-only):** kein `X-Robots-Tag`
  auf `/`; `/robots.txt` und `/sitemap.xml` liefern noch `404`.
- **Production (neuer Build):** Die deployte `vercel.json` enthält keine
  `/`-Header-Regel. Der Production-Header kann erst nach dem 01C-Deployment
  direkt verifiziert werden.

## 6. Redirects und Canonical

| Prüfung | Ergebnis |
|---|---|
| `http://www.mays-job-matcher.app/` | `308` → `https://www.mays-job-matcher.app/`, final 200, 1 Redirect |
| `http://mays-job-matcher.app/` | 2 Redirects → `https://www.mays-job-matcher.app/`, final 200 |
| `https://mays-job-matcher.app/` | `308` → `https://www.mays-job-matcher.app/`, final 200 |
| Preview `http://` → `https://` | `308`, final 200 |
| Redirect-Loops | keine (max. 2 Hops) |
| Doppelte Canonicals | keine (Landing genau 1, App-Routen 0) |
| Canonical-Domain | konsistent `https://www.mays-job-matcher.app/` in HTML, OG und Sitemap |
| Preview-URL in Sitemap | nein |

## 7. Social Sharing

Alle Tags sind auf der Preview-Landingpage vorhanden. Das referenzierte Bild
liegt auf der Produktionsdomain und wurde separat geprüft:

| Prüfung | Ergebnis |
|---|---|
| `og:title` | vorhanden, identisch mit Title |
| `og:description` | vorhanden, identisch mit Description |
| `og:type` | `website` |
| `og:url` | `https://www.mays-job-matcher.app/` |
| `og:image` | `https://www.mays-job-matcher.app/job-matcher-next-step.webp` |
| `twitter:card` | `summary_large_image` |
| `twitter:title` / `description` / `image` | vorhanden |
| Bild-HTTP | `200`, `image/webp` |
| Bildformat | WebP, 1536 × 1024, 114.688 Bytes |
| Authentifizierung | nicht erforderlich, öffentlich abrufbar |

**WebP-Bewertung:** WebP wird von Google, X/Twitter und Facebook unterstützt.
Eine externe Validierung über die jeweiligen Social-Validatoren wurde nicht
durchgeführt und wird daher nicht behauptet. Für LinkedIn/ältere Crawler ist
ein JPG/PNG-Derivat optionales Hardening; kein Blocker.

## 8. Vercel-Konfiguration

Die deployte Konfiguration wurde aus den Deployment-Metadaten gelesen und mit
dem Repository-Stand verglichen:

| Bereich | Unverändert / korrekt |
|---|---|
| `functions` (`api/**/*.mjs`, maxDuration 60) | ja |
| `crons` (`/api/cron/digest`, `0 7 * * *`) | ja |
| `redirects` (`/api/ris/router` → `/404`) | ja |
| alle 7 `/api/ris/*`-Rewrites | ja, byte-identisch |
| SPA-Rewrites | ja, Ziel jetzt `/app.html` |
| `headers` | ja, wie im Repository |
| `git.deploymentEnabled.main` | ja |

API-Stichproben auf der Preview:

- `/api/ris/router` → `307` nach `/404`.
- `/api/ris/applications` → `503` JSON (`ris_disabled`), also korrekt an den
  BFF geroutet, kein HTML-Fallback.
- `/api/ris/cvs` → `503` JSON (`cv_storage_disabled`), ebenfalls BFF.

## 9. Routing- und Funktionsregression

Browser-Prüfung mit Playwright (Chromium, headless), keine echten Konten,
synthetische E-Mail `synthetic@example.invalid`:

| Route | Ergebnis | Console-/Page-Errors |
|---|---|---|
| `/` | Landingpage rendert (`Dein nächster Karriereschritt mit KI`) | 0 |
| `/search` | Suchformular rendert | 0 |
| `/registrieren` | Registrierungsformular rendert | 0 |
| `/anmelden` | Login-Ansicht rendert (Hosted-UI-Button, kein lokales Input) | 0 |
| `/auth/callback` | „Anmeldung läuft…“ (Gast, kein Code) | 0 |
| `/profil` | „Du bist nicht angemeldet.“ | 0 |
| `/impressum` | Impressum rendert | 0 |
| `/datenschutz` | Datenschutzerklärung rendert | 0 |
| `/datenschutzprinzipien` | statische Prinzipien-Seite rendert | 0 |
| `/cv-builder/workspace` | Workspace-Startseite rendert | 0 |
| `/email-bestaetigen?email=synthetic%40example.invalid` | Bestätigungsformular rendert | 0 |

Zwei erste Selektor-Timeouts (`.landing-hero`, `input` auf `/anmelden`) waren
falsche Testselektoren, keine App-Fehler: Die Landingpage rendert über `h1`,
`/anmelden` verwendet die Hosted-UI und kein lokales Eingabefeld. Mit
korrigierten Selektoren: 0 Console-/Page-Errors.

Footer-Build-Identity in der gerenderten Preview bestätigt `93bdfe7`.

## 10. Tests und Build

Getesteter Stand: `93bdfe7` (Produkt-Commit, deployed).

```text
npm run build
tsc -b && vite build
✓ built in 1.01s

git diff --check
# keine Ausgabe, Exit 0
```

### `npm test` — Standardlauf (Parallelität)

| Lauf | Ergebnis |
|---|---|
| 1 | 1 Datei / **2 Tests failed**; 1862 passed, 5 skipped (1869) |
| 2 | 1 Datei / **1 Test failed**; 1863 passed, 5 skipped (1869) |
| 3 | 1 Datei / **1 Test failed**; 1863 passed, 5 skipped (1869) |

Alle Fehlschläge: `src/ManualSearchProfiles.integration.test.tsx`
(`Test timed out in 5000ms`) unter voller Parallelität. Dieselbe Datei wurde
bereits in `JM-MARKETING-01A` als Laufzeit-Flake dokumentiert.

### Isolierter und serieller Nachlauf

```text
npx vitest run src/ManualSearchProfiles.integration.test.tsx
Test Files 1 passed (1)
     Tests 8 passed (8)

npx vitest run --maxWorkers=2
Test Files 178 passed | 3 skipped (181)
     Tests 1864 passed | 5 skipped (1869)
Duration 152.25s
```

**Bewertung:** Kein Produkt- oder SEO-Fehler nachweisbar; die betroffenen
Tests laufen isoliert und mit reduzierter Parallelität vollständig durch. Die
5-Sekunden-Grenze ist unter Vollast zu knapp. Es wurde **keine** Änderung an
Produktlogik oder fremden Tests vorgenommen. Der Standardlauf wird nicht als
PASS behauptet.

## 11. Security und Datenschutz

- Keine privaten Daten im initialen HTML der App-Routen.
- `noindex` wird ausdrücklich nicht als Zugriffskontrolle verwendet;
  Authentifizierung/Autorisierung bleiben unverändert.
- Keine Secrets, Tokens oder echten Bewerberdaten in Requests, Tests oder
  Reports. Die E-Mail-Bestätigungsroute wurde nur mit einer synthetischen
  Adresse geprüft.
- Keine RIS-/AWS-/Cognito-/Terraform-Änderung.
- HSTS ist auf der Preview aktiv (`strict-transport-security`).
- Weitere Security-Header (CSP, `X-Content-Type-Options`, `Referrer-Policy`)
  sind nicht Teil dieses Auftrags und wurden nicht verändert.

## 12. Findings

| ID | Schwere | Finding | Auswirkung |
|---|---|---|---|
| F1 | MINOR | `ManualSearchProfiles.integration`-Timeouts unter Standard-Parallelität | Kein SEO-/Preview-Blocker; isoliert und mit `--maxWorkers=2` PASS; vorbestehender Flake |
| F2 | MINOR | Preview setzt plattformseitig `X-Robots-Tag: noindex` auf `/` | Gewollter Preview-Schutz; Production-Header erst nach 01C direkt prüfbar |
| F3 | MINOR | `og:image` ist WebP; externe Social-Validatoren nicht ausgeführt | WebP breit unterstützt; JPG/PNG-Derivat optional |
| F4 | MINOR | Rechtsseiten sind vorläufig `noindex` | Produktentscheidung für Indexierung offen; kein Blocker |
| F5 | NIT | `/datenschutz` zeigt Version 1.2 (Stand 8. November 2026) | Bestehender Inhalt aus `origin/main`, nicht Teil dieser Änderung |

Keine BLOCKER, keine MAJOR-Findings.

## 13. Release-Empfehlung

**B. PREVIEW VERIFIED WITH FINDINGS — READY FOR PRODUCTION REVIEW**

- SEO-Metadaten, Canonical-Verhalten, Indexierungsschutz, robots.txt,
  Sitemap, Redirects, Social-Metadaten, Build Identity und SPA-Routing sind
  auf der Preview verifiziert.
- Die offenen Punkte sind nicht blockierend und dokumentiert.
- Kein Merge, kein Production-Deployment, keine Branch-Löschung.
- Nächster Schritt nach gesonderter Freigabe:
  `JM-MARKETING-01C — SEO PRODUCTION RELEASE & SEARCH CONSOLE ONBOARDING`.

**Hinweis zur Report-Commit-Identität:** Der getestete Preview-Build verwendet
`93bdfe7`. Der Report-/Audit-Commit ist ein reiner Docs-Commit danach; er ist
nicht Teil des getesteten Preview-Artefakts. Eine durch den Docs-Push
ausgelöste neue Preview würde eine andere Build Identity tragen, ohne die
Produktänderung zu verändern.
