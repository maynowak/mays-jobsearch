# JM-MARKETING-04 — PUBLIC LEGAL PAGES SEO INDEXABILITY

## 1. Current status

IN PROGRESS — READ-ONLY SEO-Audit
**Auditdatum:** 27.11.2026, 09:20–09:30 UTC

## 2. Audit date/time

27.11.2026, 09:20–09:30 UTC

## 3. Git branch and HEAD

- Branch: `main`
- HEAD: `c63911f` (Merge pull request #71, 25.11.2026)
- Production: `c63911f` (automatisches Vercel-Deployment aktiv)
- Remote: `origin/main`

## 4. Audit scope

Ziel: Öffentliche Rechtsseiten (`/datenschutz`, `/impressum`, `/datenschutzprinzipien`) von `noindex,nofollow` zu `index,follow` machen und individuelle SEO-Metadaten geben.

**Bekannter Befund (vom Auftrag):**
- `vercel.json` setzt für die drei Rechtsseiten `X-Robots-Tag: noindex, nofollow`
- Die Seiten werden über `app.html` ausgeliefert (SPA)
- `app.html` enthält ebenfalls `noindex,nofollow` im HTML
- Sitemap enthält nur die Landingpage

## 5. Completed audit sections

- [x] Pflichtdokumente gelesen: AGENTS.md, TESTING.md, DEVELOPMENT_WORKFLOW.md, AI_AUDITLOG.md
- [x] Git-/Deployment-Baseline
- [x] HTTP-Header aller relevanten URLs
- [x] Initiale HTML (ohne JS) der Rechtsseiten
- [x] Sitemap und robots.txt
- [x] Content- und Struktur-Befund (Rechtstexte)
- [ ] Tests und Build
- [ ] Abschlussbericht

## 6. Actual findings

### HTTP-Header-Befund (27.11.2026, Produktionsstand)

| URL | X-Robots-Tag | Content-Length | Titel (initial) | Robots (initial HTML) |
| --- | --- | --- | --- | --- |
| `/` | **nicht vorhanden** | 2434 | KI-gestützte Jobsuche & Job Matching | `index,follow,max-image-preview:large` |
| `/datenschutz` | **`noindex, nofollow`** | 630 (app.html) | May's Job Matcher | `noindex,nofollow` |
| `/impressum` | **`noindex, nofollow`** | 630 (app.html) | *nicht sichtbar* | `noindex,nofollow` |
| `/datenschutzprinzipien` | **`noindex, nofollow`** | 5425 | Datenschutzprinzipien | `noindex,nofollow` |

**Erkenntnisse:**

1. **`/datenschutz` und `/impressum`**: Wird über Vercel-Rewrite auf `app.html` umgeleitet (content-length 630, filename="app.html"). HTTP-Header: `X-Robots-Tag: noindex, nofollow`. HTML: `noindex,nofollow`. Keine eigene HTML-Datei für diese Seiten.

2. **`/datenschutzprinziepien`**: **Eigenständige statische HTML-Datei** (content-length 5425, keine Umbenennung). HTTP-Header: `X-Robots-Tag: noindex, nofollow`. HTML: `noindex,nofollow`. Inhalt ist vollständig im HTML vorhanden (keine JS-Abhängigkeit).

**Quelle für `/datenschutzprinzipien`:** `public/legal/prinzipien.md` → wird zur Buildzeit in statisches HTML gepackt.

### Inhalt der Rechtsseiten

**`/datenschutzprinzipien`** (vollständig statisch):
- Enthält vollständigen Rechtstext
- Interner Link zu `/legal/prinzipien.md` (als Markdown-Download)
- Visuelle Gestaltung als Card-Layout
- **keine JavaScript-Abhängigkeit**

**`/datenschutz` und `/impressum`**:
- Externe Dateien in `public/legal/`:
  - `public/legal/datenschutz/*.html` (nicht explizit im Build sichtbar)
  - `public/legal/impressum/` (nicht im Build sichtbar)
- Wahrscheinlich werden diese via Vercel-Rewrite auf `app.html` umgeleitet (SPA-Fallback)
- **JS-Abhängigkeit**: Inhalt muss via React-Komponente gerendert werden

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
- **Keine Rechtsseiten** in der Sitemap

### Robots.txt

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.mays-job-matcher.app/sitemap.xml
```

- `Allow: /` – Crawling erlaubt
- **Keine spezifischen Disallows für Rechtsseiten**

### vercel.json (relevante Teile)

Headers für Rechtsseiten:
```json
{
  "source": "/datenschutz",
  "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
},
{
  "source": "/impressum",
  "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
},
{
  "source": "/datenschutzprinzipien",
  "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
}
```

Und Rewrite:
```json
{
  "source": "/impressum",
  "destination": "/app.html"
},
{
  "source": "/datenschutz",
  "destination": "/app.html"
}
```

### app.html (SPA-Fallback)

```html
<!doctype html>
<html lang="de">
  <head>
    ...
    <meta name="robots" content="noindex,nofollow" />
    ...
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

- `noindex,nofollow` im HTML
- Leerer Body (JS-Rendering erforderlich)

### SEO-Guard Code (`src/lib/seoHead.ts`)

```typescript
export const APP_ROUTES = [
  "/search",
  "/cv-builder/workspace",
  ...
  "/impressum",
  "/datenschutz",
  "/datenschutzprinzipien",
] as const;

export const PRIVATE_ROBOTS = "noindex,nofollow";
```

- Alle Rechtsseiten sind explizit in `APP_ROUTES` definiert
- `applyRouteSeoHead()` setzt `noindex,nofollow` für alle nicht-Home-Routen

## 7. Actual findings (detailliert)

| Prüfpunkt | Ergebnis |
| --- | --- |
| HTTP 200 für alle 3 Rechtsseiten | ✅ JA |
| `X-Robots-Tag: noindex, nofollow` | ✅ JA für alle 3 |
| Meta-Robots im HTML | ✅ JA für alle 3 |
| Eigenständige HTML-Datei für `/datenschutz` | ❌ NEIN (SPA-Fallback) |
| Eigenständige HTML-Datei für `/impressum` | ❌ NEIN (SPA-Fallback) |
| Eigenständige HTML-Datei für `/datenschutzprinzipien` | ✅ JA (5.4KB statisch) |
| Inhalt ohne JS für `/datenschutzprinzipien` | ✅ JA |
| Inhalt ohne JS für `/datenschutz`/`/impressum` | ❌ NEIN (leerer Body) |
| Eigene Titel für Rechtsseiten | ❌ NEIN für die ersten beiden |
| Eigen canonical für Rechtsseiten | ❌ NEIN |
| Sitemap 3 Rechtsseiten | ❌ NEIN |

## 8. Classification

**BLOCKER** für das Anliegen:

1. `/datenschutz` und `/impressum` sind als **SPA-Routen** konfiguriert und erhalten:
   - HTTP-Header: `X-Robots-Tag: noindex, nofollow`
   - HTML: `noindex,nofollow`
   - Body: `<div id="root"></div>` (leer, JS-ablhängig)

2. `/datenschutzprinzipien` ist bereits als **statische HTML-Datei** verfügbar, aber auch mit `noindex,nofollow`.

3. Die Sitemap listet **keine Rechtsseiten** und muss erweitert werden.

## 9. Evidence / file references

- Produktions-Abfrfen: `curl -sS https://www.mays-job-matcher.app/...` am 27.11.2026
- Repo-Dateien:
  - `vercel.json` (Rewrites und Headers)
  - `app.html` (SPA-Master-Template)
  - `src/lib/seoHead.ts` (Klientenseitige Noindex-Logik)
  - `public/legal/prinzipien.md` (Inhalt für `/datenschutzprinzipien`)
  - `public/sitemap.xml`

## 10. Recommended next actions (READ-ONLY)

Für die Indexierbarkeit der drei Rechtsseiten ist folgende Umsetzung erforderlich (nicht Teil dieses READ-ONLY-Audits):

### P1: HTTP-Header entfernen für Rechtsseiten

In `vercel.json`:
- Die Header-Einträge für `/datenschutz`, `/impressum` und `/datenschutzprinzipien` entfernen

### P2: HTML-Meta-Robots entfernen

In `app.html`:
- `noindex,nofollow` ggf. nur für SPA-Routen setzen (nicht für Rechtsseiten)

### P3: Statische HTML-Dateien für alle 3 Rechtsseiten erstellen

Ähnlich wie `/datenschutzprinzipien`:
- `public/datenschutz.html` mit vollständigem Inhalt
- `public/impressum.html` mit vollständigem Inhalt
- Beide mit `index,follow`, Canonical, Titel, Description

### P4: Sitemap erweitern

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.mays-job-matcher.app/</loc></url>
  <url><loc>https://www.mays-job-matcher.app/datenschutz</loc></url>
  <url><loc>https://www.mays-job-matcher.app/impressum</loc></url>
  <url><loc>https://www.mays-job-matcher.app/datenschutzprinzipien</loc></url>
</urlset>
```

### P5: SEO-Metadaten hinzufügen

Für jede Rechtsseite:
- Eindeutiger `<title>` (z.B. „Impressum – May's Job Matcher“)
- `<meta name="description">` mit kurzer Beschreibung
- `<link rel="canonical" href="...">` zur jeweiligen Seite

## 11. Open questions

- Wo befinden sich die vollständigen Rechtstexte für `/datenschutz` und `/impressum`?
  - `public/legal/datenschutz/*.html` existiert, aber nicht im Build-Output
  - Notwendig: Diese Dateien in das Build-System integrieren

- Wird `datenschutzprinzipien` bereits jetzt indexiert?
  - HTTP 200, aber `noindex,nofollow` – Google ignoriert es

## 12. Risks

- **Jetzt**: Alle 3 Rechtsseiten sind nicht indexierbar
- **Nach Änderung**: Rechtsseiten müssen korrekt indexiert werden
- **Sicherheitsaspekt**: Keine sensiblen Daten auf der Landingpage

## 13. Git status

Derzeit keine Änderungen (READ-ONLY-Audit).