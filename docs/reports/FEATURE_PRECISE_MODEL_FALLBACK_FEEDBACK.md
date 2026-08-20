# Feature: Precise Model Fallback Feedback

Branch:
feature/precise-model-fallback-feedback

Base:
main

Aktueller Step:
Step 3

Aktueller Status:
COMPLETE — PREVIEW ACCEPTED

## Step-Matrix

| Step | Thema | Status | Commit |
| 1 | Analyse (UX-/Error-Flow, Model-State, i18n, Architektur) | COMPLETE | (Analyse in Chat, kein Commit) |
| 2 | Implementierung: Fallback-Trace, präzise Meldungen, i18n, Tests | COMPLETE | 14dd323 |
| 3 | Preview / Abnahme | COMPLETE (PREVIEW ACCEPTED) | (nach Push aktualisiert) |

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

## Ziel

Die Benutzerkommunikation bei `model_unavailable` präzisieren:

- welches Modell nicht verfügbar war,
- welches Modell als nächstes verwendet wird,
- dass die bereits gefundenen Jobs erhalten bleiben,
- dass bei endgültigem Fehlschlag ein anderes Modell gewählt werden
  kann, OHNE die Jobs erneut zu laden.

## Nicht berührt (Scope)

- `fallbackOrder` / `fallbackMaxAttempts` / Timeout-Werte / Error-Codes /
  `isModelUnavailable` / Provider-Logik / bestehendes Fallback-Verhalten — unverändert
- Jobquellen, Apify, Apify-Cache, Arbeitnow, Arbeitsagentur — unverändert
- Dataset-Persistenz, Matching Retry without Job Re-fetch — unverändert
- ModelSelector, CV-Flow, LetterModal — funktional unverändert
- Bestehende `model.unavailable` / `model.fallbackNote`-Texte (CV-/Letter-Flows) — unverändert

## Step 2 — Implementierung

### Änderungen

#### 1. src/api.ts — Fallback-Trace (additiv)

- `FallbackAttempt { model: string | null; ok: boolean }` neu.
- `FallbackResult<T>` um `attempts: FallbackAttempt[]` erweitert.
- `withModelFallback` zeichnet jeden tatsächlichen Versuch in `attempts` auf
  (Reihenfolge = tatsächliche Versuchsreihenfolge) und gibt ihn mit zurück.
- Algorithmus unverändert (gleiche `fallbackOrder`, gleiche Versuchsanzahl,
  gleiche Fehler-Durchreichung, gleiche `console.warn`-Logs).
- Bei nicht-transientem Fehler wird wie bisher sofort geworfen (kein Trace-Eintrag nötig).
- Rückwärtskompatibel: alle Call-Sites (App/CvUpload/LetterModal) destrukturieren
  nur `{ data, usedFallback }`; `attempts` ist additiv.

#### 2. src/App.tsx — präzise Meldungen (Match-Flow)

- Import `modelDisplayName` (`src/lib/modelDisplayName.ts`).
- Neuer Helper `modelLabel(id)`: löst Modell-ID über `models[]` + `modelDisplayName`
  zum echten Anzeigenamen auf; Fallback auf die ID, nie hartcodiert.
- `performMatch` Erfolg + Fallback: Status-Info = gefundene Treffer + präziser
  Fallback-Text mit `{failed}` (letzter Fehlversuch) und `{used}` (erfolgreiches Modell).
- `performMatch` Fehlschlag: bei `isModelUnavailable(err)` → `model.fallbackExhausted`;
  andere Fehler (Quota/generisch) weiterhin über `describeError`.
- `runSearch` unverändert (nur Fetch-Fehler); Modellwechsel-Handler unverändert
  (weiterhin ausschließlich `/api/match` auf dem vorhandenen Dataset).

#### 3. src/i18n.tsx — neue Keys (DE + EN)

- `model.fallbackSuccess`:
  - DE: „Das Modell {failed} ist derzeit nicht verfügbar. Wir versuchen es automatisch mit {used}. Ihre bereits gefundenen Stellen bleiben erhalten."
  - EN: „The model {failed} is currently unavailable. We'll automatically try {used}. Your found jobs are kept."
- `model.fallbackExhausted`:
  - DE: „Das ausgewählte AI-Modell ist derzeit nicht verfügbar. Ihre bereits gefundenen Stellen bleiben erhalten. Sie können unten ein anderes verfügbares Modell auswählen, ohne die Jobs erneut zu laden."
  - EN: „The selected AI model is currently unavailable. Your found jobs are kept. You can pick another model below without re-running the search."
- `model.unavailable` / `model.fallbackNote` bleiben für CV-/Letter-Flows unverändert.

#### 4. src/App.test.tsx — Tests angepasst + neu

- 4 bestehende Assertions (`/momentan nicht verfügbar/`) auf die neue fachlich
  korrekte Meldung umgestellt (`/Das ausgewählte AI-Modell ist derzeit nicht verfügbar/`):
  Test L (Ein-Modell-Katalog), Matching-Retry-Tests 3, 4, 5.
- Neuer Describe-Block „Präzises Model-Fallback-Feedback (Feature)" mit 5 Tests.

#### 5. src/api.test.ts — Trace-Tests

- Bestehender strikter `toEqual` um das neue `attempts`-Feld ergänzt.
- Neu: Trace-Reihenfolge (selected → recommended → Katalog) mit `model` + `ok`;
  Erfolg im ersten Versuch → genau ein Trace-Eintrag, `usedFallback=false`.

### UX-Verhalten

- Fallback-Erfolg: „{Found…} Das Modell <A> ist derzeit nicht verfügbar. Wir versuchen es automatisch mit <B>. Ihre bereits gefundenen Stellen bleiben erhalten."
- Vollständiger Fehlschlag: „Das ausgewählte AI-Modell ist derzeit nicht verfügbar. Ihre bereits gefundenen Stellen bleiben erhalten. Sie können unten ein anderes verfügbares Modell auswählen, ohne die Jobs erneut zu laden."
- Modellnamen kommen ausschließlich aus dem Runtime-Model-State (`models[]` +
  `modelDisplayName`) — keine Duplikation, keine hartcodierten Namen.
- Modellwechsel bleibt `/api/match`-only auf dem vorhandenen Dataset; `/api/jobs`,
  Apify und Job-Source-Fetch werden NICHT ausgelöst.

### Betroffene Dateien

- `src/api.ts`
- `src/App.tsx`
- `src/i18n.tsx`
- `src/App.test.tsx`
- `src/api.test.ts`

### Tests / Gates

| Prüfung | Ergebnis |
|---|---|
| `npm test` | **137/137 PASS (16 Dateien)** |
| Gezielt (api.test.ts + App.test.tsx) | 53/53 PASS |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| `git diff --check` | sauber |
| Secret Audit | sauber (keine Keys/Tokens/ENV in Diff) |

Keine AI-Live-Requests. Kein Apify. Kein Production Deployment.

### Offene Punkte

- Keine. Nächste Steps (Preview/Abnahme, Merge, Deployment, Production-Test) sind
  PENDING und werden separat freigegeben.

## Step 3 — Preview / Abnahme

Status: **COMPLETE — PREVIEW ACCEPTED**

### Preview Deployment / Deployment-Identität

| Eigenschaft | Wert |
|---|---|
| Preview URL | https://mays-job-matcher-5zl0hhk2h-maymilly.vercel.app |
| Deployment ID (Vercel API) | `dpl_9PFMTY7eVrqVonR2bn4fgT3bwCHj` |
| State (Vercel API) | `READY` |
| tatsächlicher Deployment-Commit (Vercel API `meta.gitCommitSha`) | `e554c1807c0db8b99b180bf55d6f87c52502df40` |
| Feature HEAD | `e554c1807c0db8b99b180bf55d6f87c52502df40` |
| Preview-Deployment-Commit == Feature HEAD | **JA** |

Deployment erfolgte aus einem sauberen git-Worktree von exakt `e554c18`
(detached HEAD, kein untracked Dateien im Payload) via Vercel CLI (Preview).

### Feature-Identität (im Preview-Artefakt nachgewiesen)

1. Deployment-Commit per Vercel-API == Feature HEAD (siehe oben).
2. Preview-Bundle (`/assets/index-B9BucZZW.js`) heruntergeladen; alle neuen
   i18n-Strings DE + EN im Bundle vorhanden:
   - „Ihre bereits gefundenen Stellen bleiben erhalten"
   - „Das ausgewählte AI-Modell ist derzeit nicht verfügbar"
   - „anderes verfügbares Modell auswählen" / „ohne die Jobs erneut zu laden"
   - „Das Modell … / automatisch mit …"
   - „Your found jobs are kept" / „without re-running the search" / „We'll automatically try"
3. Lokaler Rebuild von exakt `e554c18` im Worktree mit Vercel-äquivalenter
   Build-Env (`VERCEL_ENV=preview`, leere GIT_SHA/REF) → identisches Bundle
   `index-B9BucZZW.js`, **SHA-256 `1975d952…` == deployed** → **byte-identisch**.

⇒ Preview enthält exakt den Code von `e554c18` inkl. Fallback-Trace (`attempts`),
präzise Modellnamen (Runtime-Katalog), neue i18n-Keys und die „Jobs bleiben
erhalten"-/„Modellwahl ohne neue Suche"-Hinweise.

### UI-Abnahme / Fallback-Meldungen / ModelSelector

- Interaktive Browser-Klicks im Preview konnten NICHT direkt ausgeführt werden
  (kein Browser-Automatisierungswerkzeug verfügbar) → „nicht direkt verifiziert".
- Fachlich abgedeckt durch: 137/137 Tests (u. a. „Präzises Model-Fallback-Feedback":
  Fallback-Erfolg nennt fehlgeschlagenes + verwendetes Modell + Job-Erhalt;
  vollständiger Fehlschlag nennt Modell-Wahl ohne neue Suche; Ein-Modell-Katalog;
  Modellwechsel nur `/api/match`; EN-i18n) + Bundle-Nachweis der exakten Texte.
- ModelSelector: Funktionstests (Test E/F/G: Sperre während Suche/Bewertung,
  Freigabe nach Abschluss; Retry-Tests 1–11; Trace-Tests) grün. Architektur unverändert;
  fehlgeschlagenes Modell bleibt im Katalog sichtbar; Modellwechsel löst ausschließlich
  `/api/match` auf dem vorhandenen Dataset aus (kein `/api/jobs`, kein Apify).

### Request-/Runtime-Prüfung

| Endpoint | HTTP |
|---|---|
| `/` | 200 |
| `/top` | 200 |
| `/api/model` | 200 |
| `/api/models` | 200 (Provider `configured:false` — Preview hat KEINE AI-Keys) |

Kein AI-Live-Test (Preview besitzt keine AI-Keys → laut Vorgabe NICHT durchgeführt).
Kein Apify. Keine künstlichen Job-Suchen. Keine kostenpflichtigen Provider-Requests.

### Regression / technische Validierung

| Gate | Ergebnis |
|---|---|
| `npm test` | **137/137 PASS (16 Dateien)** |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| `git diff --check` | sauber |
| Secret Audit (Code-Diff) | sauber |

Code seit Step-2-Gates unverändert (seitdem nur Docs-Commit `e554c18`); Gates erneut
frisch ausgeführt. Bestehende Features erhalten (Matching Retry, Dataset-Persistenz,
Search/Match-Trennung, withModelFallback, ModelSelector, Timeout/Network-Handling,
Jobquellen, Apify/Cache, CV-Flow, LetterModal, bestehende Fallback-Logik).

### Abnahmekriterien

| Kriterium | Status |
|---|---|
| Preview Commit == Feature HEAD | PASS (`e554c18`) |
| Feature-Code im Preview-Artefakt nachgewiesen | PASS (Bundle byte-identisch + i18n-Strings) |
| neue Fallback-Meldungen vorhanden | PASS (Bundle-Strings DE/EN) |
| Modellnamen korrekt dynamisch | PASS (via `modelDisplayName` aus Runtime-Katalog; Tests) |
| Jobs-Erhalt kommuniziert | PASS |
| Modellwechsel ohne neue Suche kommuniziert | PASS |
| ModelSelector funktioniert | PASS (Tests) |
| keine Regression sichtbar | PASS (137/137, Smoke 200) |
| Tests/Build/Audits sauber | PASS |
| keine Secrets | PASS |
| keine unerlaubten externen Requests | PASS (kein AI/Apify/Production) |
| Interaktive Browser-Klicks im Preview | nicht verifiziert (kein Browser-Tooling; durch Tests + Bundle belegt) |

### Git / Deployment

- Branch: `feature/precise-model-fallback-feedback`
- Push ausschließlich auf `origin/feature/precise-model-fallback-feedback`.
- KEIN Merge nach main. KEIN Production-Deployment. KEIN Branch-Löschen.

### Offene Punkte

- Keine. Nächste Steps (Merge nach main, Deployment, Production-Test) sind PENDING
  und benötigen separate Freigabe.