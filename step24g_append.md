---

## STEP 24G — Exact Transformation Proof

### 1. Exact Job B Input Representation

The actual double-encoded string from Arbeitnow API for "Senior Technical Project Manager" at Wundermanthompson:

```
<div class="content-intro"><h3><strong>Who We Are</strong></h3><p>VML is a leading creative company...</p><h3>Senior Project Manager experienced managing technical teams...</h3><ul><li>Release and technical reporting...</li></ul>
```

Every `<` is `<`, every `>` is `>`, every `"` is `"`, every `&` is `&`.

### 2. Current Local `htmlToPlainText()` Output

**Input:** (double-encoded string above)
**Output:** IDENTICAL to input — no transformation occurs

```
<div class="content-intro"><h3><strong>Who We Are</strong></h3><p>VML is a leading creative company...</p><h3>Senior Project Manager experienced managing technical teams...</h3><ul><li>Release and technical reporting...</li></ul>
```

**Result:** `htmlToPlainText(jobBActualRaw) === jobBActualRaw` → **TRUE**

### 3. Encoding Depth Measurement

| Pass | Input (first 80 chars) | Changed? |
|------|------------------------|----------|
| 1    | `<div class="content-intro"><h3>...` | **NO CHANGE** |
| 2    | (same) | NO CHANGE |
| 3    | (same) | NO CHANGE |
| 4    | (same) | NO CHANGE |

**Encoding depth:** Function makes ZERO passes that change the string. The double-encoded entities are never decoded.

### 4. Job A Comparison

**Job A Input (proper HTML):**
```html
<p><strong>Wein, Pasta, Kamera läuft.</strong></p><p>Wir sind Vinolisa...</p><h2>Aufgaben</h2><ul><li>...</li></ul>
```

**Job A Output:**
```
Wein, Pasta, Kamera läuft. Wir sind Vinolisa - der Onlineshop für italienischen Genuss... Aufgaben Du drehst kurze Videos ...
```

**Difference:** Job A has actual HTML tags (`<p>`, `<strong>`, etc.) — no entities to decode. Tag stripping works. Job B has double-encoded entities — `decodeHtmlEntities` fails to decode them, so tag stripping finds no tags.

### 5. Exact Current Regex Patterns (Verified from `api/_lib/filter.mjs:18-28`)

```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")           // Line 20
    .replace(/&/g, "&")               // Line 21 — BUG: runs FIRST
    .replace(/</g, "<")               // Line 22
    .replace(/>/g, ">")               // Line 23
    .replace(/"/g, '"')               // Line 24
    .replace(/&apos;/g, "'")          // Line 25
    .replace(/&#x2F;/g, "/")          // Line 26
    .replace(/&#x24;/g, "$");         // Line 27
}
```

**Critical flaw:** Line 21 replaces `&` → `&` **before** the entity patterns (lines 22-25) can match. This corrupts `<` → `<`, `>` → `>`, `"` → `"`. Subsequent passes cannot recover.

**Replacement order is:** `&nbsp;` → `&` → `<` → `>` → `"` → `&apos;` → `&#x2F;` → `&#x24;`

**Intended order should be:** Named entities FIRST (`<`, `>`, `"`, `&`, `&apos;`, etc.), THEN bare `&`.

### 6. Local vs Production Code

| Aspect | Local Current Code | Production Observation |
|--------|-------------------|------------------------|
| `decodeHtmlEntities` logic | Same as above (buggy order) | Same behavior observed |
| `htmlToPlainText` output for Job B | Returns input unchanged | Returns input unchanged |
| `htmlToPlainText` output for Job A | Clean plain text | Clean plain text (with residual `&#x26;`) |

**Conclusion:** Local code and production behavior are CONSISTENT. Both fail to decode double-encoded entities due to the same regex order bug.

---

### FINAL ANSWERS

**1. Does the CURRENT local `htmlToPlainText()` correctly process the exact Job B input?**
**NO.** It returns the input unchanged — double-encoded entities remain encoded, tags remain un-stripped.

**2. If yes, why does Production return the unprocessed value?**
N/A — local also fails.

**3. If no, what exact input causes it to fail?**
The double-encoded string where every `<` is `<`, `>` is `>`, `"` is `"`, `&` is `&`. Example: `<div class="content-intro">...`

**4. Is the problem: encoding depth, regex, function invocation, source normalization, or something else?**
**REGEX REPLACEMENT ORDER** in `decodeHtmlEntitiesOnce` (api/_lib/filter.mjs:21).

The function replaces bare `&` → `&` **first** (line 21), which corrupts all named entities (`<` → `<`, `>` → `>`, `"` → `"`). The subsequent replacements for `<`, `>`, `"` never match because the string no longer contains those characters — they were part of the entities that got corrupted.

**Root cause:** Wrong replacement order. Named entities must be replaced BEFORE bare `&`.

---

**STATUS = STEP 24G EXACT TRANSFORMATION PROVEN — NO FIX**

STOP.