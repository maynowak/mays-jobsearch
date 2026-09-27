# CV-UPLOAD-UX-04 — SKILLS-BESTAETIGUNG VOR ATS-ANALYSE

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-UPLOAD-UX-04 (Follow-up-Befund zu CV-UPLOAD-UX-03)
- User-Befund: Direkt nach dem CV-Upload startete die ATS-Analyse ohne
  Zwischenschritt — die Analyse pruefte den CV gegen ein synthetisches
  Job-Objekt aus den CV-EIGENEN vorgeschlagenen Skills (runAtsProcessing:
  jobForAts.tags = suggestedProfile.skills). Fuer den Benutzer war nicht
  erkennbar/nachvollziehbar, WAS da analysiert wird ("bedeutet im Grunde
  nichts").
- Umsetzung (CV-UPLOAD-UX-04):
  - Reihenfolge im Workflow jetzt fuer BEIDE Ziele gleich: Zielwahl -->
    SKILLS-BESTAETIGUNG --> Ausfuehrung. "Ziel ausfuehren" oeffnet immer
    zuerst die Skills-Auswahl (skill-selection); die ATS-Analyse startet
    erst nach "Mit ausgewählten Skills fortfahren".
  - ATS-Analyse nutzt jetzt die vom Benutzer bestaetigten Skills
    (cvState.selectedSkills) als Anforderungsbasis; Fallback nur, wenn leer
    (suggestedProfile.skills) — Confirm ist bei 0 Skills ohnehin deaktiviert.
  - Skills-Bildschirm zielabhaengig beschriftet (neue i18n-Keys
    cv.skillSelectTitleAts / cv.skillSelectDescriptionAts, de+en).
  - KI-Jobsuche-Pfad unveraendert (lief bereits ueber skill-selection).
  - Schritt-Anzeige unveraendert (Zielrolle → Skills → Verarbeitung) — sie
    stimmt jetzt auch fuer ATS faktisch.
- AI component / endpoint affected: POST /api/ats-analysis (Input unveraendert:
  job { title, tags, slug }, profile.skills, ai). Kein Contract-/Konsent-
  Unterschied; Consent + lokale Anonymisierung bleiben vor jedem Modell-Call
  (CV-UPLOAD-UX-03).
- Files changed: src/App.tsx, src/i18n.tsx, src/App.test.tsx,
  docs/AI_AUDITLOG.md, docs/reports/CV-UPLOAD-UX-01-EXECUTION_LOG.md
- Tests: 490/490 PASS (ATS-Flows BUG-14..19/20/22 um Skills-Bestaetigung
  ergaenzt; BUG-20 assertiert zusaetzlich tags = bestaetigte Skills);
  TypeScript PASS; Build PASS; git diff --check CLEAN
- Classification: GREEN — ATS-Analyse basiert nachweislich auf den vom
  Benutzer bestaetigten Skills; semantisch nachvollziehbarer Ablauf.
