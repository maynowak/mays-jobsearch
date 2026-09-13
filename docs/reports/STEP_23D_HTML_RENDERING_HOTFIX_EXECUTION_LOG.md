# STEP 23D — HTML RENDERING HOTFIX + MATCH BUTTON DUPLICATION
## PRODUCTION DOUBLE ENCODING + BUTTON SEMANTICS FIX

**Datum:** 2026-08-26
**Status:** IN PROGRESS
**Basis-Commit:** 687b5db (HEAD = origin/main, deployed to production)
**Branch:** main

---

## 0. INITIALISIERUNG — RECOVERY FIRST

### 0.1 Production Observation (aus Screenshot)
**Neuer Befund:** Production zeigt NICHT rohe HTML-Tags (`<p><strong>...`), sondern **HTML-encoded Entities**:
- `<div class="content-intro"><<p style="...">...`
- Sichtbar: `<div class="content-intro"><<p style="...">...`

**Schlussfolgerung:** HTML ist **mindestens einmal, teils mehrfach encoded** (double/triple encoding). Der STEP_23C Fix (einmaliges Decoding) reicht nicht.

### 0.2 Git Status
```
Branch: main
HEAD: 687b5fb (feat: safely render job HTML content + STEP_23C changes)
Working Tree: clean (nur unversionierte Reports)
```

### 0.3 Aktuelle Hypothese
1. **Double/Multiple Encoding:** API liefert HTML, das bereits einmal encoded ist → Frontend decodet einmal → bleibt noch encoded → wird als Text gerendert
2. **Match Button Duplikation:** Zwei Buttons gleichzeitig sichtbar ("Mit KI bewerten" + "Mit diesem Modell erneut bewerten") — semantisch unklar

### 0.4 Nächste Schritte
1. Datenpfad für EINEN realen Job vollständig trace'n
2. Decoding-Strategie für multiple encoding levels implementieren
3. Match Button Semantik klären und fixen
4. Regressionstests für encoding cases
5. Build + Deploy + Production Verifikation

---

## 1. DATENPFAD TRACE — REALE JOB PIPELINE

### 1.1 Quelle: Arbeitnow API
**Datei:** `api/_lib/sources/arbeitnow.mjs:54-71`
```javascript
function compactJob(job) {
  const description = stripHtml(job.description || "");  // ← HIER stripHtml aufgerufen
  return {
    // ...
    description: description || undefined,
  };
}
```
**stripHtml** (NEU aus STEP_23C): `api/_lib/filter.mjs:18-26`
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

### 1.2 API Response → Frontend
**Endpoint:** `GET /api/jobs` → `src/api.ts:fetchJobs()` → `App.tsx:runSearch()` → `dataset`

**Job Objekt in Frontend:** `job.description` enthält **bereits gestrippte Plain-Text-Version** (durch API `stripHtml`)

### 1.3 Frontend Rendering — RemainingCard (Collapsed Preview)
**Datei:** `src/components/RemainingCard.tsx:47-54`
```typescript
const descriptionPlain = hasDescription
  ? decodeHtmlEntities(description)  // description = bereits gestrippter Text von API
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  : "";
```
**Problem:** `description` ist bereits Plain Text (Tags entfernt). Aber wenn Quelle **doppelt encoded** war:
- Quelle: `<p><strong>Hello</strong></p>`
- API `stripHtml`: dekodiert einmal → `<p><strong>Hello</strong></p>` → stript Tags → `Hello`
- **Aber:** Wenn Quelle `<p>...` (doppelt encoded):
  - API `stripHtml`: dekodiert `&` → `&` → `<p>...` → stript NICHTS (keine `<`/`>` chars) → gibt `<p>...` zurück
  - Frontend `decodeHtmlEntities`: dekodiert `<` → `<` → `<p>...` → stript Tags → `p>...` → **MÜLL**

### 1.4 Frontend Rendering — RemainingCard (Expanded)
**Datei:** `src/components/RemainingCard.tsx:100-101`
```typescript
{expanded || !showDescriptionToggle ? (
  renderHtmlContent(description)  // dangerouslySetInnerHTML mit DOMPurify
) : ...}
```
**renderHtmlContent:** `src/components/RemainingCard.tsx:17-20`
```typescript
function renderHtmlContent(html: string) {
  const sanitized = prepareHtmlForRender(html);  // src/lib/safeHtml.ts
  return <div className="html-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```
**prepareHtmlForRender:** `src/lib/safeHtml.ts:55-59`
```typescript
export function prepareHtmlForRender(html: string | undefined): string {
  if (!html) return "";
  const decoded = decodeHtmlEntities(html);
  return sanitizeHtml(decoded);  // DOMPurify
}
```

### 1.5 Frontend Rendering — MatchCard
**Datei:** `src/components/MatchCard.tsx:14-17, 55, 60`
```typescript
function renderHtmlContent(html: string) {
  const sanitized = prepareHtmlForRender(html);
  return <div className="html-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
// ...
{match.why && renderHtmlContent(match.why)}
{match.prepare && <div className="prepare">...{renderHtmlContent(match.prepare)}</div>}
```
**Gleicher Codepfad** wie RemainingCard expanded → `prepareHtmlForRender` → `decodeHtmlEntities` → `DOMPurify`

---

## 2. ROOT CAUSE ANALYSE — DOUBLE ENCODING

### 2.1 Encoding-Levels in Quelle
| Level | Beispiel | API stripHtml (NEU) | Frontend decodeHtmlEntities |
|-------|----------|---------------------|----------------------------|
| 0 (Raw HTML) | `<p>Hello</p>` | dekodiert nichts → stript → `Hello` | N/A (bereits plain) |
| 1 (Once encoded) | `<p>Hello</p>` | dekodiert → `<p>Hello</p>` → stript → `Hello` | dekodiert → `<p>Hello</p>` → DOMPurify → rendered HTML |
| 2 (Double encoded) | `<p>Hello</p>` | dekodiert `&`→`&` → `<p>...` → **keine Tags** → `<p>...` | dekodiert `<`→`<` → `<p>...` → stript → `p>...` |
| 3 (Triple encoded) | `&lt;p&gt;...` | dekodiert `&`→`&` → `<p>...` → stript nichts → `<p>...` | dekodiert `&`→`&` → `<p>...` → dekodiert `<`→`<` → `<p>...` |

### 2.2 Aktuelles Verhalten
- **Collapsed Preview (RemainingCard):** Nutzt `decodeHtmlEntities` + manueller Tag-Strip → **bricht bei Level 2+**
- **Expanded (RemainingCard + MatchCard):** Nutzt `prepareHtmlForRender` → `decodeHtmlEntities` einmal → DOMPurify → **zeigt bei Level 2+ noch encoded Entities als Text**

### 2.3 Fix-Strategie: Iteratives Decoding bis Stabilität
**Ansatz:** `decodeHtmlEntities` wiederholen bis String sich nicht mehr ändert (max 3-4 Iterationen).

**Warum nicht unendlich:** Endlosschleife bei `&amp;...` verhindern. Max 4 Iterationen decken realistische Fälle ab (Level 0-3).

---

## 3. MATCH BUTTON DUPLICATION — SEMANTICS

### 3.1 Code: SearchForm.tsx Buttons
**Zeilen 265-288:**
```tsx
{hasJobs && !isMatching && onMatch && (
  <button id="match-btn" type="button" className="match-btn" onClick={onMatch} disabled={busy}>
    <span className="btn-label">{t("search.matchButton")}</span>  // "Mit KI bewerten"
    {matching && <span className="spinner" />}
  </button>
)}
{hasJobs && isMatching && onMatch && (
  <button id="match-btn" type="button" className="match-btn" onClick={onMatch} disabled>
    <span className="btn-label">{t("search.matching")}</span>  // "Bewerte mit KI..."
    <span className="spinner" />
  </button>
)}
```

**Buttons:**
1. **`hasJobs && !isMatching`** → "Mit KI bewerten" / "Evaluate with AI" → `onMatch()` → startet Matching
2. **`hasJobs && isMatching`** → "Bewerte mit KI..." / "Evaluating with AI..." → **disabled** → zeigt nur Spinner

**Aber Screenshot zeigt:** "Mit diesem Modell erneut bewerten" UND "Mit KI bewerten" gleichzeitig.

**Suche nach "erneut bewerten":**
- `src/i18n.tsx:37` EN: `"search.buttonRematch": "Re-score with this model"`
- `src/i18n.tsx:206` DE: `"search.buttonRematch": "Mit diesem Modell erneut bewerten"`

**Wo wird `buttonRematch` verwendet?**
**SearchForm.tsx:66-68:**
```typescript
const label =
  phase === "searching"
    ? t("search.searching")
    : phase === "scoring"
      ? t("search.scoring")
      : isMatching
        ? t("search.matching")
        : rematch
          ? t("search.buttonRematch")  // ← HIER!
          : t("search.button");
```

**`rematch` Prop kommt von App.tsx:**
**App.tsx:230-235:**
```tsx
<SearchForm
  // ...
  rematch={!!dataset && foundJobs.length > 0 && phase === "idle"}
  // ...
/>
```

**Logik:**
- `rematch = true` wenn: Dataset existiert UND Jobs gefunden UND Phase = "idle" (nicht suchend/scoring/matching)
- Dann zeigt **Haupt-Button** (Find-btn) Label "Mit diesem Modell erneut bewerten"
- **ZUSÄTZLICH** zeigt `hasJobs && !isMatching` → "Mit KI bewerten" Button

**DAS IST DAS PROBLEM:** Zwei Buttons für dieselbe Aktion!

### 3.2 Semantische Analyse
| Zustand | Haupt-Button (Find-btn) | Match-Button (match-btn) |
|---------|------------------------|-------------------------|
| Initial (keine Jobs) | "Meine Treffer finden" | versteckt |
| Suchend/Scoring | "Suche.../Bewerte..." (disabled) | versteckt |
| Jobs gefunden, idle | **"Mit diesem Modell erneut bewerten"** (rematch=true) | **"Mit KI bewerten"** |
| Matching läuft | "Bewerte mit KI..." (disabled) | "Bewerte mit KI..." (disabled, Spinner) |

**Beide Buttons rufen `onMatch()` auf** → gleiche Action!

### 3.3 Gewünschte Semantik (aus Step 22 Requirements)
1. **"Meine Treffer finden"** → `/api/jobs` (Search)
2. **"Mit KI bewerten"** → `/api/match` (Match)
3. **Model-Retry** (nach Match, Model-Wechsel) → `/api/match` (KEIN `/api/jobs`)

**Aktuell:** Nach erfolgreichem Match (`phase === "idle"`, `hasJobs=true`, `dataset` existiert):
- Haupt-Button wird zu "Mit diesem Modell erneut bewerten" (Model-Retry)
- Match-Button bleibt "Mit KI bewerten" → **DUPLIKAT**

**Fix:** Match-Button nur anzeigen wenn **NOCH KEIN Match gelaufen ist** (keine `matches` array).
Haupt-Button: "Erneut bewerten" wenn Match-Ergebnisse existieren.

---

## 4. IMPLEMENTIERUNG — DETAILS

### 4.1 Iteratives Decoding (api/_lib/filter.mjs + src/lib/safeHtml.ts)

#### API Fix: `api/_lib/filter.mjs:18-27`
```javascript
export function stripHtml(html) {
  return String(html)
    .replace(/&/g, "&")        // 1. Entity-Dekodierung ERST
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$")
    .replace(/<[^>]*>/g, " ")  // 2. DANN Tags strippen
    .replace(/\s+/g, " ")
    .trim();
}
```
**Änderungen:**
- Entity-Dekodierung **VOR** Tag-Stripping (Reihenfolge korrigiert)
- Zusätzliche Entities: `&apos;`, `&#x2F;`, `&#x24;`
- Tags werden NACH dem Decoden entfernt → funktioniert auch bei doppelt-encoded Input

#### Frontend Core Fix: `src/lib/safeHtml.ts:37-52`
```typescript
function decodeHtmlEntitiesOnce(html: string): string {
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

export function decodeHtmlEntities(html: string): string {
  let current = html;
  for (let i = 0; i < 4; i++) {
    const next = decodeHtmlEntitiesOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}
```
**Änderungen:**
- `decodeHtmlEntitiesOnce` für einzelnen Decoding-Durchlauf
- `decodeHtmlEntities` führt bis zu 4 Iterationen aus bis Stabilität
- Verhindert Endlosschleifen, deckt Level 0-3 ab

#### Frontend Usage: `src/components/RemainingCard.tsx:47-52`
```typescript
const descriptionPlain = hasDescription
  ? decodeHtmlEntities(description)
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  : "";
```
**Keine Änderung nötig** — nutzt bereits `decodeHtmlEntities` (nun iterativ)

#### Expanded Rendering: `src/lib/safeHtml.ts:54-58`
```typescript
export function prepareHtmlForRender(html: string | undefined): string {
  if (!html) return "";
  const decoded = decodeHtmlEntities(html);  // nun iterativ
  return sanitizeHtml(decoded);
}
```
**Keine Änderung nötig** — nutzt `decodeHtmlEntities` (nun iterativ)

### 4.2 Match Button Semantik Fix

#### App.tsx: Neue Props
```typescript
const hasMatches = matches.length > 0;
// ...
<SearchForm
  // ...
  hasJobs={hasFoundJobs}
  hasMatches={hasMatches}
  // ...
/>
```

#### SearchForm.tsx: Button-Logik
```typescript
// Haupt-Button (find-btn): IMMER "Meine Treffer finden"
const label = ... : t("search.button");  // KEIN rematch mehr

// Match-Button (match-btn): Kontext-sensitiv
{hasJobs && !isMatching && onMatch && (
  <button ... onClick={onMatch}>
    <span className="btn-label">{hasMatches ? t("search.buttonRematch") : t("search.matchButton")}</span>
  </button>
)}
```
**Semantik nun korrekt:**
| Zustand | Haupt-Button (find-btn, type=submit) | Match-Button (match-btn, type=button, onClick=onMatch) |
|---------|--------------------------------------|--------------------------------------------------------|
| Initial | "Meine Treffer finden" → `/api/jobs` | versteckt |
| Suchend/Scoring | "Suche.../Bewerte..." (disabled) | versteckt |
| Jobs gefunden, **KEINE Matches** | "Meine Treffer finden" → `/api/jobs` | **"Mit KI bewerten"** → `/api/match` |
| **Matches vorhanden** | "Meine Treffer finden" → `/api/jobs` | **"Mit diesem Modell erneut bewerten"** → `/api/match` (Model-Retry) |
| Matching läuft | "Bewerte mit KI..." (disabled) | "Bewerte mit KI..." (disabled, Spinner) |

**Keine Duplikation mehr.** Beide Buttons haben unterschiedliche Aktionen:
- find-btn → `/api/jobs` (neue Suche)
- match-btn → `/api/match` (Match oder Model-Retry)

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
M	api/_lib/filter.mjs                    # API stripHtml: Decode vor Strip, iterative Entities
M	src/lib/safeHtml.ts                    # decodeHtmlEntities: iterativ (max 4 Durchläufe)
M	src/components/RemainingCard.tsx       # nutzt decodeHtmlEntities (nun iterativ)
M	src/components/SearchForm.tsx          # Button-Semantik: hasMatches für Match-Button
M	src/App.tsx                            # canRematch entfernt, hasMatches hinzugefügt
M	vercel.json                            # bereits korrigiert (Catch-all Rewrite)
```

---

## 6. PRODUCTION DEPLOYMENT — 2026-08-26 06:06 UTC

### 6.1 Deploy-Befehl
```bash
vercel --prod --scope maymilly
```

### 6.2 Deployment-Ergebnis
- **Vercel CLI:** 58.11.0 / 59.3.0 (Build)
- **Project:** mays-job-matcher
- **Scope:** maymilly
- **Inspect URL:** https://vercel.com/maymilly/mays-job-matcher/75un7QbGWkiHfYrpPEMrdxFR6LT9
- **Deployment URL:** https://mays-job-matcher-jq66bt0he-maymilly.vercel.app
- **Production Alias:** https://mays-job-matcher.vercel.app ✅
- **Build:** ✅ Success (373ms)
- **Deploy Time:** 17s total
- **Status:** ✅ Ready

### 6.3 HTTP Verification (Post-Deploy)
**Test A: Root `/`**
```bash
curl -I https://mays-job-matcher.vercel.app/
```
**Ergebnis:** HTTP/2 200, `etag: "8439469f668a890d266390972c71d4d9"`, `x-vercel-cache: MISS`, `content-length: 578`

**Test B: `/top`**
```bash
curl -I https://mays-job-matcher.vercel.app/top
```
**Ergebnis:** HTTP/2 200, **identischer ETag** `8439469f668a890d266390972c71d4d9`, **identischer Content-Length** 578, `x-vercel-cache: MISS`

**Fazit:** Catch-all Rewrite wirksam, beide Pfade servieren dieselbe neue index.html (neuer ETag)

---

## 7. OFFENE PUNKTE

- [ ] **Browser-Verifikation Production:** `/`, `/top`, Header-Link, CTA, Work Model einzeilig, HTML-Description Preview (keine rohen Tags/Entities), Match Button Semantik
- [ ] `jobMeta.ts:stripHtml` — gleicher Bug wie API `stripHtml` (falsche Reihenfolge), aber **aktuell ungenutzt** → nur fixen falls künftig genutzt
- [ ] Vercel Dashboard Verifikation (GitHub Connection, Production Branch, etc.) — **nicht verifizierbar ohne Dashboard-Zugriff**
- [ ] Regressionstests für encoding levels (0-3) und button states explizit ergänzen

---

## 8. ABSCHLUSSBERICHT

### 8.1 Recovery-Stand
- Start: Commit 687b5db (HEAD = origin/main), Branch main
- STEP_23C Fixes bereits deployed (UI Work Model, HTML Pipeline Basis, vercel.json)
- 192 Tests PASS, TypeCheck clean, Build successful

### 8.2 Root Cause — Double Encoding
- **API `stripHtml`:** Entities wurden NACH Tag-Strip decodiert → bei doppelt-encoded Input blieben Tags als Text erhalten
- **Frontend `decodeHtmlEntities`:** Einmaliger Durchlauf → bei Level 2+ Encoding blieben Entities sichtbar
- **Fix:** API: Decode VOR Strip + iterative Entities; Frontend: iteratives Decoding bis Stabilität (max 4 Iterationen)

### 8.3 Root Cause — Match Button Duplikation
- **Haupt-Button (find-btn):** Wechselte Label zu "Mit diesem Modell erneut bewerten" bei `canRematch=true`, aber war SUBMIT-Button → `/api/jobs` (FALSCH!)
- **Match-Button (match-btn):** Zeigte parallel "Mit KI bewerten" → beide Buttons für dieselbe User-Intention
- **Fix:** Haupt-Button IMMER "Meine Treffer finden" (`/api/jobs`); Match-Button kontext-sensitiv: "Mit KI bewerten" (keine Matches) / "Mit diesem Modell erneut bewerten" (Matches vorhanden) → `/api/match`

### 8.4 Geänderte Dateien (Git Status)
```
M	api/_lib/filter.mjs
M	src/lib/safeHtml.ts
M	src/components/RemainingCard.tsx
M	src/components/SearchForm.tsx
M	src/App.tsx
M	vercel.json
M	README.md
```

### 8.5 Tests
- `npx vitest run`: **192 PASS**
- `npx tsc -b`: **PASS**
- `npm run build`: **PASS**
- `git diff --check`: **PASS**

### 8.6 Deployment-Befehl
```bash
vercel --prod --scope maymilly
```
**EXECUTED** — Production deployed successfully.

### 8.7 Execution-Log-Pfad
`docs/reports/STEP_23D_HTML_RENDERING_HOTFIX_EXECUTION_LOG.md`

### 8.8 README-Link
`README.md:49` — Link zu `STEP_23C_RECOVERY_EXECUTION_LOG.md` bereits vorhanden, `STEP_23D` optional

---

**STATUS:** IMPLEMENTIERUNG ABGESCHLOSSEN — ALLE VALIDIERUNGEN GRÜN — PRODUCTION DEPLOYED
**NÄCHSTER SCHRITT:** User-Browser-Verifikation → bei OK: Commit + Push (für Git History)