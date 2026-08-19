# Feature: Matching Retry without Job Re-Fetch

Branch:
feature/matching-retry-no-refetch

Base:
main

Aktueller Step:
Step 3

Aktueller Status:
BLOCKED — Production enthält Feature noch nicht (kein Production-Test möglich)

## Step-Matrix

| Step | Thema | Status | Commit |
| 1 | Repository-Analyse + Architekturplan (KEINE Codeänderung) | COMPLETE | (Analyse in Chat, kein Commit) |
| 2 | Implementierung: Dataset-Persist, Search/Match-Trennung, UI-Lock, Server-Schutz, Tests | COMPLETE | 12d547f |
| 3 | Production Verification | BLOCKED | (nach Push aktualisiert) |

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