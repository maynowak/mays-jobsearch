# STEP 24 — GERMAN-FIRST LOCALE + LOCATION EXECUTION LOG

## Phase 1 — Current State Analysis

### i18n Implementation (`src/i18n.tsx`)
- **Supported languages**: "en" | "de"
- **Storage**: localStorage key "mj-lang"
- **Language detection**: `readStoredLang()` — reads localStorage, defaults to "en" (not German!)
- **Language switching**: `LangToggle` in Navbar (DE/EN buttons)
- **Context**: `LangProvider` wraps App, provides `lang`, `setLang`, `t()`
- **Document lang**: Updates `document.documentElement.lang` on change

### Current Language Priority (Problem)
1. localStorage "mj-lang" → if "de" then "de", else "en"
2. **No browser language detection**
3. **Default is "en" (not German!)**

### Location Analysis
- **SearchForm**: City/ZIP input with autocomplete via `useCityAutocomplete` (OpenPLZ API)
- **Location utilities**: `src/lib/location.ts` — `parseGermanLocation()`, `formatGermanLocation()`
- **Geolocation**: NOT used anywhere
- **navigator.language/languages**: NOT used anywhere
- **Location ≠ Language**: No mixing

### Job Data Translation
- **No translation function exists**
- Job descriptions rendered as-is (HTML or plain text)
- UI uses i18n, job content stays in original language

---

## Phase 2 — Language Priority Implementation Plan

**New Priority Logic:**
1. **Explicit user choice** (localStorage "mj-lang") — highest priority
2. **Browser language** (`navigator.language` / `navigator.languages`) — if no stored choice
   - de, de-DE, de-AT, de-CH → "de"
   - en, en-US, en-GB → "en" (if supported)
   - Others → "de" (German fallback)
3. **German** — ultimate fallback

**Implementation:**
- Modify `readStoredLang()` in `src/i18n.tsx`
- Add `detectBrowserLanguage()` helper
- Keep existing `setLang()` and localStorage persistence

---

## Phase 3 — Location Check
- No geolocation used → document as-is
- City/ZIP autocomplete via OpenPLZ API (user-initiated)
- No automatic location detection

---

## Phase 4 — Location + Language Separation
- Already separated: Browser locale → UI language
- Location (city/ZIP) → search parameter only
- No auto-geolocation

---

## Phase 5 — Job Content Translation
- No translation function → document as-is
- No external API
- No new dependencies

---

## Phase 6 — Tests

### Added: `src/i18n.test.tsx` (17 tests)
- 1. explicit stored language: localStorage=de → DE
- 2. explicit stored language: localStorage=en → EN
- 3. no stored language + browser de-DE → DE
- 4. no stored language + browser de-AT → DE
- 5. no stored language + browser de-CH → DE
- 6. no stored language + browser en-US → EN
- 7. no stored language + browser en-GB → EN
- 8. no stored language + unknown browser language (fr-FR) → DE (fallback)
- 9. no stored language + no navigator → DE (fallback)
- 10. stored EN overrides browser DE
- 11. stored DE overrides browser EN
- 12. no stored language + browser de-DE → DE (default German)
- 13. navigator.languages array takes precedence over navigator.language
- 14. partial match: de-xx → DE
- 15. partial match: en-xx → EN
- 16. setLang updates lang and localStorage
- 17. document.documentElement.lang updates on language change

All 17 locale priority tests PASS.

---

## Phase 7 — Validation

### Vitest
```
Test Files  25 passed (25)
Tests  221 passed (221)
```
**Full Output Saved**: `docs/reports/STEP_24_VITEST.log`

### TypeCheck
```
(no errors)
```
**Full Output Saved**: `docs/reports/STEP_24_TYPECHECK.log`

### Build
```
✓ built in 402ms
dist/index.html                                                0.57 kB │ gzip:   0.39 kB
dist/assets/index-C4KbWQTX.js                                277.40 kB │ gzip:  88.89 kB
```
**Full Output Saved**: `docs/reports/STEP_24_BUILD.log`

### Diff Check
```
(no output = no whitespace errors)
```
**Full Output Saved**: `docs/reports/STEP_24_DIFFCHECK.log`

---

## Summary

### Changes Made (Tracked Files)
- **`src/i18n.tsx`** — Added `detectBrowserLanguage()` and updated `readStoredLang()` to implement German-first locale priority with browser language detection (net +16 lines)

### New Files (Unversioned)
- **`src/i18n.test.tsx`** — 17 comprehensive locale priority tests

### Unversioned Files Preserved
- All existing debug/test/report files untouched

### Architecture Verified
| Requirement | Status | Evidence |
|-------------|--------|----------|
| German-first fallback | ✅ | Default returns "de" |
| Browser language detection | ✅ | `navigator.language` / `navigator.languages` |
| de-DE, de-AT, de-CH → DE | ✅ | Tests 3,4,5 pass |
| en-US, en-GB → EN | ✅ | Tests 6,7 pass |
| Unknown locale → DE | ✅ | Tests 8,9 pass |
| Stored EN overrides browser DE | ✅ | Test 10 passes |
| Stored DE overrides browser EN | ✅ | Test 11 passes |
| navigator.languages precedence | ✅ | Test 13 passes |
| No auto-geolocation prompt | ✅ | No navigator.geolocation usage |
| Location ≠ Language mixing | ✅ | Location only used for search |
| No job content translation | ✅ | No translation function added |
| No external API/dependencies | ✅ | Only uses browser APIs |
| HTML rendering unchanged | ✅ | STEP 23D-M pipeline preserved |
| description/descriptionPlain unchanged | ✅ | No changes to data contract |

---

**STATUS = STEP 24 GERMAN-FIRST LOCALE + LOCATION COMPLETE — READY FOR REVIEW**

STOP. No commit, no push, no deploy.