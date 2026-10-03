# PROFILE-TAB-STATE-01

## Status
GREEN

## Scope
Fix des Load/Remove-State-Sync-Fehlers zwischen Manual Tab und CV Tab — minimal, keine Architekturänderung

- Audit-/Fix-Datum: 2026-10-03
- Branch: main, HEAD vor Fix: d6e8fc6
- Keine RIS-Anbindung, keine State-Konsolidierung, keine API-/Persistenz-/Flow-Änderung, keine Umbenennung, kein ProfileStore
- AI-Datenfluss unverändert (keine Änderung an Prompt/Modell/Anonymisierung/Consent) → `docs/AI_AUDITLOG.md` nicht geändert

## Bug

Gespeichertes Suchprofil in die Manual-Maske laden ("Jobs Finden" aus der Profil-Box), danach "CV-Daten entfernen": Die Manual-Maske zeigte weiterhin Skills, Zielrolle und Stadt des gelöschten Profils, obwohl der Profil-State (Store-Einträge + CV-Workflow) gelöscht war. Empirisch bestätigt (jsdom-Repro + echter Chromium): Nach Remove `skills="React"`, `role="Frontend"`, `city="Berlin"` statt leer.

## Root Cause

- Load-Pfad (bestehender, dokumentierter Produktfluss): `startSearchWithSavedProfile` (`src/App.tsx`) → `handleProfileChange(entry.profile)` setzt App-Level `profile` (Manual Tab). Die Maske zeigt die Werte (Textfelder via Sync-Blöcke `src/components/SearchForm.tsx:93-106`, Rest direkt controlled).
- Remove-Pfad: `handleCvRemoveData` löschte Store (`resetCvProfileLists`), Legacy-Keys, Auswahl-IDs und `cvState` — aber NIE App-Level `profile`. Die Sync-Blöcke der SearchForm reagieren nur auf *Änderungen* von `value.skills`/`value.targetRoles`; ohne Änderung kein Sync → Form-State stale.
- Kein `defaultValue`-Fehler, kein fehlendes Remount, kein separater Form-Store: Felder sind controlled bzw. synchronisiert — es fehlte ausschließlich das Zurücksetzen der Quelle (`App.profile`) beim Entfernen, plus Herkunftsunterscheidung (geladen vs. unabhängig getippt).
- CV-Tab-Seite: `CvDocumentList` (mit "CV-Daten entfernen") rendert nur in `document-selected`/`consent-required` (`App.tsx:1456`); Remove setzt `step: "idle"` → Workflow-Formulare demontieren → keine stale CV-Maske. Zusätzlich wurde `editingSearchName` beim Remove nie zurückgesetzt (Hygiene).

## Manual Tab Verhalten

- `SearchForm` Manual-Panel: Skills-/Rollen-Textfelder = lokaler Text-State mit Parent-Sync; City = controlled via `useCityAutocomplete` (gibt `value` direkt zurück); Radius/WorkModes/EmploymentTypes = direkt `value.*`. Nach Fix leert ein `setProfile(INITIAL)` alle sichtbaren Felder korrekt (durch Sync-Blöcke + controlled Bindings verifiziert).
- Load (`startSearchWithSavedProfile`): `handleProfileChange` + `handleSubmit` — unverändert (bewusster Tab-übergreifender Transfer, dokumentiert, nicht entfernt).

## CV Tab Verhalten

- Load (Edit): `editSavedSearchProfile` → `profile-ready` (`CvProfileResult`, frisch gemountet, Initial aus `suggested`) — zeigt Eintragswerte korrekt; Manual-Tab unberührt (kein `setProfile`-Aufruf im Pfad).
- Remove: `handleCvRemoveData` → `step: "idle"` → alle CV-Formulare demontiert; Store + Legacy-Keys + Auswahl-IDs + `editingSearchName` zurückgesetzt.

## Tab Isolation

- Manual-Load berührt CV-State nicht (nur `App.profile` + Suche); verifiziert per Test (Dokument + Eintrag bleiben).
- Manuelles Leeren (Feld-X/`onChange`) berührt gespeicherte CV-Einträge nicht; verifiziert per Test.
- CV-Edit berührt `App.profile` nicht; verifiziert per Test.
- CV-Remove leert die Manual-Maske NUR, wenn sie exakt ein entferntes gespeichertes Suchprofil zeigt (`profilesEqual`-Herkunftsprüfung vor dem Leeren); unabhängige Eingaben bleiben erhalten; verifiziert per Tests.

## Fix

`src/App.tsx` (einzige Produktdatei-Änderung, +35/-8 mit Kontext):

1. `INITIAL_MANUAL_PROFILE`-Konstante (Modul-Scope) als Single Source für Initial + Reset; `useState` nutzt sie.
2. `handleCvRemoveData`: Herkunftsprüfung VOR dem Leeren — zeigt `App.profile` exakt einen gespeicherten Suchprofil-Eintrag eines aktuellen Dokuments (`readCvProfileLists` + bestehendes `profilesEqual`), wird `App.profile` auf Initial zurückgesetzt; sonst bleibt es (unabhängige Eingabe). Zusätzlich `setEditingSearchName(null)` (bisher nie zurückgesetzt).

Kein globaler Reset, keine neue Komponente, kein neuer Store, keine API-Änderung.

## Regression Tests

Neu in `src/App.test.tsx` (Describe `PROFILE-TAB-STATE-01`, 6 Tests, alle grün):

1. Manual-Profil laden → Felder korrekt (Skills/Rolle/Stadt/Radius/Modes) + CV-Tab unverändert (Test 1+7)
2. Manual-Profil entfernen → Maske leer/reset + Re-render (Tab-Wechsel) bringt nichts zurück (Test 2+9)
3. Manuelles Leeren berührt CV-Eintrag nicht (Test 3)
4. CV-Profil laden (Edit) → Eintragswerte korrekt + Manual unverändert (Test 4+8)
5. CV-Profil entfernen → kein CV-Workflow-UI, Dropzone als Einstieg (Test 5)
6. Unabhängige manuelle Eingabe überlebt CV-Remove (Test 6)

## Browser Verification

Echter Chromium (Playwright, Dev-Server `:5174`, `/api/models` + `/api/profile` + `/api/jobs` per Route stubbed, PDF-Text-Extraktion real im Browser aus minimalem PDF):

- CV-Confirm Default-Name: `Frontend - Profil1` ✓
- Manual nach Load: `React` / `Frontend` / `Berlin`, Dokument vorhanden ✓
- Manual nach Remove: `""` / `""` / `""`, Radius `""` ✓
- CV-UI nach Remove weg ✓; nach Tab-Wechsel weiterhin leer ✓
- Keine Console Errors, kein React #321 ✓

## Testanzahl

- Vollsuite: 55 Files passed, 3 skipped; 695 Tests passed, 5 skipped (inkl. 6 neuer Tests)
- `tsc --noEmit -p tsconfig.app.json`: 0 Fehler
- `npm run build`: erfolgreich (nur bestehende Chunk-Size-Warnung)
- `git diff --check`: sauber

## Build
Erfolgreich (`vite build`, 540ms). Keine neuen Dependencies.

## Diff Check
`git diff --check`: keine Whitespace-Fehler. Diff-Umfang: `src/App.tsx` (+35/-8 inkl. Kontext), `src/App.test.tsx` (+175).

## Commit
Noch ausstehend beim Schreiben dieses Reports (folgt direkt; nur `src/App.tsx`, `src/App.test.tsx`, dieser Report).

## Conclusion

- Root Cause gefunden und minimal behoben (Herkunfts-bewusster Reset statt Global-Reset; Tab-Grenze gewahrt).
- Alle 9 geforderten Regressionspunkte durch 6 Tests + Browser-Verifikation abgedeckt.
- AI-Datenfluss unverändert → kein AI_AUDITLOG-Eintrag nötig.

---

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: GREEN (Fix verifiziert: Unit + Suite + tsc + Build + Diff-Check + Echt-Browser)
- Audit-Zeitpunkt: 2026-10-03; Branch: main; HEAD vor Fix: d6e8fc6
- Terraform-Checks: nicht anwendbar (Frontend-Fix, keine Infra; keine Checks ausgeführt)
- Geänderte Dateien: `src/App.tsx` (Fix), `src/App.test.tsx` (6 Regressionstests), `docs/reports/PROFILE-TAB-STATE-01-EXECUTION_LOG.md` (neu)
- `docs/screenshotsfordev/`-Änderungen (vorbestehend: 2 deleted, 2 untracked): NICHT angefasst, NICHT gestagt
- Risiken: minimal — Fix berührt nur `handleCvRemoveData` + Initial-Konstante; Verhalten bei unabhängiger Eingabe per Test abgesichert
- Nächste Schritte: keine offen (Report committen)
- Resume-Punkt: abgeschlossen, bereit zum Commit
