# JM-TRANSLATION-MODEL-SELECTION-01 — Integration / Production

**Status:** `A — MERGED / PRODUCTION VERIFIED`

**Date:** 2026-11-17
**Final `origin/main`:** `7d5b4a7d1fac1d8f0406d76cad1bd6e03b5196f0`

## Merges

| PR | Inhalt | Merge-SHA |
|---|---|---|
| #26 | CV-Profil-Skill-Cap und ORCH-01/02 | `08d74b967fc9120d31e1dec9e23f154e7ebe02b0` |
| #27 | Übersetzungs-Modellauswahl | `7d5b4a7d1fac1d8f0406d76cad1bd6e03b5196f0` |

PR #27 wurde nach PR #26 mit dem neuen Main-Stand zusammengeführt. Einziger
Konflikt war `docs/AI_AUDITLOG.md`; beide Einträge wurden vollständig
erhalten. `src/i18n.tsx` und `src/styles.css` wurden automatisch
zusammengeführt.

## Tests

Nach der Integration:

```text
npm run build
# PASS

npx vitest run --no-file-parallelism
# 1933 PASS / 11 skipped
```

Fokussiert:

```text
job-translation API + profile-skills API
RemainingCard + safeHtml

# 59 PASS
```

## Production

Beide Domains liefern Build `7d5b4a7`:

- https://www.mays-job-matcher.app
- https://mays-jobsearch.vercel.app

Vercel Production Status für den Merge: **SUCCESS**. Kein manuelles
Deployment.

## Production-E2E

### CV-Skills

Synthetischer CV mit 30 eindeutigen Technologien:

```text
POST /api/profile
HTTP 200
skills_count: 30
```

Damit ist der bisherige Cap von 20 auf dem aktuellen Production-Stand
beseitigt.

### Übersetzung mit ausgewähltem Modell

Ausgewähltes freies Modell:

```text
dots-studio/dots-3-note-preview:free
```

```text
POST /api/job-details (action=translate, model=...)
HTTP 200
translation: Wir suchen einen Softwareentwickler. Sie werden zuverlässige
Systeme mit AWS und TypeScript aufbauen. Anforderungen: 3 Jahre Erfahrung.
```

Die Modellübergabe über den bestehenden Provider-Router ist damit live
verifiziert.

### UI-Bundle

Live-Bundle enthält:

- „Übersetzungsmodell“
- „Übersetzung erneut versuchen“
- „im CV erkannten Skills ausgewählt“

## Einschränkungen

- Ein Provider kann weiterhin temporär `model_unavailable` liefern; der
  Originaltext bleibt sichtbar und die Modellauswahl wird angeboten.
- Der CV-Profilpfad bleibt KI-basiert; das Cap ist behoben, aber die
  Modellantwort kann weiterhin einzelne Technologien auslassen.
- Keine Änderung an RIS, AWS, Cognito, ATS-Scoring, Persistenz oder Consent.

## Git

Docs-Branch: `docs/jm-translation-model-selection-integration-01`
Kein Docs-Merge nach `main`.
