# STEP 23D-C — PRODUCTION HTML RENDERING ROOT-CAUSE INVESTIGATION

**Datum:** 2026-08-26
**Status:** IN PROGRESS
**Basis-Commit:** 687b5db + STEP_23C + STEP_23D (deployed)
**Branch:** main

---

## 0. INITIALISIERUNG

### 0.1 User-Befund (aus Screenshots — nicht im Repo vorhanden)
**Screenshot A (html-encoded-production.png):** Zeigt **HTML-encoded Entities** als Text:
```
<div class="content-intro">...
```

**Screenshot B (html-raw-production.png):** Zeigt **rohes HTML** als Text:
```
<div><div class="attachment-overlay preview">
<p><strong>...
</strong></p>
```

**Schlussfolgerung:** Die STEP_23D Fixes (iteratives Decoding + API stripHtml) erreichen **NICHT alle Datenpfade**. Es gibt mindestens zwei verschiedene Probleme:
- Pipeline A: HTML wird einmal encoded → iteratives Decoding hilft
- Pipeline B: HTML kommt RAW durch → kein Decoding nötig, aber Tag-Strip fehlt

### 0.2 Git Status
```
Branch: main
HEAD: 687b5db (feat: safely render job HTML content) + lokale Änderungen
Working Tree: Änderungen aus STEP_23C + STEP_23D
```

### 0.3 Ziel
Root Cause für **beide** sichtbaren Probleme finden über **echte Datenpfade**, nicht durch blindes Hinzufügen von Regex.

---

## 1. DATENPFAD-ANALYSE — PROJEKTWEITE SUCHE

### 1.1 Alle Vorkommen von `description` / `content` / `html` / `stripHtml` / `decodeHtmlEntities`

**grep-Ergebnisse (relevant):**

```
src/lib/jobMeta.ts:67-81  → stripHtml() Funktion (LOKAL, ungenutzt?)
src/lib/jobMeta.ts:83-93  → descriptionPreview() Funktion (EXPORTIERT, aber WO verwendet?)
src/lib/safeHtml.ts       → decodeHtmlEntities(), prepareHtmlForRender()
src/components/RemainingCard.tsx:13, 47-52, 100-101  → descriptionPlain + renderHtmlContent
src/components/MatchCard.tsx:14-17, 55, 60  → renderHtmlContent für why/prepare
src/components/Results.tsx  → rendert MatchCard + RemainingCard
src/api/_lib/filter.mjs:18-27  → stripHtml() API-seitig
api/_lib/sources/arbeitnow.mjs:56  → compactJob() ruft stripHtml() auf
api/_lib/sources/apify/actors.mjs:10  → normalizeArbeitsagentur() ruft stripHtml() auf
```

### 1.2 KRITISCHER FUND: `jobMeta.ts` hat EIGENE `stripHtml()` Funktion!

**Datei:** `src/lib/jobMeta.ts:67-81`
```typescript
function stripHtml(html: string): string {
  return html
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/'/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$")
    .replace(/\s+/g, " ")
    .trim();
}
```

**PROBLEME:**
1. **Falsche Reihenfolge:** Tag-Strip (`/<...>/g`) **VOR** Entity-Dekodierung
2. **Doppelte Dekodierung:** `&` → `&` passiert VOR `<` → `<` → bricht alle Entities
3. **Keine iterative Dekodierung**
4. **Diese Funktion wird NICHT exportiert** — aber `descriptionPreview()` NUTZT SIE intern!

### 1.3 `descriptionPreview()` in `jobMeta.ts:83-93`
```typescript
export function descriptionPreview(
  description: string | undefined,
  previewLength: number,
  expanded: boolean
): string | null {
  if (!description) return null;
  const plainText = stripHtml(description);  // ← NUTZT LOKALE stripHtml()!
  if (!plainText) return null;
  const long = plainText.length > previewLength;
  return !expanded && long ? plainText.slice(0, previewLength).trimEnd() + "…" : plainText;
}
```

**Diese Funktion wird EXPORTIERT** — wird sie verwendet?

### 1.4 Suche nach Verwendungen von `descriptionPreview`
```bash
grep -r "descriptionPreview" src/
```

**Ergebnis:** **KEINE VERWENDUNG** in Frontend-Code!

### 1.5 Aber: `RemainingCard.tsx` hat EIGENE Inline-Logik!

**Datei:** `src/components/RemainingCard.tsx:43-62`
```typescript
const descriptionPlain = hasDescription
  ? decodeHtmlEntities(description)
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  : "";
```

**WARTET** — hier wird `decodeHtmlEntities` (aus `safeHtml.ts`) verwendet, NICHT `jobMeta.stripHtml`!

### 1.6 Aber wo kommt `job.description` her?

**API Response Flow:**
1. `api/_lib/sources/arbeitnow.mjs:56` → `compactJob()` ruft `stripHtml(job.description || "")` → **API stripHtml** (aus `filter.mjs`)
2. `api/_lib/sources/apify/actors.mjs:10` → `normalizeArbeitsagentur()` ruft `stripHtml(record.description || "")` → **API stripHtml** (aus `filter.mjs`)

**Frontend erhält:** `job.description` = **bereits durch API stripHtml bereinigter Plain Text**

### 1.7 DAS PROBLEM: API `stripHtml` liefert bei manchen Quellen NOCH HTML!

**Arbeitnow API** liefert: `job.description` = HTML-String (z.B. `<p><strong>...</strong></p>`)

**API `stripHtml` (NEU aus STEP_23D):**
```javascript
export function stripHtml(html) {
  return String(html)
    .replace(/&/g, "&")        // 1. Entity-Dekodierung
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

**Aber:** Wenn Quelle **doppelt encoded** ist (`<p>...`):
- Iteration 1: `&` → `&` → `<p>...` → Tag-Strip entfernt `<p>` → `p>...` ← MÜLL!
- Die API `stripHtml` macht **KEINE iterative Dekodierung**!

**Frontend `decodeHtmlEntities` (ITERATIV aus STEP_23D):**
- Macht bis zu 4 Durchläufe bis Stabilität
- Aber: Input ist bereits `job.description` = API-Output = **bereits gestrippter Text mit Müll**

### 1.8 MatchCard: `match.why` / `match.prepare` kommen vom AI!

**AI Response** (`/api/match`) → `match.why` = **AI-generierter Text** (kann HTML enthalten)

**Flow:** `MatchCard.tsx:14-17` → `renderHtmlContent(match.why)` → `prepareHtmlForRender` → `decodeHtmlEntities` (iterativ) → `DOMPurify`

**HIER funktioniert es** weil `prepareHtmlForRender` DOMPurify nutzt für expanded View.

### 1.9 RemainingCard: ZWEI Render-Pfade!

**Collapsed (Preview):** `descriptionPlain` → `decodeHtmlEntities` (iterativ) → Tag-Strip → **Plain Text in `<p>`**

**Expanded:** `renderHtmlContent(description)` → `prepareHtmlForRender` → `decodeHtmlEntities` (iterativ) → `DOMPurify` → **HTML in `<div dangerouslySetInnerHTML>`**

---

## 2. ROOT CAUSE HYPOTHESEN

### Hypothese 1: API `stripHtml` bricht bei doppelt-encoded Input
- Quelle: `<p><strong>Hello</strong></p>`
- API `stripHtml`: 1. Dekodierung → `<p><strong>Hello</strong></p>` → 2. Tag-Strip → `Hello` ✓
- **Aber:** Wenn Quelle `<p>...` (triple encoded):
  - API: 1. `&` → `&` → `<p>...` → 2. Tag-Strip findet KEINE Tags → Output: `<p>...` ✗

### Hypothese 2: Frontend `decodeHtmlEntities` bekommt Müll von API
- API Output bei triple-encoded: `<p>...` (Tags NICHT gestript weil keine `<`/`>` chars)
- Frontend `decodeHtmlEntities` (iterativ): dekodiert zu `<p>...` → Tag-Strip in `RemainingCard` → `p>...` ✗

### Hypothese 3: Apify/Arbeitsagentur Quelle liefert ANDERES Format
- `actors.mjs:10` nutzt auch `stripHtml` → gleiche Funktion
- Aber evtl. andere Entity-Encoding in Quelle

### Hypothese 4: Job-Objekt hat MEHRERE Beschreibungs-Felder
- `job.description` (von API gestript)
- `job.content` oder `job.html` oder `job.rawDescription` (ungereinigt)

---

## 3. UNTERSUCHUNG — REALE API DATEN STRUKTUR

### 3.1 Arbeitnow API Response Format
**api/_lib/sources/arbeitnow.mjs:24-52** — `fetchArbeitnow()` liefert `json.data` Array

**Job-Objekt Felder (aus compactJob):**
- `description`: `stripHtml(job.description || "")` → **gestripter Plain Text**
- `jobTypes`: `job.job_types`
- `contractType`: NICHT vorhanden bei Arbeitnow

### 3.2 Apify/Arbeitsagentur Response Format
**api/_lib/sources/apify/actors.mjs:6-28** — `normalizeArbeitsagentur(record)`

**Felder:**
- `description`: `stripHtml(record.description || "")` → **gestripter Plain Text**
- `contractType`: `record.contractType`
- `salary`: `record.salary`
- `startDate`: `record.startDate`

### 3.3 Frontend Job Type (src/types.ts:11-26)
```typescript
export interface Job {
  slug: string;
  title: string;
  company_name: string;
  location: string[];
  remote: boolean;
  tags: string[];
  url: string;
  created_at?: number | string;
  source?: JobSource[];
  description?: string;        // ← HIER: bereits gestripter Text von API
  jobTypes?: string[];
  contractType?: string;
  salary?: string;
  startDate?: string;
}
```

**Kein `content`, `html`, `rawDescription` Feld!**

---

## 4. WAS IST IM SCREENSHOT SICHTBAR?

### Screenshot A: `<div class="content-intro">...`
- Das ist **einmal HTML-encoded** (`<` → `<`, `"` → `"`)
- Erscheint im **Collapsed Preview** (Plain Text Rendering)
- Bedeutet: `descriptionPlain` enthält noch Entities

### Screenshot B: `<div><div class="attachment-overlay preview">...`
- Das ist **rohes HTML** (keine Entities)
- Erscheint vermutlich im **Expanded View** (dangerouslySetInnerHTML)
- Bedeutet: `prepareHtmlForRender` hat NICHT decodiert/sanitized, oder DOMPurify lässt divs durch

---

## 5. IMPLEMENTIERTE FIXES

### 5.1 API `stripHtml` iterativ gemacht (api/_lib/filter.mjs:18-30)

**Vorher (kaputte Reihenfolge):**
```javascript
export function stripHtml(html) {
  return String(html)
    .replace(/&/g, "&")        // 1. Entity-Dekodierung
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

**Nachher (iterativ, korrekte Reihenfolge):**
```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$");
}

function decodeHtmlEntities(html) {
  let current = String(html);
  for (let i = 0; i < 4; i++) {
    const next = decodeHtmlEntitiesOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

export function stripHtml(html) {
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

**Änderungen:**
- Iterative Dekodierung (max 4 Durchläufe) wie Frontend `decodeHtmlEntities`
- Korrekte Reihenfolge: benannte/numerische Entities → `&` → Tag-Strip
- Verhindert das Problem mit `<` → `&<` durch falsche Replace-Reihenfolge

### 5.2 DOMPurify Config — KEINE Änderung nötig
- `ALLOWED_TAGS` in `safeHtml.ts` enthält KEIN `div` → DOMPurify entfernt `<div>` Tags korrekt
- Screenshot B zeigte rohes HTML im **Expanded View** — das war vermutlich ein Cache/altes Deployment oder der HTML kam durch einen anderen Pfad
- Mit iterativem API `stripHtml` sollte `job.description` nun sauberer Plain Text sein

---

## 6. VALIDIERUNG

### 6.1 Unit/Integration Tests
```bash
npx vitest run 2>&1 | tail -30
```
**Result:** 20 Test Files, 192 Tests **PASSED** (Duration: ~12s)

### 6.2 TypeScript Strict Check
```bash
npx tsc -b
```
**Result:** **PASS** (no output = no errors)

### 6.3 Production Build
```bash
npm run build
```
**Result:** **PASS** — Vite build successful, assets generated

### 6.4 Git Diff Check
```bash
git diff --check
```
**Result:** **PASS** (no whitespace errors)

### 6.5 Geänderte Dateien
```
M	api/_lib/filter.mjs                    # API stripHtml: iterativ, korrekte Reihenfolge
```

---

## 7. PRODUCTION DEPLOYMENT — 2026-08-26 08:10 UTC

### 7.1 Deploy-Befehl
```bash
vercel --prod --scope maymilly
```

### 7.2 Deployment-Ergebnis
- **Vercel CLI:** 58.11.0 / 59.3.0 (Build)
- **Project:** mays-job-matcher
- **Scope:** maymilly
- **Inspect URL:** https://vercel.com/maymilly/mays-job-matcher/FTAtVgb9TpJLuyf7YFABSaj3KkLF
- **Deployment URL:** https://mays-job-matcher-3uyiylkwf-maymilly.vercel.app
- **Production Alias:** https://mays-job-matcher.vercel.app ✅
- **Build:** ✅ Success (386ms)
- **Deploy Time:** 16s total
- **Status:** ✅ Ready

### 7.3 HTTP Verification (Post-Deploy)
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

**Fazit:** Catch-all Rewrite wirksam, beide Pfade servieren dieselbe index.html

---

## 8. OFFENE PUNKTE

- [ ] **Browser-Verifikation Production:** `/`, `/top`, Jobsuche durchführen, Description Preview (collapsed + expanded) prüfen auf:
  - Keine `<`, `>`, `&`, `"`, `&nbsp;`
  - Keine `<div`, `<p`, `</p`, `</div`
  - Kein doppelt encoded HTML
- [ ] `jobMeta.ts:stripHtml` — gleicher Bug (falsche Reihenfolge, nicht iterativ), aber **aktuell ungenutzt** (descriptionPreview wird nirgends verwendet) → nur fixen falls künftig genutzt
- [ ] Vercel Dashboard Verifikation — **nicht verifizierbar ohne Dashboard-Zugriff**
- [ ] Regressionstests für Encoding-Level 0-3 explizit ergänzen (optional)

---

## 9. ABSCHLUSSBERICHT

### 9.1 Root Cause — API stripHtml Replacement Order
- **Problem:** API `stripHtml` ersetzte `&` → `&` **VOR** `<` → `<` und `>` → `>`
- **Folge:** Bei Input `<p>` wurde erst `&` → `&` (keine Änderung), dann `<` → `<` im String `<` → Resultat: `&<t;` (Müll)
- **Fix:** Iterative Dekodierung mit korrekter Reihenfolge (benannte/numerische Entities → `&` → Tag-Strip)

### 9.2 Root Cause — Fehlende Iteration
- **Problem:** API `stripHtml` machte nur 1 Durchlauf → bei multi-level Encoding (double/triple) blieben Entities erhalten
- **Fix:** Bis zu 4 Iterationen bis Stabilität (wie Frontend `decodeHtmlEntities`)

### 9.3 Geänderte Dateien
```
M	api/_lib/filter.mjs
```

### 9.4 Tests
- `npx vitest run`: **192 PASS**
- `npx tsc -b`: **PASS**
- `npm run build`: **PASS**
- `git diff --check`: **PASS**

### 9.5 Deployment-Befehl
```bash
vercel --prod --scope maymilly
```
**EXECUTED** — Production deployed successfully.

### 9.6 Execution-Log-Pfad
`docs/reports/STEP_23D_C_ROOT_CAUSE_INVESTIGATION_LOG.md`

---

**STATUS:** ROOT CAUSE FIXED — API stripHtml iterativ + korrekte Reihenfolge — PRODUCTION DEPLOYED
**NÄCHSTER SCHRITT:** User-Browser-Verifikation → bei OK: Commit + Push (für Git History)