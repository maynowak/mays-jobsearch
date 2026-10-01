# JOB-SOURCES-01 — Docker-Suche liefert nur Arbeitnow + Arbeitsagentur (12 Stellen)

## Current status
FIXED + LIVE-VERIFIED — `enabled()` ehrlich, Apify-Join, UI-Transparenz; danach per `vercel dev` mit echten Dev-Keys bewiesen (Adzuna liefert 2 Docker-Stellen, Rest transparent begründet). Details + Beweise: `docs/reports/JOB-SOURCES-LIVE-01-EXECUTION_LOG.md`.

## Audit date/time
2026-10-01 11:25:00 CET (fix verified 2026-10-01 ~11:50 CET; live-verified ~12:30 CET, siehe LIVE-01)

## Git branch and HEAD
- Branch: main
- HEAD: f43e0b5 (working tree clean at log time)

## Audit scope
User-Meldung: Suche nach "Docker" liefert nur Arbeitnow + Arbeitsagentur mit Summe 12 Stellen — bei der Anzahl angebundener Quellen unplausibel. Auftrag: Anfrageweg Frontend → `/api/jobs` → Quellen konkret konsolidieren, Ursache finden und beheben. Vorgabe: `docs/AI_AUDITLOG.md` befolgen (kontinuierlicher Execution-Log, nur verifizierte Fakten).

## Completed audit sections
1. **Anfrageweg getraced**: `src/api.ts fetchJobs` → `api/jobs.mjs` (Param-Parsing) → `fetchAllJobs` (`api/_lib/sources/index.mjs`: `enabledSources()` → `Promise.allSettled(fetchJobs)` → dedup → `applySearchFilters` → `applySearchStrategyWithTargetRole`, Pool-Cap 50) → Meta (`sources`, `sourceReasons`, `sourceCounts`, `disabledSources`, `sourceDetails`).
2. **Quellen-Config geprüft**: lokal sind keine Keys gesetzt (`.env.local` enthält nur `VITE_CONTACT_EMAIL`); `enabled()` prüft nur Feature-Flags (Default true), `fetchJobs` gibt ohne Keys `emptyResult("missing_config")` zurück (Greenhouse: `no_boards_configured`, Public-ATS: nicht konfiguriert).
3. **Frontend-Anzeige geprüft**: `JobSources` zeigt nur liefernde Quellen (`sourceCounts`/`deliveredCounts`); `sourceReasons`/`disabledSources` werden nicht angezeigt — fehlende Quellen bleiben ohne Erklärung unsichtbar.
4. **Fix umgesetzt + verifiziert**: ehrliches `enabled()` (5 Quellen), Apify-Space-Join, `disabledSources`/`sourceReasons` in `JobSources`-UI (mit i18n + Tests), 2 Registry-Tests auf neuen Vertrag umgestellt. Volle Suite 663 passed / 2 skipped, Build OK (per `node --check`, vitest, `npm run build`).

## Actual findings
- **Hauptbefund (Konfiguration, kein Filter-Bug)**: Ohne API-Keys können Adzuna/Jooble/Theirstack faktisch nichts liefern; ohne Boards liefert Greenhouse nichts; ohne `PUBLIC_ATS_SOURCES` existiert keine Public-ATS-Quelle. Real aktiv: Arbeitnow (keyless) + Arbeitsagentur (Apify-Token in Prod offenbar gesetzt). 12 Docker-Treffer = deren lokale Substring-Filtertreffer. Die Vermutung "da stimmt was nicht" ist berechtigt, die Ursache liegt im Anfrageweg-Setup, nicht im Docker-Keyword.
- **Nebenbefund 1 (irreführende Meta)**: `enabled()` meldet Key-lose Quellen als aktiv → `disabledSources`/`sourceDetails[].enabled` lügen; Schein-Quellen werden angefragt und als `countJobSourceRequest` gezählt, obwohl sie nur Leermengen zurückgeben.
- **Nebenbefund 2 (fehlende Transparenz)**: `meta.sourceReasons` (`missing_config` etc.) erreicht das Frontend (`src/App.tsx` liest nur `sources`/`sourceCounts`/`disabledSources`), wird aber nirgends angezeigt.
- **Nebenbefund 3 (Query-Bau)**: `fetchActorJobs` (`api/_lib/sources/apify/index.mjs:43`) baut den Actor-Query via `String(roles[0] || skills || "")` — bei Skill-Arrays entsteht ein Komma-Join (`"Docker,Kubernetes"`) statt Space-Join; bei Single-Skill ("Docker") harmlos, bei Multi-Skill potenziell trefferlos.

## Evidence / file references
- `api/_lib/sources/index.mjs` — `fetchAllJobs`, `enabledSources`, `sourcesMeta`/`sourceReasons`/`disabledSources`
- `api/_lib/sources/adzuna.mjs` (`enabled`, `emptyResult("missing_config")`), `jooble.mjs`, `theirstack.mjs`, `greenhouse.mjs` (`no_boards_configured`), `apify/index.mjs` (`missing_config` ohne `APIFY_API_TOKEN`), `apify/actors.mjs` (nur Arbeitsagentur-Actor)
- `api/_lib/config.mjs` — Flags default true, Keys/Boards default leer
- `src/components/JobSources.tsx` — zeigt nur liefernde Quellen
- `src/App.tsx:276,324` — `setFoundSources(board.meta?.sources)`; reasons werden ignoriert
- `.env.local` — nur `VITE_CONTACT_EMAIL` gesetzt (Namen geprüft, keine Secrets ausgelesen)

## Classification
**GREEN** — Ursache (fehlende Keys/Boards, nicht Filter-Bug) belegt und Anfrageweg konsolidiert: Meta ehrlich, UI transparent, Suite + Build grün. Kein AI-Datenfluss betroffen (reine Job-Quellenanbindung).

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- Aktuell: 14× modified + 3× neu (inkl. LIVE-01-Log + Live-Test + Adzuna-Alias), ungepusht. `.vercel/`/`.env*` gitignored.

## Files changed, if any
- `api/_lib/sources/{adzuna,jooble,theirstack}.mjs` — `enabled()` = Flag + Key vorhanden
- `api/_lib/sources/greenhouse.mjs` — `enabled()` = Flag + Boards konfiguriert
- `api/_lib/sources/apify/actors.mjs` — Arbeitsagentur-`enabled()` = Flag + `APIFY_API_TOKEN` vorhanden
- `api/_lib/sources/apify/index.mjs` — Skill-Array wird mit Space (statt Komma via `String()`) zum Actor-Query gejoint
- `src/components/JobSources.tsx` — neue Props `disabledSources`/`sourceReasons`, inaktive Zeilen mit gemapptem Grund
- `src/components/JobSources.test.tsx` — 2 neue Tests (inaktive Zeilen, Reason-Mapping ohne Doppelzeilen)
- `src/App.tsx` — neue States `foundDisabledSources`/`foundSourceReasons`, gesetzt/zurückgesetzt in `runSearch`/`runCvSearch`, an `JobSources` übergeben
- `src/i18n.tsx` — `sources.inactive`, `sources.reasonNotConfigured`, `sources.reasonLimitReached` (DE/EN)
- `tests/api/greenhouse-source.test.mjs`, `tests/api/sources-registry.test.mjs` — auf ehrliches-`enabled()`-Verhalten umgestellt
- Nachtrag (siehe LIVE-01 §6): `api/_lib/config.mjs` — Adzuna-Alias `ADZUNA_APPLICATION_ID`/`ADZUNA_APPLICATION_KEY`; `api/_lib/sources/adzuna.mjs` — Fehlermeldung nennt beide Namen; `.env.example` — Alias dokumentiert
- `docs/reports/JOB-SOURCES-01-EXECUTION_LOG.md` — dieser Log (laufend aktualisiert)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet (Backend + Frontend + Tests + Log); keine Secrets/`.env`-Dateien angefasst.

## Open questions
1. ~~Welche Keys sind in Vercel-Production tatsächlich gesetzt?~~ Teil-beantwortet (siehe LIVE-01): Development-Env enthält Adzuna-Alias-Keys (liefern live), Jooble-/Theirstack-Keys (Upstream scheitert), kein Apify-Token, keine Greenhouse-Boards. Production-Env noch zu prüfen (dort zeigte Prod-Meta Jooble/Theirstack `upstream`, Adzuna `missing_config`, Arbeitsagentur liefernd).
2. Sollen fehlende Keys beschafft/konfiguriert werden (entschärft die Abdeckung), oder bleibt der reduzierte Quellenmix bewusst?

## Risks
- `enabled()`-Änderung macht `disabledSources`/`sourceDetails` ehrlich — Meta-Shape bleibt gleich (Arrays/Objekte unverändert), nur Inhalte werden korrekt. Geringes Risiko.
- Apify-Query-Join: Single-Skill-Verhalten unverändert (`"Docker"` bleibt `"Docker"`); Multi-Skill wird korrekter.
- Frontend zeigt zusätzlich inaktive Quellen mit Grund — reine Anzeige-Erweiterung, bestehende Tests bleiben gültig (neue Tests für neue Zeilen).

## Recommended next actions
1. Diesen Task committen + pushen (+ Deploy).
2. Nach Deploy Docker-Suche prüfen — erwartete Anzeige: Arbeitnow + Arbeitsagentur mit Treffern, Rest als "inaktiv"/"nicht konfiguriert" markiert; sobald Keys in Vercel gesetzt sind, erscheinen die Quellen automatisch als liefernd (kein Code-Change nötig).
3. Offene Frage 2 entscheiden (Keys beschaffen vs. reduzierter Mix bewusst behalten).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Reine Job-Quellenanbindung (Enabled-Logik, Query-Bau, Anzeige von Quellengründen). Kein Model Call, kein AI Provider, kein Matching-/Scoring-/Cover-Letter-/Consent-Flow geändert. `docs/AI_AUDITLOG.md` ist eine Template-/Prozess-Datei (Execution-Log-Pflicht); es wurde kein Audit-Eintrag darin erzeugt, sondern dieser Report-Log geführt und kontinuierlich aktualisiert.

## Current resume point
Fertig und verifiziert (Suite 663 passed / 2 skipped, Build OK). Nächster Schritt: committen + pushen.
