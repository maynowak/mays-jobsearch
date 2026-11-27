# JM-MARKETING-04 — PUBLIC LEGAL PAGES SEO INDEXABILITY

## 1. Executive Summary

Die drei öffentlichen Rechtsseiten (`/datenschutz`, `/impressum`, `/datenschutzprinzipien`) sind **derzeit nicht indexierbar**.

| Seite | HTTP-Status | X-Robots-Tag | HTML-Robots | Statischer Inhalt | Indexierbar |
| --- | --- | --- | --- | --- | --- |
| `/` | 200 | – | `index,follow` | ✅ | ✅ |
| `/datenschutz` | 200 | `noindex,nofollow` | `noindex,nofollow` | ❌ (SPA-Fallback) | ❌ |
| `/impressum` | 200 | `noindex,nofollow` | `noindex,nofollow` | ❌ (SPA-Fallback) | ❌ |
| `/datenschutzprinzipien` | 200 | `noindex,nofollow` | `noindex,nofollow` | ✅ (5.4KB HTML) | ❌ |

**BLOCKER-Status: YELLOW → IMPLEMENTATION REQUIRED**

Alle drei Seiten liefern HTTP 200 (kein technischer Block), aber:
- HTTP-Header: `X-Robots-Tag: noindex, nofollow`
- HTML-Meta: `noindex,nofollow`
- `/datenschutz` und `/impressum`: SPA-Fallback ohne Inhalt
- `/datenschutzprinzipien`: Statischer Inhalt, aber `noindex`

---

## 2. Git-/Deployment-Baseline

- Repository: `maynowak/Mays-JobMatcher`
- Production: `c63911f` (25.11.2026, PR #71)
- Domain: `https://www.mays-job-matcher.app`
- Build: Vite + React, `index.html` als SPA-Entry

---

## 3. Technischer Crawling-Befund

### HTTP-Header

| URL | X-Robots-Tag | Canonical | Titel |
| --- | --- | --- | --- |
| `/` | fehlt | nicht gesetzt | KI-gestützte Jobsuche & Job Matching |
| `/datenschutz` | `noindex, nofollow` | fehlt | May's Job Matcher (Standard) |
| `/impressum` | `noindex, nofollow` | fehlt | May's Job Matcher (Standard) |
| `/datenschutzprinzipien` | `noindex, nofollow` | fehlt | Datenschutzprinzipien |

### HTTP-Response Details

- `/` (Home): 200, 2434 Byte, kein X-Robots-Tag
- `/datenschutz`, `/impressum`: 200, 630 Byte, `X-Robots-Tag: noindex, nofollow`, Content-Disposition: `filename="app.html"`
- `/datenschutzprinziepien`: 200, 5425 Byte, `X-Robots-Tag: noindex, nofollow`, **eigene Datei**

---

## 4. Initiales HTML (ohne JavaScript)

### Home (`/`)
```html
<title>KI-gestützte Jobsuche & Job Matching | May's Job Matcher</title>
<meta name="robots" content="index,follow,max-image-preview:large" />
<body><div id="root"></div></body>
```
- Titel und robots vorhanden
- Body: leer (JS-Rendering)

### /datenschutz & /impressum
```html
<title>May's Job Matcher</title>
<meta name="robots" content="noindex,nofollow" />
<body><div id="root"></div></body>
```
- Standard-Title (nicht spezifisch)
- `noindex,nofollow`
- Body: leer (SPA-Fallback)

### /datenschutzprinziepien
```html
<title>Datenschutzprinzipien</title>
<meta name="robots" content="noindex,nofollow">
<!-- vollständiger Rechtstext im <pre>-Block -->
<body>...</body>
```
- **Eigenständiger Inhalt** vorhanden
- `noindex,nofollow` behindert Indexierung

---

## 5. Sitemap / Robots

### robots.txt
```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.mays-job-matcher.app/sitemap.xml
```

- Crawling ist erlaubt
- Sitemap existiert, aber inaktiv

### Sitemap (aktuell)
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.mays-job-matcher.app/</loc>
  </url>
</urlset>
```

- **Nur 1 URL** – Landingpage
- **Keine Rechtsseiten** enthalten

---

## 6. Content-Befund

### /datenschutzprinzipien (statischer Inhalt)

Der vollständige Rechtstext ist im HTML enthalten:

```
UNSERE DATENSCHUTZPRINZIPIEN
May's Job Matcher – KI sinnvoll nutzen. Persönliche Daten bewusst schützen.
Stand: 10. Oktober 2026

UNSER LEITGEDANKE
Nicht möglichst viele Daten sammeln, sondern mit möglichst wenigen Daten...

Technik soll entlasten, nicht verunsichern.
```

**Quelle:** `public/legal/prinzipien.md`

### /datenschutz & /impressum

In `public/legal/`:
- `datenschutz/*.html` (nicht explizit im Build)
- `impressum/` (nicht explizit im Build)

**Frage:** Wo befinden sich die vollständigen Rechtstexte?

---

## 7. Soft-404-Risiko

Unbekannte Pfade (`/foobar`, `/xxx`):
- Wird über `app.html` ausgeliefert (630 Byte, `noindex,nofollow`)
- Kein Soft-404-Signal (kein 200 mit Content, der wie 404 aussieht)

---

## 8. Konkrete Ursachen / Hypothesen

| Ursache | Bewertung |
| --- | --- |
| HTTP-Header `noindex,nofollow` für Rechtsseiten | **BELEGT** |
| HTML-Meta `noindex,nofollow` in app.html | **BELEGT** |
| Keine statischen HTML-Dateien für /datenschutz & /impressum | **BELEGT** |
| Sitemap ohne Rechtsseiten | **BELEGT** |

---

## 9. Priorisierte Empfehlungen

### P1: HTTP-Header entfernen (vercel.json)
Entfernen Sie die Header-Einträge für die drei Rechtsseiten:
```json
// LÖSCHEN:
{
  "source": "/datenschutz",
  "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
}
// usw. für /impressum und /datenschutzprinziepien
```

### P2: HTML-Meta-Robots anpassen (app.html oder statische Dateien)
- Für Rechtsseiten: `index,follow`
- Für SPA-Routen: `noindex,nofollow`

### P3: Statische HTML-Dateien erstellen

```bash
# Erstellen Sie für jede Rechtsseite:
public/datenschutz.html
public/impressum.html
public/datenschutzprinziepien.html  
```

Jede Datei mit:
```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Datenschutz — May's Job Matcher</title>
  <meta name="description" content="Privacy policy and data protection information for May's Job Matcher.">
  <link rel="canonical" href="https://www.mays-job-matcher.app/datenschutz" />
  <meta name="robots" content="index,follow" />
  <!-- OG/Twitter wie nötig -->
</head>
<body>
  <!-- vollständiger Rechtstext -->
</body>
</html>
```

### P4: Sitemap aktualisieren
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.mays-job-matcher.app/</loc></url>
  <url><loc>https://www.mays-job-matcher.app/datenschutz</loc></url>
  <url><loc>https://www.mays-job-matcher.app/impressum</loc></url>
  <url><loc>https://www.mays-job-matcher.app/datenschutzprinziepien</loc></url>
</urlset>
```

### P5: Vercel-Rewrites anpassen

Falls statische Dateien verwendet werden, entfernen Sie die Rewrites oder priorisieren Sie sie:
```json
{
  "source": "/datenschutz",
  "destination": "/datenschutz.html"
}
```

---

## 10. Tests und Evidenz

### Ausgeführte Prüfungen

HTTP-Requests (27.11.2026):
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
content-length: 5425

$ curl https://www.mays-job-matcher.app/sitemap.xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset ...>
  <url><loc>https://www.mays-job-matcher.app/</loc></url>
</urlset>
```

---

## 11. Abschließende GO/NO-GO-Bewertung

| Frage | Bewertung |
| --- | --- |
| HTTP-Status | **GO** (200 für alle) |
| Technische Indexierbarkeit | **NO-GO** (Headers + HTML zeigen noindex) |
| Sitemap für Rechtsseiten | **NO-GO** (fehlt) |
| Statischer Inhalt | **TEILWEISE** (nur datenschutzprinziepien) |

**Gesamtbewertung: YELLOW**

Es muss ein Umsetzungspaket erstellt werden, um:
1. `noindex,nofollow` entfernen
2. Statische HTML-Dateien für alle 3 Rechtsseiten erstellen
3. SEO-Metadaten hinzufügen
4. Sitemap aktualisieren

---

## 12. Grenzen des Audits

- Kein GSC-Zugang
- Die vollständigen Rechtstexte für `/datenschutz` und `/impressum` waren nicht direkt im Build-Output gefunden
- `public/legal/datenschutz/*.html` existiert, aber wird nicht explizit in `dist/` kopiert

---

## 13. Commit-History

Keine Code-Änderungen im Rahmen dieses READ-ONLY-Audits.

---

## 14. Nächste Schritte

1. **Separater Umsetzungsauftrag** erstellen: `JM-MARKETING-04B-LEGAL-SEO-IMPLEMENTATION`
2. Rechtstexte für `/datenschutz` und `/impressum` identifizieren
3. Statische HTML-Dateien erstellen
4. `vercel.json`, `app.html`, `sitemap.xml` aktualisieren
5. Build und Deployment testen
6. Production-Verification durchführen