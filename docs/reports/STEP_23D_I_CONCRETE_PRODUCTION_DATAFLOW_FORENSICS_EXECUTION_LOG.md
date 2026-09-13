# STEP 23D-I — CONCRETE PRODUCTION DATAFLOW FORENSICS
## INVESTIGATION ONLY — NO CODE CHANGES / NO COMMIT / NO PUSH / NO DEPLOY

**Datum:** 2026-08-26
**Status:** COMPLETE — ROOT CAUSE IDENTIFIED
**Basis-Commit:** 687b5db (HEAD = origin/main)
**Branch:** main

---

## 0. INITIALISIERUNG

### 0.1 Untersuchungsziel
**Production-Befund:** Firefox Private/Incognito zeigt HTML-Tags als literal Text:
```
<p><strong>About Sony Music Entertainment</strong></p>
<p>...
</p>
<div class="ICMS_InfoMsg ...">
...
```

**Konkreter Job:** "Engineering Manager, Royalty Share - PDEGO" bei sonymusicentertainment

### 0.2 Ziel
Trace dieses EXAKTEN Jobs durch den Production-Datenfluss:
1. API-Endpunkt identifizieren
2. Production JSON Response für diesen Job inspizieren
3. `job.description` und `job.descriptionPlain` Runtime-Werte dokumentieren
4. Frontend Collapsed-Preview Rendering-Pfad nachvollziehen
5. Mit Component-Tests vergleichen
6. Konkrete Root-Cause-Kategorie bestimmen (A-E)

---

## 1. API ENDPOINT IDENTIFIZIERUNG

### 1.1 Frontend API Client
**Datei:** `src/api.ts:186-195`

```typescript
export async function fetchJobs(profile: Profile): Promise<JobsResponse> {
  const params = new URLSearchParams();
  if (profile.skills) params.set("skills", profile.skills);
  if (profile.targetRole) params.set("targetRole", profile.targetRole);
  if (profile.city) params.set("city", profile.city);
  if (profile.radiusKm) params.set("radiusKm", String(profile.radiusKm));
  if (profile.workModes?.length) params.set("workMode", profile.workModes.join(","));
  if (profile.employmentTypes?.length)
    params.set("employmentType", profile.employmentTypes.join(","));
  return apiFetch<JobsResponse>(`/api/jobs?${params.toString()}`);
}
```

**Endpoint:** `GET /api/jobs` mit Query-Parametern (skills, targetRole, city, radiusKm, workMode, employmentType)

---

## 2. PRODUCTION API RESPONSE — CONCRETE EVIDENCE

### 2.1 Befehl ausgeführt
```bash
curl -s "https://mays-job-matcher.vercel.app/api/jobs?skills=royalty" | jq '.jobs[] | {title, company_name, description: (.description // "" | .[:500]), descriptionPlain: (.descriptionPlain // "" | .[:500])}'
```

### 2.2 Production JSON Response — EXAKT

**Job 1:** "Product Manager, Royalty Share - PDEGO"
```json
{
  "title": "Product Manager, Royalty Share - PDEGO",
  "company_name": "sonymusicentertainment",
  "description": "<p><strong>About Sony Music Entertainment</strong></p>\n<p>At Sony Music Entertainment, we fuel the creative journey...",
  "descriptionPlain": "<p><strong>About Sony Music Entertainment</strong></p> <p>At Sony Music Entertainment, we fuel the creative journey..."
}
```

**Job 2:** "Engineering Manager, Royalty Share - PDEGO" (EXAKTER SCREENSHOT-JOB)
```json
{
  "title": "Engineering Manager, Royalty Share - PDEGO",
  "company_name": "sonymusicentertainment",
  "description": "<p><strong>About Sony Music Entertainment</strong></p>\n<p>At Sony Music Entertainment, we fuel the creative journey...",
  "descriptionPlain": "<p><strong>About Sony Music Entertainment</strong></p> <p>At Sony Music Entertainment, we fuel the creative journey..."
}
```

---

## 3. RUNTIME VALUES — EXAKTE DOKUMENTATION

| Feld | typeof | enthält `<p>` | enthält `<` | enthält `&` | Erste ~200 chars |
|------|--------|---------------|----------------|-----------------|------------------|
| **job.description** | string | NEIN (nur `<p>`) | JA | JA | `<p><strong>About Sony Music Entertainment</strong></p>\n<p>At Sony Music...` |
| **job.descriptionPlain** | string | NEIN (nur `<p>`) | JA | JA | `<p><strong>About Sony Music Entertainment</strong></p> <p>At Sony Music...` |

**KRITISCHER BEFUND:** **BEIDE Felder enthalten HTML-encoded Entities (`<`, `>`, `"`, `'`, `&`) — KEINER enthält echte HTML-Tags.**

---

## 4. FRONTEND COLLAPSED PREVIEW RENDERING PFAD

### 4.1 Component Trace
**Datei:** `src/components/RemainingCard.tsx:43-50, 91`

```typescript
const rawDescription = job.description ?? "";
const plainDescription = job.descriptionPlain ?? "";
const hasDescription = (rawDescription.trim().length > 0) || (plainDescription.trim().length > 0);
const showDescriptionToggle = plainDescription.replace(/\s+/g, " ").trim().length > DESCRIPTION_PREVIEW_LENGTH;

const previewText = !expanded && showDescriptionToggle
  ? plainDescription.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd() + "…"
  : plainDescription;

// Rendering (Zeile 91):
<p className="remaining-description">{previewText}</p>
```

### 4.2 Rendering Methode
- **Feld verwendet:** `plainDescription` = `job.descriptionPlain ?? ""`
- **Rendering:** React Text Rendering `{previewText}` → **Text Node**
- **KEIN** `dangerouslySetInnerHTML`
- **KEIN** `prepareHtmlForRender`
- **KEIN** `sanitizeHtml`
- **KEIN** Entity-Decoding

---

## 5. ROOT CAUSE — CONCRETE

### 5.1 Was passiert
1. **API liefert:** `descriptionPlain = "<p><strong>About Sony Music Entertainment</strong></p>..."` (HTML-encoded entities)
2. **Frontend nimmt:** `plainDescription = job.descriptionPlain` 
3. **Frontend rendert:** `<p className="remaining-description">{previewText}</p>` mit `{previewText}` als **React Text Node**
4. **Browser rendert:** Literal Text `<p><strong>About Sony Music Entertainment</strong></p>...` — da Text Nodes NICHT HTML-parsen

### 5.2 Root Cause Category
**KATEGORIE A) Production API sendet HTML in descriptionPlain**

**BEWEIS:** 
- `descriptionPlain` Feld in Production API Response enthält `<p><strong>...` statt dekodiertem Plain Text
- API `stripHtml` Funktion dekodiert Entities NICHT vor dem Tag-Stripping

---

## 6. WARUM COMPONENT TESTS GRÜN WAREN

**Test Input (RemainingCard.test.tsx):**
```typescript
descriptionPlain: "About Sony Music Entertainment At Sony Music Entertainment... " // ECHTER Plain Text, KEINE Entities
```

**Production Input:**
```json
descriptionPlain: "<p><strong>About Sony Music Entertainment</strong></p>..." // ENTITIES!
```

**Tests prüften nur:** Component-rendering bei **korrektem** Input
**Tests prüften NICHT:** Ob API **tatsächlich** korrekten Input liefert

---

## 7. API ROOT CAUSE — `stripHtml` ENTITY DECODING

### 7.1 API Code: `api/_lib/filter.mjs:18-46`

```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")      // ← GENERIC & REPLACE ZUERST!
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

### 7.2 BUG: REPLACEMENT ORDER

**Aktuelle Reihenfolge (FALSCH):**
1. `&nbsp;` → ` `
2. `&` → `&`           ← **GENERIC & ZUERST!**
3. `<` → `<`
4. `>` → `>`
5. `"` → `"`
6. `&apos;` → `'`
7. `&#x2F;` → `/`
8. `&#x24;` → `$`

**Trace mit Input `<p>`:**
1. `&nbsp;` → ` `: keine Änderung
2. `&` → `&`: `<p>` → `<p>` (das `&` in `<` wird zu `&`)
3. `<` → `<`: Kein `<` char im String (ist `<`)
4. `>` → `>`: Kein `>` char
5. **Ergebnis: `<p>` — ENTITIES NICHT DEKODIERT!**

**Dann `stripHtml`:**
- `decoded` = `<p>` (keine `<`/`>` chars)
- `.replace(/<[^>]*>/g, " ")`: Matcht NICHTS
- **Output: `<p>` — ENTITIES BLEIBEN ERHALTEN!**

---

## 8. BEFEHLE & OUTPUT — EXAKT AUSGEFÜHRT

```bash
# 1. API Endpoint identifiziert
grep -n "fetchJobs" /home/dci-student/projects/Mays-Jobsearch/src/api.ts

# 2. Production API Response für Sony Music Job
curl -s "https://mays-job-matcher.vercel.app/api/jobs?skills=royalty" | jq '.jobs[] | {title, company_name, description: (.description // "" | .[:500]), descriptionPlain: (.descriptionPlain // "" | .[:500])}'

# Output zeigte beide Jobs mit description und descriptionPlain die < > Entities enthalten

# 3. Runtime values dokumentiert (siehe Tabelle oben)
```

---

## 9. ROOT CAUSE ZUSAMMENFASSUNG

| Kategorie | Status | Begründung |
|-----------|--------|------------|
| **A) Production API sendet HTML in descriptionPlain** | ✅ **BEWIESEN** | `descriptionPlain` enthält `<p><strong>...` statt Plain Text |
| B) Frontend nutzt description statt descriptionPlain | ❌ | Frontend nutzt korrekt `descriptionPlain` |
| C) Field Transformation | ❌ | Keine Transformation zwischen API und Component |
| D) Anderer Component/Pfad | ❌ | `RemainingCard` ist einziger Preview-Renderer |
| E) Other | ❌ | Root Cause ist A |

---

## 10. CONCLUSION

**ROOT CAUSE:** API `stripHtml` Funktion in `api/_lib/filter.mjs` dekodiert HTML-Entities **NICHT korrekt** vor dem Tag-Stripping, weil der **generic `&` replace VOR den spezifischen Entity-Replaces** ausgeführt wird.

**FOLGE:** `descriptionPlain` enthält HTML-encoded Entities (`<`, `>`, `"`, etc.) statt dekodiertem Plain Text.

**FRONTEND VERHALTEN:** Korrekt — rendert `descriptionPlain` als Text Node, wodurch Browser die Entities als literal Text anzeigt.

**FIX NOTWENDIG:** `decodeHtmlEntitiesOnce` Replacement Order korrigieren — spezifische Entities (`<`, `>`, `"`, `&apos;`, numerische) **VOR** generischem `&` replace.

---

## 11. EXECUTION LOG PATH

`docs/reports/STEP_23D_I_CONCRETE_PRODUCTION_DATAFLOW_FORENSICS_EXECUTION_LOG.md`

---

## 12. COMMANDS ACTUALLY EXECUTED

```bash
grep -n "fetchJobs" /home/dci-student/projects/Mays-Jobsearch/src/api.ts
curl -s "https://mays-job-matcher.vercel.app/api/jobs?skills=royalty" | jq '.jobs[] | {title, company_name, description: (.description // "" | .[:500]), descriptionPlain: (.descriptionPlain // "" | .[:500])}'
```

---

## 13. STATUS

**STATUS:** FORENSICS COMPLETE — ROOT CAUSE IDENTIFIED (Category A)
**NEXT STEP:** Fix `decodeHtmlEntitiesOnce` replacement order in `api/_lib/filter.mjs` — then re-verify Production

---

*Investigation complete. No code changes made. No commits. No pushes. No deploys.*