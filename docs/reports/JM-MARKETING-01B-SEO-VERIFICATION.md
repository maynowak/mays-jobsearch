# JM-MARKETING-01B — SEO PREVIEW & GOOGLE DISCOVERABILITY VERIFICATION

**Status:** `SEO VERIFICATION COMPLETE — PASS WITH WARNINGS`
**Scope:** Production website `https://www.mays-job-matcher.app` (read-only)
**Actual Google index status:** `BLOCKED / UNVERIFIED`
**No production, RIS, AWS, Terraform, auth, consent or storage change.**

## 1. Ergebnisübersicht

| Bereich | Ergebnis |
|---|---|
| Homepage erreichbar | **PASS** — HTTP 200 |
| robots.txt | **PASS** — 200, `Allow: /`, `Disallow: /api/`, Sitemap |
| sitemap.xml | **PASS** — 200, gültiges XML, genau eine URL |
| Canonical | **PASS** — `https://www.mays-job-matcher.app/` |
| robots-Meta Homepage | **PASS** — `index,follow,max-image-preview:large` |
| Googlebot-Antwort | **PASS** — HTTP 200, kein `X-Robots-Tag: noindex` |
| Private/App-Routen | **PASS** — `X-Robots-Tag: noindex, nofollow` |
| Open Graph | **WARNING** — vollständig, aber WebP-Querformat |
| Twitter Cards | **WARNING** — `twitter:image:alt` und `twitter:site` fehlen |
| Strukturierte Daten | **WARNING** — kein JSON-LD vorhanden |
| Meta Description | **WARNING** — 172 Zeichen, möglicherweise gekürzt |
| Non-www/HTTP | **PASS** — 308 auf `https://www.mays-job-matcher.app/` |
| Vercel-Alias | **PASS** — Kanonisch auf www; Alias bleibt erreichbar |
| Tatsächliche Google-Indexierung | **BLOCKED / UNVERIFIED** — keine Search-Console-/Google-spezifische Prüfung |

**Gesamtstatus:** `PASS WITH WARNINGS`; keine technische Indexierungsblockade
der Homepage erkennbar.

## 2. Geprüfte URLs und Nachweise

| URL | Prüfung |
|---|---|
| `https://www.mays-job-matcher.app/` | HTTP 200, indexierbar |
| `https://www.mays-job-matcher.app/robots.txt` | HTTP 200, Inhalt geprüft |
| `https://www.mays-job-matcher.app/sitemap.xml` | HTTP 200, XML geparst |
| `https://www.mays-job-matcher.app/job-matcher-next-step.webp` | HTTP 200, `image/webp`, 114.688 Bytes |
| `https://www.mays-job-matcher.app/datenschutz` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/impressum` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/search` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/profil` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/cv-builder/workspace` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/auth/callback` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/anmelden` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/registrieren` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/email-bestaetigen` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/datenschutzprinzipien` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/landingspage2` | 200, `noindex, nofollow` |
| `https://www.mays-job-matcher.app/dev/example` | 404, `noindex, nofollow` |

## 3. robots.txt und Sitemap

`robots.txt`:

```text
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.mays-job-matcher.app/sitemap.xml
```

`sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.mays-job-matcher.app/</loc></url>
</urlset>
```

Bewertung:

- Genau eine öffentliche Landing-URL ist gelistet.
- Die noindex-Rechts-/App-Seiten sind nicht in der Sitemap.
- Kein `lastmod`; mittelfristig optional ergänzen.
- Private Routen sind über HTTP-Header geschützt; `robots.txt` allein
  verhindert keine Indexierung, ist hier aber nicht die einzige Schutzschicht.

## 4. Homepage-Metadaten

```text
Title:       KI-gestützte Jobsuche & Job Matching | May's Job Matcher
Title-Länge: 56 Zeichen
Description: Finde Jobs, die wirklich zu dir passen – mit individuellen
             Suchprofilen, KI-gestütztem Job-Matching und Lebenslaufanalyse.
             Organisiere deine Jobsuche mit May's Job Matcher.
Description-Länge: 172 Zeichen
Canonical:   https://www.mays-job-matcher.app/
Robots:      index,follow,max-image-preview:large
```

- Title und Canonical sind konsistent.
- Die Description ist technisch gültig, überschreitet aber die übliche
  SERP-Anzeigelänge; eine Fassung um 150–160 Zeichen ist empfehlenswert.
- `non-www` und HTTP leiten per **308** auf die kanonische `https://www`-URL.
- `https://mays-jobsearch.vercel.app/` liefert dieselbe Seite, trägt aber
  ebenfalls die www-Canonical-URL; dadurch wird der Alias kanonisch gebündelt.

## 5. Open Graph / Social Preview

Vorhanden:

```text
og:type              website
og:locale            de_DE
og:site_name         May's Job Matcher
og:title             siehe Title
og:description      siehe Description
og:url               https://www.mays-job-matcher.app/
og:image             https://www.mays-job-matcher.app/job-matcher-next-step.webp
og:image:width       1536
og:image:height      1024
og:image:alt         Vorschau der Job-Matching-Oberfläche von May's Job Matcher
twitter:card         summary_large_image
twitter:title        siehe Title
twitter:description  siehe Description
twitter:image        gleiche WebP-URL
```

Warnpunkte:

- Social-Crawler unterstützen WebP nicht überall gleich zuverlässig; ein
  JPEG-/PNG-Fallback mit 1200 × 630 px wäre robuster.
- `twitter:image:alt` fehlt.
- `twitter:site` / `twitter:creator` fehlen.
- Das Bild ist 3:2, nicht das übliche 1,91:1-Format; Plattformen können es
  beschneiden.

## 6. Strukturierte Daten

Im ausgelieferten Homepage-HTML wurden **keine JSON-LD-Blöcke** gefunden.
Damit gibt es keine fehlerhaften strukturierten Daten, aber auch keine
maschinenlesbare `Organization`-/`WebSite`-/`SoftwareApplication`-Auszeichnung.

Bewertung: **WARNING / Verbesserungspotenzial**, kein technischer Blocker.

## 7. Indexierungsschutz für private Daten

Die sensiblen App-Routen werden serverseitig mit

```text
X-Robots-Tag: noindex, nofollow
```

ausgeliefert. Das umfasst u. a.:

- `/search`
- `/profil`
- `/cv-builder/workspace`
- `/auth/callback`
- `/anmelden`
- `/registrieren`
- `/email-bestaetigen`
- `/landschaftsseiten`/`/landingspage2`
- Rechtsseiten wie `/datenschutz`, `/impressum`,
  `/datenschutzprinzipien`

Zusätzlich schützt die Anwendung Authentifizierung und serverseitige
Berechtigungen; SEO-Header sind nur eine zusätzliche Ebene.

## 8. Tatsächliche Google-Indexierung

**BLOCKED / UNVERIFIED.**

- Keine Google Search Console wurde geöffnet oder verifiziert.
- Es wurde keine Google-spezifische Indexabfrage als Beweis verwendet.
- Eine externe Web-Suche nach `site:mays-job-matcher.app` liefert die
  Homepage; das belegt Auffindbarkeit in dieser Suchintegration, **nicht**
  den Google-Index.
- Die technische Indexierbarkeit der Homepage ist PASS; die tatsächliche
  Google-Aufnahme muss separat über Search Console oder eine kontrollierte
  Google-Suche bestätigt werden.

## 9. SERP-Vorschau (aus Metadaten, keine echte Google-Aufnahme)

```text
www.mays-job-matcher.app
KI-gestützte Jobsuche & Job Matching | May's Job Matcher
Finde Jobs, die wirklich zu dir passen – mit individuellen Suchprofilen,
KI-gestütztem Job-Matching und Lebenslaufanalyse. Organisiere deine Jobsuche
mit May's Job Matcher.
```

## 10. Priorisierte Empfehlungen

1. **P1 — Social-Robustheit:** JPEG-/PNG-OG-Bild im Format 1200 × 630 px
   bereitstellen und `twitter:image:alt` sowie optional `twitter:site`
   ergänzen.
2. **P1 — Google Search Console:** nach Freigabe Property verifizieren und
   die tatsächliche Indexierung der Landingpage prüfen. Keine Änderung erfolgt
   in diesem Auftrag.
3. **P2 — Meta Description:** auf ca. 150–160 Zeichen kürzen.
4. **P2 — Structured Data:** JSON-LD für `Organization`, `WebSite` und
   `SoftwareApplication` ergänzen, sobald fachlich/freigabeseitig gewünscht.
5. **P3 — Sitemap:** optional `lastmod` für die Landing-URL ergänzen; weitere
   indexierbare öffentliche Seiten derzeit nicht vorhanden.

## 11. Grenzen

Nur lesende Production-Prüfung. Keine Änderungen an Produktcode, SEO-Tags,
Authentifizierung, Consent, CV-Speicherung, RIS, AWS oder Terraform. Keine
Google-Search-Console-Verifizierung, kein Deployment und kein Main-Merge.
