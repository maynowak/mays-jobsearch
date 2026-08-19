# Feature: Matching Retry without Job Re-Fetch

Branch:
feature/matching-retry-no-refetch

Base:
main

Aktueller Step:
Step 6

Aktueller Status:
STEP 5 = PASS · STEP 6 = PASS

## Step-Matrix

| Step | Thema | Status | Commit |
| 1 | Repository-Analyse + Architekturplan (KEINE Codeänderung) | COMPLETE | (Analyse in Chat, kein Commit) |
| 2 | Implementierung: Dataset-Persist, Search/Match-Trennung, UI-Lock, Server-Schutz, Tests | COMPLETE | 12d547f |
| 3 | Production Verification | BLOCKED | d25a8f8 |
| 4 | Merge Preparation | COMPLETE (MERGE-READY) | 624a878 |
| 5 | Merge nach main | COMPLETE (PASS) | 624a878 (main) |
| 6 | Production Deployment | COMPLETE (PASS) | 624a878 (deployed) |

## Recovery-Regel

Bei Wiederaufnahme zuerst diese Datei lesen.

Nicht anhand einer vorherigen Console-Ausgabe raten.

Der letzte COMMITTED Checkpoint ist maßgeblich.

Nur mit dem nächsten PENDING Step fortfahren.

Bei BLOCKED oder FAILED:
- Ursache dokumentieren
- Status setzen
- Report committen
- pushen
- STOPP

Nach jedem abgeschlossenen Step:
1. Feature-Report aktualisieren
2. Tests prüfen
3. git status
4. git diff --check
5. Secret Audit
6. Commit
7. Push
8. erst danach nächsten Step beginnen

## Ziel

Nach einem fehlgeschlagenen AI-Matching darf ein Wechsel des AI-Modells KEINE erneute
Jobsuche und KEINEN erneuten Apify-/Jobbörsen-Request auslösen. Die bereits geladenen
Jobs bleiben für ein erneutes Matching erhalten. Suchmaske und Modellauswahl sind
während einer laufenden Suche technisch gesperrt.

## Nicht berührt (Scope)

- Timeout-/Fallback-Feature (FEATURE_AI_MATCHING_TIMEOUT) NICHT geöffnet
- Timeout-Werte, `timeout`/`network_error`-Codes, `model_unavailable`-Fallback-Logik unverändert
- Jobquellen / Apify-Implementierung / Apify-Cache unverändert
- Matching-Algorithmus unverändert
- AI Provider-Implementierungen unverändert
- Kein UI-Redesign, keine neuen Dependencies

## Step 2 — Implementierung

Status: COMPLETE

### Ausgangslage (Git)

- main == `4fa80b4`
- Feature-Branch `feature/matching-retry-no-refetch` von main erstellt

### Caller-Audit (/api/match ohne jobs)

- `src/api.ts` `fetchMatches` sendet `jobs` IMMER im Body (kein Fallback nötig).
- Cron-Digest (`api/cron/digest.mjs`) nutzt `fetchFilteredJobs` (Arbeitnow) separat,
  NICHT `/api/match`. Kein Abhängigkeit vom Match-Fallback.
- Tests (`tests/api/match-cache.test.mjs`) senden `jobs` in allen Erfolgsfällen.
- → Entfernen des `fetchAllJobs`-Fallbacks im Match-Handler ist sicher.

### Umgesetzte Änderungen

#### 1. Dataset persistieren (src/App.tsx)

- Neuer State `dataset: { jobs: Job[]; profile: Profile } | null`.
- Nach fehlgeschlagenem Matching wird das Dataset NICHT verworfen.
- Keine Dataset-Logik in `SearchForm` oder `ModelSelector`.

#### 2. Search und Matching trennen (src/App.tsx)

- `runSearch(submitted)`:
  → Re-Entrancy-Guard (`busyRef`)
  → UI-Lock (phase = searching)
  → `fetchJobs(submitted)` (EINZIGER Job-Fetch-Pfad)
  → Dataset speichern
  → `performMatch(dataset, effectiveModel)`
  → UI freigeben
- `performMatch(dataset, model)` (Match-only):
  → Re-Entrancy-Guard (via Caller)
  → `withModelFallback(fetchMatches(dataset.profile, dataset.jobs, model))`
  → Ergebnisse setzen
  → UI freigeben
- `performMatch` enthält KEINEN Job-Fetch, ruft NICHT `/api/jobs` auf,
  löst KEINEN Apify-Request aus.

#### 3. Modellwechsel (src/App.tsx, handleModelChange)

- Modellwechsel löst NIE eine neue Jobsuche aus.
- Wenn `dataset` existiert UND `dataset.profile` == aktuellem `profile` UND kein
  Request läuft → `performMatch(dataset, neuesModel)` (Match-only auf vorhandenem Dataset).
- Reiner Modellwechsel invalidiert das Dataset NICHT.
- `effectiveModel`-/Fallback-Logik unverändert.

#### 4. Dataset-Invalidierung (src/App.tsx, handleProfileChange)

- Vergleich `next` vs. `dataset.profile` über Skills, TargetRole, City.
- Bei echter Änderung → `setDataset(null)` → neue Suche erforderlich.
- Modellwechsel ist KEINE Invalidierung.
- UX „alte Ergebnisse bleiben sichtbar" bleibt erhalten (`foundJobs`/`matches` werden
  nur bei erfolgreichem Match ersetzt).

#### 5. UI-Locking (funktional, nicht nur visuell)

- `src/components/SearchForm.tsx`: Skills-, TargetRole-, City-Inputs `disabled={busy}`
  (zusätzlich zum bereits deaktivierten Submit-Button).
- `src/components/CvUpload.tsx`: `handleFile`-Guard um `busy` erweitert
  (Dropzone kann während der Suche keine Verarbeitung starten);
  EditableProfile-Inputs (Skills, Erfahrungslevel, Zielrolle, Stadt) `disabled={busy}`;
  Confirm-Button war bereits disabled.
- `ModelSelector` war bereits über `disabled={isSearching}` gesperrt.
- Re-Entrancy-Guard `busyRef` (useRef, synchron) am Anfang von `runSearch` und im
  Modellwechsel-Pfad → greift auch gegen Enter-/requestSubmit-/programmatische Auslösung.
- Nach Erfolg ODER Fehler: `phase` → `idle`, UI wieder frei.

#### 6. Server-Schutz (api/match.mjs)

- `fetchAllJobs`-Import und -Fallback entfernt.
- `/api/match` ohne `jobs` (oder leeres `jobs`) → HTTP 400 `bad_request`,
  `chat` wird NICHT aufgerufen.
- Kein `fetchAllJobs()` mehr aus dem Match-Handler möglich.
- Keine Änderung an `api/_lib/sources/` oder Apify-Cache-Logik.

### Tests

Gezielt neu/angepasst:

- `src/App.test.tsx` — neuer Describe-Block „Matching Retry ohne Job-Re-Fetch":
  - Test 1: Erste Suche → `fetchJobs` genau 1×
  - Test 2: Erfolgreiches Matching → kein weiterer Job-Fetch
  - Test 3: Matching-Fehler → Dataset bleibt erhalten; Re-Match nutzt vorhandene Jobs
  - Test 4: Modellwechsel nach Fehler → `fetchJobs` NICHT erneut
  - Test 5: Modellwechsel → `fetchMatches` mit exakt vorhandenem Dataset (+ Modell-ID)
  - Test 6: Suchparameteränderung → Dataset invalidiert (kein Match auf altem Dataset)
  - Test 7: Neue Suche → `fetchJobs` wieder erlaubt
  - Test 8: Suchmaske während der Suche disabled
  - Test 8b: CV-EditableProfile-Inputs während der Suche disabled
  - Test 9: Model-Combobox während der Suche disabled
  - Test 10: paralleler zweiter Suchstart wird verhindert (Guard, via `fireEvent.submit`)
- `tests/api/match-cache.test.mjs`:
  - Test 11: `/api/match` ohne jobs → 400 `bad_request`, kein `chat`
  - `/api/match` mit leerem jobs-Array → 400 `bad_request`
  - Strukturell: Match-Handler importiert `fetchAllJobs`/`_lib/jobs` NICHT mehr

Bestehende Tests wurden NICHT entfernt oder abgeschwächt.

Regression insbesondere geprüft:
- „Old results stay visible" (Tests A–G) grün
- Fallback-Note / effectiveModel grün
- SearchForm Hero → Sidebar Remount grün
- CV-Flow grün
- ModelSelector-Tests (Test E/F/G) grün
- Test M (Erweitern löst keine Requests aus) grün

### Ergebnis / Gate

| Prüfung | Ergebnis |
|---|---|
| Gezielte neue/angepasste Tests | grün |
| `npm test` | 130/130 grün (16 Dateien) |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| `git diff --check` | sauber |
| Secret Audit | sauber (keine Keys/Tokens/ENV in Diff) |

Keine Live-AI-Requests. Kein Apify-Live-Test. Kein Deployment. Kein Preview.

### Betroffene Dateien

- `src/App.tsx` — Dataset-State, `runSearch`/`performMatch`-Trennung, Guard,
  `handleModelChange`, `handleProfileChange`
- `src/components/SearchForm.tsx` — Suchfelder disabled bei busy
- `src/components/CvUpload.tsx` — Dropzone-Guard, EditableProfile-Inputs disabled
- `api/match.mjs` — jobs Pflicht (400), `fetchAllJobs`-Fallback entfernt
- `src/App.test.tsx` — neue Feature-Tests (Tests 1–10, 8b)
- `tests/api/match-cache.test.mjs` — Server-Schutz-Tests (Test 11 + strukturell)

### Git Branch / Commit / Push

- Branch: `feature/matching-retry-no-refetch`
- HEAD == origin/feature/matching-retry-no-refetch (nach Push verifiziert)
- KEIN Merge nach main. KEIN Production/Preview.

### Offene Punkte

- Kein BLOCKED. Nächste Steps (Preview/Abnahme, Merge, Deployment) sind PENDING
  und werden separat freigegeben.

## Step 3 — Production Verification

Status: BLOCKED

Commit: (nach Push aktualisiert)

### Deployment-Verifikation (VOR dem Test, gemäß Regel)

Vor jedem Production-Test wurde geprüft, ob Production den Feature-Code enthält:

| Prüfung | Ergebnis |
|---|---|
| Git Feature-HEAD | `12d547f` (feature/matching-retry-no-refetch) |
| Git `origin/main` / `main` | `4fa80b4` |
| Feature-Commit `12d547f` in main | NEIN (Branch nicht gemergt) |
| Production Deployment Commit (Footer `commitSha` aus deployed Client-Bundle) | `6ff72e7` (älteres Timeout-Feature-Deployment) |
| Production Build SHA == Feature-Commit | NEIN |

Feature-Marker im deployed Production-Bundle (`index-D5VSUyLy.js`,
https://mays-job-matcher.vercel.app/assets/index-D5VSUyLy.js):

| Marker | Im Production-Bundle |
|---|---|
| `busyRef` | ABSENT |
| `performMatch` | ABSENT |
| `handleModelChange` | ABSENT |
| `handleProfileChange` | ABSENT |
| `JobDataset` | ABSENT |
| `This endpoint requires the job list` (Server-Message) | ABSENT |
| `model_unavailable` / `Bewerte deine Treffer mit KI…` (Alt-Code) | PRESENT |

Fazit: **Production enthält den Feature-Commit NICHT.**

### Konsequenz (laut Vorgabe)

Regel: „Wenn Production NICHT den aktuellen Feature-Code enthält: STOPP.
Kein eigenmächtiges Production-Deployment. In diesem Fall melden:
'Production enthält Feature noch nicht.'"

→ **KEIN Production-Test ausgeführt.**
→ **KEIN eigenmächtiges Deployment.**
→ **KEINE Requests an Production gesendet** (kein `/api/jobs`, kein `/api/match`,
   kein AI-Request, kein Apify-Request).

### Dokumentationspflicht (Punkte 1–14)

1. Production Deployment / Commit: `6ff72e7` (verifiziert via deployed Bundle `commitSha`); Feature `12d547f` NICHT deployed.
2. getestete Suche: NICHT getestet (Feature nicht deployed).
3. initiale Job-Fetch-Requests: nicht direkt verifiziert (kein Test).
4. initiale Match-Requests: nicht direkt verifiziert (kein Test).
5. Model-Retry: nicht direkt verifiziert (kein Test).
6. `/api/jobs` während Model-Retry: nicht direkt verifiziert (kein Test).
7. Apify-Verhalten: nicht direkt verifiziert (kein Test, bewusst kein Apify-Probe-Request).
8. `/api/match` während Model-Retry: nicht direkt verifiziert (kein Test).
9. UI-Locking: nicht direkt verifiziert (kein Test; in Step 2 per Unit-Tests abgedeckt).
10. Dataset-Persistenz: nicht direkt verifiziert (kein Test; in Step 2 per Unit-Tests abgedeckt).
11. Suchparameter-Invalidierung: nicht direkt verifiziert (kein Test).
12. Ergebnis: **BLOCKED** — Production enthält Feature noch nicht.
13. Kosten-/Request-Befund: 0 zusätzliche Requests an Production (kein `/api/jobs`, kein `/api/match`, kein AI, kein Apify). Keine Kosten entstanden.
14. Unerwartete Beobachtungen: keine.

### GIT

- Nur Dokumentation geändert (`docs/reports/FEATURE_MATCHING_RETRY_NO_REFETCH.md`).
- Commit + Push, HEAD == origin verifiziert.
- KEIN Merge nach main. KEIN Branch-Löschen. KEIN Deployment.

### Nächster sinnvoller Step

Feature zuerst nach `main` mergen und auf Production deployen (separate Freigabe).
Danach Step 3 erneut möglich — erst dann ist der Production-Test zulässig.

## Step 4 — Merge Preparation

Status: COMPLETE → MERGE-READY

Commit: (nach Push aktualisiert)

### 1. Git / Branch-Analyse

| Prüfung | Ergebnis |
|---|---|
| Aktueller Branch | `feature/matching-retry-no-refetch` |
| Feature HEAD | `d25a8f8` |
| origin Feature HEAD | `d25a8f8` (in Sync) |
| main HEAD | `4fa80b4` |
| origin/main | `4fa80b4` (in Sync) |
| Merge Base | `4fa80b4` == main HEAD |
| Fast-forward möglich | **JA** (Feature ist strikter Nachfahre von main, kein Rebase/Merge-Commit nötig) |
| Commits auf Feature (nicht in main) | `12d547f` (Feature-Code), `d25a8f8` (Step-3-Docs) |

Kein History-Rewrite durchgeführt.

### 2. Feature-Scope

`git diff main...feature/matching-retry-no-refetch`: 7 Dateien, +637 / −52.

| Datei | Änderung | Scope |
|---|---|---|
| `src/App.tsx` | Dataset-State, runSearch/performMatch-Split, handleModelChange, handleProfileChange, busyRef-Guard, describeError/profilesEqual | Feature-kern |
| `src/components/SearchForm.tsx` | 3 Inputs `disabled={busy}` | UI-Locking |
| `src/components/CvUpload.tsx` | Dropzone-Guard + 4 EditableProfile-Inputs `disabled={busy}` | UI-Locking |
| `api/match.mjs` | jobs-Pflicht (400 bad_request), `fetchAllJobs`-Fallback entfernt | Server-Schutz |
| `src/App.test.tsx` | +237 (11 Feature-Szenarien) | Tests |
| `tests/api/match-cache.test.mjs` | +24 (Server-400-Tests) | Tests |
| `docs/reports/FEATURE_MATCHING_RETRY_NO_REFETCH.md` | Feature-Report | Dokumentation |

Alle 50 entfernten Zeilen (exkl. Headers) sind Teil der beabsichtigten Entkopplung:
- `api/match.mjs`: `fetchAllJobs`-Import + jobs-Fallback → 400-Pflicht
- `src/App.tsx`: `runSearch`-Zusammenlegung → Split in runSearch/performMatch; 2 `onChange`-Props → neue Handler
- `src/components/CvUpload.tsx`: `if (processing) return;` → `if (processing || busy) return;` (additiv)

Keine Datei außerhalb des Feature-Scope verändert.

### 3. Bestehende Features — Absolut-Regel

Vollständiger Diff geprüft: **KEINE bestehende Funktion entfernt.**

| Feature | Status |
|---|---|
| Jobquellen (Apify, Arbeitnow, Arbeitsagentur, `_lib/jobs.mjs`, `_lib/sources/`) | unverändert |
| Apify-Cache / Cache-Logik | unverändert |
| Matching-Funktionen (`keywordHits`, `tokenize`, `filter.mjs`, `ai.mjs`) | unverändert |
| Fallback-Logik (`withModelFallback`, `model_unavailable`) | unverändert |
| ModelSelector-Funktionen | unverändert |
| CV-Flow (`CvUpload`, PDF-Lesen) | unverändert (nur additive Busy-Sperre) |
| Old-results-visible (Ergebnisse bleiben bis zum Erfolg sichtbar) | erhalten (`setFoundJobs` nur bei Erfolg) |
| Such-Validierung (noSkills/noJobs/noJobsCity-Warnungen) | erhalten (identisch in runSearch/performMatch) |
| Quota-/Unavailable-Fehlermeldungen | erhalten (`describeError` identische Pfade) |
| Effektive-Model-/Recommended-Logik | erhalten |

### 4. Server-Änderung (api/match.mjs)

- `/api/match` ohne `jobs` (oder leeres Array) → HTTP 400 `bad_request`,
  Meldung: „This endpoint requires the job list. Run a search first to get jobs."
- kein `fetchAllJobs()`-Aufruf mehr möglich aus dem Handler (Import entfernt)
- kein Apify-/Job-Source-Fetch über Match-Pfad
- Caller-Audit (erneut): Frontend `fetchMatches` sendet `jobs` immer; Cron-Digest nutzt
  `fetchFilteredJobs` (Arbeitnow) separat; Tests senden `jobs` in Erfolgsfällen
- Job-Source-Implementierungen (`_lib/sources/`) unverändert

### 5. Tests / Regression (alle grün)

| Gate | Ergebnis |
|---|---|
| `npm test` | **130/130 PASS (16 Dateien)** |
| `npx tsc -b` | PASS |
| `npm run build` | PASS (vite build ok) |
| `git diff --check` | sauber |
| Secret Audit | sauber (keine Keys/Tokens/ENV in Diff) |

Regressionsbereiche geprüft: SearchForm (Test E/F/G), CV-Flow (Tests in CvUpload),
ModelSelector, Fallback-Note, Old-results-visible (Tests A–G), Remount (Hero↔Sidebar),
Matching, API /api/match — alle bestehenden Tests unverändert grün.

### 6. Feature-Tests (11 Szenarien)

| # | Szenario | Test |
|---|---|---|
| 1 | Erste Suche → Job-Fetch genau einmal | Test 1 (`toHaveBeenCalledTimes(1)`) |
| 2 | Erfolgreiches Matching → kein weiterer Job-Fetch | Test 2 |
| 3 | Matching-Fehler → Dataset bleibt erhalten | Test 3 |
| 4 | Modellwechsel nach Fehler → kein Job-Fetch | Test 4 (`mock.calls.length` unverändert) |
| 5 | Modellwechsel → Matching mit vorhandenem Dataset | Test 5 (fetchMatches mit exaktem Dataset + Modell) |
| 6 | Suchparameteränderung → Dataset invalidiert | Test 6 |
| 7 | Neue Suche → Job-Fetch wieder erlaubt | Test 7 (`2` Calls) |
| 8 | Suchmaske während busy disabled | Test 8 (Skills/Zielrolle/Stadt) |
| 9 | Model-Combobox während busy disabled | Test 9 |
| 10 | Paralleler Suchstart verhindert | Test 10 (Re-Entrancy-Guard) |
| 11 | /api/match ohne jobs → 400 ohne fetchAllJobs | match-cache: „/api/match ohne jobs → 400 bad_request und KEIN fetchAllJobs/Apify", „mit leerem jobs-Array → 400" |

Keine Production-Requests. Keine Apify-Live-Requests. Keine AI-Requests.

### 7. Deployment-Identität

- Production enthält den Feature-Code derzeit NICHT (in Step 3 verifiziert:
  deployed Bundle `commitSha 6ff72e7`, Feature-Marker ABSENT).
- In diesem Step NICHT getestet/deployt.
- Nach dem Merge wird Production anhand der tatsächlichen Deployment-/Build-Identität erneut geprüft.

### 8. Zusammenfassung / Ergebnis

- Merge-Vorbereitung: **COMPLETE**
- Feature HEAD: `d25a8f8` · main HEAD: `4fa80b4` · Merge Base: `4fa80b4`
- Fast-forward: **JA**
- Feature-Scope: klein, additiv, ausschließlich Feature-Zweck
- Bestehende Features: alle erhalten (kein Löschen/Deaktivieren)
- Tests: 130/130 · Build: PASS · tsc: PASS · diff-check: sauber · Secret Audit: sauber
- Deployment-Hinweis: Production enthält Feature noch nicht (Merge + Deploy separat freigegeben)

### 9. Git

- Commit für Step-4-Dokumentation erstellt, Push nur auf
  `origin/feature/matching-retry-no-refetch`.
- HEAD == origin/feature/matching-retry-no-refetch (nach Push verifiziert).
- KEIN Merge nach main. KEIN Branch-Löschen. KEIN Deployment.

### Offene Punkte

- Keine BLOCKED-Gründe. Nächste Schritte (Merge nach main, Deployment, Production-Test,
  Branch-Cleanup) sind PENDING und benötigen separate Freigabe.

## Step 5 — Merge nach main

Status: **PASS**

### Merge-Methode

`git merge --ff-only feature/matching-retry-no-refetch` (ausgeführt auf main).
KEIN Rebase. KEIN Merge-Commit. KEINE History-Rewrite.

### Werte

| Wert | Vorher | Nachher |
|---|---|---|
| Feature HEAD | `624a878` | — |
| main HEAD | `4fa80b4` | `624a878` |
| origin/main | `4fa80b4` | `624a878` (gepusht) |
| Fast-forward | JA (Merge Base == main HEAD) | — |

### Feature-Commits vollständig in main enthalten

`12d547f` (Feature-Code), `d25a8f8` (Step-3-Docs), `624a878` (Step-4-Docs) — alle via FF in main.

### Working Tree

Sauber (nur dauerhaft untracked: `ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/` — nicht Teil des Deploys).

### Post-Merge-Gate (alle PASS)

| Gate | Ergebnis |
|---|---|
| `npm test` | **130/130 PASS (16 Dateien)** |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| `git diff --check` | sauber |
| Secret Audit | sauber (nur `tokenize`-Code-/Report-Texttreffer, keine Secrets, keine `process.env`-Refs) |

### Bestehende Features erhalten

Vollständiger Diff gegen Vor-Merge-main geprüft: Jobquellen, Apify/Cache, Matching,
`withModelFallback`, ModelSelector, CV-Flow, Old-results-visible,
Quota/Unavailable-Fehler, effectiveModel-Logik — alle unverändert. Nur die
beabsichtigte Entkopplung (Dataset-Persist, runSearch/performMatch, UI-Lock,
Server-400-Pflicht) ist hinzugekommen.

## Step 6 — Production Deployment

Status: **PASS**

### Deployment-Identität

| Eigenschaft | Wert |
|---|---|
| Production URL | https://mays-job-matcher.vercel.app |
| Deployment-URL | https://mays-job-matcher-jxejqop3z-maymilly.vercel.app |
| Deployment ID (Vercel API) | `dpl_5wY5XN9z7TWNXrfib645ffNxhU4t` |
| Environment (Vercel API) | `production` |
| State (Vercel API) | `READY` |
| tatsächlicher Deployment-Commit (Vercel API `meta.gitCommitSha`) | `624a8785def3b1807eb8bc8bcd1e443b68b459d8` |
| main HEAD | `624a8785def3b1807eb8bc8bcd1e443b68b459d8` |
| Deployment-Commit == main HEAD | **JA** (exakter String-Vergleich) |

Deployment erfolgte aus einem sauberen git-Worktree von exakt `624a878`
(detached HEAD), damit der Inhalt exakt dem gemergten main-Stand entspricht
(keine untracked Dateien im Deploy-Payload). Deployment via Vercel CLI `--prod`.

### Build-/Feature-Identität (hart verifiziert)

1. Deployment-Commit per Vercel-API ausgelesen: == main HEAD (siehe oben).
2. Deployed Client-Bundle (`/assets/index-CAjHj6ol.js`) heruntergeladen.
3. Lokaler Rebuild von exakt `624a878` im detached Worktree mit
   Vercel-äquivalenter Build-Env (`VERCEL_ENV=production`, `VERCEL_GIT_COMMIT_SHA=""`,
   `VERCEL_GIT_COMMIT_REF=""`) → identisches Bundle `index-CAjHj6ol.js`.
4. SHA-256: `3f50ab61…` == `3f50ab61…` → **Bundle byte-identisch**.

⇒ Der Production-Client enthält exakt den Code von main `624a878`, inklusive
Feature-Code (Dataset-State, runSearch/performMatch, handleModelChange,
handleProfileChange, busyRef-Guard, UI-Lock).

### Feature-Marker / Server-Verhalten

- `buildInfo` im Bundle gebacken: `production` (Env), Branch `HEAD` (detached),
  `commitSha` leer (CLI-Deploy setzt kein `VERCEL_GIT_COMMIT_SHA`; der
  authoritative Deployment-Commit stammt aus der Vercel-API, siehe oben).
- Server-Verhalten `/api/match` ohne jobs → 400 `bad_request`:
  **nicht direkt per Request verifiziert** (laut Vorgabe „Keine /api/match-Anfrage");
  abgedeckt durch Unit-Tests (`tests/api/match-cache.test.mjs`) und dadurch, dass
  das Deployment aus exakt dem Commit mit dieser Server-Logik gebaut wurde.

### Technische Smoke Tests (kostenfrei, kein AI/Apify)

| Endpoint | HTTP |
|---|---|
| `/` | 200 |
| `/top` | 200 |
| `/api/model` | 200 (`{"model":"dots-studio/dots-3-note-preview:free"}`) |
| `/api/models` | 200 (Modell-Liste, OpenRouter) |

Keine `/api/match`-, keine `/api/jobs`-Anfrage, kein Apify-/AI-Request ausgeführt.

### Requests / Kosten

0 zusätzliche kostenpflichtige Requests. Kein AI. Kein Apify. Kein Job-Source-Fetch.

### Unerwartete Beobachtungen

- Vom CLI erzeugtes Deployment baked keine `VERCEL_GIT_COMMIT_SHA` ein →
  Footer-Commit-SHA im Bundle leer (kosmetisch; Deployment-Commit ist über die
  Vercel-API belegt und Bundle wurde byte-identisch zum Commit-Build verifiziert).
- `.vercel/` ist nur lokal vorhanden (nicht getrackt); für exakte Inhaltsdeployments
  wurde ein Worktree-Ausbau des main-Commits verwendet.

## Feature-Branch

Noch NICHT gelöscht (laut Vorgabe: Löschung erst nach Production-Test + vollständigem
Feature-Abschluss in separatem Step freigeben).

## Offene Punkte

Nächster Schritt (PENDING, separate Freigabe): gezielte Production-Verifikation des
Features (kontrollierte Suche, Model-Retry ohne Job-Re-Fetch, Request-Nachweis).