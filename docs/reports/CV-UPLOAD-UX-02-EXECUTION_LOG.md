# CV-UPLOAD-UX-02 — WORKFLOW-OVERLAY AUF ALLEN VIEWPORTS (MOBILE-FIX)

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-26
- Task: CV-UPLOAD-UX-02 (Follow-up-Befund zu CV-UPLOAD-UX-01)
- User-Befund: Nach der Einwilligung erschien bei Pfad A erst die Inline-
  Maske "Verarbeitungsstatus" unter der Suchmaske — nicht das Overlay.
- Root Cause (verifiziert, src/styles.css): .cv-workflow-overlay war per
  Design-Entscheidung aus BUG-14..19 nur ab @media (min-width: 768px) als
  fixed Overlay gestaltet; auf Mobile renderte der Workflow bewusst inline.
  -> Kein Logikfehler im Overlay-State (cvOverlayActive), sondern reine
  CSS-Viewport-Regel.
- Umsetzung:
  - .cv-workflow-overlay gilt jetzt auf ALLEN Viewports: Mobile-First als
    Vollbild-Sheet (fixed, inset 0, Karte ohne Radius, min-height 100dvh),
    ab 768px weiterhin zentrierter Dialog (max-width 680px, max-height 88vh).
  - App.tsx: Step-Fokus-Effekt vereinfacht — Fokus genuegt auf allen
    Viewports (Mobile-scrollIntoView entfaellt, da kein Inline-Workflow).
  - Inline bleibt weiterhin (unveraendert): document-selected (CV-Liste unter
    der Suchmaske), consent-required im dismissed-Zustand, ats-complete
    (ATSModal ist selbst Overlay).
- Consent-/Privacy-/Contract-Bezug: keine Aenderung (reines Darstellungs-CSS
  + Kommentar-/Effekt-Bereinigung).
- Files changed: src/styles.css, src/App.tsx, docs/AI_AUDITLOG.md,
  docs/reports/CV-UPLOAD-UX-01-EXECUTION_LOG.md (aktualisiert)
- Tests: 490/490 PASS; TypeScript PASS; Build PASS; git diff --check CLEAN
- Classification: GREEN — Overlay-Verhalten entspricht jetzt der Anforderung
  (Prozess B sichtbar im Overlay; Menue nach dem Schliessen unter der
  Suchmaske). Manuelle Browser-Verifikation (Mobile-Viewport) empfohlen.
