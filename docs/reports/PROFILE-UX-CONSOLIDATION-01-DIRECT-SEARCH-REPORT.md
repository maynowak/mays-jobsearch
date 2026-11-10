# PROFILE-UX-CONSOLIDATION-01 — DIRECT SEARCH FROM SAVED PROFILES

**Status:** `PROFILE-UX-CONSOLIDATION-01 — DIRECT SEARCH + MOBILE UX VERIFIED LOCAL`
**Basis:** `origin/main` `02a5107`
**Branch:** `feature/profile-ux-consolidation-01-direct-search`
**Code-Commit:** `6a1f5c4`
**Kein Push, Merge oder Deployment.**

## 1. Umgesetzt

### CV-Suchprofil → Suche

Jede dauerhafte CV-Suchprofilkarte hat jetzt die sichtbare Hauptaktion
**„🔍 Damit suchen“**. Der Klick:

1. prüft die stabile `searchProfileId` und die Zugehörigkeit zur aktuellen
   RIS-`cvId`,
2. übernimmt die gespeicherte Konfiguration über
   `searchConfigurationToProfile()`,
3. navigiert zur bestehenden Suchmaske `/search`,
4. startet erst dort genau eine Suche über den vorhandenen `handleSubmit`-Pfad.

### ATS-Profil → Suche

Jede ATS-Karte hat dieselbe Hauptaktion. Die Zuordnung erfolgt ausschließlich
über `searchProfileId`, nicht über den Namen. Das ATS-Profil liefert Skills und
Zielrollen; das Elternprofil liefert Ort, Radius, Arbeitsmodelle und
Beschäftigungsarten. Dafür wird die bestehende Funktion
`buildCvSearchProfile()` wiederverwendet.

### Validierung und Sicherheit

Neue pure Helper-Funktion
`src/lib/persistentProfileSearch.ts`:

- `parent.cvId === cvId` — sonst `invalid_cv`
- `ats.searchProfileId === parent.searchProfileId` — sonst `invalid_parent`
- mindestens Skills oder Zielrollen — sonst `missing_criteria`

Die Oberfläche zeigt diese Fehler verständlich an. Der Suchpfad:

- schreibt keine RIS-Daten,
- überträgt kein PDF und keine zusätzlichen CV-Daten,
- startet keine CV-Analyse und kein AI-Matching außerhalb des bestehenden
  Suchablaufs,
- verhindert Mehrfachstarts über einen Pending-Ref und deaktivierte Buttons,
- startet die Suche erst nach dem Wechsel auf `/search` (kein Hintergrundstart
  auf der Profilseite).

### Mobile UX

- „🔍 Damit suchen“ ist die primäre, vollflächige Aktion auf 320–430 px.
- Bearbeiten, Löschen, ATS-Profile und Erstellen bleiben erreichbar.
- Bestehende Accordion-, Skill-Chip- und 44-px-Regeln bleiben erhalten.
- Keine horizontalen Überläufe in den geprüften Breiten.

## 2. Tests

| Prüfung | Ergebnis |
|---|---|
| Fokussierte App-/Profil-/Helper-Tests | **128 PASS** |
| Serielle Gesamtsuite | **1692 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Browser-E2E Direct Search | **PASS** |
| Breiten | 320 / 390 / 430 / 768 / 1440 px |
| Suchen pro Breite | 3 (CV, ATS, zweites gleichnamiges Profil) |
| RIS-Schreiboperationen | **0** |
| Unerwartete CV-/AI-Calls | **0** |
| Suchergebnisse auf `/search` sichtbar | **PASS** |

Der E2E prüft konkret:

- CV-Profil mit `React, TypeScript` und Berlin/25 km
- ATS-Profil mit `React, GraphQL` und `Frontend Engineer`; Elternwerte
  Berlin/25 km, `remote,hybrid`, `full_time` bleiben erhalten
- zwei gleichnamige CV-Profile mit unterschiedlichen IDs und unterschiedlichen
  Skills (`React` vs. `Vue`)
- Reload der Profilseite und erneute direkte Suche
- keine RIS-Schreiboperation, kein `/api/profile`, kein `/api/ats`,
  kein `/api/match`, kein `/api/cover-letter`

## 3. Screenshots

`docs/reports/assets/PROFILE-UX-CONSOLIDATION-01-DIRECT-SEARCH/`

- `profiles-{320,390,430,768,1440}.png` — Hauptaktion in der Profilverwaltung
- `search-cv-{320,390,430,768,1440}.png` — übernommene Suchkriterien auf `/search`

## 4. Commits

- `6a1f5c4` — direkte Suche aus dauerhaften CV-/ATS-Profilen
- Dokumentations-Commit (HEAD) — Bericht und Auditlog

## 5. Verbleibende Einschränkungen

- Kein authentifizierter Live-RIS-E2E mit echten Kontodaten; der Browser-E2E
  nutzt eine synthetische Session und gemockte RIS-/Suchantworten.
- Kein Push, Merge oder Deployment im Rahmen dieses Auftrags.
- Keine Änderung an RIS, AWS, Terraform, Cognito, Consent-Verträgen oder
  produktiven Benutzerdaten.
- Die bestehende Suchmaschine, RIS-Speicherung und Profilverwaltung wurden
  nicht ersetzt.

## 6. Empfehlung

**GO für Review und kontrollierten Merge.**
**NO-GO für Production-Deployment**, bis Merge-/Deployment-Freigabe und ein
Live-Browser-Lauf gegen den deployten Build vorliegen.
