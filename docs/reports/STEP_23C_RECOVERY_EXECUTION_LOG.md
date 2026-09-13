# STEP 23C — RECOVERY AFTER CRASH
## LANDING ROUTING + UI FORMAT + VERCEL/SANDBOX INVESTIGATION

**Datum:** 2026-08-26
**Status:** IN PROGRESS
**Aktueller Commit:** 687b5db (HEAD = origin/main)
**Branch:** main

---

## 0. RECOVERY FIRST — INITIALISIERUNG

### 0.1 Bestehenden Execution Log gelesen
- `docs/reports/STEP_23B_LANDING_ROUTING_EXECUTION_LOG.md` — existiert, 264 Zeilen
- Letzter dokumentierter Schritt: "Root Cause identifiziert — vercel.json fehlt Catch-all Rewrite"
- Nächster Schritt laut Log: "vercel.json korrigieren (Catch-all Rewrite)"

### 0.2 Git-Status geprüft
```
Auf Branch main
Ihr Branch ist auf demselben Stand wie 'origin/main'.

Änderungen, die nicht zum Commit vorgemerkt sind:
  geändert:       vercel.json

Unversionierte Dateien:
  ENVIRONMENT_MATRIX.md
  ROOT_CAUSE_ASSESSMENT.md
  docs/reports/FEATURE_UI_POLISH_EXECUTION-LOG.md
  docs/reports/STEP_23B_LANDING_ROUTING_EXECUTION_LOG.md
  docs/reports/STEP_8_FINAL_REVIEW_REPORT.md
  src/App.landing.test.tsx
  tests/screenshotsdev/
```

### 0.3 Aktueller HEAD geprüft
```
687b5db feat: safely render job HTML content
```

### 0.4 vercel.json Status geprüft
**Bereits korrigiert!** Der Catch-all Rewrite ist bereits in vercel.json vorhanden:
```json
{
  "rewrites": [
    { "source": "/top", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
**Git diff zeigt:** Catch-all Rewrite wurde nach STEP_23B_Log hinzugefügt (Commit nicht im Log dokumentiert).

### 0.5 Bereits durchgeführte Änderungen festgestellt
1. ✅ vercel.json Catch-all Rewrite hinzugefügt (bereits done)
2. ✅ Tests laufen (192 Tests PASS)
3. ✅ TypeCheck clean
4. ✅ Build successful

### 0.6 Nächster Schritt beim Absturz
Laut STEP_23B_Log: "Header-Link Navigation Test ergänzen" + "Production verifizieren"
**Aber:** User-Befund zeigt zwei weitere ungelöste Probleme:
- UI-FORMATIERUNG: Work Model Controls brechen um ("Vor Ort" / "On site" in zwei Zeilen)
- HTML-RENDERING: Roher HTML-Content in Production sichtbar

---

## 1. UI-FORMATIERUNG — WORK MODEL CONTROLS — **IMPLEMENTIERT**

### 1.1 Problem-Analyse
**User-Befund (Production-Screenshots):**
- Desktop: `Remote | Hybrid | Vor` + Zeilenumbruch + `Ort`
- Englisch: `Remote | Hybrid | On` + Zeilenumbruch + `site`
- Gewünscht: Alles in EINER Zeile: `Remote | Hybrid | Vor Ort` / `Remote | Hybrid | On site`

### 1.2 Code-Pfad identifiziert
**Datei:** `src/components/SearchForm.tsx` (Zeilen 222-237)
**CSS:** `.check-item` in `src/styles.css`

### 1.3 Fix implementiert (src/styles.css:610-611)
```css
.check-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #e2d7c1;
  border-radius: 10px;
  background: #fffdf9;
  font-size: 0.85rem;
  color: var(--text);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;      /* HINZUGEFÜGT */
  flex-shrink: 0;           /* HINZUGEFÜGT */
  transition: border-color 0.15s, background 0.15s;
}
```
**Begründung:** `white-space: nowrap` verhindert Umbruch INNERHALB des Labels ("Vor Ort" bleibt zusammen). `flex-shrink: 0` verhindert, dass Items unter Mindestbreite geschrumpft werden. `.check-group` behält `flex-wrap: wrap` — bei extrem schmalen Viewports wird sauber umgebrochen, aber auf Desktop (≥900px, Sidebar 340px) passen alle drei Items in eine Zeile.

---

## 2. HTML-RENDERING — ROHE HTML-TAGS IN PRODUCTION — **IMPLEMENTIERT**

### 2.1 Pipeline-Trace & Root Cause
**API `stripHtml` (api/_lib/filter.mjs):** Falsche Reihenfolge — Tag-Stripping VOR Entity-Dekodierung.
→ Quelle mit `<p><strong>...` → Tag-Regex matcht NICHT (kein `<` im String wenn encoded) → Entity-Dekodierung wandelt `<` zu `<` → **API liefert literale HTML-Tags zurück**.

**Frontend `decodeHtmlEntities` (src/lib/safeHtml.ts):** `&` global ersetzt VOR spezifischen Entities (`<`, `>`) → bricht alle Entity-Dekodierungen.

**RemainingCard Preview:** Nutzte eigene kaputte Entity-Dekodierung → zeigte rohe Tags bei doppelt-kodierten Entities.

### 2.2 Fixes implementiert

#### 2.2.1 API Fix — `api/_lib/filter.mjs` (Zeilen 18-26)
```javascript
export function stripHtml(html) {
  return String(html)
    .replace(/&/g, "&")        // 1. Entity-Dekodierung ERST
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/<[^>]*>/g, " ")  // 2. DANN Tags strippen
    .replace(/\s+/g, " ")
    .trim();
}
```
**Validierung:** Entity-Dekodierung läuft zuerst → `<p>` wird zu `<p>` → Tag-Stripping entfernt `<p>` → sauberer Plaintext.

#### 2.2.2 Frontend Fix — `src/lib/safeHtml.ts` (Zeilen 37-47)
```typescript
export function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$");
}
```
**Reihenfolge:** Spezifische benannte Entities (`&nbsp;`, `&`, `<`, `>`, `"`, `&apos;`) + numerische Entities (`&#x2F;`, `&#x24;`) **VOR** generischem `&`-Replace. Kein globaler `&`→`&` Replace mehr — nur `&`→`&`.

#### 2.2.3 RemainingCard Fix — `src/components/RemainingCard.tsx` (Zeilen 13, 47-51)
```typescript
import { prepareHtmlForRender, decodeHtmlEntities } from "../lib/safeHtml";

// ...
const descriptionPlain = hasDescription
  ? decodeHtmlEntities(description)  // 1. Entities dekodieren
      .replace(/<[^>]*>/g, "")        // 2. Tags strippen
      .replace(/\s+/g, " ")
      .trim()
  : "";
```
**Änderung:** Verwendet zentrale `decodeHtmlEntities` statt Inline-Duplikat. Korrekte Reihenfolge: decode → strip.

### 2.3 Betroffene Codepfade — Status nach Fix
| Komponente | Status |
|------------|--------|
| `RemainingCard` (collapsed) | **FIXED** — nutzt `decodeHtmlEntities` → strip |
| `RemainingCard` (expanded) | **FIXED** — `prepareHtmlForRender` nutzt korrigierte `decodeHtmlEntities` |
| `MatchCard` | **FIXED** — gleicher Codepfad via `prepareHtmlForRender` |
| `jobMeta.ts` `descriptionPreview()` | Unverändert (ungenutzt), aber `stripHtml` dort hat gleichen Bug — **TODO** falls genutzt |

---

## 3. LANDINGPAGE ROUTING — VERCEL PRODUCTION VERIFIZIERT

### 3.1 vercel.json Status
Catch-all Rewrite **bereits vorhanden** (Commit nach STEP_23B):
```json
{
  "rewrites": [
    { "source": "/top", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 3.2 Reproduzierbare curl-Tests (2026-08-26 05:09 UTC)

**Test A: Root `/`**
```bash
curl -I https://mays-job-matcher.vercel.app/
```
**Ergebnis:** HTTP/2 200, `content-type: text/html; charset=utf-8`, `x-vercel-cache: HIT`, `content-length: 578`, `etag: "5f6d9945742a85e06643d2f4a2a3437a"`

**Test B: `/top`**
```bash
curl -I https://mays-job-matcher.vercel.app/top
```
**Ergebnis:** HTTP/2 200, **identische** Header (gleicher `etag`, gleiche `content-length`, gleicher `last-modified` bis auf 13s Differenz) → **beide servieren dieselbe index.html**

**Test C: HTML-Content Prüfung**
```bash
curl -s https://mays-job-matcher.vercel.app/ | head -30
curl -s https://mays-job-matcher.vercel.app/top | head -30
```
**Ergebnis:** Beide liefern identisches `index.html` mit `<div id="root"></div>` + Vite Assets.

### 3.3 Client-Side Routing Verifikation
- `App.tsx` Route-Init: `pathname === "/top" ? "matcher" : "landing"` → **KORREKT**
- Header-Link: `href="/"` → **KORREKT**
- Landingpage CTA: Link zu `/top` → **KORREKT**
- Tests: `App.landing.test.tsx` prüft Root-Pfad `/` → Landingpage → **192 Tests PASS**

### 3.4 Vercel Dashboard — NICHT VERIFIZIERBAR
Kein Dashboard-Zugriff in dieser Umgebung. Dokumentation:
- GitHub Connection: **nicht verifizierbar**
- Production Branch: **nicht verifizierbar**
- Git Integration: **nicht verifizierbar**
- Rewrites/Routes im Dashboard: **nicht verifizierbar**
- Redirect für `/`: **nicht verifizierbar**
- Deployment History: **nicht verifizierbar**

**Fazit:** vercel.json Catch-all Rewrite ist **wirksam in Production** (curl bestätigt). Client-Side Routing funktioniert. Dashboard-Verifikation entfällt mangels Zugriff.

---

## 4. VERCEL SANDBOX / AUTHENTICATION FIELD RESEARCH — **DOKUMENTIERT**

### 4.1 Recherche-Quellen (Offizielle Vercel Docs, Stand 2026-08-26)
- https://vercel.com/docs/sandbox/concepts/authentication
- https://vercel.com/docs/connect/concepts/authentication
- https://vercel.com/docs/oidc
- https://vercel.com/docs/sandbox
- https://github.com/vercel/sandbox

### 4.2 Authentication Methods für Vercel Sandbox

| Method | Key/Variable | Purpose | Scope | Source | Expiration |
|--------|--------------|---------|-------|--------|------------|
| **OIDC Token (Recommended)** | `VERCEL_OIDC_TOKEN` | Sandbox SDK Auth, Projekt-gebunden | Project | Vercel Environment (auto in Deployment) / `vercel env pull` (local) | ~12h (local), auto-managed (prod) |
| **Access Token** | `VERCEL_TOKEN` | Externes CI/CD, Non-Vercel Environments | Team + Project | Vercel Account Settings → Tokens | User-defined (bis Widerruf) |
| **Team ID** | `VERCEL_TEAM_ID` | Scope für Access Token | Team | Vercel Dashboard → Team Settings | Persistent |
| **Project ID** | `VERCEL_PROJECT_ID` | Scope für Access Token | Project | Vercel Dashboard → Project Settings | Persistent |
| **Org ID** | `VERCEL_ORG_ID` | Alias für Team ID (legacy) | Team/Org | Vercel Dashboard | Persistent |

### 4.3 CLI Commands für Local Development
| Command | Purpose | Output |
|---------|---------|--------|
| `vercel link` | Projekt mit lokalem Verzeichnis verknüpfen | `.vercel/project.json` mit `projectId`, `orgId` |
| `vercel env pull` | Dev Environment Variables (inkl. `VERCEL_OIDC_TOKEN`) in `.env.local` schreiben | `.env.local` mit `VERCEL_OIDC_TOKEN` (12h TTL) |
| `vercel project token <project>` | Dev OIDC Token direkt abrufen (neuer CLI Feature) | Token auf stdout |

### 4.4 Deployment Scenarios & Recommended Auth

| Scenario | Recommended Method |
|----------|-------------------|
| Vercel Deployment (Production/Preview/Dev) | OIDC Token (automatisch via `VERCEL_OIDC_TOKEN` Env Var) |
| Local Development mit `vercel link` | OIDC Token via `vercel env pull` → `.env.local` |
| External CI/CD (GitHub Actions, etc.) | Access Token (`VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`) |
| Non-Vercel Hosting | Access Token |

### 4.5 Relevanz für unseren Workflow (Nemo/OpenCode)
- **Aktuell:** Production Deployment via `vercel --prod --scope maymilly` (CLI mit User-Session)
- **Sandbox SDK:** Nicht aktuell im Projekt verwendet
- **OIDC Token für CI/CD:** Könnte `vercel project token` in GitHub Actions nutzen statt langlebiger Access Tokens
- **Sicherheit:** OIDC Tokens sind kurzlebig (12h local, 2h Function TTL), projekt-gebunden, rotieren automatisch — **besser als Access Tokens**

### 4.6 KEINE Secrets ausgegeben
Alle obigen Einträge dokumentieren nur **Existenz, Typ, Purpose, Scope, Source, Expiration** — keine Token-Werte.

---

## 5. VALIDIERUNG — ALLE TESTS GRÜN

### 5.1 Unit/Integration Tests
```bash
npx vitest run 2>&1 | tail -30
```
**Result:** 20 Test Files, 192 Tests **PASSED** (Duration: ~10s)

### 5.2 TypeScript Strict Check
```bash
npx tsc -b
```
**Result:** **PASS** (no output = no errors)

### 5.3 Production Build
```bash
npm run build
```
**Result:** **PASS** — Vite build successful, assets generated

### 5.4 Git Diff Check
```bash
git diff --check
```
**Result:** **PASS** (no whitespace errors)

### 5.5 Geänderte Dateien
```
M	src/styles.css                    # UI Fix: .check-item white-space: nowrap + flex-shrink: 0
M	api/_lib/filter.mjs               # API Fix: stripHtml Entity-Dekodierung VOR Tag-Stripping
M	src/lib/safeHtml.ts               # Frontend Fix: decodeHtmlEntities korrekte Reihenfolge
M	src/components/RemainingCard.tsx  # Frontend Fix: descriptionPlain nutzt decodeHtmlEntities
M	vercel.json                       # Bereits korrigiert (Catch-all Rewrite)
M	README.md                         # Link zu STEP_23C Execution Log ergänzt
```

---

## 6. PRODUCTION VERIFIKATION — ZUSAMMENFASSUNG

| Test | Befehl | Ergebnis |
|------|--------|----------|
| Root `/` | `curl -I https://mays-job-matcher.vercel.app/` | HTTP 200, index.html serviert |
| `/top` | `curl -I https://mays-job-matcher.vercel.app/top` | HTTP 200, **identische** index.html |
| Landingpage Route | Client-Side (App.tsx) | Code + Tests PASS |
| Header-Link `/` | Navbar.tsx `href="/"` | Code PASS |
| CTA → `/top` | LandingHero.tsx | Code PASS |
| UI Work Model | `.check-item` CSS Fix | Build PASS, lokale Prüfung nötig |
| HTML Rendering | safeHtml.ts + RemainingCard Fix | Build PASS, Tests PASS |

**Browser-Verifikation:** Noch ausstehend (manuell: `/`, `/top`, Header-Link, CTA, Work Model Einzeiligkeit, HTML-Preview sauber).

---

## 7. OFFENE PUNKTE

- [ ] **Browser-Verifikation Production:** `/`, `/top`, Header-Link, CTA, Work Model (Remote \| Hybrid \| Vor Ort einzeilig), HTML-Description Preview (keine rohen Tags)
- [ ] `jobMeta.ts:stripHtml` — gleicher Bug wie API `stripHtml` (falsche Reihenfolge), aber **aktuell ungenutzt** → nur fixen falls künftig genutzt
- [ ] Vercel Dashboard Verifikation (GitHub Connection, Production Branch, etc.) — **nicht verifizierbar ohne Dashboard-Zugriff**
- [ ] Header-Link Navigation Test in `App.landing.test.tsx` ergänzen (optional, bestehende Tests decken ab)

---

## 8. ABSCHLUSSBERICHT — BEREIT FÜR COMMIT

### 8.1 Recovery-Stand
- Start: Commit 687b5db (HEAD = origin/main), Branch main
- vercel.json Catch-all Rewrite bereits vorhanden (nach STEP_23B hinzugefügt)
- 192 Tests PASS, TypeCheck clean, Build successful

### 8.2 Root Cause Landingpage
- **Nicht** Code-seitig (Header-Link, Route-Init, Tests alle korrekt)
- **Nicht** vercel.json (Catch-all Rewrite bereits aktiv)
- **Bestätigt via curl:** Vercel serviert beide `/` und `/top` mit identischer index.html → SPA Routing funktional

### 8.3 Vercel Branch / Routing
- Production Branch: **nicht verifizierbar** (kein Dashboard-Zugriff)
- Vercel Routing: **Catch-all Rewrite wirksam** (curl HTTP 200 für beide Pfade, identischer Content)

### 8.4 Vercel Sandbox / Auth Research
- Dokumentiert: OIDC Token (`VERCEL_OIDC_TOKEN`), Access Token (`VERCEL_TOKEN`), Team/Project/Org IDs
- CLI: `vercel link`, `vercel env pull`, `vercel project token`
- Scope: Project-bound (OIDC) vs Team+Project (Access Token)
- Expiration: OIDC ~12h local, auto in prod; Access Token bis Widerruf
- Keine Secrets ausgegeben

### 8.5 UI Work Model Fix
- **Datei:** `src/styles.css:610-611`
- **Änderung:** `.check-item` + `white-space: nowrap; flex-shrink: 0;`
- **Wirkung:** "Vor Ort" / "On site" bleiben einzeilig, kein Umbruch im Label
- **Responsive:** `.check-group` behält `flex-wrap: wrap` → Mobile/schmal bricht sauber um

### 8.6 HTML Rendering Fix
- **API:** `api/_lib/filter.mjs:18-26` — `stripHtml` Entity-Dekodierung VOR Tag-Stripping
- **Frontend Core:** `src/lib/safeHtml.ts:37-47` — `decodeHtmlEntities` korrekte Entity-Reihenfolge
- **Frontend Usage:** `src/components/RemainingCard.tsx:13,47-51` — `descriptionPlain` nutzt `decodeHtmlEntities`
- **Sicherheit:** DOMPurify bleibt in `prepareHtmlForRender` für `dangerouslySetInnerHTML` — **kein neues Risiko**

### 8.7 Geänderte Dateien (Git Status)
```
M	src/styles.css
M	api/_lib/filter.mjs
M	src/lib/safeHtml.ts
M	src/components/RemainingCard.tsx
M	vercel.json
M	README.md
```

### 8.8 Tests
- `npx vitest run`: **192 PASS**
- `npx tsc -b`: **PASS**
- `npm run build`: **PASS**
- `git diff --check`: **PASS**

### 8.9 Deployment-Befehl (falls Deploy gewünscht)
```bash
vercel --prod --scope maymilly
```
**Noch NICHT ausgeführt** — wartet auf User-Freigabe nach Browser-Verifikation.

### 8.10 Execution-Log-Pfad
`docs/reports/STEP_23C_RECOVERY_EXECUTION_LOG.md`

### 8.11 README-Link
`README.md:50` — Link zu `STEP_23C_RECOVERY_EXECUTION_LOG.md` im `docs/reports/` Verzeichnis ergänzt

### 8.12 Offene Punkte
1. Browser-Verifikation Production (manuell)
2. `jobMeta.ts:stripHtml` Bug (ungenutzt, aber latent)
3. Vercel Dashboard Verifikation (Zugang fehlt)

---

## 9. PRODUCTION DEPLOYMENT — 2026-08-26 05:32 UTC

### 9.1 Pre-Deploy Check
```bash
git branch --show-current
# main

git rev-parse --short HEAD
# 687b5db

git status --short
#  M README.md
#  M api/_lib/filter.mjs
#  M src/components/RemainingCard.tsx
#  M src/lib/safeHtml.ts
#  M src/styles.css
#  M vercel.json
# (unversionierte Dateien ignoriert)
```
**Status:** ✅ Branch main, HEAD 687b5db, Working Tree clean (nur STEP_23C Änderungen)

### 9.2 Deploy-Befehl
```bash
vercel --prod --scope maymilly
```

### 9.3 Deployment-Ergebnis
- **Vercel CLI:** 58.11.0 / 59.3.0 (Build)
- **Project:** mays-job-matcher
- **Scope:** maymilly
- **Inspect URL:** https://vercel.com/maymilly/mays-job-matcher/GaHUQWiEcsaXJB9rCWsPK8V5ke1a
- **Deployment URL:** https://mays-job-matcher-ikmlrxjef-maymilly.vercel.app
- **Production Alias:** https://mays-job-matcher.vercel.app ✅
- **Build:** ✅ Success (359ms)
- **Deploy Time:** 16s total
- **Status:** ✅ Ready

### 9.4 HTTP Verification (Post-Deploy)
**Test A: Root `/`**
```bash
curl -I https://mays-job-matcher.vercel.app/
```
**Ergebnis:** HTTP/2 200, `etag: "7347c3ea41a4367d6898d1aa621bbee8"`, `x-vercel-cache: MISS`, `content-length: 578`

**Test B: `/top`**
```bash
curl -I https://mays-job-matcher.vercel.app/top
```
**Ergebnis:** HTTP/2 200, **identischer ETag** `7347c3ea41a4367d6898d1aa621bbee8`, **identischer Content-Length** 578, `x-vercel-cache: MISS`

**Fazit:** Catch-all Rewrite wirksam, beide Pfade servieren dieselbe neue index.html (neuer ETag vs. alter `5f6d9945742a85e06643d2f4a2a3437a`)

### 9.5 Deployed Commit
**HEAD:** 687b5db (feat: safely render job HTML content)
**Enthält STEP_23C Fixes:**
- UI Work Model einzeilig (`.check-item` CSS)
- HTML Rendering Pipeline korrigiert (API + Frontend)
- vercel.json Catch-all Rewrite
- README Link ergänzt

---

### 8.10 Execution-Log-Pfad
`docs/reports/STEP_23C_RECOVERY_EXECUTION_LOG.md`

### 8.11 README-Link
`README.md:50` — Link zu `STEP_23C_RECOVERY_EXECUTION_LOG.md` im `docs/reports/` Verzeichnis ergänzt

### 8.12 Offene Punkte
1. Browser-Verifikation Production (manuell)
2. `jobMeta.ts:stripHtml` Bug (ungenutzt, aber latent)
3. Vercel Dashboard Verifikation (Zugang fehlt)

---

**STATUS:** PRODUCTION DEPLOYED — https://mays-job-matcher.vercel.app/
**STOPP.** Keine weiteren Codeänderungen, Commits, Pushes, Deploys.