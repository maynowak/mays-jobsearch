# CV-PROFILE-LISTS-04 — "CV-DATEN ENTFERNEN"-BUTTON (PRIVACY)

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-PROFILE-LISTS-04 (User-Request, Datenschutz)
- Purpose: Ein Button im CV-Bereich, der gespeicherte Daten entfernt — mit
  Bestaetigung und Hinweis, dass die Lebenslaeufe erneut hochgeladen werden
  muessen.
- Umsetzung:
  - CvDocumentList: neuer Button "CV-Daten entfernen" oeffnet eine
    Bestaetigungsbox (role="alertdialog") mit Hinweistext; "Endgültig
    entfernen" / "Abbrechen".
  - App.handleCvRemoveData: resetCvProfileLists() (Session-Speicher) +
    purgeLegacyCvListsFromLocalStorage() + kompletter Reset des CV-Workflow-
    States (Step "idle", Dokumente/Profile/Consent geleert).
  - Nach dem Entfernen ist wieder die Dropzone der sichtbare Einstieg
    (erneutes Hochladen) — Consent wird erneut abgefragt.
- Files changed: src/components/CvDocumentList.tsx, src/App.tsx,
  src/i18n.tsx (3 neue Keys de/en), src/styles.css,
  src/components/CvDocumentList.test.tsx, src/App.test.tsx,
  docs/AI_AUDITLOG.md, docs/reports/CV-PROFILE-LISTS-02-EXECUTION_LOG.md
- Tests: 503/503 PASS (neuer Flow-Test: Bestaetigen/Abbrechen/Entfernen);
  TypeScript PASS; Build PASS; git diff --check CLEAN
- Classification: GREEN — Datenschutz-Anforderung umgesetzt.
