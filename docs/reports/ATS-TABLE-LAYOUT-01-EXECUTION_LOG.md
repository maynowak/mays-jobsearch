# Execution Log: ATS-TABLE-LAYOUT-01

## Status: GREEN ✅

## Datum/Zeit
2026-10-16 23:03 Europe/Berlin

## Git-Status (vor Commit)
- **Branch:** `main`
- **HEAD vorher:** `a21f727`
- **Working Tree:** 3 modifizierte Dateien, keine Secrets, `git diff --check` sauber

## Audit-Umfang
UI-Fehler in der ATS-Analyse. In der zweiten Tabelle "Was bereits passt"
laufen Anforderungstext und Status ohne Abstand zusammen ("devopsPasst").
Die erste Tabelle "Anforderungen der Stelle" war korrekt.

---

## 1. Root Cause (im Code verifiziert, nicht vermutet)

**Dateien:**
- `src/components/AtsOverlay.tsx` — `renderMatches()` vs. `renderRequirements()`
- `src/styles.css:5083` — `.ats-requirement`

**Befund:**

`.ats-requirement` ist ein Block-Container (nur `padding` + `border-left`), **kein** Flex-Container.

`renderRequirements()` (funktioniert) — enthält einen inneren Flex-Wrapper:
```jsx
<div style={{ display: 'flex', justifyContent: 'space-between', ... }}>
  <span className="ats-requirement-text">{req.text}</span>
  <span className="ats-requirement-status">{userStatus}</span>
</div>
```

`renderMatches()` (fehlerhaft) — **kein** Flex-Wrapper; die beiden `<span>`
liegen als direkte Inline-Kinder nebeneinander, ohne Whitespace-Textnode:
```jsx
<div className="ats-requirement matched">
  <span className="ats-requirement-text">{req.text}</span>   // "devops"
  <span className="ats-requirement-status matched">...</span> // "Passt"
</div>
```
→ Inline-Elemente ohne Abstand = `devopsPasst`.

**Ursache war exklusiv die fehlende Wrapper-Struktur in `renderMatches()`.**
Keine API-, Daten- oder ATS-Logik betroffen.

---

## 2. Implementierte Änderungen

### `src/components/AtsOverlay.tsx`
- `renderMatches()`: Flex-Wrapper `div.ats-requirement-row` ergänzt
- `renderRequirements()`: Inline-Style durch dieselbe Klasse ersetzt
- Redundante Inline-Styles entfernt (`.ats-requirement.matched` existiert bereits in CSS)

### `src/styles.css`
- Neue Klasse `.ats-requirement-row` (flex / space-between / gap / wrap)
  mit dokumentierendem Kommentar zur Fehlerursache

### `src/components/AtsOverlay.test.tsx`
- Neue Suite `ATS-TABLE-LAYOUT-01` mit 3 Regressionstests

---

## 3. Wichtige Erkenntnis zu `textContent`

Der erste Testversuch prüfte `expect(container.textContent).not.toContain("devopsPasst")`
und **schlug fehl — korrekt, aber aus dem falschen Grund.**

`textContent` verkettet adjazente Elemente immer ohne Trenner, **unabhängig vom
CSS-Layout**. Auch mit korrektem Flex-Wrapper ergibt `textContent`
`"devopsPasst"`. Der ursprüngliche Fehler war rein **visuell**, nicht im Text-Content.

Konsequenz: `textContent` ist als Indikator für diesen Bug untauglich.
Die Regressionstests prüfen daher die **Struktur** (getrennte Elementknoten +
Flex-Wrapper), nicht den verketteten Text.

---

## 4. Regressionstest-Verifikation

Der Fix wurde testweise zurückgenommen, um zu beweisen, dass die Tests greifen:

| Zustand | Ergebnis |
|---|---|
| Fix angewendet | 13 passed |
| Fix reverted (Bug wiederhergestellt) | **2 failed** (Wrapper + Struktur) |
| Fix wiederhergestellt | 13 passed |

Damit ist der Test ein echter Regressionstest, kein tautologischer Test.

---

## 5. Testergebnisse

```
npm test    ->  Test Files 68 passed | 3 skipped (71)
                Tests     794 passed | 5 skipped (799)   (+3 neu)
npm run build -> ✓ built (tsc -b + vite build, keine Fehler)
git diff --check -> sauber
Secret-Audit      -> keine Treffer
```

**Nicht verifiziert (OPEN):** Visuelle Browser-Darstellung. jsdom prüft
Struktur, nicht Pixel. Ein manueller Browser-Check des Abstands
Text links / Status rechts steht aus.

---

## 6. Regression-Scope

Unverändert: ATS-Score-Logik, Gap-/Match-Berechnung, Skill-Reconciliation,
API, Datenschutz, Themes, Holographic-Design. Rein Darstellungs-Ebene.

---
AI-AUDITLOG-Ende