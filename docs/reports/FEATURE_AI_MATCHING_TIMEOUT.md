# Feature: AI Matching Timeout & Fallback Responsiveness

Branch:
feature/ai-matching-timeout

Base:
main

Aktueller Step:
Step 2

Aktueller Status:
COMPLETE

## Step-Matrix

| Step | Thema | Status | Commit |
| 1 | Bestandsanalyse | COMPLETE | 0079993 |
| 2 | Timeout-Werte senken + Fehler-Codes + Client-Unterscheidung | COMPLETE | 9eb4813 |
| 3 | ... | PENDING | — |

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