# Execution Log — Feature: Precise Model Fallback Feedback

> Anmerkung zum Log selbst (Transparenz):
> In der Step-2-Aufgabenstellung war KEIN Execution-Log-Pfad definiert, und es
> existierte zu Beginn der Arbeit KEIN Execution-Log in `docs/reports/`
> (nur Feature-Reports). Dieser Log wird NACH Abschluss der Step-2-Arbeit an dem
> hier angeforderten Pfad erstellt und enthält ausschließlich tatsächlich
> durchgeführte Arbeit mit realen, verifizierbaren Belegen (Git-Historie,
> ausgeführte Kommandos, Test-/Build-Ergebnisse, Commit-Hashes).
> Keine Einträge wurden erfunden; jede Angabe ist gegen Git/Testlauf nachprüfbar.

Branch:
feature/precise-model-fallback-feedback

HEAD:
14dd3230641fc7553743a7439d7223ba53c9a4bd

origin:
14dd3230641fc7553743a7439d7223ba53c9a4bd

Status:
COMPLETE

---

## 1. Repository/Git initial state

- Action: Aktuellen Stand und Branch-Position feststellen.
- Command: `git fetch origin` / `git checkout main && git pull --ff-only origin main` / `git checkout -b feature/precise-model-fallback-feedback`
- Result: `main` war auf `f5f5ee2` (= origin/main). Feature-Branch von aktuellem main erstellt.
- Evidence: `git rev-parse main` = `f5f5ee202cb34030c8c2abbe5d21cebf4f116142`; `git branch --show-current` = `feature/precise-model-fallback-feedback`.
- Impact: Saubere Basis für ein additives, isoliertes Feature.
- Next step: Bestehende Strukturen untersuchen.

## 2. Relevant existing documentation found

- Action: Vorhandene Reports/Dokumente sichten.
- Command: `ls docs/reports/`
- Result: Vorhanden: `FEATURE_AI_MATCHING_TIMEOUT.md`, `FEATURE_APP_VERSION_FOOTER.md`, `FEATURE_MATCHING_RETRY_NO_REFETCH.md`, `FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md` (Step-1/2-Report), `TEST_SAFETY_PHASE1_CURRENT.md`. KEIN Execution-Log vorhanden.
- Evidence: `ls docs/reports/` (siehe Result).
- Impact: Feature-Report und Architektur-Doku (`docs/ARCHITECTURE.md`, `docs/AI_PROVIDERS.md`, `docs/CHANGELOG.md`, `docs/ROADMAP.md`) als Konsistenzreferenz.
- Next step: Implementierung anhand dieser Doku-Konventionen prüfen.

## 3. Existing matching/fallback/model-selector structures examined

- Action: Client-Fallback-, Match- und ModelSelector-Flows analysieren.
- Command: Read `src/api.ts`, `src/App.tsx`, `src/components/Status.tsx`, `src/components/ModelSelector.tsx`, `src/hooks/useAvailableModels.ts`, `src/lib/modelDisplayName.ts`, `src/types.ts`, `api/match.mjs`, `api/_lib/ai.mjs`/`providers/`.
- Result: `withModelFallback` lieferte nur `{ data, usedFallback }`; Fallback-Kette (`fallbackOrder`: selected → recommended → Katalog, max `fallbackMaxAttempts`) ist der UI unbekannt; `model_unavailable` wird über `describeError`/`isModelUnavailable` zur generischen Meldung `model.unavailable` gemappt; `effectiveModel`/`selectedModel`/`models[]` (id/name/provider) sind in App vollständig verfügbar; `modelDisplayName` liefert Anzeigenamen ohne Duplikation.
- Evidence: src/api.ts:72-157 (FallbackResult/withModelFallback), src/App.tsx:49-114, src/i18n.tsx:69-75/219-225.
- Impact: Basis für den additiven Trace und die präzisen Meldungen.
- Next step: Fehlende Kommunikationsbausteine bestimmen.

## 4. Existing functionality identified

- Action: Bestehende Features und Textstellen katalogisieren.
- Result: Matching Retry without Job Re-fetch (Dataset-Persistenz, runSearch/performMatch, busyRef), ModelSelector, `model.unavailable`/`model.fallbackNote` (auch in CvUpload/LetterModal), Quota-/Timeout-/Network-Handling, Jobquellen, Apify, Cache. All dies bleibt erhalten.
- Evidence: Grep über `model_unavailable`/`fallbackNote`/`fallbackOrder`/`withModelFallback` (src + api + docs + tests).
- Impact: Scope-Grenze des Features ist „nur Benutzerkommunikation".
- Next step: Fehlende Elemente bestimmen.

## 5. Missing components determined

- Action: Defizite der aktuellen Meldung bestimmen.
- Result: (a) Kein Zugriff der UI auf die Versuchs-Kette (welches Modell fehlschlug, welches als Nächstes verwendet wird); (b) keine Aussage „Jobs bleiben erhalten"; (c) keine Aussage „Modellwahl ohne neue Suche"; (d) Modellnamen fehlen in der Meldung.
- Evidence: Step-1-Analyse (Abschnitte A–F).
- Impact: Minimaler Eingriff = additiver `attempts`-Trace in `withModelFallback` + neue i18n-Keys + neue Meldungslogik in `performMatch`.
- Next step: Implementierung.

## 6. Implementation

- Action: Trace in `src/api.ts` ergänzen; Meldungen in `src/App.tsx`; i18n-Keys de/en; Tests.
- Command: Edit `src/api.ts`, `src/App.tsx`, `src/i18n.tsx`, `src/App.test.tsx`, `src/api.test.ts`; Write `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md`.
- Result:
  - `src/api.ts`: `FallbackAttempt` + `FallbackResult<T>.attempts`; `withModelFallback` zeichnet jeden Versuch auf. Algorithmus unverändert (gleiche `fallbackOrder`, gleiche Versuchsanzahl, gleiche Fehler-Durchreichung).
  - `src/App.tsx`: `modelLabel()` via `modelDisplayName`; `performMatch` zeigt bei Fallback-Erfolg `model.fallbackSuccess` (mit `{failed}`/`{used}`) und bei vollständigem Fehlschlag `model.fallbackExhausted`; sonst unverändert.
  - `src/i18n.tsx`: `model.fallbackSuccess` + `model.fallbackExhausted` (DE + EN). `model.unavailable`/`model.fallbackNote` unverändert.
  - Tests: 5 neue App-Tests + 2 Trace-Tests in api.test.ts; 4 bestehende Assertions (`/momentan nicht verfügbar/`) auf die neue Meldung umgestellt.
- Evidence: `git diff --stat main..HEAD` = 6 Dateien, +355/−12.
- Impact: Präzise Benutzerkommunikation; bestehendes Fallback-Verhalten unverändert.
- Next step: Tests/Validierung.

## 7. Tests/validation

- Action: Gezielte + vollständige Test-Suite.
- Command: `npx vitest run src/api.test.ts src/App.test.tsx` und `npm test`.
- Result: Gezielt 53/53 PASS; vollständig **137/137 PASS (16 Dateien)**.
- Evidence: Vitest-Ausgabe (`Test Files 16 passed`, `Tests 137 passed`).
- Impact: Keine Regressionen; neue Szenarien abgedeckt.
- Next step: TypeScript/Build.

## 8. TypeScript/build

- Action: Typcheck und Produktions-Build.
- Command: `npx tsc -b` und `npm run build`.
- Result: `TSC_OK`; `vite build` erfolgreich (`index-DELMv0R2.js`, „built in 339ms").
- Evidence: Konsolen-Ausgaben.
- Impact: Typ- und Build-Sicherheit.
- Next step: Doku-Abgleich.

## 9. Documentation alignment

- Action: Feature-Report mit Implementierung abgleichen.
- Command: Write/Edit `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md`; Quervergleich mit Git-Status/Testlauf.
- Result: Report Step 2 dokumentiert Änderungen, betroffene Dateien, UX-Verhalten, Trace, i18n, Tests, Build, Audit, Git-Status, offene Punkte — konsistent mit Commit `14dd323` und Testlauf 137/137.
- Evidence: Report-Inhalt vs. `git show --stat HEAD`.
- Impact: Wiederaufnahme-fähige Doku.
- Next step: Git-/Qualitäts-Gates.

## 10. Git status / diff-check / Secret Audit

- Action: Qualitäts-Gates vor Commit.
- Command: `git diff --check`; Grep nach Secret-Mustern im Diff.
- Result: `DIFFCHECK_OK`; `SECRET_AUDIT_CLEAN` (keine Keys/Tokens/ENV-Referenzen im Diff).
- Evidence: Konsolen-Ausgaben.
- Impact: Sauberer, sicherer Commit.
- Next step: Commit/Push.

## 11. Final assessment

- Action: Ergebnis bewerten.
- Result: Feature-Scope exakt umgesetzt; alle Gates PASS; kein bestehendes Feature entfernt; Fallback-Algorithmus unverändert; keine AI-/Apify-/Production-Requests ausgeführt.
- Evidence: Gates in Abschnitt 7/8/10; Commit `14dd323`.
- Impact: Feature ist merge-fähig (Merge erst nach separater Freigabe).
- Next step: Offene Punkte dokumentieren.

## 12. Open points / next step

- Offene Punkte: Keine offenen Implementierungsfragen. Preview/Abnahme, Merge nach main, Production-Deployment, Production-Test sind PENDING und benötigen separate Freigabe.
- Next step: Nächste freigegebene Phase abwarten.

---

## Explizite Pflicht-Feststellungen

- Existing features were NOT removed: wahr (Diff umfasst nur additive Änderungen; kein Löschen/Deaktivieren von Jobquellen, Apify, Cache, Matching, ModelSelector, CV, LetterModal, Timeout/Network-Handling).
- Existing fallback algorithm was NOT changed: wahr (`fallbackOrder`, `fallbackMaxAttempts`, Timeouts, Error-Codes, `isModelUnavailable`, Provider-Logik unverändert; nur additiv `attempts` aufgezeichnet).
- No AI request: wahr (keine Live-AI-Requests in diesem Step).
- No Apify request: wahr.
- No Production request: wahr (kein Deployment, kein Production-Zugriff).
- Branch: feature/precise-model-fallback-feedback
- HEAD: 14dd3230641fc7553743a7439d7223ba53c9a4bd
- origin: 14dd3230641fc7553743a7439d7223ba53c9a4bd

---

# STEP 3 — PREVIEW / ABNAHME

## 1. Repository-/Git-Ist-Stand

- Action: Aktuellen Stand vor Abnahme feststellen.
- Command: `git branch --show-current` / `git rev-parse HEAD` / `git rev-parse origin/feature/precise-model-fallback-feedback` / `git rev-parse main` / `git rev-parse origin/main` / `git status --short`.
- Result: Branch `feature/precise-model-fallback-feedback`; HEAD `e554c18`; origin/feature `e554c18` (in Sync); main `f5f5ee2`; origin/main `f5f5ee2`; Working Tree nur dauerhaft untracked (`ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`).
- Evidence: Ausgabe der o. g. Kommandos.
- Impact: Klare Ausgangsbasis für die Preview-Abnahme.
- Next step: Preview-Deployment.

## 2. Relevante Dokumentation

- Action: Execution Log zu Beginn geöffnet; Feature-Report geprüft.
- Command: Read `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK-EXECUTION-LOG.md`; Read/Edit `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md`.
- Result: Beide Dokumente vorhanden; Step-2-Log vollständig; kein zweiter Log angelegt.
- Evidence: Dateiinhalte.
- Impact: Konsistenz zwischen Log und Report.
- Next step: Preview-Deployment.

## 3. Preview-Deployment / Deployment-Identität

- Action: Preview aus sauberem Worktree von `e554c18` deployen; Deployment-Commit aus Vercel auslesen.
- Command: `git worktree add /tmp/opencode/preview-feedback e554c18`; `npx vercel --yes` (Preview) im Worktree; `npx vercel inspect <url>`; Vercel-API `GET /v13/deployments/dpl_9PFMTY7eVrqVonR2bn4fgT3bwCHj`.
- Result: Preview-URL `https://mays-job-matcher-5zl0hhk2h-maymilly.vercel.app`; Deployment-ID `dpl_9PFMTY7eVrqVonR2bn4fgT3bwCHj`; State READY; `meta.gitCommitSha` = `e554c1807c0db8b99b180bf55d6f87c52502df40` == Feature HEAD.
- Evidence: Vercel-API-Response (gitCommitSha, gitCommitMessage).
- Impact: Preview-Deployment-Commit == Feature HEAD erfüllt.
- Next step: Feature-Identität.

## 4. Feature-Identität

- Action: Preview-Bundle auf neue Funktion prüfen; gegen lokalen Rebuild von `e554c18` vergleichen.
- Command: `curl` `/top` (Bundle `index-B9BucZZW.js`), `curl` Bundle, `grep` i18n-Strings; `VERCEL_ENV=preview VERCEL_GIT_COMMIT_SHA="" VERCEL_GIT_COMMIT_REF="" npm run build` im Worktree; `sha256sum`.
- Result: Alle neuen DE+EN-i18n-Strings im Preview-Bundle PRESENT; lokaler Rebuild liefert identisches Bundle, **SHA-256 `1975d952…` == deployed** → byte-identisch.
- Evidence: grep-Ausgabe; SHA-256-Vergleich.
- Impact: Preview enthält exakt den Code von `e554c18` (Trace, präzise Modellnamen, neue i18n-Keys, Hinweise).
- Next step: UI-Abnahme.

## 5. UI-Abnahme

- Action: Preview-Endpunkte prüfen; interaktive Klick-Abnahme.
- Command: `curl` `/, /top, /api/model, /api/models`.
- Result: Alle HTTP 200; `/api/models` meldet Provider `configured:false` (Preview ohne AI-Keys). Interaktive Browser-Klicks: **nicht direkt verifiziert** (kein Browser-Automatisierungswerkzeug verfügbar).
- Evidence: HTTP-Statuscodes; Hinweis auf fehlendes Browser-Tooling.
- Impact: Seiten-/Endpunkt-Funktion bestätigt; interaktive UI-Verifikation über 137 Tests + Bundle-Nachweis belegt.
- Next step: Fallback-Meldungen.

## 6. Fallback-Meldungen

- Action: Vorhandensein und Wortlaut der neuen Meldungen prüfen.
- Command: `grep` Preview-Bundle (DE+EN-Strings); Tests „Präzises Model-Fallback-Feedback (Feature)".
- Result: Meldungen „Das Modell X ist derzeit nicht verfügbar. Wir versuchen es automatisch mit Y. Ihre bereits gefundenen Stellen bleiben erhalten." / „Das ausgewählte AI-Modell ist derzeit nicht verfügbar. … anderes verfügbares Modell auswählen, ohne die Jobs erneut zu laden." (DE+EN) vorhanden; dynamische Modellnamen via `modelDisplayName` aus Runtime-Katalog.
- Evidence: Bundle-grep; 5 neue App-Tests grün.
- Impact: Kernziel erfüllt.
- Next step: ModelSelector-Verhalten.

## 7. ModelSelector-Verhalten

- Action: Funktionsfähigkeit prüfen.
- Command: Tests Test E/F/G, Matching-Retry-Tests 1–11, Retry-Test 4 (Modellwechsel nur `/api/match`).
- Result: Dropdown sperrt/entsperrt korrekt; fehlgeschlagenes Modell bleibt sichtbar; Modellwechsel löst ausschließlich `/api/match` auf vorhandenem Dataset aus; kein `/api/jobs`, kein Apify. Architektur unverändert.
- Evidence: Testläufe grün (137/137).
- Impact: ModelSelector-Anforderungen erfüllt.
- Next step: Request-/Runtime-Prüfung.

## 8. Request-/Runtime-Prüfung

- Action: Keine unerlaubten externen Requests ausführen; Preview hat keine AI-Keys.
- Command: `curl` freie Endpunkte (siehe 5).
- Result: Kein AI-Live-Test durchgeführt (Preview ohne AI-Keys → laut Vorgabe nicht erzwungen); kein Apify; keine künstlichen Job-Suchen; keine kostenpflichtigen Requests.
- Evidence: `/api/models` zeigt `configured:false`.
- Impact: Request-Sicherheit gewahrt.
- Next step: Regression / technische Validierung.

## 9. Regression / technische Validierung

- Action: Gates frisch ausführen.
- Command: `npx vitest run src/api.test.ts src/App.test.tsx`; `npm test`; `npx tsc -b`; `npm run build`; `git diff --check`; Secret-Grep (Code-Diff).
- Result: Gezielt 53/53; **`npm test` 137/137 PASS (16 Dateien)**; `TSC_OK`; Build PASS; `DIFFCHECK_OK`; `CODE_SECRET_AUDIT_CLEAN`. Code seit Step-2-Gates unverändert (seitdem nur Docs-Commit `e554c18`).
- Evidence: Konsolen-Ausgaben; Git-Diff (nur Docs).
- Impact: Keine Regression; Entscheidung durch tatsächlichen Diff begründet.
- Next step: Dokumentationsabgleich.

## 10. Dokumentationsabgleich

- Action: Feature-Report und Execution Log aktualisieren (nicht neu anlegen).
- Command: Edit `FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md` (Step-3-Abschnitt, Abnahmekriterien) und `FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK-EXECUTION-LOG.md` (Step-3-Abschnitt, laufende Dokumentation).
- Result: Beide konsistent; Step-3-Abschnitte enthalten Git-Ist-Stand, Preview-Deployment, Feature-Identität, UI/Fallback/ModelSelector, Request-Prüfung, Regression, Audit, Bewertung, offene Punkte.
- Evidence: Dateiinhalte.
- Impact: Wiederaufnahme-fähige, konsistente Doku.
- Next step: Git-Commit/Push.

## 11. Git-Status / Diff-Check / Secret-Audit

- Action: Nur Dokumentation committen; auf Feature-Branch pushen.
- Command: `git add docs/reports/…`; `git commit`; `git push`; `git rev-parse HEAD`/`origin/feature/…`.
- Result: Docs-Commit erstellt; Push auf `origin/feature/precise-model-fallback-feedback`; HEAD == origin. KEIN Merge, KEIN Production-Deployment, KEIN Branch-Löschen.
- Evidence: Git-Ausgaben.
- Impact: Dokumentierter Abnahmestand.
- Next step: Abschlussbewertung.

## 12. Abschlussbewertung

- Action: Abnahmekriterien gegen Ist-Zustand prüfen.
- Result: Preview-Commit == Feature HEAD; Feature-Code im Artefakt (byte-identisches Bundle) nachgewiesen; neue Fallback-Meldungen (DE+EN) vorhanden; dynamische Modellnamen; Jobs-Erhalt und Modellwechsel ohne neue Suche kommuniziert; ModelSelector funktioniert; Tests/Build/Audits sauber; keine Secrets; keine unerlaubten externen Requests. Einzige Einschränkung: interaktive Browser-Klicks nicht direkt verifiziert (kein Tooling) — durch Tests + Bundle belegt, daher nicht als BLOCKED gewertet.
- Evidence: Gates + Vercel-API + SHA-256.
- Impact: **PREVIEW ACCEPTED**.
- Next step: Offene Punkte.

## 13. Offene Punkte

- Offene Punkte: Keine abnahmerelevanten. Merge nach main, Production-Deployment, Production-Test sind PENDING und benötigen separate Freigabe.
- Next step: Nächste freigegebene Phase abwarten.

---

## STEP-3-PFLICHT-FESTSTELLUNGEN

- Existing features were NOT removed: wahr (Code-Diff unverändert seit Step 2; nur Docs-Commit `e554c18`).
- Existing fallback algorithm was NOT changed: wahr.
- No AI request: wahr (kein AI-Live-Test; Preview ohne AI-Keys).
- No Apify request: wahr.
- No Production request: wahr (nur Preview-Deployment, kein Production).
- Branch: feature/precise-model-fallback-feedback
- HEAD (Abnahme-Basis): e554c1807c0db8b99b180bf55d6f87c52502df40
- origin: e554c1807c0db8b99b180bf55d6f87c52502df40 (vor Step-3-Docs-Commit)

---

# STEP 4a — UX CORRECTION / MANUAL MODEL RETRY ANALYSIS

> Hinweis Git: Dieser Step ist REINE Analyse. Doku-Update am Log (hier) ist erlaubt,
> ABER laut Step-4a-Vorgabe wird in diesem Step NICHT committet / gepusht.
> Das Log-Update bleibt vorerst uncommitted und wird mit dem nächsten freigegebenen
> Implementierungs-Step committet.

## 1. Git-/Repository-Ist-Stand

- Action: Stand feststellen.
- Command: `git branch --show-current` / `git rev-parse HEAD` / `git rev-parse origin/feature/precise-model-fallback-feedback` / `git rev-parse main` / `git status --short`.
- Result: Branch `feature/precise-model-fallback-feedback`; HEAD `72c7fed`; origin/feature `72c7fed` (in Sync); main `f5f5ee2`; Working Tree nur dauerhaft untracked (`ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`).
- Evidence: Kommando-Ausgaben.
- Impact: Stabile Analyse-Basis nach PREVIEW ACCEPTED (Step 3).
- Next step: Dokumentation sichten.

## 2. Vorhandene relevante Dokumentation

- Action: Execution Log geöffnet (kein zweiter Log); Feature-Report geprüft.
- Command: Read `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK-EXECUTION-LOG.md`; Read `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md`.
- Result: Step 2 + Step 3 vollständig dokumentiert; Status PREVIEW ACCEPTED; kein zweiter Log angelegt.
- Evidence: Dateiinhalte.
- Impact: Konsistenter Ausgangspunkt.
- Next step: Flow-Analyse (Code lesen).

## 3. Aktueller Search-/Match-Flow

- Action: `src/App.tsx` lesen (`runSearch`, `performMatch`, `handleProfileChange`, `handleModelChange`).
- Command: Read `src/App.tsx`.
- Result: `runSearch` (App.tsx:117): busyRef-Guard → `fetchJobs` → Dataset setzen → `performMatch(nextDataset, effectiveModel)` (automatisch). `performMatch` (App.tsx:78): `withModelFallback` → je Modell ein `/api/match`; Erfolg → `setFoundJobs`/`setMatches` + Status; alle Fehlschläge → `model.fallbackExhausted` (error); `finally` → `phase=idle`, busyRef frei.
- Evidence: App.tsx:78-153.
- Impact: Suche koppelt aktuell Suche und Matching aneinander; nach Fehlschlag ist das Dataset vorhanden.
- Next step: ModelSelector-Flow.

## 4. Aktueller ModelSelector-Flow

- Action: `src/components/ModelSelector.tsx` + App-Verdrahtung lesen.
- Command: Read `src/components/ModelSelector.tsx`; Read `src/App.tsx` (Props 202-210).
- Result: ModelSelector bekommt `value=effectiveModel`, `onChange=handleModelChange`, `disabled=isSearching`. Intern: Listbox mit allen Modellen (inkl. fehlgeschlagenem), Auswahl ruft `onChange(option.id)`.
- Evidence: ModelSelector.tsx:62-331.
- Impact: Selektion ist rein informativ; die Auslösung passiert im App-Handler.
- Next step: Dataset-Lebensdauer.

## 5. Aktuelle Dataset-Lebensdauer

- Action: Dataset-Lebenszyklus verfolgen.
- Command: Read `src/App.tsx` (dataset-State, handleProfileChange).
- Result: `dataset` wird NACH erfolgreichem `fetchJobs` gesetzt; bleibt durch Match-Fehler erhalten; wird in `handleProfileChange` invalidiert, sobald Skills/TargetRole/City von `dataset.profile` abweichen (`profilesEqual`); Modellwechsel invalidiert NICHT.
- Evidence: App.tsx:37, 144-160.
- Impact: Dataset-Persistenz funktioniert wie geplant; Basis für manuelles Re-Matching.
- Next step: automatische Fallback-Kette.

## 6. Aktuelle automatische Fallback-Kette

- Action: `src/api.ts` lesen.
- Command: Read `src/api.ts` (`fallbackOrder`, `withModelFallback`, `isModelUnavailable`).
- Result: Reihenfolge = selected → recommended → Katalog (`fallbackOrder`), max `fallbackMaxAttempts` (Standard 3); jeder Versuch ist ein eigener `/api/match`-Request; `attempts`-Trace wird seit Step 2 mitgegeben; bei vollständigem Fehlschlag wird der letzte `model_unavailable`-Fehler geworfen.
- Evidence: api.ts:93-157.
- Impact: Fallback-Algorithmus unverändert und funktionsfähig; Trace liefert die Basis für präzise Meldungen.
- Next step: Ursache des automatischen Starts.

## 7. Aktuelle Ursache des automatischen Starts

- Action: `handleModelChange` analysieren.
- Command: Read `src/App.tsx` (162-171).
- Result: **Ursache:** `handleModelChange` ruft nach `setSelectedModel` direkt `performMatch(dataset, model)` auf, wenn `dataset` existiert, `profilesEqual(dataset.profile, profile)` UND nicht busy. Genau das startet nach einer Modelauswahl sofort Matching.
- Evidence: App.tsx:162-171.
- Impact: Kern der UX-Korrektur: Diese automatische Auslösung muss entfernt werden.
- Next step: geeignete bestehende UI-Aktion für manuellen Start.

## 8. Geeignete bestehende UI-Aktion für manuellen Matching-Start

- Action: Bestehende UI-Aktionen katalogisieren.
- Command: Read `src/components/SearchForm.tsx` (Submit-Button `#find-btn`, `onSubmit`), `src/components/ModelSelector.tsx`.
- Result: Bestehende Aktionen: (a) Suchformular-Submit-Button („Meine Treffer finden" / „Find my matches") → `onSubmit` → aktuell immer `runSearch` (neue Jobsuche); (b) ModelSelector-Auswahl → aktuell Auto-Match (soll entfallen). Es gibt KEINE separate „nur Re-Match"-Aktion.
- Analyse: Semantisch passend ist der **bestehende Primär-Button des Suchformulars**. Er wird kontextabhängig:
  - Gültiges Dataset vorhanden (`dataset && profilesEqual(dataset.profile, profile)`), `phase===idle` → Submit ruft `performMatch(dataset, effectiveModel)` (Match-only, kein `fetchJobs`).
  - Kein gültiges Dataset (frisch oder durch Parameteränderung invalidiert) → Submit ruft `runSearch` (neue Jobsuche).
- Ergebnis: KEIN neuer Button nötig; die bestehende primäre CTA wird für „manueller Matching-Start" wiederverwendet. Optional neuer Button-Label für den Re-Match-Zustand (i18n), z. B. „Mit diesem Modell erneut bewerten".
- Impact: Minimale, semantisch konsistente UX-Änderung.
- Next step: Erkennung/Invalidierung von Suchparameteränderungen.

## 9. Erkennung/Invalidierung von Suchparameteränderungen

- Action: Prüfen, ob Skills/TargetRole/City-Änderungen das Dataset invalidieren.
- Command: Read `src/App.tsx` (`handleProfileChange`, `profilesEqual`).
- Result: Bereits implementiert: `handleProfileChange` setzt `dataset=null`, sobald eine der drei Eingaben von `dataset.profile` abweicht. KEINE automatische neue Suche bei Eingabeänderung (nur Invalidierung); neue Suche erfolgt manuell über den Submit-Button.
- Evidence: App.tsx:155-160.
- Impact: Regel 3 erfüllt; zusätzlich soll bei Invalidierung der „erschöpft"-Hervorhebung (neuer Zustand) zurückgesetzt werden.
- Next step: notwendige UX-Änderungen definieren.

## 10. Notwendige UX-Änderungen (Plan, noch NICHT implementiert)

- `src/App.tsx`:
  - `handleModelChange` → NUR `setSelectedModel` + Hervorhebung zurücksetzen. KEIN automatischer `performMatch`.
  - Submit-Handler kontextabhängig: gültiges Dataset → `performMatch(dataset, effectiveModel)`; sonst `runSearch`.
  - Neuer Zustand (z. B. `modelExhausted`) → wird im erschöpften Fallback-Fehlpfad gesetzt (`model.fallbackExhausted`-Status), zurückgesetzt bei Modellwahl, Parameteränderung, erfolgreichem Match, neuer Suche.
  - `modelExhausted` an ModelSelector als optionales Prop (z. B. `attention`).
- `src/components/ModelSelector.tsx`: optionales Prop `attention` → CSS-Highlight-Klasse + Hinweis-Text (`t("model.retryHint")`) unter dem Dropdown.
- `src/components/SearchForm.tsx`: optionales Label für den Re-Match-Zustand (`search.buttonRematch`) — der Button bleibt das manuelle Start-Element.
- `src/i18n.tsx`: neue Keys DE+EN: `model.retryHint` („Bitte versuche, ein anderes Modell auszuwählen." / „Please try selecting a different model."), optional `search.buttonRematch`.
- `src/styles.css`: Highlight-Stil (z. B. `.model-field--attention` / Fokus-Ring auf `.model-trigger`).
- Nicht geändert: Fallback-Algorithmus, Dataset-Architektur, Jobquellen, Apify, Timeout/Network, CV-/Letter-Flows, Error-Codes.
- Evidence: Analyse (Abschnitte 3–9) + Code.
- Impact: Gewünschter Ablauf: erschöpfter Fallback → Fehlermeldung → Highlight + Hinweis → Modellwahl (kein Start) → manueller Start (Submit) → `/api/match` auf Dataset → kein `/api/jobs`/Apify.
- Next step: Testplan.

## 11. Notwendige Tests (Plan, noch NICHT implementiert)

1. automatische Fallback-Kette bleibt unverändert (Reihenfolge/Versuche).
2. alle automatischen Modelle erschöpft → Fehlermeldung.
3. ModelSelector wird hervorgehoben (`attention`-Klasse/Hinweis sichtbar).
4. Hinweis „Bitte versuche, ein anderes Modell auszuwählen." erscheint (DE+EN).
5. Modellwechsel allein startet KEIN Matching (kein zusätzlicher `fetchMatches`-Call).
6. manuelles Matching (Submit) startet `/api/match`.
7. manuelles Matching verwendet vorhandenes Dataset (exakte Jobs).
8. manuelles Matching erzeugt KEIN `/api/jobs`.
9. manuelles Matching erzeugt KEIN Apify (kein `fetchJobs`).
10. Änderung von Skills invalidiert Dataset.
11. Änderung von TargetRole invalidiert Dataset.
12. Änderung von City invalidiert Dataset.
13. nach Invalidierung: neue Suche muss manuell gestartet werden (kein Auto-Search).
14. neue Suche darf danach `/api/jobs` auslösen.
15. UI-Locking während Suche/Matching (Suchparameter/ModelSelector/CV/manueller Start gesperrt).
16. Highlight verschwindet nach Modellwahl.
17. bestehende CV-/Letter-Flows bleiben erhalten.
- Evidence: Step-3-Abnahmekriterien + dieser Plan.
- Impact: Abnahmesicherheit für die UX-Korrektur.
- Next step: Regression-Risiken.

## 12. Mögliche Regressionen

- `handleModelChange` ohne Auto-Start bricht bestehende Tests, die Modellwahl → sofortigen Match erwarten: Matching-Retry-Tests 3/4/5 (`src/App.test.tsx`) und „Präzises Model-Fallback-Feedback"-Test 4. Diese müssen auf den MANUELLEN Start (Submit-Klick) umgestellt werden — Anpassung an das neue fachliche Verhalten, keine Abschwächung.
- Kontextabhängiger Submit-Button: Audit der Tests zeigt, dass alle Submit-Aufrufe mit geänderten Suchparametern erfolgen (→ Invalidierung → `runSearch`); kein Test verlässt sich auf „unveränderte Parameter + Submit → neue `fetchJobs`". Kein Bruch erwartet, wird aber per Testlauf verifiziert.
- Neues optionales Prop am ModelSelector (Default false) hält andere Nutzungen stabil.
- Keine Änderung an Fallback-Algorithmus/Dataset-Architektur → keine Risiken für Request-Sicherheit (weiterhin nur `/api/match` bei Modellwechsel/Re-Match).
- Kein Eingriff in CV-/Letter-/Jobquellen-/Apify-Flows.
- Evidence: Testanalyse + Code-Reads.
- Impact: Bekannte, gezielte Testanpassungen; sonst keine.
- Next step: Abschlussbewertung.

## 13. Abschlussbewertung

- Action: Analyseergebnis bewerten.
- Result: Ursache des unerwünschten automatischen Starts exakt identifiziert (`handleModelChange` Auto-Start, App.tsx:162-171). Geeignete bestehende Aktion für den manuellen Start gefunden (Suchformular-Submit-Button, kontextabhängig). Regel 1–5 durch minimale additive Änderungen umsetzbar. Kein Code geändert.
- Evidence: Abschnitte 1–12.
- Impact: Klarer Implementierungsplan für den nächsten freigegebenen Step.
- Next step: Freigabe abwarten (Implementierung Step 4b).

## 14. Nächster Step

- Nächster Step: Implementierung der UX-Korrektur nach separater Freigabe (Step 4b).
- Offene Punkte: Keine offenen Analysefragen. Kein Commit in diesem Step (Vorgabe Step 4a).
---

# STEP 4b — IMPLEMENTIERUNG UX-KORREKTUR (MANUELLER MODELL-RETRY)

> Freigabe durch Benutzer für die Implementierung erteilt („Step 4b implementieren").
> Inkludiert: der zuvor uncommittede Step-4a-Log-Eintrag (Analyse) wird mit diesem
> Step zusammen committet.

## 1. Git-/Repository-Ist-Stand

- Action: Stand vor Implementierung feststellen.
- Command: `git branch --show-current` / `git rev-parse HEAD` / `git status --short`.
- Result: Branch `feature/precise-model-fallback-feedback`; HEAD `72c7fed`; Working Tree mit uncommittedem Step-4a-Log-Update + dauerhaft untracked (`ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`).
- Evidence: Kommando-Ausgaben.
- Impact: Sauberer Ausgangspunkt für die Umsetzung des Step-4a-Plans.
- Next step: Code implementieren.

## 2. Implementierung (Dateien)

- Action: UX-Korrektur gemäß Step-4a-Analyse umgesetzt.
- Command: Edit `src/App.tsx`, `src/components/SearchForm.tsx`, `src/components/ModelSelector.tsx`, `src/i18n.tsx`, `src/styles.css`, `src/App.test.tsx`.
- Result:
  - `src/App.tsx`: `handleModelChange` ruft NUR noch `setSelectedModel` + Highlight-Reset auf (kein Auto-Start). Neuer `handleSubmit` (kontextabhängig): gültiges Dataset + `phase idle` → `performMatch(dataset, effectiveModel)` (Match-only, kein `/api/jobs`); sonst → `runSearch`. Neuer State `modelExhausted` (gesetzt im erschöpften Fallback-Fehlpfad, zurückgesetzt bei Erfolg, Modellwahl, Parameteränderung, neuer Suche). `onCvSubmit={runSearch}` hält den CV-Flow als neue Suche. `rematch={canRematch}` und `attention={modelExhausted}` verdrahtet.
  - `src/components/SearchForm.tsx`: optionales `onCvSubmit`- und `rematch`-Prop; Button-Label wechselt bei gültigem Dataset zu `search.buttonRematch`.
  - `src/components/ModelSelector.tsx`: optionales `attention`-Prop → `.model-field--attention` + Hinweis `model.retryHint` (role=status).
  - `src/i18n.tsx`: neue Keys DE+EN `search.buttonRematch` („Mit diesem Modell erneut bewerten"/„Re-score with this model") und `model.retryHint` („Bitte versuche, ein anderes Modell auszuwählen."/"Please try selecting a different model.").
  - `src/styles.css`: `.model-field--attention` (Akzent-Ring auf `.model-trigger`), `.model-hint--attention`.
  - `src/App.test.tsx`: Retry-Tests 3/4/5 und Feature-Test 4 auf manuellen Start umgestellt; neuer Block „UX-Korrektur: Manueller Modell-Retry (Step 4a)" mit Tests A–G.
- Evidence: `git diff` (alle Dateien geprüft).
- Impact: Regeln 1–5 des Step-4a-Plans umgesetzt; Fallback-Algorithmus/Dataset-Architektur unverändert.
- Next step: Validierung.

## 3. Validierung (Tests, Build, Diff, Secrets)

- Action: Alle Gates ausführen.
- Command: `npm test` / `npx tsc -b` / `npm run build` / `git diff --check` / Secret-Audit (`git diff` nach api_key/secret/token/apify).
- Result: Tests **144/144** (16 Dateien) PASS; `tsc -b` PASS; `vite build` PASS (dist/assets/index-A5XyqamC.js); `git diff --check` sauber; keine Secrets/Apify-/Key-Referenzen im Code-Diff (nur Doku-Erwähnungen im Log).
- Evidence: Kommando-Ausgaben.
- Impact: Implementierung ist technisch abnahmefähig.
- Next step: Commit.

## 4. Commit

- Action: Änderungen committen.
- Command: `git add` (5 Src-/Test-Dateien + Log) → `git commit`.
- Result: Siehe Commit-Hash unten.
- Evidence: `git log --oneline -1`.
- Impact: Feature-Umsetzung inkl. Step-4a-Analyse dokumentiert und versioniert.
- Next step: Push / Merge / Deployment nach Freigabe.

---

# STEP 5 — PREVIEW / ABNAHME

## 1. Git-/Repository-Ist-Stand

- Action: Stand feststellen.
- Command: `git branch --show-current` / `git rev-parse HEAD` / `git rev-parse origin/feature/precise-model-fallback-feedback` / `git rev-parse main` / `git rev-parse origin/main` / `git status --short`.
- Result: Branch `feature/precise-model-fallback-feedback`; HEAD `ddd6fc0`; origin/feature `ddd6fc0` (in Sync); main == origin/main `f5f5ee2`; Working Tree nur dauerhaft untracked (`ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`).
- Evidence: Kommando-Ausgaben.
- Impact: Feature HEAD == `ddd6fc0` bestätigt → gültige Deploy-Basis.
- Next step: Preview-Deployment.

## 2. Preview-Deployment

- Action: Sauberes git-Worktree von `ddd6fc0` erzeugen, Vercel-Preview deployen, tatsächlichen Deployment-Commit auslesen.
- Command: `git worktree add --detach /tmp/opencode/preview-s5 ddd6fc0`; `npx vercel --yes` (mit `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`); Vercel-API `v6/deployments` mit Token aus `~/.local/share/com.vercel.cli/auth.json`.
- Result: Preview-URL https://mays-job-matcher-3pxispsqv-maymilly.vercel.app; Deployment `dpl_F8pvmj8Pz661LhCVmRTwf6z4FyJe`; `meta.gitCommitSha` == `ddd6fc04b45fe5623522768173d141f469eefef9` == Feature HEAD. State READY.
- Evidence: CLI-Ausgabe + API-JSON (uid/url/state/gitCommitSha).
- Impact: Erwartung „Preview Commit == Feature HEAD" → PASS. KEIN Test auf falschem Build.
- Next step: Feature-Identität.

## 3. Feature-Identität

- Action: Deployed Bundle `index-MWzvy0WI.js` (244.311 Bytes) laden; i18n-Strings scannen; mit lokalem Rebuild von `ddd6fc0` vergleichen.
- Command: `curl -s …/assets/index-MWzvy0WI.js`; String-Grep (DE/EN retryHint + buttonRematch); lokaler Rebuild mit `VERCEL_ENV=preview VERCEL_GIT_COMMIT_SHA= VERCEL_GIT_COMMIT_REF= npm run build`; `sha256sum`-Vergleich.
- Result: Alle Step-4b-i18n-Strings im Bundle vorhanden (DE+EN). Lokaler Rebuild erzeugt exakt `index-MWzvy0WI.js` — **byte-identisch** (SHA-256 `9ab9441cbf38d437b73fdd32003e3049f87b7954e4bb0c8a72721e4f88250c7e`). Verhalten (kein Auto-Start, `modelExhausted`, kontextabhängiger Submit, Dataset-Re-Match) durch DOM-Tests A–G belegt (minifizierte Namen nicht als Strings suchbar).
- Evidence: String-Treffer, sha256sum-Ausgabe.
- Impact: Preview enthält exakt den Step-4b-Code (PASS).
- Next step: Technische Smoke Tests.

## 4. Technische Smoke Tests

- Action: HTTP-Status für `/`, `/top`, `/api/model`, `/api/models` prüfen; Konfigurationszustand prüfen.
- Command: `curl -s -w "%{http_code}"` je Pfad; Body-Lesung für `/api/model`, `/api/models`.
- Result: Alle vier Pfade HTTP 200. `/api/models`: Provider `configured:false` → KEINE AI-Keys im Preview.
- Evidence: curl-Ausgaben.
- Impact: KEIN AI-Live-Test, KEIN Apify, KEINE kostenpflichtigen Requests (Vorgabe). Console-/Runtime-/Network-Fehler im echten Browser: nicht direkt verifiziert (kein Browser-Tooling); keine jsdom-/Build-Fehler.
- Next step: UX-Abnahme.

## 5. UX-Abnahme

- Action: Abnahmekriterien gegen automatische DOM-Level-Tests + statische Evidenz prüfen (kein Browser-Tooling verfügbar).
- Command: Testauswahl (Step-4a-Tests A–G, App-Tests 6–9, 8b, Matching-Retry 3–5, Feature-Test 4); Bundle-/Deployment-Belege.
- Result: Alle Kriterien PASS (siehe Feature-Report Step 5, Tabelle). „Modellwahl allein startet KEIN Matching" (Test A), Hinweis sichtbar (Test B), Highlight vorhanden/verschwindet (B/C), manueller Button (E), Dataset-Re-Match ohne `/api/jobs` (D), neue Suche manuell + Parameter-Invalidierung (F, Test 6/7), Sperrung während Suche/Matching (Test 8/8b/9, Test G).
- Evidence: Testausführungen (144/144 grün).
- Impact: UX-Verhalten auf DOM-Ebene vollständig abgenommen; echte Browser-Klicks nicht direkt verifiziert (kein Tooling) — explizit als solche markiert, NICHT als PASS für den Live-Browser behauptet.
- Next step: Neue Suche.

## 6. Neue Suche

- Action: Dataset-Invalidierung + manuelle neue Suche prüfen.
- Command: Test F + Test 6 + Test 7 (jsdom).
- Result: Änderung an Skills/TargetRole/City invalidiert Dataset (kein Auto-Search); neue Suche nur manuell (Submit) → `/api/jobs` erlaubt; neues Dataset entsteht. Echter Browser-Livetest nicht möglich (keine Keys) → nicht erzwungen; durch Tests + statische Evidenz dokumentiert.
- Evidence: Testausführungen.
- Impact: Regel „neue Suche bleibt manuell" bestätigt.
- Next step: Request-Sicherheit.

## 7. Request-Sicherheit

- Action: Request-Verhalten bei Modellwahl vs. manuellem Start prüfen.
- Command: Step-4a-Tests A/D (fetchMatches/fetchJobs-Call-Zähler); String-/Bundle-Analyse.
- Result: Modellauswahl allein löst KEINEN Request aus (Test A: Call-Zähler unverändert). Manueller Start → genau `/api/match` auf vorhandenem Dataset, kein `/api/jobs`, kein Apify (Test D, Matching-Retry-Tests 3–5).
- Evidence: Testausführungen.
- Impact: Request-Sicherheit auf Request-Ebene belegt; Live-Netzwerk-Nachweis im echten Browser **nicht direkt verifiziert** (kein Browser-Tooling) — explizit als solche markiert.
- Next step: Regression.

## 8. Regression

- Action: Bestehende Features prüfen (keine Löschung/Deaktivierung).
- Command: Volle Testsuite (16 Dateien, 144 Tests); Diff-Review Step 4b.
- Result: Automatische Fallback-Kette, Dataset-Persistenz, Search/Match-Trennung, ModelSelector, Jobquellen, Apify/Cache, Timeout-/Network-Handling, CV-Flow, Footer erhalten; LetterModal-Code unverändert (kein Test, Build ok). `api/`-Code im Step-4b-Diff nicht angefasst.
- Evidence: Testausführungen + `git diff` (nur additive Änderungen).
- Impact: Keine sichtbaren Regressionen.
- Next step: Test/Build/Audit.

## 9. Test / Build / Audit

- Action: Alle Gates ausführen.
- Command: `npm test` / `npx tsc -b` / `npm run build` / `git diff --check` / Secret-Audit (`git diff` + untracked Scan nach api_key/secret/token/password/apify).
- Result: Tests **144/144** (16 Dateien) PASS; `tsc -b` PASS; `vite build` PASS; `git diff --check` sauber; keine Secrets (0 Treffer). Keine Tests entfernt/abgeschwächt (nur erweiterte/angepasste an neues fachliches Verhalten).
- Evidence: Kommando-Ausgaben.
- Impact: Abnahmevoraussetzungen erfüllt.
- Next step: Dokumentation.

## 10. Dokumentation

- Action: Feature-Report + Execution Log aktualisieren.
- Command: Append Step-5-Abschnitte an `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md` und diesen Log.
- Result: Beide Dokumente konsistent (Preview-Deployment, Commit `ddd6fc0`, UX-Abnahme, technische Tests, offene Punkte).
- Evidence: Dateien.
- Impact: Abnahme nachvollziehbar dokumentiert.
- Next step: Git-Commit der Doku.

## 11. Git

- Action: Nur Doku-Änderungen committen und auf den Feature-Branch pushen.
- Command: `git add` (2 Docs) → `git commit` → `git push`.
- Result: Siehe Commit-Hash unten.
- Evidence: `git log --oneline -1`, `git rev-parse origin/feature/...`.
- Impact: Doku versioniert; kein Merge nach main, kein Production-Deployment, kein Branch-Löschen.

## Abnahmeergebnis

- **STEP 5 = COMPLETE** · **PREVIEW = ACCEPTED**
- Nicht direkt verifiziert (kein Browser-Tooling): Live-Browser-Klicks, Live-Netzwerk-Request-Nachweis, Browser-Console/Network-Fehler — explizit als „nicht verifiziert" markiert, durch DOM-Tests und Bundle-Identität abgedeckt.
- Nächster Step (Merge nach main, Production-Deployment) benötigt separate Freigabe.

---

# STEP 6 — MERGE-VORBEREITUNG + ZUKÜNFTIGER SUCHPARAMETER-SCOPE (PLANNED)

## 1. Git-/Repository-Ist-Stand

- Action: Ist-Stand zu Beginn feststellen.
- Command: `git branch --show-current` / `git rev-parse HEAD` / `git rev-parse origin/feature/precise-model-fallback-feedback` / `git rev-parse main` / `git rev-parse origin/main` / `git status --short` / `git log --oneline main..feature`.
- Result: Branch `feature/precise-model-fallback-feedback`; HEAD `cf8744a`; origin/feature `cf8744a` (in Sync); main == origin/main `f5f5ee2`; Working Tree nur dauerhaft untracked (`ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`). Feature-Commits über main: `14dd323` (feat), `e554c18` (docs), `72c7fed` (docs), `ddd6fc0` (feat), `cf8744a` (docs).
- Evidence: Kommando-Ausgaben.
- Impact: Vollständige, verifizierbare Ausgangslage dokumentiert.
- Next step: Teil A — Merge-Gate.

## 2. Teil A — Merge-Gate

- Action: Alle 15 Merge-Gates prüfen.
- Command: `git merge-base --is-ancestor main feature/...` / `git diff --stat main feature/...` / `git diff main feature/... -- src/api.ts` / `git diff main feature/... --numstat` / Deletions-Review / `npm test` / `npx tsc -b` / `npm run build` / `git diff --check` / Secret-Audit.
- Result: Fast-forward möglich (merge-base `f5f5ee2` == main HEAD). Feature-Diff: 10 Dateien (App.tsx, api.ts, i18n.tsx, ModelSelector, SearchForm, styles.css, App.test.tsx, api.test.ts, 2 Doc-Dateien). `api.ts`-Diff = nur `FallbackAttempt`/`attempts`-Trace (kein Apify/Jobquellen/Timeout-Eingriff); `api/`-Verzeichnis (Serverless) unverändert. Gelöschte Zeilen ausschließlich Testtexte (`/momentan nicht verfügbar/` → präzise Meldung), eine Test-Erwartung (`usedFallback` → + `attempts`) und Kommentar-Zeilen. Tests **144/144** PASS; `tsc -b` PASS; `vite build` PASS; `git diff --check` sauber; Secret-Scan 0 Treffer.
- Evidence: Kommando-Ausgaben (Diff, Test-/Build-Outputs).
- Impact: **MERGE-READY** bestätigt; KEIN Merge durchgeführt (separate Freigabe).
- Next step: Teil B–F — Suchparameter-Scope dokumentieren.

## 3. Teil B — Wichtige neue Suchparameter (PLANNED)

- Action: Anforderungen aus echtem UX-Test als verbindlichen Scope der nächsten Phase dokumentieren (NICHT implementiert).
- Command: Append Feature-Report (Abschnitt „NEXT DEVELOPMENT SCOPE — NEUE SUCHPARAMETER").
- Result: Umkreis (10/25/50/100 km, Dropdown), Arbeitsmodell (Remote/Hybrid/Vor Ort, Mehrfachauswahl), Arbeitszeit (Vollzeit default, Teilzeit zusätzlich) dokumentiert. Jede Änderung → Dataset-Invalidierung, keine Auto-Suche, manuelle neue Suche erlaubt `/api/jobs` + Jobquellen/Apify.
- Evidence: Feature-Report-Abschnitt.
- Impact: Klarer, verbindlicher Scope für die nächste Entwicklungsphase; als PLANNED gekennzeichnet.
- Next step: Teil C/E — Trennung + Matrix.

## 4. Teil C — Search Parameter vs. Model Retry (Trennung)

- Action: Verbindliche Trennung dokumentieren.
- Command: Append Feature-Report (Abschnitt „Suchparameter vs. Modell-Retry").
- Result: SUCHPARAMETER → Dataset invalidieren, manuelle neue Suche, `/api/jobs`, neues Dataset, Matching. MODEL-WECHSEL → Dataset nicht invalidieren, kein `/api/jobs`, kein Apify, vorhandenes Dataset, nur `/api/match`, manueller Matching-Start.
- Evidence: Feature-Report-Abschnitt.
- Impact: Kein Scope-Spill zwischen Suche und Modellwahl.
- Next step: Teil E — Matrix.

## 5. Teil E — Search-Parameter-Matrix

- Action: Matrix dokumentieren.
- Command: Append Feature-Report (Matrix-Tabelle).
- Result: Tabelle mit Zielrolle/Skills/Ort (bestehend) und Umkreis/Arbeitsmodell/Arbeitszeit (neu) inkl. Mehrfachauswahl/Invalidierung//api/jobs/AI-Matching. Offener Punkt vermerkt: abweichende technische Behandlung eines Parameters wird dokumentiert, nicht eigenmächtig geändert.
- Evidence: Feature-Report-Abschnitt.
- Impact: Konsistente Planungsbasis.
- Next step: Teil F — Testplan.

## 6. Teil F — Testplan für die spätere Phase

- Action: Testplan (geplant, nicht implementiert) dokumentieren.
- Command: Append Feature-Report (Testplan 1–15).
- Result: 15 geplante Tests (Umkreis-Auswahl, Arbeitsmodell-Mehrfachauswahl, Vollzeit-Default, Teilzeit, Invalidierung je Parameter, manuelle neue Suche mit `/api/jobs`/Apify, Modellwechsel ohne `/api/jobs`/Apify, Dataset-Re-Match erhalten).
- Evidence: Feature-Report-Abschnitt.
- Impact: Abnahmekriterien der nächsten Phase vorbereitet.
- Next step: Teil G — Abschlussbewertung.

## 7. Teil G — Abschlussbewertung / Status

- Action: Ergebnis bewerten.
- Command: Konsolidierung der Gate-Ergebnisse.
- Result: **MERGE-READY**. Nicht durchgeführt: Merge, Production-Deployment, Branch-Löschen, AI-Request, Apify, Implementierung der neuen Parameter.
- Evidence: Abschnitte 1–6.
- Impact: Klarer, freigabebereiter Stand; nächster Step benötigt separate Freigabe.
- Next step: Dokumentation committen + pushen.

## 8. Dokumentation & Git

- Action: Feature-Report + Execution Log aktualisieren; nur Doku-Commits auf den Feature-Branch pushen.
- Command: Append beider Docs; `git add` (2 Docs) → `git commit` → `git push`.
- Result: Beide Dokumente konsistent (MERGE-READY + PLANNED-Scope); Commit-Hash siehe `git log`.
- Evidence: `git log --oneline -1`, `git rev-parse origin/feature/...`.
- Impact: Stand vollständig versioniert; keine Codeänderungen in diesem Step.
- Next step: STOPP — auf separate Merge-Freigabe warten.

## Nicht durchgeführt (explizit)

- Merge nach main: NICHT durchgeführt (separate Freigabe).
- Production-Deployment: NICHT durchgeführt.
- Branch-Cleanup: NICHT durchgeführt.
- AI-Requests / Apify: KEINE.
- Implementierung der neuen Suchparameter: KEINE (nur PLANNED dokumentiert).

---

# STEP 7 — ABSCHLUSS FEATURE-BLOCK + SEARCH-PARAMETER-ERWEITERUNG

## 1. Repository-/Git-Ist-Stand

- Action: Ist-Stand zu Beginn feststellen.
- Command: `git branch --show-current` / `git rev-parse HEAD` / `git rev-parse origin/feature/precise-model-fallback-feedback` / `git rev-parse main` / `git rev-parse origin/main` / `git status --short` / `ls docs/reports/`.
- Result: Branch `feature/precise-model-fallback-feedback`; HEAD `68f56b2`; origin/feature `68f56b2` (in Sync); main == origin/main `f5f5ee2`; Working Tree nur dauerhaft untracked (`ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`). Feature-Status: MERGE-READY, Preview ACCEPTED, Tests 144/144. Vorhandene Doku: 7 Report-Dateien in `docs/reports/`.
- Evidence: Kommando-Ausgaben.
- Impact: Verifizierte Ausgangslage.
- Next step: Code-Erkundung (SearchForm/Dataset-/Search-/Match-Flow).

## 2. Bestehende Dokumentation

- Action: Vorhandene Reports prüfen (Feature-Report + Execution Log als Leitdokumente).
- Command: Read `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK*.md`.
- Result: Feature-Report enthält MERGE-READY-Status + PLANNED-Scope (Umkreis/Arbeitsmodell/Arbeitszeit); Execution Log Steps 1–6 vollständig.
- Evidence: Dateien.
- Impact: Konsistente Basis für den Abschluss.
- Next step: SearchForm-/Flow-Analyse.

## 3. Aktueller Feature-Stand

- Action: Feature-Verhalten aus dem Merge-Gate bestätigen.
- Command: `git log --oneline main..feature` / Diff-Review (Steps 2–6).
- Result: Precise-Fallback-Feedback + manueller Modell-Retry implementiert und abgenommen; MERGE-READY.
- Evidence: Git-Log/Diff.
- Impact: Abgenommenes Verhalten wird beibehalten (TEIL 1).
- Next step: SearchForm-Stand.

## 4. Aktueller SearchForm-Stand

- Action: `src/components/SearchForm.tsx` lesen.
- Command: Read `src/components/SearchForm.tsx`.
- Result: Felder Skills, Zielrolle, Stadt; Submit-Button kontextabhängig (`onSubmit`), CV-Modus; Busy-Locking; `rematch`-Label vorhanden. KEINE Felder für Umkreis/Arbeitsmodell/Arbeitszeit.
- Evidence: Datei.
- Impact: Erweiterung baut auf bestehender Struktur auf (kein UI-Architektur-Wechsel).
- Next step: Dataset-/Search-/Match-Flow.

## 5. Aktueller Dataset-/Search-/Match-Flow

- Action: `src/App.tsx` + `src/api.ts` + Serverless prüfen.
- Command: Read `src/App.tsx` (runSearch/performMatch/handleProfileChange/handleSubmit), `src/api.ts` (fetchJobs), `api/jobs.mjs` + `api/_lib/` (Filter).
- Result: `profile` = {skills,targetRole,city}; `profilesEqual` invalidiert Dataset; `runSearch` → fetchJobs → Dataset → performMatch; Modellwechsel getrennt (nur /api/match, manueller Start).
- Evidence: Dateien.
- Impact: Die neuen Parameter müssen in `Profile`, `profilesEqual` und SearchForm integriert werden.
- Next step: Implementierung.

## 6. Implementierung Client (Suchparameter)

- Action: `Profile` um `radiusKm`, `workModes`, `employmentTypes` erweitern und durch UI/API durchreichen.
- Command: Edit `src/types.ts` (WorkMode, EmploymentType, RADIUS_KM_OPTIONS [10,25,50,100], WORK_MODES, EMPLOYMENT_TYPES; neue Profilfelder REQUIRED), `src/App.tsx` (initial profile, `arraysEqual`, `profilesEqual` über alle 6 Felder), `src/components/SearchForm.tsx` (Umkreis-Select `#radius`, Arbeitsmodell-/Arbeitszeit-Checkboxen, `toggleIn`/`toggleEmployment` mit „nie leer", `handleSubmit` reicht neue Felder durch, alles `disabled={busy}`), `src/components/CvUpload.tsx` (confirm() baut vollständiges Profile), `src/api.ts` (fetchJobs sendet `radiusKm`/`workMode`/`employmentType`), `src/i18n.tsx` (DE+EN Keys), `src/styles.css` (Select-Optik, Check-Gruppen, `:has(input:checked)`), `src/components/AlertCard.tsx` (subscribeAlert-Profil vervollständigt).
- Result: Typen, UI, API-Passthrough und Styling umgesetzt; `npx tsc -b` grün.
- Evidence: `git diff` (13 geänderte Dateien), TSC ohne Fehler.
- Impact: Neue Parameter sind echte Suchprofil-Parameter; Verhalten ohne Angabe unverändert.
- Next step: Server-Filter.

## 7. Implementierung Server (Best-Effort-Filter)

- Action: Filterlogik additiv in `api/_lib/filter.mjs` ergänzen und durch `/api/jobs` reichen.
- Command: Edit `api/_lib/filter.mjs` (`parseList`, `EMPLOYMENT_ALIASES`, `jobEmploymentTokens`, `employmentMatches`, `workModeMatches`, `applySearchFilters`), `api/_lib/sources/index.mjs` (fetchAllJobs übernimmt neue Parameter, filtert nach dedup, `totalFiltered = filtered.length`), `api/jobs.mjs` (liest Query-Parameter).
- Result: `employmentMatches` schließt Stellen OHNE Beschäftigungs-Info NICHT aus (sonst künstlich leere Standard-Suche „Vollzeit"); Alias-Sets DE/EN; `workModeMatches` filtert nur bei ausschließlich „remote" (per `job.remote`); „hybrid"/„onsite" und `radiusKm` ohne Geocoding nicht ableitbar -> offene Punkte, ehrlich dokumentiert.
- Evidence: `git diff`; `node --check` auf allen geänderten .mjs grün.
- Impact: Standardverhalten ohne Parameter identisch; neue Filter wirken nur wenn angefordert.
- Next step: Tests.

## 8. Tests / Gates (Step 7)

- Action: TEIL-8-Testpunkte umsetzen.
- Command: Edit `src/components/SearchForm.test.tsx` (7 neue UI-Tests: Umkreis-Dropdown 10/25/50/100, Auswahl je Wert, Arbeitsmodell-Checkboxen vorhanden, Mehrfachauswahl über StatefulForm, Vollzeit-Default, Teilzeit auswählbar, Vollzeit+Teilzeit/mind. eine aktiv), `src/App.test.tsx` (8 neue Lifecycle-Tests: Umkreis-/Arbeitsmodell-/Arbeitszeit-Änderung invalidiert Dataset und landet als neue /api/jobs-Suche; Skills-Änderung weiterhin; neue Suche manuell; Modellwechsel invalidiert NICHT + kein /api/jobs (=> kein Apify) + kein Auto-Match; manueller Retry nutzt vorhandenes Dataset; UI-Locking der neuen Felder während Suche).
- Command: `npx tsc -b`, `npm test`, `npm run build`, `git diff --check`, Secret-Audit (`git diff | grep ...`).
- Result: Tests 159/159 (144 + 15 neue) PASS; TSC OK; Build OK; `git diff --check` OK; Secret-Scan ohne Treffer.
- Evidence: Kommando-Ausgaben.
- Impact: Alle abgenommenen Verhaltensweisen (precise fallback, manueller Retry, kein Auto-Match bei Modellwahl, Dataset-Erhalt) bleiben grün (Regression).
- Next step: Commit Step 7, dann TEIL 10 Env-Matrix, TEIL 11 Dev-Deployment.

## 9. Vercel Dev-/Test-Deployment (TEIL 11)

- Action: Sauberer Worktree des exakten Commits `d53c4c9` anlegen und Preview deployen.
- Command: `git worktree add /tmp/opencode/deploy-step7 d53c4c9`; `npm install`; `VERCEL_ORG_ID=… VERCEL_PROJECT_ID=… npx vercel --yes` (workdir Worktree).
- Result: Preview `https://mays-job-matcher-6d8yc2d76-maymilly.vercel.app`, Deployment `dpl_EFyj268VMJbbojtaEY9qPYn3dxNH`, READY.
- Deployment-Identität: Vercel-API zeigt `meta.gitCommitSha = d53c4c92b7d7a451a41c6d8f8a4ee09569cb0ef6` (== HEAD `d53c4c9`). ✓
- Smoke Tests: `/` 200, `/top` 200, `/api/model` 200 (`{"model":null}` → keine AI-Keys), `/api/models` 200, `/api/jobs` 200.
- Neue Suchparameter live geprüft: baseline 40 Jobs (5 remote); `workMode=remote` → genau die 5 Remote-Jobs ✓; `employmentType=full_time` → 22; `employmentType=part_time` → 1; `radiusKm=25` → Passthrough ohne Filter (offener Punkt, dokumentiert). ✓
- Live-UX/AI-Test: NICHT möglich — keine AI-Credentials konfiguriert (`configured:false`). UX-Abnahme erfolgt über die DOM-Tests (159/159). Browser-Flow: „nicht direkt verifiziert" (kein Browser-Tooling).
- Evidence: Deployment-URL, Vercel-API-Ausgabe, curl-Ausgaben.
- Impact: Funktionierende Abnahme-Instanz der Suchparameter; Server-Filter real bestätigt.
- Next step: Merge nach main (TEIL 12) + Production-Deployment.

## 10. Merge nach main + Production-Deployment (TEIL 12)

- Action: FF-Merge prüfen, main auf Stand bringen, Production deployen, Identität + Smoke verifizieren.
- Command: `git merge-base main feature` == `f5f5ee2` == origin/main → FF möglich. `git checkout main && git merge --ff-only feature/precise-model-fallback-feedback` → main == `0305d52`. `git push origin main`. Sauberer Worktree `0305d52` + `npx vercel --prod --yes`.
- Result: Production `https://mays-job-matcher.vercel.app`, Deployment `dpl_DJRUFY1BtYjnY7ZPr81hhwGsswL7`, READY, `target=production`.
- Deployment-Identität: Vercel-API `meta.gitCommitSha = 0305d526b677d28ccb34e97babe873bcdf437112` == main HEAD. ✓
- Smoke Tests (Production): `/` 200, `/top` 200, `/api/model` 200 (`{"model":"dots-studio/dots-3-note-preview:free"}` → AI konfiguriert), `/api/models` 200.
- Suchparameter live (Production): baseline 40 Jobs (5 remote); `workMode=remote` → 5, alle remote ✓; `employmentType=part_time` → 15 ✓; `radiusKm=25` → 40 (Passthrough, offener Punkt) ✓.
- Live-AI-Matching: POST `/api/match` mit React-Frontend-Beispiel → 100/100, plausible Begründung + Vorbereitungsfrage. ✓ (echter Live-Test, da AI in Production konfiguriert)
- Evidence: Deployment-URL, Vercel-API, curl-Ausgaben.
- Impact: Neues Feature in Production aktiv und verifiziert; FF-Merge, main == origin/main.
- Next step: Doku finalisieren (TEIL 13/14) + Abschluss (TEIL 15).

## 11. Doku-Finalisierung (TEIL 13/14)

- Action: Feature-Report (PLANNED → IMPLEMENTED/COMPLETE, Step-Matrix, Testpunkte 1–15 grün), README (Status, Suchparameter inkl. offener Punkte, Current-Status-Tabelle, Testing 159/159, Planned aktualisiert), CHANGELOG (Eintrag 2026-08-20).
- Command: Edit `docs/reports/FEATURE_PRECISE_MODEL_FALLBACK_FEEDBACK.md`, `README.md`, `docs/CHANGELOG.md`.
- Result: Doku konsistent; nichts als implementiert dargestellt, was nicht verifiziert wurde (offene Punkte radiusKm/hybrid/onsite explizit).
- Evidence: Dateien.
- Impact: Projektübersicht + Reports vollständig.
- Next step: Abschluss (TEIL 15).

## 12. Abschluss (TEIL 15)

- Action: Gates final fahren, Git-Integrität prüfen, Feature-Branch erst ganz am Ende löschen.
- Command: `npm test`, `npx tsc -b`, `npm run build`, `git diff --check`, Secret-Audit, `git status`.
- Result: `npm test` 159/159 PASS; `npx tsc -b` PASS; `npm run build` PASS; `git diff --check` PASS; Secret-Audit ohne Treffer. `git status` — Working Tree nur dauerhaft untracked (`ROOT_CAUSE_ASSESSMENT.md`, `tests/screenshotsdev/`). `git log --oneline main..feature` leer → Feature vollständig in main (FF); `main == origin/main` (Commit `12b010b`). Feature-Branch anschließend entfernt (nach Integritätsprüfung).
- Evidence: Kommando-Ausgaben.
- Impact: STATUS = COMPLETE.
