# MODEL-SELECT-01 — EXECUTION LOG (Combobox-Liste ueberlaufend anzeigen)

## Current status
FINALIZED — alle Validierungen gruen. Commit steht aus (Nutzerfreigabe).

## Umsetzung (final)
- ModelSelector.tsx: Beim Oeffnen wird das Trigger-Rect gemessen und die
  Liste (`.model-popover--fixed`) mit position: fixed + berechneten
  Koordinaten (top/left/width) inline gesetzt — sie ueberlagert jetzt jeden
  Overflow-Container (Workflow-Overlay, Modals, Karten).
- Richtungslogik (oben/unten) aus dem bisherigen openUp uebernommen;
  Position haftet am Trigger (Neumessung bei Scroll/Resize waehrend offen).
- Kein ARIA-/Tastatur-/Verhaltens-Change; bisheriges absolute Styling bleibt
  Fallback, falls kein Rect messbar (z. B. jsdom).
- Test: Assertion .model-popover--fixed beim Oeffnen im Modell-Step.

## Files changed
- src/components/ModelSelector.tsx
- src/styles.css (.model-popover--fixed)
- src/App.test.tsx (1 Assertion)
- docs/reports/MODEL-SELECT-01-EXECUTION_LOG.md (diese Datei)

## Checks (final)
- npx vitest run: 43 Files / 504 Tests — PASS
- npx tsc -b — PASS
- npm run build — PASS (nur bekannte Chunk-Size-Hinweise)
- git diff --check — CLEAN

## Consent-/Privacy-/Contract-Bezug
Keine Aenderung (reine Darstellung; keine neue Datenfluege/-persistenz).

## Classification
GREEN — Combobox-Liste wird ueberlaufend ueber dem Frame angezeigt.

## Resume point
Abgeschlossen; naechster Schritt: Commit nach Nutzerfreigabe.

## Audit date/time
2026-09-26 (nach CV-UPLOAD-UX-06, HEAD 1de217d gepusht)

## Git state (Start)
- Branch: main, HEAD 1de217d, synchron mit origin/main, working tree clean

## Task / Purpose (User-Request)
Beim Aufmachen der KI-Modell-Combobox sollen die Elemente UEBERLAUFEND
angezeigt werden (ueber dem umgebenden Frame liegen), statt vom Container
abgeschnitten zu werden.

## Befund (verifiziert)
- ModelSelector rendert .model-popover mit position: absolute innerhalb
  .model-field. Clipping-Vorfahren mit overflow != visible (u. a.
  .cv-processing-card im Workflow-Overlay mit overflow-y: auto, .modal-box)
  schneiden die Liste ab — sie liegt nicht "ueber" dem Frame.

## Plan
- Popover beim Oeffnen auf position: fixed mit aus gemessenem Trigger-Rect
  berechneten Koordinaten setzen (bleibt ueber allen Frames/Overlays).
  Richtungslogik (oben/unten) aus bestehendem openUp uebernehmen.
- Position bei Scroll/Resize neu berechnen, damit sie am Trigger haftet.
- Keine Aenderung an ARIA-/Tastatur-Verhalten; Default-Styling als Fallback.

## Completed sections
- [x] Umsetzung ModelSelector.tsx + styles.css
- [x] Tests
- [x] Validierung + Audit-Eintrag (in dieser Datei, unten)
