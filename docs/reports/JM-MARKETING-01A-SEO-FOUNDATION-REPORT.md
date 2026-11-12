# JM-MARKETING-01A — SEO Foundation — Ausführungsbericht

**Status:** `IMPLEMENTED — TESTED (LOKAL) — READY FOR PREVIEW REVIEW`
**Datum:** 2026-11-12 (Europe/Berlin)
**Branch:** `feature/jm-marketing-01a-seo-foundation`
**Basis:** `origin/main` @ `a0dc1ec` (`fix(vercel): rewrite cv builder workspace route`)
**Ziel-URL:** https://www.mays-job-matcher.app

Kein Push, kein Merge nach `main`, kein Preview-/Production-Deployment, keine
Branch-Löschung, keine RIS-/AWS-/Cognito-/Terraform-Änderung, keine Secrets.

---

## 1. Baseline

| Prüfung | Ergebnis |
|---|---|
| Repository | lokaler Checkout von `maynowak/mays-jobsearch` |
| Ausgangsbranch | `feature/jm-ris-vercel-test-env-05-integration` (5 Commits vor `origin/main`, unverändert gelassen) |
| Unversionierte Fremddateien | 4 Dokumente unter `docs/` (unverändert, nicht committed) |
| `git fetch origin main` | `origin/main` = `a0dc1ec` |
| Neuer Branch | `feature/jm-marketing-01a-seo-foundation` direkt von `origin/main` |
| `merge-base` | `a0dc1ec` (Branch enthält keine fremden Commits) |

**Live-Baseline (read-only, vor der Änderung):**

- `/` lieferte `<title>May's Job Matcher</title>` ohne Description, Canonical,
  Open Graph oder Twitter-Card.
- `/profil` und `/search` lieferten byte-identisch dieselbe generische
  `index.html` (identischer ETag) — keine routenspezifischen Metadaten.
- `/robots.txt` und `/sitemap.xml` lieferten HTTP 404.
- `https://mays-job-matcher.app/` → HTTP 308 auf `https://www.mays-job-matcher.app/`.

**Bereitgestelltes Paket:** `JM-MARKETING-01A-SEO-FOUNDATION(1).zip` wurde
gelesen und gegen den aktuellen Stand geprüft. Übernommen wurden die
Grundidee, `robots.txt`, `sitemap.xml` und das Header-Fragment. Nicht
unverändert übernommen wurden:

- die abweichende Meta-Description (Auftragstext hat Vorrang),
- die fehlende `og:image` (vorhandenes, lizenziertes WebP-Asset genutzt),
- der Ansatz, die Landing-Metadaten in derselben `index.html` zu lassen
  (private Routen hätten weiterhin das Landing-Canonical geerbt),
- die unvollständige Routenliste (u. a. `/search`, `/registrieren`,
  `/cv-builder/workspace`, `/landingspage2`, Rechtsseiten).

---

## 2. Designentscheidung: zwei HTML-Shells

Vite liefert mehrere Routen über HTML-Einstiegspunkte aus. Eine einzelne
`index.html` mit Landing-Canonical hätte auch `/profil`, `/anmelden` usw. mit
`<link rel="canonical" href="https://www.mays-job-matcher.app/">` ausgeliefert.
`X-Robots-Tag: noindex` allein verhindert zwar die Indexierung, lässt aber ein
falsches Canonical in der HTTP-Antwort stehen.

Deshalb:

- **`index.html`** — öffentliche Landingpage mit vollständigen SEO-Metadaten,
  `index,follow`, Canonical `/`.
- **`app.html`** — identische App-Shell ohne Canonical, ohne OG-URL, mit
  `<meta name="robots" content="noindex,nofollow">`.
- Alle Nicht-Startseiten-Rewrites in `vercel.json` zeigen auf `/app.html`.
  API-Rewrites, Cron, Redirects und Functions bleiben unverändert.
- Zusätzlich entfernt `src/lib/seoHead.ts` bei clientseitigen Übergängen und im
  Vite-Dev-Fallback (der für alle Pfade `index.html` liefert) das Canonical und
  setzt `noindex`. Das ist Defense-in-Depth, nicht der Hauptnachweis.

**Sonderfall `/datenschutzprinzipien`:** Dort existiert eine statische Seite
unter `public/datenschutzprinzipien/index.html`. Vercel gibt dem Dateisystem
Vorrang vor Rewrites; die Route wird daher weiterhin statisch ausgeliefert.
Die Seite trägt jetzt ebenfalls `noindex,nofollow` und erhält zusätzlich den
`X-Robots-Tag`-Header. Ein Test modelliert diese Dateisystem-Priorität
ausdrücklich.

Damit ist die Startseite die einzige Route mit Landing-Canonical — sowohl im
ausgelieferten HTML als auch nach clientseitiger Navigation.

---

## 3. Implementierte SEO-Funktionen

### Landingpage (`index.html`)

- `lang="de"`
- Title: `KI-gestützte Jobsuche & Job Matching | May's Job Matcher`
- Description: `Finde passende Stellen mit individuellen Suchprofilen, KI-gestütztem Job Matching und Lebenslaufanalyse. Organisiere deine Jobsuche mit May's Job Matcher.`
- `robots`: `index,follow,max-image-preview:large`
- Canonical: `https://www.mays-job-matcher.app/`
- Open Graph: `og:type`, `og:locale=de_DE`, `og:site_name`, `og:title`,
  `og:description`, `og:url`, `og:image` (`/job-matcher-next-step.webp`,
  1536×1024, bestehendes eigenes Asset), `og:image:alt`
- Twitter: `summary_large_image`, `twitter:title`, `twitter:description`,
  `twitter:image`

### Indexierungsschutz

`X-Robots-Tag: noindex, nofollow` in `vercel.json` für:

`/search`, `/cv-builder/workspace`, `/landingspage2`, `/registrieren`,
`/anmelden`, `/auth/callback`, `/profil`, `/email-bestaetigen`, `/impressum`,
`/datenschutz`, `/datenschutzprinzipien`, `/app.html`, `/dev/(.*)`

Zusätzlich liefern `app.html` und die statische Prinzipien-Seite selbst
`noindex,nofollow`. Rechtsseiten (`/impressum`, `/datenschutz`,
`/datenschutzprinzipien`) sind bewusst vorläufig `noindex`, bis sie eigene,
serverseitig ausgelieferte Metadaten erhalten; sie sind nicht in der Sitemap.

**Wichtig:** `noindex` ist kein Zugriffsschutz. Die geschützten Routen liefern
weiterhin nur die statische App-Shell; persönliche Daten werden erst
clientseitig nach Authentifizierung geladen. Es wurden keine vertraulichen
Inhalte öffentlich ausgeliefert.

### robots.txt / sitemap.xml

- `public/robots.txt`: `User-agent: *`, `Allow: /`, `Disallow: /api/`,
  Sitemap-Referenz auf `https://www.mays-job-matcher.app/sitemap.xml`.
- `public/sitemap.xml`: ausschließlich `https://www.mays-job-matcher.app/`.
- Beide Dateien werden von Vite nach `dist/` kopiert.

### Vercel

- Bestehende `functions`, `crons`, `redirects`, `git.deploymentEnabled` und
  alle API-Rewrites unverändert.
- SPA-Rewrites für alle bestehenden Routen bleiben erhalten; Ziel ist jetzt
  `/app.html` statt `/index.html`.
- Keine neuen Dependencies, keine Architekturänderung außer dem zweiten
  HTML-Einstiegspunkt.

### Drift-Schutz

`src/lib/seoHead.ts` exportiert `APP_ROUTES` als einzige Liste der
indexierungsgeschützten Anwendungsrouten. Tests prüfen:

- jede Route in `APP_ROUTES` hat Header und `/app.html`-Rewrite,
- die Nicht-API-Rewrite-Liste ist exakt `APP_ROUTES`,
- jedes Routen-Literal in `src/App.tsx` und `src/rootRoute.ts` ist in
  `APP_ROUTES` enthalten (fängt neue private Routen).

---

## 4. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `index.html` | Landing-SEO-Metadaten |
| `app.html` | Neue, nicht indexierbare App-Shell |
| `vite.config.ts` | Zwei HTML-Inputs (`index.html`, `app.html`) |
| `src/lib/seoHead.ts` | Canonical-/Robots-Guard, `APP_ROUTES` |
| `src/main.tsx` | Initialer Guard + `popstate`-Listener |
| `src/App.tsx` | Guard bei Navigation (`navigationVersion`) |
| `vercel.json` | `headers` mit `X-Robots-Tag`; Rewrites auf `/app.html` |
| `public/robots.txt` | Neu, inkl. `Disallow: /api/` |
| `public/sitemap.xml` | Neu |
| `public/datenschutzprinzipien/index.html` | `noindex,nofollow` ergänzt |
| `src/lib/seoHead.test.ts` | Unit-Tests Canonical/Robots |
| `src/seoMetadata.test.ts` | Metadaten-, Robots-, Sitemap-, Vercel-Konfigurations- und Drift-Tests |
| `src/seoHttpDelivery.test.ts` | HTTP-Auslieferungstest (lokale Vercel-Simulation) |
| `src/ProfileRoute.test.tsx` | React-Wiring: Canonical-Entfernung bei `/profil` und `popstate` |
| `docs/AI_AUDITLOG.md` | Audit-Eintrag |
| `docs/reports/JM-MARKETING-01A-SEO-FOUNDATION-REPORT.md` | Dieser Bericht |

---

## 5. Tests und Ergebnisse

### Fokussierte SEO-/Routing-Tests

```text
npx vitest run src/lib/seoHead.test.ts src/seoMetadata.test.ts \
  src/seoHttpDelivery.test.ts src/ProfileRoute.test.tsx
Test Files  4 passed (4)
     Tests  77 passed (77)
```

### Vollsuite

Lauf A (vor den Review-Härtungen):

```text
Test Files  1 failed | 177 passed | 3 skipped (181)
     Tests  1 failed | 1858 passed | 5 skipped (1864)
FAIL src/ManualSearchProfiles.integration.test.tsx > ... > creates a manual profile ...
Error: Test timed out in 5000ms.
```

Lauf B (nach den Review-Härtungen):

```text
Test Files  1 failed | 177 passed | 3 skipped (181)
     Tests  2 failed | 1862 passed | 5 skipped (1869)
```

Beide Fehlschläge lagen in `src/ManualSearchProfiles.integration.test.tsx`
(Timeouts unter Parallellast). Isolierter Nachlauf:

```text
npx vitest run src/ManualSearchProfiles.integration.test.tsx
Test Files  1 passed (1)
     Tests  8 passed (8)
```

Lauf C (unveränderter Stand, vollständige Wiederholung):

```text
npm test
Test Files  178 passed | 3 skipped (181)
     Tests  1864 passed | 5 skipped (1869)
Duration  92.06s
```

Die Timeouts werden als Laufzeit-Flake unter Parallellast dokumentiert; sie
sind isoliert und in der vollständigen Wiederholung nicht reproduzierbar. Es
wird kein ursächlicher Zusammenhang mit dieser Änderung behauptet.

### Build

```text
npm run build
tsc -b && vite build
✓ 350 modules transformed
dist/app.html      0.63 kB
dist/index.html    2.37 kB
✓ built in 1.36s
```

Vorhanden nach Build: `dist/index.html`, `dist/app.html`, `dist/robots.txt`,
`dist/sitemap.xml`, `dist/datenschutzprinzipien/index.html` (mit noindex).

### Diff-/Syntax-Prüfung

```text
git diff --check
# keine Ausgabe, Exit 0
```

`tsc -b` ist Teil von `npm run build` und PASS.

---

## 6. HTTP-Auslieferungsnachweis (lokal)

Da kein Preview-Deployment ausgeführt wurde, wurde die tatsächliche
Kombination aus gebauten Dateien und `vercel.json` mit einem lokalen
HTTP-Server simuliert (Rewrites + Header exakt aus der Konfiguration). Das ist
**kein** Vercel-Preview-Nachweis, sondern ein Nachweis, dass die ausgelieferten
Antworten die Metadaten/Header bereits im HTTP-Body bzw. in den Headern tragen
und nicht erst durch Client-JavaScript entstehen. Der Vitest-Test modelliert
zusätzlich die Dateisystem-Priorität vor Rewrites.

| Route | Status | `X-Robots-Tag` | Canonical | HTML `noindex` |
|---|---|---|---|---|
| `/` | 200 | – | ja | nein |
| `/search` | 200 | noindex, nofollow | nein | ja |
| `/cv-builder/workspace?handoff=test` | 200 | noindex, nofollow | nein | ja |
| `/anmelden` | 200 | noindex, nofollow | nein | ja |
| `/auth/callback` | 200 | noindex, nofollow | nein | ja |
| `/profil` | 200 | noindex, nofollow | nein | ja |
| `/email-bestaetigen` | 200 | noindex, nofollow | nein | ja |
| `/registrieren` | 200 | noindex, nofollow | nein | ja |
| `/impressum` | 200 | noindex, nofollow | nein | ja |
| `/datenschutz` | 200 | noindex, nofollow | nein | ja |
| `/datenschutzprinzipien` | 200 | noindex, nofollow | nein | ja (statische Seite) |
| `/landingspage2` | 200 | noindex, nofollow | nein | ja |
| `/robots.txt` | 200 | – | – | – |
| `/sitemap.xml` | 200 | – | – | – |

### Reale Live-Prüfung (nur Baseline, read-only)

- Non-www → www: HTTP 308.
- `https://www.mays-job-matcher.app/job-matcher-next-step.webp`: HTTP 200,
  `image/webp`.
- Live `/robots.txt` und `/sitemap.xml`: HTTP 404 (vor Deployment erwartet).

---

## 7. Sicherheit, Datenschutz, Data Flow

- Keine neuen Datenflüsse, keine neuen externen Calls, keine neuen Dependencies.
- Keine Änderung an RIS-BFF, Cognito, AWS, Terraform oder persönlichen Daten.
- `noindex` ergänzt, ersetzt aber keine Authentifizierung/Autorisierung.
- Keine Secrets, Tokens oder personenbezogenen Daten in Code, Tests, Report
  oder Commit-Messages.
- `og:image` verweist auf ein bereits öffentliches, lizenziertes
  App-Screenshot-Asset (`JM-THIRD-PARTY-LICENSE-INVENTORY-01`: VERIFIED).
- Der `/email-bestaetigen`-Pfad kann eine E-Mail-Adresse im Query-String
  tragen; die Route ist jetzt zusätzlich `noindex`. Eine eigene
  `Referrer-Policy` wurde nicht ergänzt (bestehende Browser-Defaults,
  keine Drittanbieter-Ressourcen) und bleibt optionales Hardening für 01B.

---

## 8. Review-Findings und Auflösung

Unabhängige Reviewer (Scope/Architektur und Security/Privacy) bewerteten den
Branch als **READY** ohne Blocker. Eingearbeitet wurden:

- **Statische Prinzipien-Seite:** `noindex` ergänzt; Emulation modelliert
  Dateisystem-vor-Rewrite; Report präzisiert.
- **Drift-Schutz:** `APP_ROUTES` wird gegen Rewrite-Liste und Routen-Literale
  in `App.tsx`/`rootRoute.ts` geprüft.
- **React-Wiring:** Tests für Canonical-Entfernung bei `/profil` und
  `popstate`.
- **`/index.html`:** wird jetzt als Startseite normalisiert (Canonical `/`).
- **`robots.txt`:** `Disallow: /api/` ergänzt.
- **Test-Robustheit:** HTML-Aussagen über DOMParser statt String-Reihenfolge.

Verbleibend:

1. **Vercel-Preview nicht verifiziert:** Header-/Rewrite-/Dateisystem-Verhalten
   muss in JM-MARKETING-01B an einer echten Preview-URL geprüft werden.
2. **`og:image` Format:** WebP ist bei den meisten Crawlern akzeptiert; für
   maximale Kompatibilität kann in 01B ein JPG/PNG-Derivat ergänzt werden.
3. **Rechtsseiten:** `/impressum`, `/datenschutz`, `/datenschutzprinzipien`
   sind vorläufig `noindex`; Produktfreigabe für Indexierung und eigene
   Metadaten stehen aus.
4. **`/datenschutzprinzipien`:** statische Seite hat Vorrang; ein Test deckt
   das ab, die Live-Auslieferung bleibt in 01B zu bestätigen.
5. **Timeouts:** zwei Laufzeit-Flakes in `ManualSearchProfiles.integration`
   unter Parallellast, isoliert und im Wiederholungslauf PASS.
6. **Kein Push:** Der Branch existiert nur lokal; `origin` kennt ihn nicht.

---

## 9. Git-Status

```text
Branch:      feature/jm-marketing-01a-seo-foundation
Basis:       a0dc1ec (origin/main)
Commits:     afb5bf1 feat(seo): add landing metadata and non-indexable app shell
             0a99b1f feat(seo): serve robots and sitemap with noindex headers for app routes
             1822674 test(seo): cover metadata, canonical, robots, headers and HTTP delivery
             b93c8c2 fix(seo): harden route coverage and static legal page indexing
             <docs>  docs(seo): add JM-MARKETING-01A report and audit entry
Ahead/behind: 4/0 gegenüber origin/main (vor dem Docs-Commit)
Push:        nicht ausgeführt
```

Unveränderte, unversionierte Fremddateien bleiben im Working Tree und sind
nicht Teil der Commits.

---

## 10. Empfehlung JM-MARKETING-01B — SEO Preview & Google Discoverability Verification

1. Feature-Branch pushen (separate Freigabe) und Vercel-Preview abwarten.
2. An der Preview-URL per `curl -I` prüfen:
   `/`, `/search`, `/profil`, `/anmelden`, `/auth/callback`,
   `/cv-builder/workspace`, `/email-bestaetigen`, `/registrieren`,
   `/impressum`, `/datenschutz`, `/datenschutzprinzipien`, `/landingspage2`,
   `/robots.txt`, `/sitemap.xml`.
3. Erwartung: Startseite 200 mit Canonical und ohne `X-Robots-Tag`;
   App-Routen 200 mit `X-Robots-Tag: noindex, nofollow` und ohne Canonical;
   `robots.txt`/`sitemap.xml` 200 mit korrektem Content-Type und ohne
   SPA-Fallback.
4. `?handoff=...`-Query bei `/cv-builder/workspace` auf Erhalt prüfen.
5. Non-www → www (308) und Canonical-Konsistenz erneut bestätigen.
6. Open-Graph-/Twitter-Vorschau mit einem echten Crawler/Validator prüfen;
   ggf. JPG/PNG-`og:image` nachziehen.
7. Erst nach Production-Freigabe: Sitemap in der Google Search Console
   einreichen; Rechtsseiten-Metadaten entscheiden.
8. Keine `noindex`-Route als „Public“ in die Sitemap aufnehmen.
