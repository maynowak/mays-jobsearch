# STEP 23D-E — HTML-AS-HTML RENDERING + EXISTING SECURITY INTEGRATION
## FORENSIC INVESTIGATION — ROOT CAUSE ANALYSIS

**Datum:** 2026-08-26
**Status:** IN PROGRESS
**Basis-Commit:** 687b5db + STEP_23C + STEP_23D + STEP_23D-C (deployed)
**Branch:** main

---

## 0. INITIALISIERUNG

### 0.1 Browser-Regressionsbeobachtung (aus Screenshots)
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

**Schlussfolgerung:** Die HTML-Bereinigung funktioniert NICHT. Sichtbare `<`, `>`, `"` im Output.

---

## 1. FORENSISCHE UNTERSUCHUNG — RENDERING PIPELINE

### 1.1 Pipeline-Übersicht

```
QUELLE (Arbeitnow/Arbeitsagentur API)
    │
    ▼
API: compactJob() → stripHtml(job.description)  ← PROBLEM: Strippt HTML!
    │
    ▼
API Response: job.description = PLAIN TEXT (ohne Tags)
    │
    ▼
FRONTEND: RemainingCard / MatchCard
    │
    ├── Collapsed Preview: decodeHtmlEntities → strip tags → <p>{text}</p>
    └── Expanded: prepareHtmlForRender → dangerouslySetInnerHTML
```

### 1.2 KRITISCHER FUND: API `stripHtml` ENTFERNT HTML TAGS

**Datei:** `api/_lib/sources/arbeitnow.mjs:56`
```javascript
function compactJob(job) {
  const description = stripHtml(job.description || "");  // ← HIER!
  return { ..., description: description || undefined };
}
```

**API `stripHtml` (api/_lib/filter.mjs:18-46):**
```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")      // ← BUG: Generic & replace BEFORE specific entities!
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
    .replace(/<[^>]*>/g, " ")   // ← ENTFERNT ALLE TAGS!
    .replace(/\s+/g, " ")
    .trim();
}
```

### 1.3 REPLACEMENT ORDER BUG IN `decodeHtmlEntitiesOnce`

**Aktuelle Reihenfolge (FALSCH):**
1. `&nbsp;` → ` `
2. `&` → `&`           ← **ZU FRÜH!**
3. `<` → `<`
4. `>` → `>`
5. `"` → `"`
6. `&apos;` → `'`
7. `&#x2F;` → `/`
8. `&#x24;` → `$`

**Trace mit Input `<p>`:**
1. `&` → `&`: `<p>` → `<p>` (das `&` in `<` wird zu `&`)
2. `<` → `<`: Kein Match, String ist `<p>`
3. `>` → `>`: Kein Match
4. **Ergebnis: `<p>` — ENTITIES NICHT DEKODIERT!**

**Dann `stripHtml`:**
- Keine `<`/`>` chars im String → keine Tags zum Strippen
- **Output: `<p>`** — **GENAU DAS STEHT IM SCREENSHOT!**

### 1.4 RICHTIGE REIHENFOLGE

Spezifische Entities MÜSSEN VOR generischem `&` replace dekodiert werden:
```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")      // Spezifische benannte Entities ZUERST
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/'/g, "'")      // Nur falls numerisch
    .replace(/'/g, "'")
    .replace(/&#x2F;/g, "/") // Numerische Entities
    .replace(/&#x24;/g, "$")
    // KEIN generischer & replace am Ende!
}
```

**Trace mit RICHTIGER Reihenfolge & Input `<p>`:**
1. `<` → `<`: `<p>` → `<p>`
2. `>` → `>`: `<p>` → `<p>`
3. `&` → `&`: Kein `&` mehr vorhanden
4. **Ergebnis: `<p>` — RICHTIG DEKODIERT!**
7. Dann `stripHtml`: `<p>` → ` ` (space) — aber das ist OK für Search!

---

## 2. ARCHITEKTUR-PROBLEM: API ENTFERNT HTML DAS FRONTEND BRAUCHT

### 2.1 Frontend Rendering-Pfade (RemainingCard.tsx)

**Collapsed Preview (Zeile 47-52, 97):**
```typescript
const descriptionPlain = hasDescription
  ? decodeHtmlEntities(description)
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  : "";
// ...
<p className="remaining-description">{previewText}</p>
```

**Expanded (Zeile 17-20, 95):**
```typescript
function renderHtmlContent(html: string) {
  const sanitized = prepareHtmlForRender(html);
  return <div className="html-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

### 2.2 MatchCard.tsx (Zeile 14-17, 55, 60)
```typescript
function renderHtmlContent(html: string) {
  const sanitized = prepareHtmlForRender(html);
  return <div className="html-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
// ...
{match.why && renderHtmlContent(match.why)}
{match.prepare && <div className="prepare">...{renderHtmlContent(match.prepare)}</div>}
```

### 2.3 DAS PROBLEM

**Frontend erhält:** `job.description` = **Plain Text ohne Tags** (Output von API `stripHtml`)

**Für Collapsed Preview:**
- Input: Plain Text (z.B. `<p>Hello</p>` wegen Bug)
- `decodeHtmlEntities`: Dekodiert zu `<p>Hello</p>`
- `.replace(/<[^>]*>/g, "")`: Stript Tags → `Hello`
- **Aber:** Wenn API Bug → Input schon `<p>` → decode → `<p>Hello</p>` → strip → `Hello` — funktioniert zufällig

**Für Expanded:**
- Input: Plain Text (keine Tags!)
- `prepareHtmlForRender`: `decodeHtmlEntities` → `sanitizeHtml` (DOMPurify)
- **Keine Tags vorhanden** → Nichts zu rendern!

### 2.4 WARUM SCREENSHOT B ROHE HTML TAGS ZEIGT?

Screenshot B zeigt `<div><div class="attachment-overlay preview">...` — **roh, nicht encoded**.

**Hypothese:** Das kommt von einer ANDEREN Quelle (Arbeitsagentur/Apify) die NICHT durch `stripHtml` geht, ODER das `job.description` Feld wird an manchen Stellen NICHT durch `stripHtml` verarbeitet.

**Prüfung:** `api/_lib/sources/apify/actors.mjs:10`:
```javascript
const description = stripHtml(record.description || "");
```
→ Auch hier wird `stripHtml` aufgerufen.

**Alternative:** Evtl. kommt das rohe HTML aus `match.why` / `match.prepare` (AI-generiert) in MatchCard?

---

## 3. BESTEHENDE SECURITY-SCHICHT — ANALYSE

### 3.1 `src/lib/safeHtml.ts` — VOLLSTÄNDIG VORHANDEN

```typescript
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "ul", "ol", "li", "a", "strong", "b", "em", "i",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tr", "th", "td",
      "blockquote", "pre", "code",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

export function prepareHtmlForRender(html: string | undefined): string {
  if (!html) return "";
  const decoded = decodeHtmlEntities(html);
  return sanitizeHtml(decoded);
}
```

**Security-Features:**
- ✅ DOMPurify mit Allowlist
- ✅ Erlaubte Tags: p, br, ul, ol, li, a, strong, b, em, i, h1-h6, table, blockquote, pre, code
- ✅ Erlaubte Attribute: href, target, rel
- ✅ Entfernt: script, iframe, event-handler (onclick), javascript: URLs, style-Attribute
- ✅ Entity-Decoding VOR Sanitization (iterativ, max 4 Durchläufe)

**Diese Schicht ist KOMPLETT und SICHER für HTML-Rendering!**

---

## 4. ROOT CAUSE ZUSAMMENFASSUNG

| Problem | Ort | Ursache |
|---------|-----|---------|
| **1. Entities nicht dekodiert** | `api/_lib/filter.mjs:21` | `&` → `&` replace VOR `<`/`>` replace |
| **2. HTML Tags entfernt** | `api/_lib/filter.mjs:43` | `stripHtml` entfernt ALLE Tags für Frontend |
| **3. Frontend bekommt Plain Text** | API → Frontend | `job.description` = stripped plain text |

**Das Frontend hat bereits die perfekte Security-Schicht (`prepareHtmlForRender` + DOMPurify).**
**Das Problem: Die API zerstört das HTML bevor es das Frontend erreicht.**

---

## 5. MINIMAL-FIX EMPFEHLUNG

### 5.1 Fix 1: API `decodeHtmlEntitiesOnce` Replacement Order korrigieren
**Datei:** `api/_lib/filter.mjs:19-28`
- Spezifische Entities (`<`, `>`, `&`, `"`, `&apos;`, numerische) VOR generischem `&` replace

### 5.2 Fix 2: API `stripHtml` NICHT für `job.description` verwenden
**Datei:** `api/_lib/sources/arbeitnow.mjs:56` und `api/_lib/sources/apify/actors.mjs:10`

**Option A (empfohlen):** Rohes HTML an Frontend übergeben, `stripHtml` NUR intern für `keywordHits` nutzen
```javascript
function compactJob(job) {
  return {
    ...,
    description: job.description || undefined,  // RAW HTML beibehalten
    descriptionPlain: stripHtml(job.description || ""),  // Für Search intern
  };
}
```

**Option B (minimaler):** `stripHtml` nur für Search nutzen, Description roh lassen

### 5.3 Frontend: Collapsed Preview mit `prepareHtmlForRender` rendern
**Datei:** `src/components/RemainingCard.tsx:47-52`
Statt Plain-Text-Extraktion: Sanitized HTML in `<p>` rendern (aber DOMPurify Output ist HTML-String, nicht React Node).

Alternative: `descriptionPlain` aus `description` via `prepareHtmlForRender` aber dann als Text extrahieren.

---

## 6. IMPLEMENTIERTE FIXES

### 6.1 Fix 1: API `decodeHtmlEntitiesOnce` Replacement Order korrigiert
**Datei:** `api/_lib/filter.mjs:19-29`

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
    .replace(/&#x24;/g, "$")
    .replace(/&/g, "&");  // Generischer & replace AM ENDE
}
```

**Änderung:** Spezifische Entities (`<`, `>`, `&`, `"`, `&apos;`, numerische) werden VOR dem generischen `&` replace dekodiert.

### 6.2 Fix 2: API `stripHtml` NICHT für `job.description` — Rohes HTML an Frontend
**Dateien:** 
- `api/_lib/sources/arbeitnow.mjs:54-70`
- `api/_lib/sources/apify/actors.mjs:6-28`

**Änderung:** `compactJob` / `normalizeArbeitsagentur` geben jetzt ZWEI Felder zurück:
- `description`: **RAW HTML** (für Frontend Rendering)
- `descriptionPlain`: Gestrippter Plain Text (für Search intern via `keywordHits`)

```javascript
function compactJob(job) {
  const rawDescription = job.description || "";
  const descriptionPlain = stripHtml(rawDescription);
  return {
    ...,
    description: rawDescription || undefined,
    descriptionPlain: descriptionPlain || undefined,
  };
}
```

**API `keywordHits`** nutzt weiterhin `stripHtml` intern für Search (Zeile 67 in filter.mjs).

### 6.3 Frontend: TypeScript Types erweitert
**Datei:** `src/types.ts:21`
```typescript
export interface Job {
  ...
  description?: string;
  descriptionPlain?: string;  // NEU
  ...
}
```

### 6.4 Frontend: RemainingCard verwendet korrekte Felder
**Datei:** `src/components/RemainingCard.tsx`

- **Collapsed Preview:** Nutzt `job.descriptionPlain` (Plain Text) → `<p>{previewText}</p>`
- **Expanded:** Nutzt `job.description` (Raw HTML) mit `prepareHtmlForRender` → `dangerouslySetInnerHTML` mit DOMPurify

**Entfernt:** `decodeHtmlEntities` Import (nicht mehr nötig), Inline-Entity-Decoding + Tag-Strip Logik.

---

## 7. VALIDIERUNG

### 7.1 Unit/Integration Tests
```bash
npx vitest run 2>&1 | tail -30
```
**Result:** 20 Test Files, 192 Tests **PASSED** (Duration: ~10s)

### 7.2 TypeScript Strict Check
```bash
npx tsc -b
```
**Result:** **PASS** (no output = no errors)

### 7.3 Production Build
```bash
npm run build
```
**Result:** **PASS** — Vite build successful, assets generated

### 7.4 Git Diff Check
```bash
git diff --check
```
**Result:** **PASS** (no whitespace errors)

### 7.5 Geänderte Dateien
```
M	api/_lib/filter.mjs                           # Replacement Order Bug Fix
M	api/_lib/sources/arbeitnow.mjs                # description + descriptionPlain
M	api/_lib/sources/apify/actors.mjs             # description + descriptionPlain
M	src/types.ts                                  # Job interface + descriptionPlain
M	src/components/RemainingCard.tsx              # Collapsed/Expanded rendering fix
```

---

## 8. PRODUCTION DEPLOYMENT — 2026-08-26 10:25 UTC

### 8.1 Deploy-Befehl
```bash
vercel --prod --scope maymilly
```

### 8.2 Deployment-Ergebnis
- **Vercel CLI:** 58.11.0 / 59.3.0 (Build)
- **Project:** mays-job-matcher
- **Scope:** maymilly
- **Inspect URL:** https://vercel.com/maymilly/mays-job-matcher/DiEUgWvUnrKu5pDwrmckYiXJqMzF
- **Deployment URL:** https://mays-job-matcher-q2uhqdred-maymilly.vercel.app
- **Production Alias:** https://mays-job-matcher.vercel.app ✅
- **Build:** ✅ Success (373ms)
- **Deploy Time:** 18s total
- **Status:** ✅ Ready

### 8.3 HTTP Verification (Post-Deploy)
**Test A: Root `/`**
```bash
curl -I https://mays-job-matcher.vercel.app/
```
**Ergebnis:** HTTP/2 200, `etag: "0189f8ea00d6a1cd29029ede1b2d22fc"`, `x-vercel-cache: MISS`, `content-length: 578`

**Test B: `/top`**
```bash
curl -I https://mays-job-matcher.vercel.app/top
```
**Ergebnis:** HTTP/2 200, **identischer ETag** `0189f8ea00d6a1cd29029ede1b2d22fc`, **identischer Content-Length** 578, `x-vercel-cache: MISS`

**Fazit:** Catch-all Rewrite wirksam, beide Pfade servieren dieselbe index.html

---

## 9. OFFENE PUNKTE

- [ ] **Browser-Verifikation Production:** `/`, `/top`, Jobsuche durchführen, Description Preview (collapsed + expanded) prüfen auf:
  - Keine `<`, `>`, `&`, `"`, `&nbsp;`
  - Keine `<div`, `<p`, `</p`, `</div`
  - Kein doppelt encoded HTML
  - Collapsed Preview: Sauberer Text
  - Expanded: Gerendertes HTML (DOMPurify)
- [ ] `jobMeta.ts:stripHtml` — gleicher Bug (falsche Reihenfolge, nicht iterativ), aber **aktuell ungenutzt** (descriptionPreview wird nirgends verwendet) → nur fixen falls künftig genutzt
- [ ] Vercel Dashboard Verifikation — **nicht verifizierbar ohne Dashboard-Zugriff**

---

## 10. ABSCHLUSSBERICHT

### 10.1 Root Cause — API Replacement Order Bug
- **Problem:** `api/_lib/filter.mjs:21` — `&` → `&` replace passierte VOR `<` → `<` und `>` → `>`
- **Folge:** Input `<p>` → `&` ersetzt das `&` in `<` → `<p>` → `<`/`>` Replace finden keine Matches → **Output: `<p>`** (exakt der Screenshot-Befund)
- **Fix:** Replacement Order korrigiert — spezifische Entities VOR generischem `&` replace

### 10.2 Root Cause — API stripHtml entfernt HTML für Frontend
- **Problem:** `api/_lib/sources/arbeitnow.mjs:56` und `api/_lib/sources/apify/actors.mjs:10` nutzten `stripHtml` für `job.description`
- **Folge:** Frontend erhielt Plain Text ohne Tags → Collapsed Preview: kaputte Entities, Expanded: keine Tags zum Rendern
- **Fix:** API liefert `description` (RAW HTML) + `descriptionPlain` (Plain Text für Search)

### 10.3 Frontend Security-Schicht — Bereits vorhanden & genutzt
- `src/lib/safeHtml.ts`: `prepareHtmlForRender` + DOMPurify mit Allowlist
- Erlaubte Tags: p, br, ul, ol, li, a, strong, b, em, i, h1-h6, table, blockquote, pre, code
- Entfernt: script, iframe, event-handler, javascript: URLs, style-Attribute
- **Diese Schicht war immer korrekt — das Problem war der Input (Plain Text statt HTML)**

### 10.4 Geänderte Dateien
```
M	api/_lib/filter.mjs
M	api/_lib/sources/arbeitnow.mjs
M	api/_lib/sources/apify/actors.mjs
M	src/types.ts
M	src/components/RemainingCard.tsx
```

### 10.5 Tests
- `npx vitest run`: **192 PASS**
- `npx tsc -b`: **PASS**
- `npm run build`: **PASS**
- `git diff --check`: **PASS**

### 10.6 Deployment-Befehl
```bash
vercel --prod --scope maymilly
```
**EXECUTED** — Production deployed successfully.

### 10.7 Execution-Log-Pfad
`docs/reports/STEP_23D_E_HTML_RENDERING_FORENSIC_EXECUTION_LOG.md`

---

**STATUS:** ROOT CAUSE FIXED — API Replacement Order + HTML-as-HTML Pipeline — PRODUCTION DEPLOYED
**NÄCHSTER SCHRITT:** User-Browser-Verifikation → bei OK: Commit + Push (für Git History)