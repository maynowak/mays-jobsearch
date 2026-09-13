# STEP 23D-L — HTML ENTITY NORMALIZATION FIX + REGRESSION TESTS

**Datum:** 2026-08-26
**Status:** IN PROGRESS
**Basis-Commit:** d4800d4 (HEAD = origin/main)
**Branch:** main

---

## 0. INITIALISIERUNG

### 0.1 Ausgangslage (aus STEP 23D-K bewiesen)
- **Root Cause:** `decodeHtmlEntitiesOnce` in `api/_lib/filter.mjs` hat falsche Replacement-Reihenfolge und falsche Regex-Patterns
- **Bug:** `.replace(/&/g, "&")` läuft FIRST → korrumpiert `<` zu `<`, `>` zu `>`
- **Bug:** `.replace(/</g, "<")` matched literal `<` char, NICHT `<` string
- **Bug:** `.replace(/>/g, ">")` matched literal `>` char, NICHT `>` string
- **Production** verwendet diesen Code (HEAD = origin/main = d4800d4)
- **Tests** in d4800d4 testen literal HTML (`"<p>"`), NICHT entity-encoded (`"<p>"`)

### 0.2 Ziel
Minimalen Fix für `decodeHtmlEntitiesOnce()` entwerfen + Regressionstests für alle Production-Fälle.

---

## PHASE 1 — FIX DESIGN

### 1.1 Aktueller buggy Code (api/_lib/filter.mjs:19-32)
```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")      // BUG: FIRST - corrupts all entities
    .replace(/</g, "<")      // BUG: matches literal '<' char
    .replace(/>/g, ">")      // BUG: matches literal '>' char
    .replace(/"/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$");
}
```

### 1.2 Gewünschte Semantik
Input → Output mapping für Testfälle:

| # | Input | Erwarteter Output | Hinweis |
|---|-------|-------------------|---------|
| 1 | `<p><strong>Hello</strong></p>` | `Hello` | Raw HTML |
| 2 | `<p><strong>Hello</strong></p>` | `Hello` | Entity-encoded |
| 3 | `<p><strong>Hello</strong></p>` | `Hello` | Double-encoded |
| 4 | `A & B` | `A & B` | Normaler Text |
| 5 | `A < B > C` | `A < B > C` | Vergleichszeichen (keine Tags!) |
| 6 | `A & B` | `A & B` | Entity in Text |
| 7 | Production job description | Reiner Text | Real case |
| 8 | `<script>alert(1)</script>` | `alert(1)` | XSS - tags stripped |
| 9 | `Hello&nbsp;World` | `Hello World` | NBSP |
| 10 | `&#60;p&#62;Hello&#60;/p&#62;` | `Hello` | Numeric entities |

### 1.3 Korrekte Replacement-Reihenfolge
**Spezifische Entities FIRST, generisches `&` LAST:**

```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/</g, "<")      // Entity string "<" → "<"
    .replace(/>/g, ">")      // Entity string ">" → ">"
    .replace(/"/g, '"')      // Entity string """ → """
    .replace(/&apos;/g, "'") // Entity string "&apos;" → "'"
    .replace(/&#x2F;/g, "/") // Numeric entity
    .replace(/&#x24;/g, "$") // Numeric entity
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)) // Decimal numeric
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16))) // Hex numeric
    .replace(/&/g, "&");     // Generic LAST
}
```

### 1.4 Iterative Dekodierung (decodeHtmlEntities)
Bestehende Funktion macht 4 Durchläufe - beibehalten für double/triple encoding.

---

## PHASE 2 — IMPLEMENTIERUNG

### 2.1 Fix anwenden