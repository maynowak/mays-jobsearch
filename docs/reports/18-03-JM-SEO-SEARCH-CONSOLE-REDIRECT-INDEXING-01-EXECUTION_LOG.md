# JM-SEO-SEARCH-CONSOLE-REDIRECT-INDEXING-01 — Execution Log

**Status:** COMPLETE (READ-ONLY SEO-R Redirect & Indexing Audit)
**Auditdatum:** 27.11.2026, 09:35–09:50 UTC

---

## 1. Current status

COMPLETE. Alle Redirects und Indexierungsbedingungen analysiert. Keine Produktcode-Änderungen durchgeführt.

## 2. Audit date/time

27.11.2026, 09:35–09:50 UTC

## 3. Git branch and HEAD

- Branch: `main`
- HEAD: `c63911f` (PR #71, 25.11.2026)
- Production: `c63911f` (automatisches Vercel-Deployment)
- Remote: `origin/main`

## 4. Audit scope

Search Console-Meldung "Seite mit Weiterleitung" untersuchen. Alle technischen Redirects prüfen:
- HTTP → HTTPS
- Non-www → www  
- Trailing-Slash
- Rechtsseiten (`/datenschutz`, `/impressum`, `/datenschutzprinziepien`)
- Private Routen
- Unbekannte Pfade

## 5. Completed audit sections

- [x] Pflichtdokumente gelesen
- [x] Git-/Deployment-Baseline
- [x] HTTP-Redirect-Prüfungen
- [x] HTTP-Header für alle relevanten URLs
- [x] Initiales HTML (Titel, Robots, Canonical)
- [x] Sitemap und robots.txt
- [x] Private-Routen-Prüfung
- [x] Unknown-Route-Prüfung
- [x] Abschlussbericht erstellt

## 6. Actual findings

### 6.1 HTTP → HTTPS Redirects

| URL | Status | Location | Bewertung |
| --- | --- | --- | --- |
| `http://mays-job-matcher.app/` | 308 | `https://mays-job-matcher.app/` | INTENDED |
| `http://mays-job-matcher.app/datenschutz` | 308 | `https://mays-job-matcher.app/datenschutz` | INTENDED |
| `http://mays-job-matcher.app/impressum` | 308 | `https://mays-job-matcher.app/impressum` | INTENDED |

**Keine Probleme:** Alle HTTP-Requests leiten korrekt zu HTTPS um.

### 6.2 Non-www → www Redirects

| URL | Status | Bewertung |
| --- | --- | --- |
| `https://mays-job-matcher.app/` | 308 → `https://www.mays-job-matcher.app/` | INTENDED |
| `https://www.mays-job-matcher.app/` | 200 | OK |

**Keine Probleme:** `mays-job-matcher.app` (ohne www) leitet zu `www.mays-job-matcher.app` um. Das ist beabsichtigt.

### 6.3 Trailing-Slash-Verhalten

| URL | Status | Bewertung |
| --- | --- | --- |
| `/datenschutz` | 200 | OK |
| `/datenschutz/` | 404 | INTENDED (trailingSlash: false in vercel.json) |
| `/impressum` | 200 | OK |
| `/impressum/` | 404 | INTENDED |

**Keine Probleme:** Vercel-Framework ist auf `trailingSlash: false` eingestellt. Trailing-Slash-URLs erhalten 404.

### 6.4 Rechtsseiten - HTTP-Header und HTML

| URL | HTTP 200 | X-Robots-Tag | HTML Robots | Canonical | Titel | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/datenschutz` | ✅ | `noindex,nofollow` | `noindex,nofollow` | fehlt | May's Job Matcher (Standard) | BLOCKED |
| `/impressum` | ✅ | `noindex,nofollow` | `noindex,nofollow` | fehlt | May's Job Matcher (Standard) | BLOCKED |
| `/datenschutzprinziepien` | ✅ | `noindex,nofollow` | `noindex,nofollow` | fehlt | Datenschutzprinzipien | BLOCKED |

**Notiz:** `/datenschutzprinziepien` ist bereits als eigenständige HTML-Datei (5.4KB) verfügbar, aber mit `noindex,nofollow` versehen.

### 6.5 Private Routen

| URL | Status | X-Robots-Tag | Bewertung |
| --- | --- | --- | --- |
| `/search` | 200 | `noindex,nofollow` | INTENDED |
| `/profil` | 200 | `noindex,nofollow` | INTENDED |
| `/anmelden` | 200 | `noindex,nofollow` | INTENDED |
| `/registrieren` | 200 | `noindex,nofollow` | INTENDED |
| `/auth/callback` | 200 | `noindex,nofollow` | INTENDED |
| `/cv-builder/workspace` | 200 | `noindex,nofollow` | INTENDED |

### 6.6 Unbekannte Routen

| URL | Status | X-Robots-Tag | Bewertung |
| --- | --- | --- | --- |
| `/foobar` | 404 | – | OK (echte 404) |
| `/xxx` | 404 | – | OK |
| `/searchxyz` | 404 | – | OK |
| `/.well-known` | 404 | – | OK |

**Keine Soft-404-Risiken:** Unbekannte Pfade erhalten echte 404 (nicht 200).

### 6.7 Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.mays-job-matcher.app/</loc>
  </url>
</urlset>
```

- **Nur 1 URL** – Landingpage
- **Keine Rechtsseiten** – erwartetes Fehlverhalten für SEO-Zwecke
- **Keine Redirects in Sitemap** – korrekt

### 6.8 robots.txt

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.mays-job-matcher.app/sitemap.xml
```

- `Allow: /` – Crawling erlaubt
- Keine spezifischen Disallows für Rechtsseiten

## 7. Actual findings

**Keine unbeabsichtigten Redirects gefunden.** Alle Redirects sind technisch korrekt:

1. **HTTP → HTTPS**: Alle HTTP-Requests (auch `/datenschutz`, `/impressum`) leiten zu HTTPS um. Das ist INTENDED.
2. **Non-www → www**: `mays-job-matcher.app` leitet zu `www.mays-job-matcher.app` um. INTENDED.
3. **Trailing Slash**: URLs mit Trailing Slash erhalten 404 (Framework-Einstellung). INTENDED.

**Das Problem für SEO ist nicht die Weiterleitung, sondern:**
- `X-Robots-Tag: noindex, nofollow` für Rechtsseiten in `vercel.json`
- `noindex,nofollow` im HTML von `app.html`
- Keine eigenständigen statischen HTML-Dateien für `/datenschutz` und `/impressum`
- `sitemap.xml` listet keine Rechtsseiten

## 8. Classification

**A — NO UNINTENDED REDIRECTS FOUND**

Die Search Console-Meldung "Seite mit Weiterleitung" bezieht sich auf legitime Redirects:
- HTTP → HTTPS
- Non-www → www

Diese Redirects sind **absichtlich** und **korrekt** konfiguriert.

## 9. Evidence / file references

- HTTP-Abfrfen: `curl -sS -D - -o /dev/null` gegen `https://www.mays-job-matcher.app/*`
- `vercel.json`: Redirects und Headers-Konfiguration
- `public/sitemap.xml`: Nur Landingpage

## 10. Open questions

- **Search Console-URL-Beispiele fehlen**: Ohne konkrete betroffene URLs kann die Meldung nicht genauer analysiert werden.
- **Indexierungsgrund**: Die "nicht indexiert"-Meldung bezieht sich auf `noindex,nofollow`, nicht auf die Redirects.

## 11. Risks

Keine. Redirects sind beabsichtigt und funktionieren korrekt.

## 12. Recommended next actions

**Für die Indexierung der Rechtsseiten (nicht für Redirects):**

Siehe separaten Report `18-02-JM-MARKETING-04-LEGAL-SEO-REPORT.md`.

Kurzfassung:
1. `X-Robots-Tag` Header für Rechtsseiten entfernen
2. Statische HTML-Dateien für `/datenschutz` und `/impressum` erstellen
3. SEO-Metadaten hinzufügen
4. Sitemap erweitern

## 13. Git status

Keine Code-Änderungen (READ-ONLY-Audit).