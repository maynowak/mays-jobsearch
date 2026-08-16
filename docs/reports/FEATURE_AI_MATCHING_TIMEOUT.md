# Feature: AI Matching Timeout & Fallback Responsiveness

Branch:
feature/ai-matching-timeout

Base:
main

Aktueller Step:
Step 8

Aktueller Status:
COMPLETE

## Step-Matrix

| Step | Thema | Status | Commit |
| 1 | Bestandsanalyse | COMPLETE | 0079993 |
| 2 | Timeout-Werte senken + Fehler-Codes + Client-Unterscheidung | COMPLETE | 9eb4813 |
| 3 | Fallback-/Performance-Verifikation | COMPLETE | 7fb86df |
| 4 | Development Live Test | COMPLETE | 6e7cc5d |
| 5 | Preview / Abnahme | COMPLETE | 3133446 |
| 6 | Merge-Vorbereitung | COMPLETE | 410c095 |
| 7 | Merge nach main | COMPLETE | 2709a5d |
| 8 | Production Deployment | COMPLETE | 1c65946 |
| 9 | Performance-/Live-Verifikation | PENDING | — |

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

Die sehr langen Wartezeiten beim AI-Matching untersuchen (Root Cause), ohne vorschnell
Timeout-Werte zu ändern. Diagnose lokal/Development, KEIN Production-Deploy, keine
AI-Live-Requests, keine Provider-/Env-/Secret-Änderungen.

## Production-Diagnoseinput (Screenshot-Hinweise, KEINE Root-Cause-Beweise)

`/api/match` → HTTP 502; Fallback-Sequenz:

- attempt=1 model=cf/meta-llama/llama-2-7b-chat-hf provider=EdenAI status=502 code=model_unavailable → fallback
- attempt=2 model=dots-studio/dots-3-note-preview:free status=502 code=model_unavailable → fallback
- attempt=3 model=cohere/north-mini-code:free status=502 code=model_unavailable → no more fallbacks

## Step 1 — Bestandsanalyse

Status: COMPLETE

Commit: 0079993

### AUSGANGSLAGE (Git)

- main == origin/main == `d9ab072` (Working Tree sauber, nur dauerhafte untracked Dateien)
- Feature-Branch `feature/ai-matching-timeout` von main erstellt und gepusht

### UNTERSUCHTE DATEIEN

- `api/_lib/ai.mjs` — re-exportiert `chat` aus `providers/index.mjs`; kein Timeout-Logik
- `api/_lib/providers/index.mjs` — Provider-Loop, Fallback-Logik, `isProviderExhausted`-Weiche
- `api/_lib/providers/edenai.mjs` — EdenAI-Provider, Timeout, Status-Mapping
- `api/_lib/providers/openrouter.mjs` — OpenRouter-Provider, Timeout, Status-Mapping
- `api/_lib/providers/errors.mjs` — `AiError`, `ERROR_CODES`, `isProviderExhausted`
- `api/_lib/model.mjs` + `api/_lib/models.mjs` — Modell-Konfiguration / Resolver-Re-Export
- `api/_lib/config.mjs` — `modelFallbackMaxAttempts` (Default 3)
- `api/match.mjs` — Endpoint, liest `x-mj-attempt`, ruft `chat` auf
- `api/cover-letter.mjs`, `api/profile.mjs` — gleiche `chat`-Nutzung (betroffen, aber Fokus Matching)
- `api/models.mjs`, `api/model.mjs` — Modell-Listen-/Default-Endpoints
- `api/_lib/sources/apify/client.mjs` — Apify-Client (Job-Source, kein AI); eigener Polling-Mechanismus
- `src/api.ts` — **Client-Fallback-Logik** `withModelFallback`, `fallbackOrder`, `isModelUnavailable`
- `src/App.tsx` — Matching-Aufruf über `withModelFallback` mit `request` = `fetchMatches`
- `src/components/LetterModal.tsx`, `src/components/CvUpload.tsx` — gleiche Client-Fallback-Nutzung
- `src/hooks/useAvailableModels.ts` — lädt Modell-Liste, setzt `fallbackMaxAttempts`
- `vercel.json` — `maxDuration: 60` für `api/**/*.mjs`

### ZEITMESSUNG (aus Code abgeleitet)

1. **Expliziter Timeout vorhanden?** JA, pro Provider-Chat-Aufruf via `AbortSignal.timeout`.
2. **Wie hoch?** EdenAI `TIMEOUT_MS = 55_000` (55 s, `edenai.mjs:8`); OpenRouter `TIMEOUT_MS = 40_000` (40 s, `openrouter.mjs:16`).
3. **Wo gesetzt?** In `edenai.mjs:283` und `openrouter.mjs:256` als `signal: AbortSignal.timeout(TIMEOUT_MS)` im `fetch(CHAT_URL, ...)`.
4. **Pro Versuch?** JA — jeder Provider-Chat-Aufruf hat sein eigenes `AbortSignal.timeout`. Der Client startet pro Modell-Versuch einen NEUEN `/api/match`-Request (siehe unten).
5. **HTTP 502 / model_unavailable → sofort zurückgefallen?** Im **Server** NEIN: `isProviderExhausted()` umfasst NUR `freeQuotaExceeded`, `quotaExhausted`, `insufficientCredits`, `limitReached`. `model_unavailable` ist dort NICHT enthalten → ein `model_unavailable` wird sofort weitergeworfen (`index.mjs:90`), der Provider-Loop macht für dieses Modell KEINEN weiteren Versuch. Der Server-Fallback greift also nur bei Quota/Credits/Limit — nicht bei `model_unavailable`.
6. **Wartet der Code trotzdem bis zum Timeout?** Im Server nur, wenn der Provider gar nicht antwortet (Timeout-Zweig). Bei sofortigem HTTP-502 antwortet der Provider schnell → kein langes Warten pro Versuch. DAS Problem liegt woanders: siehe 9.
7. **Mehrere Timeout-Schichten?** JA, drei:
   - Provider-fetch: `AbortSignal.timeout` 40 s (OpenRouter) / 55 s (EdenAI)
   - Vercel: `maxDuration: 60` s pro Function-Invocation (`vercel.json`) → **Vercel bricht bei 60 s ab, bevor ein EdenAI-Timeout von 55 s + Overhead komplett ablaufen könnte** (Risiko eines Vercel-Abbruchs statt sauberem 502)
   - Apify-Client: eigener Polling-/`maxWaitMs`-Mechanismus (Job-Source, nicht AI)
8. **Provider-seitige Wartezeiten nicht kontrollierbar?** JA — die reine Antwortzeit des Providers (bis der HTTP-Status zurückkommt) läuft in `fetch`; `AbortSignal.timeout` begrenzt nur die Gesamtdauer, nicht die Provider-Bearbeitungszeit. Wenn der Provider bei 502 langsam antwortet, ist diese Zeit unkontrolliert.
9. **Maximale Dauer eines einzelnen AI-Versuchs?** Bis zu 55 s (EdenAI) bzw. 40 s (OpenRouter) Timeout, aber durch Vercel `maxDuration: 60` s effektiv auf ~60 s gedeckelt. ACHTUNG: Bei langer Provider-Antwortzeit (> ~55 s EdenAI) kann Vercel die Invocation vor dem sauberen Timeout-Abbruch beenden.
10. **Maximale Dauer einer kompletten Fallback-Kette?** Der Client (`withModelFallback`, `src/api.ts:119`) probiert sequenziell mehrere Modelle, jedes als eigener `/api/match`-Request (`fallbackOrder` + `fallbackMaxAttempts` = 3 aus `config.mjs`). Worst Case: 3 × bis zu ~60 s (Vercel-Limit) = **bis zu ~180 s** sichtbare Wartezeit. Der Screenshot-Befund (sehr lange Wartezeit bei 3 Versuchen) passt genau dazu.

### ROOT CAUSE / KERNFINDUNG

**Die lange Wartezeit entsteht NICHT durch ein einzelnes Timeout, sondern durch die SERIELLE Client-Fallback-Kette aus bis zu 3 vollständigen `/api/match`-Requests, deren Gesamtdauer durch Vercel `maxDuration: 60 s` pro Request auf bis zu ~180 s kumuliert.**

- Der Server macht bei `model_unavailable` bewusst KEINEN weiteren Versuch (`isProviderExhausted` schließt es aus) → jeder `/api/match`-Request endet nach dem ersten fehlgeschlagenen Provider-Aufruf mit 502.
- Der Client interpretiert `model_unavailable` als transient (`isModelUnavailable`, `api.ts:45`) → startet den nächsten Modell-Versuch als neuen Request.
- Pro Versuch kann die tatsächliche Provider-Antwortzeit (bis zum 502 oder bis zum Timeout-Abbruch) sehr hoch sein; mit 3 Versuchen summiert sich das.

### A/B/C-TRENNUNG (Design-Punkt)

- **A) Modell sofort nicht verfügbar (502 / model_unavailable):** Server erkennt HTTP 502 direkt und wirft `modelUnavailable` sofort (`edenai.mjs:341`, `openrouter.mjs:304`). ✓ sauber für den Einzelversuch. ABER: `model_unavailable` löst im Client einen weiteren Request aus (transient), und der Server behandelt es NICHT als Fallback-fähig — die beiden Fallback-Ebenen widersprechen sich teilweise in der Semantik.
- **B) Netzwerk-/Provider-Timeout:** `AbortSignal.timeout` bricht nach 40/55 s ab; der Catch-Zweig mappt **Timeout UND Netzwerkfehler beide auf `model_unavailable`** (`edenai.mjs:285-293`, `openrouter.mjs:258-262`) — der Fehler-Code `timeout`/`network_error` existiert in `errors.mjs` (Kategorie provider), wird aber in diesem Pfad NIE gesetzt. Eine Unterscheidung Timeout ≠ Modell-502 geht dadurch im Client verloren.
- **C) Erfolgreicher Request:** normal verarbeitet. ✓

**Fazit A/B/C:** Die drei Fälle werden im Server-Antwortpfad nur teilweise getrennt. Entscheidend: Timeout/Netzwerk wird auf `model_unavailable` reduziert und ist damit für den Client nicht von „Modell sofort tot" unterscheidbar. Für die Fallback-Entscheidung im Client ist `model_unavailable` transient (weiterer Versuch), was bei einem echten Timeout unnötig lange dauert.

### VERMUTETER HAUPTHEBEL (für spätere Optimierung, NOCH KEINE ÄNDERUNG)

- Reduktion der seriellen Client-Kette: schneller erkennen, ob ein Modell sofort tot ist (502) vs. nur langsam (Timeout) — z. B. `timeout`-Code statt `model_unavailable` bei Abort-Zweig setzen, damit der Client Timeouts anders behandeln kann.
- Timeout-Werte auf ein Niveau senken, das sicher unter Vercel `maxDuration: 60 s` liegt (z. B. EdenAI 55 s → 30 s, OpenRouter 40 s → 25 s), damit Vercel nicht vor dem sauberen Abbruch kappt.
- Prüfen, ob ein Einzel-`/api/match`-Request vorzeitig mit einem sauberen 502/`timeout` beendet werden kann, statt die gesamte Kette im Client zu durchlaufen.
- Prüfen, ob `isProviderExhausted` bzw. die Server-Semantik von `model_unavailable` so erweitert werden kann, dass der Server innerhalb eines Requests schneller den nächsten Fallback nimmt (Verhaltensänderung — nur mit Tests absichern).

### MINIMALE SICHERE ÄNDERUNG (VORSCHLAG FÜR STEP 2, NICHT DIESER STEP)

1. In `edenai.mjs`/`openrouter.mjs` den Timeout-Catch so ändern, dass Timeout/Netzwerk als eigener Fehler-Code (`timeout`/`network_error`) geworfen wird statt `model_unavailable` (Unterscheidbarkeit für Client).
2. Timeout-Werte reduzieren (sicher unter Vercel `maxDuration`).
3. Client (`isModelUnavailable` / `withModelFallback`) anhand der neuen Codes entscheiden: sofortiges 502 → weiter; Timeout → nicht unnötig weiter oder mit verkürzter Wartezeit.
4. Tests ergänzen/absichern (Server: Timeout-Code; Client: Unterscheidung 502 vs. Timeout).

### RISIKEN

- **Änderung an der Server-Fallback-Semantik** (`isProviderExhausted` / `model_unavailable`) kann das bisher dokumentierte Verhalten („Nicht-Quota-Fehler wird direkt weitergegeben", `tests/api/providers.test.mjs:115`) verändern → Tests betroffen.
- **Timeout-Senkung** könnte legitime, langsamere aber erfolgreiche Antworten abschneiden → Trade-off Responsiveness vs. Erfolgsquote.
- **Vercel maxDuration 60 s** ist eine harte Grenze; jede Verlängerung der Kette innerhalb eines Requests ist ohne Erhöhung des Limits nicht möglich.

### ERGEBNIS

- Root Cause: serielle Client-Fallback-Kette (bis zu 3 `/api/match`-Requests) × hohe Provider-/Timeout-Dauer pro Versuch, gedeckelt durch Vercel `maxDuration: 60 s` → bis zu ~180 s sichtbare Wartezeit.
- Timeout-Werte: EdenAI 55 s, OpenRouter 40 s (pro Provider-Chat); Vercel 60 s hart.
- Fallback-Verhalten: Server nur bei Quota/Credits/Limit; `model_unavailable` wird im Client als transient behandelt (neuer Request).
- A/B/C nur teilweise getrennt: Timeout/Netzwerk → wird auf `model_unavailable` gemappt.
- Zuständige Stellen: `edenai.mjs`, `openrouter.mjs`, `providers/index.mjs`, `errors.mjs`, `src/api.ts`, `config.mjs`, `vercel.json`.
- NOCH KEINE Code-Änderung in Step 1.

### GIT-STAND

- Branch: `feature/ai-matching-timeout`
- Commit: siehe Step-Matrix (nach Push aktualisiert)

## Step 2 — Timeout-Werte senken, Fehler-Codes unterscheiden, Client-Fallback anpassen

Status: COMPLETE

Commit: 9eb4813

### ÄNDERUNGEN (3 Bausteine)

1. **Timeout-Werte gesenkt (sicher unter Vercel `maxDuration: 60`)**
   - EdenAI: `TIMEOUT_MS` 55 s → **30 s** (`api/_lib/providers/edenai.mjs`)
   - OpenRouter: `TIMEOUT_MS` 40 s → **25 s** (`api/_lib/providers/openrouter.mjs`)

2. **Timeout/Netzwerk als eigene Fehler-Codes (A/B-Trennung)**
   - In beiden Providern wird der fetch-Catch-Zweig nicht mehr pauschal auf `model_unavailable`
     gemappt:
     - Timeout/Abort (`AbortSignal.timeout`) → **`timeout`**, HTTP 504
     - Netzwerkfehler (fetch-Reject) → **`network_error`**, HTTP 502
   - `ERROR_CODES.timeout` / `ERROR_CODES.networkError` existierten bereits
     (`errors.mjs`), werden aber jetzt erstmals im Chat-Pfad tatsächlich gesetzt.

3. **Client-Unterscheidung 502 vs. Timeout (`src/api.ts`)**
   - `timeout` und `network_error` zu `NON_TRANSIENT_CODES` hinzugefügt.
   - Effekt: `withModelFallback` fällt bei einem Timeout/Netzwerkfehler **nicht mehr zurück**
     (kein unnötiger weiterer `/api/match`-Request), sondern reicht den Fehler sofort weiter.
   - Sofortiges 502 / `model_unavailable` bleibt weiterhin transient → Fallback-Kette (wie bisher).

### VERHALTENSBESCHREIBUNG NACH DER ÄNDERUNG

- **A) Modell sofort tot (502, `model_unavailable`):** weiterhin schneller Fallback im Client.
- **B) Timeout (`timeout`, 504) / Netzwerk (`network_error`, 502):** Client stoppt sofort,
  kein weiterer Request → die serielle Fallback-Kette wird NICHT mehr mit Timeouts multipliziert.
- **C) Erfolg:** unverändert.

### ERWARTETE AUSWIRKUNG

- Worst-Case-Wartezeit eines einzelnen Versuchs sinkt von bis zu 55 s auf max. 30 s (EdenAI)
  bzw. 25 s (OpenRouter), deutlich unter Vercel `maxDuration: 60`.
- Timeouts verursachen keine multiplizierte Wartezeit mehr (vorher bis zu 3 × 55 s ≈ 165 s
  in der Client-Kette).

### TESTS

- `tests/api/edenai-provider.test.mjs`: Timeout → `timeout`/504, Netzwerk → `network_error`/502
- `tests/api/openrouter-provider.test.mjs` (NEU): Timeout → `timeout`/504, Netzwerk →
  `network_error`/502, 402 → `insufficient_credits`, Model-Katalog-Filterung, Chat-Request
- `src/api.test.ts`: `withModelFallback` fällt bei `timeout` und `network_error` NICHT zurück
- Gesamt: 116/116 Tests grün, `tsc -b` + `vite build` grün, `git diff --check` sauber,
  Secret Audit sauber

### RISIKEN / HINWEISE

- Timeout-Senkung kann langsamere, aber erfolgreiche Provider-Antworten abschneiden
  (Trade-off Responsiveness vs. Erfolgsquote) — bewusst gewählt zugunsten Responsiveness.
- Verhaltensänderung im Client (kein Fallback bei Timeout) ist bewusst: Ein Timeout ist
  meist provider-/netzwerkweit; ein weiterer Versuch verlängert nur die Wartezeit.
- `model_unavailable` bleibt für den Server-Loop unverändert (kein Providerwechsel im
  Server; siehe `tests/api/providers.test.mjs:115`).

### GIT-STAND

- Commit: 9eb4813 (gepusht)

## Step 3 — Fallback-/Performance-Verifikation

Status: COMPLETE

Commit: 7fb86df

### GEZIELTE TESTS (nur relevante, zuerst)

Ausgeführt (5 Dateien, 42 Tests, alle grün):

- `tests/api/edenai-provider.test.mjs` — Timeout→`timeout`/504, Netzwerk→`network_error`/502, 5xx→`model_unavailable`, Erfolg
- `tests/api/openrouter-provider.test.mjs` (neu) — Timeout/Netzwerk/402/Erfolg/Katalog
- `tests/api/providers.test.mjs` — Router-Loop, `model_unavailable` ohne Providerwechsel, Quota-Fallback
- `tests/api/match-cache.test.mjs` — `/api/match`-Endpoints
- `src/api.test.ts` — `withModelFallback`-Verhalten

### A/B/C/D-VERIFIKATION (Codepfad + gezielte Testläufe)

| Fall | Erwartung | Ergebnis |
| A) `model_unavailable` (502) | Fallback auslösen | ✓ `isModelUnavailable`→true; `providers.test.mjs`-Fallback-Tests grün |
| B) `timeout` (504) | KEIN unnötiger weiterer `/api/match`-Fallback | ✓ `timeout` in `NON_TRANSIENT_CODES`; `src/api.test.ts`-Test „fällt bei timeout NICHT zurück" grün |
| C) `network_error` (502) | KEIN unnötiger weiterer Fallback | ✓ `network_error` in `NON_TRANSIENT_CODES`; zugehöriger Test grün |
| D) Erfolgreicher Request | normales Verhalten unverändert | ✓ Provider-Chat-Erfolgstests grün |

Server-Loop-Check: `isProviderExhausted` enthält weder `timeout` noch `network_error`
(`errors.mjs:47`) → beide werden im Server-Loop sofort weitergeworfen, KEIN Provider-Wechsel,
KEIN Retry. `model_unavailable` ebenfalls nicht enthalten → wie dokumentiert (Test
`providers.test.mjs:115`).

### ZEITVERHALTEN (aus Codepfaden abgeleitet, kontrollierte Mocks)

- Single-Versuch max.: **EdenAI 30 s** (`edenai.mjs:8`), **OpenRouter 25 s** (`openrouter.mjs:16`),
  beide via `AbortSignal.timeout` im fetch. Zeitmessung liegt unter Vercel `maxDuration: 60`.
- `model_unavailable` (sofortiger HTTP-502): kein Warten bis Timeout — sofortiger Throw im Provider.
- Timeout/Netzwerk: Abort bricht den fetch nach 30/25 s ab; Client stoppt (kein Retry).
- **Max. Fallback-Kette:** `timeout`/`network_error` = 1 Versuch → STOPP (max. 30/25 s).
  `model_unavailable` = bis zu 3 schnelle Versuche (jeder endet sofort mit 502 → schnelle
  Antwort, KEINE Timeout-Addierung). KEIN „30 s + zusätzlicher Retry".
- Resterisiko (dokumentiert, bekannt): Model-Katalog-Fetch (`fetchEligibleModels`) hat keinen
  eigenen Timeout; bei kaltem Cache kann der erste Katalog-Abruf unbegrenzt dauern
  (Cache `CACHE_TTL_MS = 10 min` dämpft das im Normalbetrieb). Kein Scope von Step 3.

### REGRESSION (vollständige Suite + Build)

- `npm test`: **116/116 grün** (16 Dateien)
- `npx tsc -b`: grün
- `npm run build`: grün (vite build erfolgreich)

### BEWERTUNG

1. **Wird `model_unavailable` korrekt gefallbackt?** Ja — weiterhin transient (Client-Fallback aktiv).
2. **Werden `timeout`/`network_error` korrekt getrennt?** Ja — Server mappt Timeout→504/`timeout`,
   Netzwerk→502/`network_error`; beide sind eigenständige Codes (nicht mehr `model_unavailable`).
3. **Stoppt der Client bei `timeout`/`network_error`?** Ja — beide in `NON_TRANSIENT_CODES`,
   `isModelUnavailable`→false → `withModelFallback` reicht den Fehler sofort weiter.
4. **Gibt es unnötige Retries?** Nein — weder Server-Loop noch Client-Fallback wiederholen
   Timeout/Netzwerkfehler. `model_unavailable`-Kette ist gewollt (schnelle 502-Antworten).
5. **Max. Dauer eines einzelnen Versuchs:** 30 s (EdenAI) / 25 s (OpenRouter).
6. **Max. Dauer einer Fallback-Kette:** bei Timeout/Netzwerk 1× (30/25 s); bei `model_unavailable`
   bis zu 3 schnelle Versuche (keine Timeout-Addierung). Vorher (Step 1): bis zu 3 × 55 s ≈ 165 s.
7. **Plausible Reduktion ggü. Production-Screenshot?** Ja — die serielle 3-×-55-s-Kette ist durch
   Timeout-Senkung + Nicht-Fallback auf Timeout ersetzt. NICHT als bewiesen behauptet; Live-Test folgt in Step 4.
8. **Offensichtlicher Performance-Blocker?** Keiner im Chat-/Fallback-Pfad. Einzige Restlücke:
   Model-Katalog-Fetch ohne Timeout (siehe oben) — kein Blocker im Normalbetrieb (Cache).

### GIT-STAND

- Commit: siehe Step-Matrix (nach Push aktualisiert)
- Status vor Commit: Branch `feature/ai-matching-timeout`, HEAD == origin == vorheriger Checkpoint

## Step 4 — Development Live Test

Status: COMPLETE

Commit: 6e7cc5d

### DEVELOPMENT RUNTIME

- `vercel dev --listen 3000` gestartet (Vercel CLI 58.11.0, Node 22.23.1)
- Vite-Dev-Server auf dynamischem Port (46405), App auf **http://localhost:3000**
- Hürde: Vorhandenes `dist/` (Build-Artefakt) ließ Vercel das Framework als „static" erkennen
  → „Failed to detect a server running on port 37269". Nach temporärer Verschiebung von `dist/`
  startete Vercel Dev sauber; `dist/` wurde danach wiederhergestellt.
- Endpunkte: `GET /` HTTP 200, `GET /api/models` HTTP 200, `GET /api/model` HTTP 200,
  Vite-Module `/src/main.tsx`, `/src/App.tsx` HTTP 200.
- KEIN Preview, KEIN Production.

### UMGEBUNG (Development-Env)

- Nur `EDENAI_DEV_API_KEY` in Development verfügbar → EdenAI Sandbox aktiv
- OpenRouter: KEIN Key in Development → `enabled()` false → deaktiviert
- `/api/model` → `cloudflare/@cf/google/gemma-7b-it-lora`; `/api/models` listet 4 EdenAI-Modelle
- Testfall: 3 inline-Jobs im POST-Body (kein Apify-Aufruf; `jobs` wurden mitgeliefert)

### TATSÄCHLICHE AI-VERSUCHE (Live, beobachtet)

Versuch 1 (Default gemma-7b-lora):
EdenAI, `cloudflare/@cf/google/gemma-7b-it-lora`, HTTP 502, code=bad_ai_response, 7.0 s

Versuch 2 (attempt=2, llama-2-7b-lora):
EdenAI, `cloudflare/@cf/meta-llama/llama-2-7b-chat-hf-lora`, HTTP 502, code=bad_ai_response, 6.4 s

Versuch 3 (attempt=3, gemma-2b-lora):
EdenAI, `cloudflare/@cf/google/gemma-2b-it-lora`, HTTP 502, code=bad_ai_response, 5.5 s

Einzelnachweis über direktes Provider-Probe-Skript (EDENAI_DEV_API_KEY, Development):
- Default-Modell: OK 4.20 s, Inhalt = Konversation („Hello! It's nice to meet you…") statt JSON
- llama-2-7b-lora: OK 1.60 s, Inhalt = Konversation statt JSON

Kernbefund: Die Sandbox-Modelle antworten schnell mit Konversationstext statt Matching-JSON.
`parseMatches` findet kein JSON → `bad_ai_response` (502). Das ist ein Modell-/Prompt-Verhalten
der Sandbox, KEIN Timeout/Netzwerk/model_unavailable.

### ZEITMESSUNG

BEFORE (beobachteter Production-Screenshot-Befund, NICHT reproduzierbar):
- Versuch 1 ≈ 56.7 s, Versuch 2 ≈ 27.0 s, Versuch 3 ≈ 41.9 s, Gesamt ≈ 125+ s
- Ursache laut Step-1-Analyse: hohe Provider-Timeout-Werte + serielle Client-Kette

AFTER (tatsächliche Development-Messung):
- Einzelne Versuche: 5.5 / 6.4 / 7.0 s (je `bad_ai_response`)
- Kein Versuch erreichte den neuen Timeout (EdenAI 30 s / OpenRouter 25 s)
- Gesamt (3 sequenzielle Requests): ~18.9 s kumuliert

Vergleichsbarkeit: **NICHT direkt vergleichbar** (Production vs. Sandbox-Modelle,
unterschiedliche Modell-Reihen). Die Development-Zeiten sind aber deutlich unter den
beobachteten Production-Werten und weit unter den neuen Timeout-Grenzen.

### FALLUNTERSCHEIDUNG (Live)

- A) `model_unavailable` (502): **trat live nicht natürlich auf** → bereits in Step 3
  gezielt getestet (Fallback aktiv). Im Live-Test nicht erzwingen.
- B) `timeout` (504): **trat live nicht auf** → kein Versuch erreichte die 30/25-s-Grenze.
  In Step 3 gezielt getestet (Client stoppt, kein weiterer Versuch).
- C) `network_error` (502): **trat live nicht auf** → Step-3-Tests decken das ab.

Alle beobachteten Live-Fehler waren `bad_ai_response` (nicht-transient im Client →
`NON_TRANSIENT_CODES`; kein unnötiger weiterer Fallback-Versuch veranlasst).

### UI-VERHALTEN

- Suche startet (App + Module laden), UI serviert (HTTP 200)
- Kein Browser-Automation-Test durchgeführt; Live-Check über API/HTTP-Ebene
- Kein unnötig langer Spinner beobachtbar (einzelne Versuche 5.5–7 s, weit unter Timeout)
- Ergebnis: sinnvoller Fehler (`bad_ai_response` mit freundlicher Meldung) statt Hänger

### EXTERNE REQUESTS / KOSTEN

- Verwendet: `EDENAI_DEV_API_KEY` (Sandbox) für die Live-Match-Requests + 2 direkte Probe-Aufrufe
- Kein OpenRouter-Request (kein Production-Key, OpenRouter in Development deaktiviert)
- Kein Apify-Aufruf (Testfall mitgelieferte `jobs`)
- Kein Production-Request, keine Production-Daten geändert
- Kostenrisiko: minimal (nur Sandbox-Key; keine kostenpflichtigen Modelle/Requests)

### REGRESSION (abschließendes Gate)

- Gezielte Timeout/Fallback-Tests: 38/38 grün
- `npm test`: **116/116 grün** (16 Dateien)
- `npx tsc -b`: grün
- `npm run build`: grün

### SECRET AUDIT

- Vor Commit: `git diff --check` sauber, Secret-Audit sauber (keine Keys in Diff/Report)

### GIT-STAND

- Commit: siehe Step-Matrix (nach Push aktualisiert)

## Step 5 — Preview / Abnahme

Status: COMPLETE

Commit: 3133446

### VORBEGINN (bestätigt)

- Branch: `feature/ai-matching-timeout`, HEAD == origin/feature/ai-matching-timeout == `b557632`
- Step 4 = COMPLETE; Working Tree nur erwartete untracked Dateien
- NICHT auf main gewechselt, KEIN Merge, KEIN Production-Deploy

### PREVIEW DEPLOYMENT

- Genau EIN Preview-Deployment erstellt: `npx vercel deploy --yes`
- **Preview URL:** https://mays-job-matcher-mevsubnto-maymilly.vercel.app
- **Deployment ID:** dpl_2kokHToLnhUG3HAaT3Txk9HDQTte
- **Environment:** preview
- **Source Branch:** feature/ai-matching-timeout
- **Deployment Commit (tatsächlich, aus Vercel-API):** `b557632af7a585f6ce9b25b6748fea2a16eb704f`
  (githubCommitSha aus Deployment-Metadaten) == Git HEAD `b557632`
- gitDirty: 1 (nur untracked Dateien im Repo, erwartet; KEINE Commits am Feature-Code geändert)
- KEIN Production-Deployment, KEINE Environment-Änderung

### BUILD-IDENTITÄT

- Client-Bundle: `index-DzIvqmVQ.js`
- Footer im Matcher-Layout (Route `/top`): **`Version 2.0.0 · preview · b557632`**
- **Deployment Commit == Build Identity == Git HEAD == b557632** → verifiziert ✓
- Kein künstlicher Code-Change nötig (Build-Identität bereits sichtbar)

### FEATURE-CODE IM ARTEFAKT

- Client-Bundle enthält die neuen Fehlercodes: `model_unavailable`, `timeout`, `network_error` ✓
  (Timeout-Werte 30 s/25 s liegen im Server-Code, nicht im Client-Bundle)
- Deployment-Quellbaum (Vercel-Files-API) enthält den geänderten Server-Code
  (api/_lib/providers/edenai.mjs, openrouter.mjs, src/api.ts) aus Commit `b557632`

### FRONTEND-ABNAHME (CDP, Headless-Chrome)

- App lädt: Titel „May's Job Matcher", H1 vorhanden, readyState=complete, Root gerendert
- Landing-Seite: Hero + „Find jobs" + Sprache (EN/DE) + Navigation funktionsfähig
- Matcher-Seite (Route `/top`): Formular mit Skills/Target-Role/City/Alerts, „Find my matches",
  Model-Selector zeigt „No free AI models are available right now" (= erwarteter Zustand ohne Keys)
- Footer gerendert mit Build-Identität (siehe oben)
- KEINE relevanten Console Errors / Runtime Exceptions beobachtet
- KEINE relevanten Frontend Network Errors (alle Endpoints HTTP 200)

### AI / API

- **AI Live Test NICHT durchgeführt** in Preview:
  - Preview besitzt keine AI-Provider-Keys (beide Provider `enabled:false`, `configured:false`)
  - Begründung: AI-Fehlerpfade wurden bereits in Step 3 kontrolliert getestet;
    Development-Live-Verhalten in Step 4 verifiziert.
- API-Routen geprüft (kein AI, keine Keys): `/` 200, `/api/model` 200 (model=null),
  `/api/models` 200 (leer, Provider disabled), `/api/jobs` 200 (Arbeitnow, kein Apify),
  CSS 200. `/api/models` erster Aufruf 15 s (Cold-Start), warm 0.3 s.
- KEIN Apify-Run, KEIN EdenAI/OpenRouter/Production-Request

### SECRET AUDIT

- Preview-HTML: keine Keys/Tokens/ENV ✓
- Client-Bundle: keine API-Key-Namen, keine `process.env`-Verweise, keine JWT-ähnlichen Tokens ✓
- Deployment enthält keine exponierten Secrets

### ERGEBNIS

- Feature-Code korrekt gebaut, Deployment stammt vom richtigen Branch/Commit,
  Identität nachvollziehbar (Deployment == Build == Git HEAD)
- Frontend/UI funktioniert, keine Regression, keine Secrets exponiert
- Preview ohne AI-Keys korrekt betreibbar (erwarteter No-Key-Zustand)

### GIT-STAND

- Commit: siehe Step-Matrix (nach Push aktualisiert)

## Step 6 — Merge-Vorbereitung

Status: COMPLETE

Commit: 410c095

### GIT-ZUSTAND (tatsächlich, geprüft)

- Aktueller Branch: `feature/ai-matching-timeout`
- Feature HEAD: `f676040` == origin/feature/ai-matching-timeout == `f676040` (synchron)
- main: `d9ab072` == origin/main == `d9ab072`
- Gemeinsamer Ausgangspunkt (merge-base): `d9ab072` == main
- **main seit Feature-Erstellung NICHT weitergelaufen** (0 Commits seit merge-base)
- **Fast-forward möglich: JA** (Feature-Branch ist strikter Nachfahre von main)

### FEATURE-SCOPE (git diff main...HEAD --stat)

7 Dateien, 659 insertions / 6 deletions, ausschließlich Feature-bezogen:

- `api/_lib/providers/edenai.mjs` — TIMEOUT_MS 55 s→30 s, Timeout/Netzwerk als eigene Codes (504/502)
- `api/_lib/providers/openrouter.mjs` — TIMEOUT_MS 40 s→25 s, Timeout/Netzwerk als eigene Codes
- `src/api.ts` — `timeout`/`network_error` zu NON_TRANSIENT_CODES (kein Client-Fallback bei Timeout)
- `src/api.test.ts` — Client-Tests (kein Fallback bei timeout/network_error)
- `tests/api/edenai-provider.test.mjs` — Timeout/Netzwerk-Mapping-Tests
- `tests/api/openrouter-provider.test.mjs` (neu) — OpenRouter-Provider-Tests
- `docs/reports/FEATURE_AI_MATCHING_TIMEOUT.md` — Feature-Report

NICHT enthalten (Scope sauber): kein Footer-Feature, keine Job-Import-/Apify-/Safety-Änderungen,
keine unrelated UI changes, keine Production-ENV-Änderungen, keine Secrets.

### PREVIEW-IDENTITÄT

- Preview Build/Deployment Commit: `b557632` (dpl_2kokHToLnhUG3HAaT3Txk9HDQTte)
- Feature HEAD jetzt: `f676040`
- Commits zwischen Preview `b557632` und HEAD `f676040`:
  - `3133446` (test: complete preview verification for ai timeout) — nur Report
  - `f676040` (docs: record step 5 commit in feature report) — nur Report
- **Nur Dokumentation seit Preview** (Code-Diff b557632..HEAD = 0 Zeilen Code)
- → Preview-Abnahme bleibt gültig, kein erneuter Preview-Test nötig

### TEST-/BUILD-GATE

- `npm test`: **116/116 grün** (16 Dateien)
- `npx tsc -b`: PASS
- `npm run build`: PASS
- `git diff --check`: sauber
- Secret Audit (kompletter Feature-Diff main...HEAD): sauber — keine Keys/Tokens/ENV-Werte

### MERGE-READINESS

Merge-ready = **JA**

- Feature Branch korrekt, origin synchron
- main-Zustand bekannt, Fast-forward möglich (bevorzugte Methode)
- Feature-Scope sauber, keine unerwarteten Codeänderungen
- Tests/tsc/build grün, diff-check sauber, Secret Audit sauber
- Preview-Abnahme weiterhin gültig (nur Doku-Commits seit Preview)

### GIT-STAND

- Commit: siehe Step-Matrix (nach Push aktualisiert)

## Step 7 — Merge Feature → main

Status: COMPLETE

Commit: 2709a5d

### MERGE (Fast-forward)

- **Merge-Methode:** fast-forward (git merge --ff-only)
- Feature HEAD vor Merge: `002fa73`
- main HEAD vor Merge: `d9ab072`
- Gemeinsamer merge-base: `d9ab072` == main (main nicht weitergelaufen)
- **Neuer main HEAD:** `002fa73` (== Feature HEAD, FF)
- **origin/main:** `002fa73` (gepusht)
- Merge-Commit: **nicht vorhanden** (reiner Fast-forward, keine History-Rewrite)
- Feature-Commits (0079993 … 002fa73) vollständig in main enthalten

### TEST-/BUILD-GATE AUF MAIN (erster vollständiger Test auf integriertem Stand)

- `npm test`: **116/116 grün** (16 Dateien)
- `npx tsc -b`: PASS
- `npm run build`: PASS
- `git diff --check`: sauber
- Secret Audit: sauber

### VERIFIKATION NACH PUSH

- main == origin/main == `002fa73`
- Working Tree sauber (nur dauerhafte untracked Dateien)
- Feature-Code vollständig in main

### PREVIEW-IDENTITÄT

- Preview getestet mit `b557632`; seitdem nur Doku-Commits (Step 6: Code-Diff = 0)
- → Preview-Abnahme gilt für den gemergten Code weiterhin
- NICHT behauptet, dass Production bereits getestet wurde

### GIT-STAND

- Commit: siehe Step-Matrix (nach Push aktualisiert)

## Step 8 — Production Deployment

Status: COMPLETE

Commit: 1c65946

### VOR DEPLOYMENT

- Branch: `main`, HEAD == origin/main == `6ff72e7`
- Working Tree sauber (nur dauerhafte untracked Dateien)

### PRODUCTION DEPLOYMENT

- **Deployment ID:** `dpl_DH75keaahuFaa19W7GKxRYPBJg4e`
- **Status:** READY
- **Environment:** production
- **Source Branch:** main
- **Production Deployment Commit:** `6ff72e7cc9f667e9efe43dd999c251767546d782` (Message: docs: record step 7 commit in feature report)
- **Git main HEAD:** `6ff72e7` → **Deployment Commit == Git HEAD** ✓
- **Production URL:** https://mays-job-matcher-5w7dxumj4-maymilly.vercel.app (Alias: https://mays-job-matcher.vercel.app)
- Genau EIN Production-Deployment; keine weiteren Deployments, keine Preview

### FOOTER / BUILD IDENTITY

- Footer auf Production (`/top`): **`Version 2.0.0 · production · 6ff72e7`**
- **Production Deployment Commit == Footer Build SHA** ✓

### TIMEOUT-CODE NACHWEIS (deployed Code, via Vercel File API)

- `edenai.mjs`: `TIMEOUT_MS = 30_000`, Timeout→`ERROR_CODES.timeout`, Netzwerk→`ERROR_CODES.networkError` (Status 504/502)
- `openrouter.mjs`: `TIMEOUT_MS = 25_000`, Timeout→`ERROR_CODES.timeout`, Netzwerk→`ERROR_CODES.networkError`
- → Production enthält den gemergten Feature-Code (identische File-UIDs wie Preview)

### SMOKE TEST (Production)

- `/` → HTTP 200 (0.44 s)
- `/top` (Matcher-Seite) → HTTP 200 (0.49 s); H1 + Formular laden, kein Fehler
- `/api/model` → HTTP 200 (1.47 s)
- `/api/models` → HTTP 200 (1.40 s)
- Console/Network: keine offensichtlichen Fehler (keine AI Requests ausgelöst)

### KOSTEN-/NUTZUNGSNACHWEIS

- **AI Requests:** 0 (kein /api/match-Aufruf, kein AI-Live-Test)
- **Apify:** 0
- Kostenrisiko dieses Steps: minimal (nur statische Seiten + Modell-Listen-Endpunkte)

### VERIFIKATION

- Deployment Ready, Source main, Deployment Commit nachvollziehbar
- Production URL erreichbar, Footer Build Identity korrekt
- Relevante Seiten laden, keine offensichtlichen Console/Network Errors
- Secret Audit sauber, `git diff --check` sauber

### GIT-STAND

- Commit: siehe Step-Matrix (nach Push aktualisiert)