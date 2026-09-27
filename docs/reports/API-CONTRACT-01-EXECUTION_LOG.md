# API-CONTRACT-01 — TARGET API CONTRACT DECISION (AI CONTRACT)

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

- Date: 2026-09-25
- Task: API-CONTRACT-01
- Purpose: Verbindlicher Target API Contract — IST vs TARGET vs MIGRATION.
  Rein deklarativ; KEIN Code, KEINE Route-, Auth-, Response- oder
  Error-Aenderung in diesem Schritt.
- AI component / endpoint affected:
  - POST /api/ats-analysis: Target-Vertrag haelt ai.enabled / ai.consent /
    ai.model (optional) fest. Semantik: ohne ai.model Server-Default; mit
    ai.model Durchreichung bis chat({ model }) — entspricht exakt der
    BROWSER-BUG-22-Implementierung.
  - POST /api/profile, POST /api/match, POST /api/cover-letter: model?
    bleibt optional; x-mj-attempt ist als interner Header dokumentiert.
- Consent-Bezug: ai.consent bleibt der Pflicht-Schalter fuer KI-Verarbeitung
  mit CV-Inhalten (CvConsentGate / AtsOverlay) — im Vertrag ausdruecklich.
- Anonymisierungsabgrenzung: Die CV-Anonymisierung (src/lib/anonymize.ts)
  ist lokal/clientseitig und wird NICHT als AI-Operation gefuehrt; der Server
  erhaelt nur den bereits (ggf. anonymisierten) Text.
- Model selection / fallback: Client nutzt withModelFallback (wahl ->
  empfohlen -> verfuegbar) fuer match/profile; ATS nutzt explizites Modell
  mit Recovery-Punkt (ats-model-recovery) statt stillem Fallback — dokumentiert.
- Betroffene Dokumente: docs/API_CONTRACT.md (neu), docs/AI_AUDITLOG.md
  (dieser Eintrag). docs/API_INVENTORY.md bleibt IST-Inventur.
- Historische Befunde unveraendert (nichts geloescht/ueberschrieben).
- Verifikation: 486/486 Tests PASS, TypeScript PASS, Build PASS,
  git diff --check PASS.
- Classification: GREEN — Contract-Entscheidung dokumentiert; Umsetzung
  erfolgt in separaten Migrationsschritten (Open Decisions siehe
  API_CONTRACT.md §18).
