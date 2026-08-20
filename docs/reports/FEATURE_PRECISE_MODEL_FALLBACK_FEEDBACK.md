# Feature: Precise Model Fallback Feedback

Branch:
feature/precise-model-fallback-feedback

Base:
main

Aktueller Step:
Step 7

Aktueller Status:
COMPLETE — SUCHPARAMETER IMPLEMENTIERT UND IN PRODUCTION DEPLOYED

## Step-Matrix

| Step | Thema | Status | Commit |
| 1 | Analyse (UX-/Error-Flow, Model-State, i18n, Architektur) | COMPLETE | (Analyse in Chat, kein Commit) |
| 2 | Implementierung: Fallback-Trace, präzise Meldungen, i18n, Tests | COMPLETE | 14dd323 |
| 3 | Preview / Abnahme | COMPLETE (PREVIEW ACCEPTED) | (nach Push aktualisiert) |
| 4 | UX-Korrektur: manueller Modell-Retry (kein Auto-Start) | COMPLETE | ddd6fc0 |
| 5 | Preview / Abnahme (4b) | COMPLETE (PREVIEW ACCEPTED) | cf8744a |
| 6 | Merge-Vorbereitung + zukünftiger Scope | COMPLETE (MERGE-READY) | 68f56b2 |
| 7 | Suchparameter-Erweiterung + Merge + Production | COMPLETE | d53c4c9, 0305d52 |

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
---

# Step 5 — Preview / Abnahme

## Status

- **STEP 7 = COMPLETE** · **SUCHPARAMETER IMPLEMENTIERT UND IN PRODUCTION DEPLOYED** (Commits `d53c4c9` → `0305d52` → `12b010b`)
- Feature-Branch Fast-forward nach `main` gemerged; `main == origin/main`; Feature-Branch entfernt.
- Browser-Flow nicht direkt verifiziert (kein Browser-Tooling); jeder Punkt durch
  automatische DOM-Level-Tests (159/159) und Live-Endpunkt-Tests abgedeckt.

## Preview Deployment

- URL: https://mays-job-matcher-3pxispsqv-maymilly.vercel.app
- Deployment: `dpl_F8pvmj8Pz661LhCVmRTwf6z4FyJe`
- Vercel-Deployment-Commit (`meta.gitCommitSha`): `ddd6fc04b45fe5623522768173d141f469eefef9`
- Erwartung „Preview Commit == Feature HEAD" → **PASS** (Feature HEAD `ddd6fc0` zum Deploy-Zeitpunkt)
- Deployment aus sauberem git-Worktree von `ddd6fc0` über Vercel CLI (Preview).

## Feature-Identität (Step-4b-Code im Preview)

- i18n-Strings im Bundle nachgewiesen (String-Scan im deployed Bundle `index-MWzvy0WI.js`):
  - `model.retryHint`: „Bitte versuche, ein anderes Modell auszuwählen." ✓ / „Please try selecting a different model." ✓
  - `search.buttonRematch`: „Mit diesem Modell erneut bewerten" ✓ / „Re-score with this model" ✓
  - `model.fallbackExhausted` (erschöpfter Fallback) vorhanden ✓
- **Bundle-Identität:** Lokaler Rebuild von `ddd6fc0` mit `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_SHA=""`, `VERCEL_GIT_COMMIT_REF=""`
  → deployed Bundle `index-MWzvy0WI.js` **byte-identisch** (SHA-256 `9ab9441c…`).
- handleModelChange/manuelle Auswahl ohne Auto-Start, `modelExhausted`, kontextabhängiger Submit,
  Dataset-Re-Match: durch die neuen DOM-Tests A–G (Step 4b) verifiziert; Variablennamen minifiziert,
  daher nicht als Strings im Bundle, aber als Verhalten in jsdom-Tests belegt.

## Technische Smoke Tests

| Pfad | Status |
|---|---|
| `/` | 200 ✓ |
| `/top` | 200 ✓ |
| `/api/model` | 200 ✓ |
| `/api/models` | 200 ✓ (Provider `configured:false` → KEINE AI-Keys im Preview) |

- KEIN AI-Live-Test, KEIN Apify, KEINE kostenpflichtigen Requests (keine Keys; Vorgabe).
- Console-/Runtime-/Network-Fehler im echten Browser: **nicht direkt verifiziert** (kein Browser-Tooling);
  keine Fehler in jsdom-Tests, Build sauber.

## UX-Abnahme

Abnahme-Kriterien — Beleg durch automatische DOM-Level-Tests (jsdom + Testing Library, 144/144) und/oder statische Evidenz:

| Kriterium | Status | Beleg |
|---|---|---|
| Preview enthält exakten Feature-Code | PASS | Deployment-Commit `ddd6fc0`, Bundle byte-identisch (SHA `9ab9441c…`) |
| Suchmaske während Suche gesperrt | PASS | App-Test 8 + 8b (Skills/Zielrolle/Stadt/CV deaktiviert) |
| ModelSelector während Suche gesperrt | PASS | App-Test 9 (`model-trigger` disabled) |
| Fallback-Hinweis vorhanden | PASS | Step-4a-Test B („Bitte versuche, ein anderes Modell auszuwählen.") |
| ModelSelector nach Fallback hervorgehoben | PASS | Step-4a-Test B (`.model-field--attention` vorhanden) |
| Modellwahl allein startet KEIN Matching | PASS | Step-4a-Test A (kein zusätzlicher `fetchMatches`-Call) |
| manueller Retry-Button vorhanden | PASS | Step-4a-Test E („Mit diesem Modell erneut bewerten") |
| manueller Retry verwendet vorhandenes Dataset | PASS | Step-4a-Test D (exakte Jobs, `/api/match`, kein `/api/jobs`) |
| neue Suche bleibt manuell | PASS | Step-4a-Test F + App-Test 7 |
| Suchparameter invalidieren Dataset | PASS | App-Test 6 + Step-4a-Test F |
| bestehende Features erhalten | PASS | 144 Tests (Fallback-Kette, Timeout/Network, Jobquellen, CV, Footer) |
| Tests / Build / Audit sauber | PASS | `npm test` 144/144, `tsc -b`, `vite build`, `git diff --check`, Secret-Scan |
| Request-Sicherheit auf Netzebene (echter Browser) | nicht direkt verifiziert | kein Browser-Tooling; auf Request-Ebene durch Tests belegt (Modellwahl = 0 Requests) |
| Interaktive Browser-Klicks im Preview | nicht direkt verifiziert | kein Browser-Tooling; durch Tests + Bundle belegt |

## Regression

- Nichts gelöscht/deaktiviert: automatische Fallback-Kette, Dataset-Persistenz, Search/Match-Trennung,
  ModelSelector, Apify, Jobquellen, Apify-Cache, Timeout-/Network-Handling, CV-Flow, LetterModal,
  Fehlerbehandlung. Nur additive Änderungen in App/SearchForm/ModelSelector/i18n/styles.
- Kein Eingriff in `api/`-Code (Fallback-Algorithmus, Request-Handling) im Step-4b-Diff.

## Git

- Branch `feature/precise-model-fallback-feedback`, HEAD/`origin` = `ddd6fc0` (+ Step-5-Docs-Commit nach dieser Dokumentation).
- Push ausschließlich auf `origin/feature/precise-model-fallback-feedback`.
- KEIN Merge nach main. KEIN Production-Deployment. KEIN Branch-Löschen.

## Offene Punkte

- Nächste Steps (Merge nach main, Production-Deployment) sind PENDING und benötigen separate Freigabe.

---

# Merge-Vorbereitung & geplante Suchparameter-Erweiterung

## Status

- **MERGE-READY** (fast-forward nach main möglich) — Feature-Branch `feature/precise-model-fallback-feedback`, HEAD `cf8744a`.
- Der Merge selbst ist NICHT durchgeführt (separate Freigabe erforderlich).

## Merge-Gate (geprüft, alle PASS)

| Gate | Ergebnis |
|---|---|
| Feature HEAD | `cf8744a` (== origin/feature) |
| main HEAD | `f5f5ee2` |
| origin/main | `f5f5ee2` (== main) |
| Merge Base | `f5f5ee2` (== main HEAD) |
| Fast-forward möglich | JA (`main` ist Vorfahr des Feature-Branches) |
| Feature-Diff gegen main | 10 Dateien: `src/App.tsx`, `src/api.ts`, `src/i18n.tsx`, `src/components/ModelSelector.tsx`, `src/components/SearchForm.tsx`, `src/styles.css`, `src/App.test.tsx`, `src/api.test.ts`, 2 Doc-Dateien |
| Scope des Diffs | nur Precise-Fallback-Feedback + manueller Modell-Retry (UX-Korrektur) + Tests/Doku |
| bestehende Features erhalten | PASS (keine gelöschten Feature-Codezeilen; `api/`-Verzeichnis unverändert) |
| keine unerwünschten Änderungen | PASS (nur additive Änderungen; gelöschte Zeilen = Testtexte/Erwartungen) |
| Working Tree | sauber (nur dauerhaft untracked `ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`) |
| Tests | 144/144 PASS (16 Dateien) |
| TypeScript | `tsc -b` PASS |
| Build | `vite build` PASS |
| `git diff --check` | PASS |
| Secret Audit | 0 Treffer (keine Keys/Apify-Referenzen im Code-Diff) |

Erhalten geblieben (keine Löschung/Deaktivierung): Jobquellen, Arbeitnow, Arbeitsagentur, Apify, Apify-Cache,
Dataset-Persistenz, Search/Match-Trennung, `withModelFallback`, ModelSelector, Timeout-/Network-Handling,
CV-Flow, LetterModal, bestehende Fallback-Logik, zukünftige Erweiterungsmöglichkeiten.

---

# SUCHPARAMETER-ERWEITERUNG (IMPLEMENTIERT, IN PRODUCTION DEPLOYED)

> **IMPLEMENTED / COMPLETE** — Die zuvor als NEXT DEVELOPMENT SCOPE dokumentierten Anforderungen
> (Umkreis / Arbeitsmodell / Arbeitszeit) wurden in Step 7 umgesetzt, abgenommen, nach main
> gemerged (FF) und in Production deployed (Deployment `dpl_DJRUFY1BtYjnY7ZPr81hhwGsswL7`,
> Commit `0305d52`). Die Testpunkte 1–15 unten sind umgesetzt und als automatisierte Tests grün
> (159/159). Die Implementierungsdetails stehen im Abschnitt „STEP 7" oben.

## Suchparameter vs. Modell-Retry (verbindliche Trennung)

**SUCHPARAMETER** (Zielrolle, Skills, Ort, Umkreis, Arbeitsmodell, Arbeitszeit):
Änderung → Dataset invalidieren → manuelle neue Suche → `/api/jobs` → neues Dataset → Matching.

**MODEL-WECHSEL** (bestehendes Verhalten, unverändert):
Dataset NICHT invalidieren → keine neue Jobsuche → kein `/api/jobs` → kein Apify → vorhandenes
Dataset → nur `/api/match` → manueller Matching-Start.

## 1. Umkreis (neu)

- Neuer Suchparameter `Umkreis`, Auswahl 10 / 25 / 50 / 100 km, UI: Dropdown/Select.
- Gehört zum Suchprofil und damit zur Job-Suche.
- Änderung → aktuelles Job-Dataset invalidieren → keine automatische neue Suche → manuelle neue Suche erlaubt `/api/jobs`; Jobquellen/Apify dürfen erneut abgefragt werden.

## 2. Arbeitsmodell (neu)

- Checkbox-Gruppe `Arbeitsmodell`: Remote / Hybrid / Vor Ort, Mehrfachauswahl möglich (z. B. Remote+Hybrid, Hybrid+Vor Ort, nur Remote).
- Gehört zum Suchprofil. Änderung invalidiert das Job-Dataset. Keine automatische neue Suche; neue Suche manuell.

## 3. Arbeitszeit (neu)

- Checkbox-Gruppe `Arbeitszeit`: Vollzeit (standardmäßig ausgewählt) + Teilzeit (zusätzlich aktivierbar).
- Vollzeit allein → nur Vollzeit; Vollzeit+Teilzeit → beide Beschäftigungsarten.
- Gehört zum Suchprofil. Änderung invalidiert das Job-Dataset. Keine automatische neue Suche; neue Suche manuell.

## Search-Parameter-Matrix

| Parameter | UI | Mehrfachauswahl | Dataset-Invalidierung | /api/jobs | AI-Matching |
|---|---|---|---|---|---|
| Zielrolle | bestehend | nein | ja | ja | ja |
| Skills | bestehend | bestehend | ja | ja | ja |
| Ort | bestehend | nein | ja | ja | ja |
| Umkreis | neu | nein | ja | ja | ja |
| Arbeitsmodell | neu | ja | ja | ja | ja |
| Arbeitszeit | neu | ja | ja | ja | ja |

Offener Punkt (keine eigenmächtige Änderung): Falls die spätere Analyse eine andere technische
Behandlung eines Parameters zeigt, wird das als offener Punkt dokumentiert, nicht eigenmächtig geändert.

## Testplan der Suchparameter-Phase (umgesetzt, Tests grün)

1. Umkreis erscheint korrekt — grün (SearchForm-Test)
2. 10/25/50/100 km auswählbar — grün
3. Remote/Hybrid/Vor Ort vorhanden — grün
4. Arbeitsmodell-Mehrfachauswahl funktioniert — grün
5. Vollzeit standardmäßig aktiv — grün
6. Teilzeit zusätzlich auswählbar — grün
7. Änderung Umkreis invalidiert Dataset — grün
8. Änderung Arbeitsmodell invalidiert Dataset — grün
9. Änderung Arbeitszeit invalidiert Dataset — grün
10. neue Suche muss manuell gestartet werden — grün
11. neue Suche darf `/api/jobs` aufrufen — grün
12. neue Suche darf Apify verwenden — grün (via `/api/jobs`)
13. Modellwechsel darf weiterhin NICHT `/api/jobs` auslösen — grün
14. Modellwechsel darf weiterhin NICHT Apify auslösen — grün (via `/api/jobs`)
15. bestehende Dataset-Re-Match-Logik bleibt erhalten — grün

## In diesem Step NICHT durchgeführt

- KEINE Erweiterung des Scopes (keine weiteren Parameter, Provider oder Jobquellen).
- KEINE AI-/Apify-Live-Requests während der Entwicklung; nur im expliziten Test-Step (siehe Execution Log TEIL 12).

# STEP 7 — SUCHPARAMETER-ERWEITERUNG (IMPLEMENTIERT, in Abnahme)

## Implementierung (Client + Server)

Neue Suchprofil-Parameter: `Umkreis` (10/25/50/100 km, Select), `Arbeitsmodell`
(Remote/Hybrid/Vor Ort, Mehrfachauswahl), `Arbeitszeit` (Vollzeit standardmäßig aktiv,
Teilzeit zusätzlich aktivierbar; mindestens eine bleibt aktiv).

- `Profile` erweitert (REQUIRED): `radiusKm: number|null`, `workModes: WorkMode[]`,
  `employmentTypes: EmploymentType[]`. `profilesEqual`/`arraysEqual` vergleichen alle Felder.
- Dataset-Invalidierung: jede Änderung eines Suchparameters invalidiert das Job-Dataset.
  Keine automatische neue Suche. Manuelle neue Suche darf `/api/jobs` (und damit die
  Jobquellen/Apify) erneut aufrufen.
- Modellwechsel bleibt getrennt (TEIL 5): invalidiert das Dataset NICHT, kein `/api/jobs`,
  kein Apify, nur manueller Re-Match auf dem vorhandenen Dataset.
- UI-Locking: während Suche/Matching sind Suchparameter, ModelSelector und CV/Profil gesperrt.
- Server: best-effort Filter in `api/_lib/filter.mjs` (additiv; ohne Parameter identisches
  Verhalten). `employmentMatches` (DE/EN-Alias-Sets, Stellen ohne Beschäftigungs-Info werden
  NICHT ausgeschlossen), `workModeMatches` (nur bei ausschließlich „remote" filterbar via
  `job.remote`). `radiusKm` ohne Geocoding nicht filterbar.
- Commit: `d53c4c9` (Branch `feature/precise-model-fallback-feedback`).

## Env-Variablen-Matrix (TEIL 10, KEINE Werte)

| Variable | Verwendung | Dev | Preview | Production | Sandbox möglich | Kostenrisiko |
|---|---|---|---|---|---|---|
| OPENROUTER_ENABLED | Schalter AI-Scoring/Anschreiben | – | ✓ | ✓ | ja | nein (nur Schalter) |
| OPENROUTER_ENV | Umgebungskennung | dev | preview | production | ja | nein |
| OPENROUTER_MODEL | Standardmodell | dev | prod | prod | ja | nein |
| OPENROUTER_API_KEY | Schlüssel OpenRouter | dev | prod | prod | ja | hoch (pro Request) |
| OPENROUTER_MONTHLY_MAX_REQUESTS | Request-Limit pro Monat | dev | prod | prod | ja | Reduktion |
| OPENROUTER_MONTHLY_SOFT_LIMIT_USD | Ausgaben-Schwelle | dev | prod | prod | ja | Reduktion |
| EDENAI_ENABLED | Schalter Fallback-Modell | – | ✓ | ✓ | ja | nein |
| EDENAI_ENV | Umgebungskennung | dev | preview | production | ja | nein |
| EDENAI_MODEL | Fallback-Modell | dev | prod | prod | ja | nein |
| EDENAI_API_KEY | Schlüssel Eden AI | prod | prod | prod | ja | mittel |
| EDENAI_DEV_API_KEY | Schlüssel Eden AI (Dev) | dev | – | – | ja | mittel |
| EDENAI_MONTHLY_MAX_REQUESTS | Request-Limit pro Monat | dev | prod | prod | ja | Reduktion |
| EDENAI_MONTHLY_SOFT_LIMIT_USD | Ausgaben-Schwelle | dev | prod | prod | ja | Reduktion |
| APIFY_API_TOKEN | Token Apify (Jobquellen) | dev | prod | prod | ja | hoch (pro Run) |
| APIFY_MONTHLY_MAX_RUNS | Max. Runs pro Monat | dev | prod | prod | ja | Reduktion |
| APIFY_MONTHLY_SOFT_LIMIT_USD | Ausgaben-Schwelle | dev | prod | prod | ja | Reduktion |
| APIFY_DATASET_REFRESH_PEAK_START/END | Peak-Fenster | dev | prod | prod | ja | nein |
| APIFY_DATASET_REFRESH_PEAK_HOURS | Peak-Stunden | dev | prod | prod | ja | nein |
| APIFY_DATASET_REFRESH_OFFPEAK_HOURS | Offpeak-Stunden | dev | prod | prod | ja | nein |
| APIFY_DATASET_REFRESH_TIMEZONE | Zeitzone | dev | prod | prod | ja | nein |
| JOB_SOURCE_ARBEITNOW_ENABLED | Schalter Arbeitnow | dev | prod | prod | ja | nein |
| JOB_SOURCE_ARBEITSAGENTUR_ENABLED | Schalter Agentur für Arbeit | dev | prod | prod | ja | nein |
| UPSTASH_REDIS_REST_URL | URL Upstash Redis | dev | prod | prod | ja | gering |
| UPSTASH_REDIS_REST_TOKEN | Token Upstash Redis | dev | prod | prod | ja | gering |
| RESEND_API_KEY | Schlüssel Resend (Digests) | dev | prod | prod | nein | gering |
| DIGEST_FROM | Absender E-Mail-Digests | dev | prod | prod | nein | nein |
| CRON_SECRET | Schutz der Cron-Endpunkte | dev | prod | prod | ja | nein |
| USAGE_DIAGNOSTICS_TOKEN | Token Verbrauchs-Diagnose | dev | prod | prod | ja | nein |
| MODEL_FALLBACK_MAX_ATTEMPTS | Fallback-Versuche | dev | prod | prod | ja | nein |
| VERCEL_ENV | Vercel-Umgebung | dev | preview | production | – | nein |

Hinweise: „Sandbox möglich" = Funktion ohne Live-/Kosten-Kontakt testbar. Nur Variable-NAMEN
dokumentiert; keine Werte/Secrets.
