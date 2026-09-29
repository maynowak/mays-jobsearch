# APIFY-SCALEUP-01 — Run-Limit 30 → 100 + Kostenschätzung

## Current status
COMPLETED — `APIFY_MONTHLY_MAX_RUNS`-Default auf 100 angehoben, Doku nachgezogen, Kostenschätzung belegt.

## Audit date/time
2026-09-29 15:55:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: f85d37c (before change; change uncommitted at log time)
- Working tree: `M api/_lib/config.mjs`, Doku-Dateien (siehe Files changed)

## Audit scope
User-Vorgaben: (1) klären, ob `$0.79 / 1.000 Results` ein Durchschnitt ist; (2) Limit hochskalieren (30 Runs "wirklich zu wenig", belegt durch `limit_reached` am 29.09.); (3) Kostenschätzung liefern. Code-Änderung: nur der Default-Wert; Env-Override, Zähler-Mechanik, Quotas, Cache unverändert.

## Completed audit sections
1. **Preisstruktur geklärt**: `$0.79 / 1.000 Results` ist der Stückpreis des Actor-Autors pro geliefertem Ergebnis ("from" = Einstiegspreis, kein Durchschnitt); dazu kleine Compute-Kosten pro Run (~10 s Runs); `[$0.45]`-Badge ist der Listen-/Startpreis des Actors im Store. Gesamtkosten pro Run = Results × Rate + Compute; maßgeblich bleibt das Apify-Dashboard.
2. **Ist-Abgleich**: September `$0.26` bei ≥30 Runs (Limit erreicht) → ≈ $0.01/Run all-in — passt zu kleinen Result-Mengen + kurzen Runs.
3. **Default angehoben**: `api/_lib/config.mjs` 30 → 100; Doku (README, JOB_SOURCES, ARCHITECTURE, DEPLOYMENT, ENVIRONMENT_MATRIX, CHANGELOG-Eintrag) nachgezogen.
4. **Verifiziert**: 570 passed / 2 skipped (Live-Opt-in), Build OK, Diff clean. Mechanik-Tests mocken den Backstop (unabhängig vom Default).

## Actual findings
- 30 Runs/Monat (≈1/Tag) ist operativ zu wenig — produktiv belegt.
- Neue Staffel: 100 Runs/Monat (≈3/Tag).

| Runs/Monat | Results (Ø10/Run) | Result-Kosten | Compute (ca.) | Gesamt ca. |
|---|---|---|---|---|
| 30 (alt) | ~300 | ~$0.24 | ~$0.03 | **~$0.27** (deckt sich mit $0.26 Ist) |
| 60 | ~600 | ~$0.47 | ~$0.06 | **~$0.55** |
| 100 (neu) | ~1000 | ~$0.79 | ~$0.10 | **~$0.90** |
| 100 Worst-Case (40/Run) | 4000 | $3.16 | ~$0.15 | **~$3.30** |

- Selbst der Worst-Case bleibt unter dem $5.00-Budget aus der Runner-Ansicht; realistisch ≈ $1/Monat. Zusätzlich dämpfen L1-Cache (10 Min), Dataset-Reuse (6 h Peak / 12 h Off-Peak) und Tages-Quotas die reale Run-Zahl; Zähler resettet monatlich automatisch.
- `APIFY_MONTHLY_SOFT_LIMIT_USD` ($4.00) bewusst unverändert: rein advisores Anzeige-Feld, blockiert nichts.

## Evidence / file references
- `api/_lib/config.mjs:95` — Default 30 → 100 (einzige Verhaltensänderung)
- User-Runner-Daten: `blackfalcondata/arbeitsagentur-jobs-feed`, `Succeeded`, 10 s, `maxResults: 100` (manueller Test-Run), September `$0.26 / $5.00`, Pricing `from $0.79 / 1,000 results`
- `api/_lib/usage.mjs:156-160` — `apifyRunLimitReached` (Mechanik unverändert, Tests mocken Backstop)
- Doku: `README.md`, `docs/JOB_SOURCES.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `ENVIRONMENT_MATRIX.md`, `docs/CHANGELOG.md` (neuer `Unreleased — 2026-09-29`-Eintrag)
- Run: 47 passed / 1 skipped Files, 570 passed / 2 skipped Tests

## Classification
**GREEN** — Anhebung umgesetzt, Schätzung belegt und im Budget, Suite grün.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 7× modified (Config + 5 Doku-Dateien), alle zu diesem Task gehörig.

## Files changed
- `api/_lib/config.mjs` — Default `APIFY_MONTHLY_MAX_RUNS` 30 → 100
- `README.md`, `docs/JOB_SOURCES.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `ENVIRONMENT_MATRIX.md` — Default-Angaben nachgezogen
- `docs/CHANGELOG.md` — neuer `Unreleased — 2026-09-29`-Eintrag inkl. Kostenschätzung
- `docs/reports/APIFY-SCALEUP-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst (insbesondere keine Mechanik-/Test-Änderungen nötig).

## Open questions
Keine. Hinweis: Per-Env-Override (`APIFY_MONTHLY_MAX_RUNS`) bleibt jederzeit möglich und schlägt den Default.

## Risks
Niedrig und beziffert: Worst-Case ≈ $3.30/Monat < $5.00-Budget; realistisch ≈ $1. Mechanik (Backstop, Quotas, Cache) unverändert; Tests grün.

## Recommended next actions
1. Diesen Task committen + pushen (+ bei Bedarf deployen, damit der neue Default in Production greift).
2. Optional: `/api/usage` (mit `USAGE_DIAGNOSTICS_TOKEN`) nach Monatswechsel beobachten.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Kosten-/Limit-Konfiguration einer Job-Source (Default-Wert + Doku). Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert. Nächster Schritt: committen + pushen (+ Deploy, damit Production den neuen Default übernimmt).
