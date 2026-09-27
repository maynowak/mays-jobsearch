# CV-UPLOAD-UX-05 — SCHRITT-LABELS KORRIGIERT (DE/EN-ENTZERRUNG)

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-UPLOAD-UX-05 (User-Befund: unklare/verwirrende Schritt-Anzeige im
  CV-Workflow, u. a. doppeltes "Abgeschlossen")
- Befund (verifiziert, src/i18n.tsx + CvProcessingSteps.tsx + App.tsx-Mapping):
  - DE-Labels waren gegenueber EN um einen Schritt verschoben:
    cv.processingStep6 DE "Zielrolle" vs EN "Goal" (es ist die ZielWAHL,
    nicht die Zielrolle); step7 DE "Verarbeitung" vs EN "Target";
    step8 DE "Abgeschlossen" vs EN "Processing" — die laufende Verarbeitung
    wurde fälschlich als "Abgeschlossen" angezeigt.
  - Doppeltes "Abgeschlossen" (step8/9/10 alle identisch in DE).
  - cv.processingStep10 war ein ungenutzter Key (nicht in STEPS referenziert).
  - Mapping: improvement-selection, reanalysis und match-impact-select mappten
    alle pauschal auf "target".
- Umsetzung:
  - Labels korrigiert (DE): step6 "Ziel", step7 "Analyse", step8
    "Verarbeitung" (step9 "Abgeschlossen" bleibt); ENTSPRECHEND EN step7
    "Target" -> "Analysis". Ungenutzter Key cv.processingStep10 entfernt
    (beide Locales).
  - Mapping verfeinert (App.tsx): improvement-selection → "improvement",
    reanalysis → "reanalysis", match-impact-select → "match-impact"
    (statt alles "target"; Labels stehen dadurch an der richtigen Stelle).
- Resultierende Anzeige (DE): Dokument → Einwilligung → Anonymisierung →
  Modell → Profil → Ziel → Skills → Analyse → Verarbeitung → Abgeschlossen →
  Verbesserungen → Re-Analyse → Match Impact.
- Consent-/Privacy-/Contract-Bezug: keine Aenderung (Labels + Mapping).
- Files changed: src/i18n.tsx, src/App.tsx, docs/AI_AUDITLOG.md,
  docs/reports/CV-UPLOAD-UX-01-EXECUTION_LOG.md (aktualisiert)
- Tests: 490/490 PASS; TypeScript PASS; Build PASS; git diff --check CLEAN
- Classification: GREEN — Schritt-Anzeige jetzt konsistent DE/EN und
  wahrheitsgemaess zum Ablauf.
