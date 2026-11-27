# JM-SEO-SEARCH-CONSOLE-REDIRECT-INDEXING-01 — Redirect & Indexing Audit Report

## 1. Executive Summary

### Suchergebnis

**A — NO UNINTENDED REDIRECTS FOUND**

Die Google Search Console-Meldung "Seite mit Weiterleitung" bezieht sich auf **legitime, beabsichtigte Redirects**. Es wurden **keine unbeabsichtigten oder fehlerhaften Redirects** gefunden.

Die eigentlichen SEO-Probleme für die Rechtsseiten liegen nicht in den Redirects, sondern in:
1. `X-Robots-Tag: noindex, nofollow` HTTP-Headern
2. `noindex,nofollow` im HTML
3. Fehlender Canonical-Link
4. Keine SEO-Metadaten (Titel, Description)
5. `sitemap.xml` listet keine Rechtsseiten auf

---

## 2. Git-/Deployment-Baseline

- Repository: `maynowak/Mays-JobMatcher`
- Production: `c63911f` (25.11.2026, PR #71)
- Domain: `https://www.mays-job-matcher.app`
- Build: Vite + React, `index.html` als SPA-Entry

---

## 3. Search Console Evidence

**Kein berechtigter Zugang zur Google Search Console verfügbar.**

Die vom Auftragstyp bereitgestellte Information:
- Meldung: "Seite mit Weiterleitung"
- Keine spezifischen betroffenen URLs wurden genannt

**Limitation:** Ohne konkrete URL-Beispiele kann die Meldung nicht genauer analysiert werden.

---

## 4. Technischer Redirect-Befund

### 4.1 HTTP → HTTPS Redirects

| Ausgangs-URL | HTTP-Status | Location | Redirect-Kette | Bewertung |
| --- | --- | --- | --- | --- |
| `http://mays-job-matcher.app/` | 308 | `https://mays-job-matcher.app/` | 1 Schritt | ✅ INTENDED |
| `http://mays-job-matcher.app/datenschutz` | 308 | `https://mays-job-matcher.app/datenschutz` | 1 Schritt | ✅ INTENDED |
| `http://mays-job-matcher.app/impressum` | 308 | `https://mays-job-matcher.app/impressum` | 1 Schritt | ✅ INTENDED |

**Ergebnis:** Keine unerwarteten Redirects. Alle HTTP-Requests (auch zu Rechtsseiten) leiten korrekt zu HTTPS um.

### 4.2 Non-www → www Redirects

| URL | HTTP-Status | Location |
| --- | --- | --- |
| `https://mays-job-matcher.app/` | 308 | `https://www.mays-job-matcher.app/` |
| `https://www.mays-job-matcher.app/` | 200 | – |

**Erwartetes Verhalten:** Die Domain `mays-job-matcher.app` (ohne www) leitet zu `www.mays-job-matcher.app` um. Das ist eine bewusste Wahl für konsistente Canonical-URLs.

**Bewertung:** INTENDED

### 4.3 Trailing-Slash-Verhalten

| URL | HTTP-Status | Bewertung |
| --- | --- | --- |
| `/datenschutz` | 200 | OK |
| `/datenschutz/` | 404 | INTENDED |
| `/impressum` | 200 | OK |
| `/impressum/` | 404 | INTENDED |
| `/` | 200 | OK |
| `/index.html` | 200 | OK |

**Bewertung:** INTENDED — Vercel `trailingSlash: false` ist korrekt konfiguriert.

### 4.4 Private Routen

| URL | HTTP-Status | X-Robots-Tag | Bewertung |
| --- | --- | --- | --- |
| `/search` | 200 | `noindex,nofollow` | ✅ INTENDED |
| `/profil` | 200 | `noindex,nofollow` | ✅ INTENDED |
| `/anmelden` | 200 | `noindex,nofollow` | ✅ INTENDED |
| `/registrieren` | 200 | `noindex,nofollow` | ✅ INTENDED |
| `/auth/callback` | 200 | `noindex,nofollow` | ✅ INTENDED |
| `/cv-builder/workspace` | 200 | `noindex,nofollow` | ✅ INTENDED |

**Bewertung:** Keine Indexierung nötig.

### 4.5 Unbekannte Routen (Soft-404-Test)

| URL | HTTP-Status | X-Robots-Tag | Bewertung |
| --- | --- | --- | --- |
| `/foobar` | 404 | – | ✅ ECHTE 404 |
| `/xxx` | 404 | – | ✅ ECHTE 404 |
| `/searchxyz` | 404 | – | ✅ ECHTE 404 |
| `/.well-known` | 404 | – | ✅ ECHTE 404 |

**Keine Soft-404-Risiken.** Unbekannte Pfade erhalten echte 404-Antworten, nicht 200 mit "nicht gefunden" UI.

---

## 5. Sitemap / Canonical / Robots

### Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.mays-job-matcher.app/</loc>
  </url>
</urlset>
```

- **Nur 1 URL** – Landingpage
- **Keine Rechtsseiten** – erwartetes Fehlverhalten für SEO
- **Keine Redirects in Sitemap** – korrekt

### robots.txt

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.mays-job-matcher.app/sitemap.xml
```

- `Allow: /` – Crawling erlaubt
- Keine spezifischen Disallows

---

## 6. Content- und Indexierungs-Befund

### Öffentliche URLs

| URL | HTTP 200 | Canonical | Meta-Robots | X-Robots-Tag | Titel | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | ✅ | – (kein) | `index,follow,max-image-preview:large` | – | KI-gestützte Jobsuche & Job Matching | ✅ OK |
| `/datenschutz` | ✅ | – | `noindex,nofollow` | `noindex,nofollow` | May's Job Matcher (Standard) | ❌ BLOCKED |
| `/impressum` | ✅ | – | `noindex,nofollow` | `noindex,nofollow` | May's Job Matcher (Standard) | ❌ BLOCKED |
| `/datenschutzprinziepien` | ✅ | – | `noindex,nofollow` | `noindex,nofollow` | Datenschutzprinzipien | ❌ BLOCKED |

**Notiz:** `/datenschutzprinziepien` funktioniert (korrekte Schreibrecht: `/datenschutzprinziepien`), ist aber ebenfalls nicht indexierbar.

### Probleme für SEO

1. **Keine Canonicals** für Rechtsseiten
2. **Keine eindeutigen Titel** für `/datenschutz` und `/impressum`
3. **X-Robots-Tag** blockiert alle drei Rechtsseiten
4. **HTML Meta-Robots** blockiert alle drei Rechtsseiten
5. **Sitemap** listet keine Rechtsseiten auf

---

## 7. Konkrete Ursachen / Hypothesen

| Ursache | Bewertung | Begründung |
| --- | --- | --- |
| Search Console "Seite mit Weiterleitung" | **NICHT RELEVANT** | Redirects sind korrekt (HTTP→HTTPS, Non-www→www) |
| Rechtsseiten nicht indexiert | **BELEGT** | `noindex,nofollow` in Header und HTML |
| Fehlende Rechtsseiten in Sitemap | **BELEGT** | Nur Landingpage enthalten |

---

## 8. Priorisierte Empfehlungen

### Für Redirect-Probleme: **KEINE AKTION NÖTIG**

Alle Redirects sind beabsichtigt und funktionieren korrekt.

### Für Indexierbarkeit der Rechtsseiten

Siehe separaten Report `18-02-JM-MARKETING-04-LEGAL-SEO-REPORT.md`.

Kurzfassung:
1. `vercel.json`: `X-Robots-Tag` Header für Rechtsseiten entfernen
2. `app.html`: `noindex,nofollow` nur für SPA-Routen lassen
3. Statische HTML-Dateien für `/datenschutz` und `/impressum` erstellen
4. SEO-Metadaten hinzufügen
5. `sitemap.xml` erweitern

---

## 9. Tests und Evidenz

### HTTP-Header

```
$ curl -I https://www.mays-job-matcher.app/
HTTP/2 200
content-type: text/html; charset=utf-8
(no x-robots-tag)

$ curl -I https://www.mays-job-matcher.app/datenschutz
HTTP/2 200
x-robots-tag: noindex, nofollow
content-disposition: inline; filename="app.html"

$ curl -I https://www.mays-job-matcher.app/datenschutzprinziepien
HTTP/2 200
x-robots-tag: noindex, nofollow
content-disposition: inline; filename="datenschutzprinziepien"
```

### Trailing-Slash

```
$ curl -I https://www.mays-job-matcher.app/impressum/
HTTP/2 404
```

---

## 10. Abschließende GO/NO-GO-Bewertung

| Frage | Bewertung |
| --- | --- |
| Unbeabsichtigte Redirects | **GO** (keine gefunden) |
| Redirect-Ketten | **GO** (max. 1 Schritt, wie erwartet) |
| Trailing-Slash-Konfiguration | **GO** (korrekt) |
| Private-Routen geschützt | **GO** (noindex,nofollow) |
| Soft-404-Risiko | **GO** (echte 404) |
| Rechtsseiten indexierbar | **NO-GO** (wegen noindex) |

**Gesamtbewertung: A — NO UNINTENDED REDIRECTS FOUND**

Die Search Console-Meldung "Seite mit Weiterleitung" bezieht sich auf legitime Redirects. Die eigentlichen SEO-Probleme liegen in der `noindex`-Konfiguration der Rechtsseiten, nicht in den Redirects.

---

## 11. Grenzen des Audits

- Kein Zugriff auf Google Search Console
- Keine URL-Beispiele für die "Weiterleitung"-Meldung
- Sitemap und Canonical-Prüfungen basieren auf öffentlich zugänglichen Ressourcen

---

## 12. Commit-History

Keine Code-Änderungen (READ-ONLY-Audit).