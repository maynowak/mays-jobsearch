# JOBMATCHER-ATS-PROFILE-INTEGRITY-01 — INTEGRITY REPORT

Status: COMPLETED
Datum: 2026-10-14
Branch: main
Git-Commit: c012507 (Baseline) -> CURRENT

## 1. Ausgangszustand
Nach dem Gate `JOBMATCHER-SEARCH-ATS-PROFILE-HIERARCHY-01` war die grundlegende Beziehung zwischen Suchprofilen und ATS-Profilen implementiert. Die Filterung im UI und die grundlegende Speicherung waren vorhanden, jedoch fehlten tiefergehende Validierungen im Store-Layer (z.B. Kontext-Prüfungen, strikte Cap-Einhaltung bei Legacy-Zuordnung und Schutz vor versehentlicher Umzuordnung).

## 2. Implementierte Änderungen (Store-Level)

Alle Änderungen wurden in `src/lib/cvProfileStore.ts` vorgenommen, um die Geschäftslogik zentral und unabhängig vom UI-State zu sichern.

### saveCvAtsProfile (Validierung)
- **Kontext-Check:** Es wird nun geprüft, ob die übergebene `searchProfileId` tatsächlich im aktuellen CV-Bucket existiert. Ungültige IDs führen zum Abbruch (`return null`).
- **Cap-Enforcement (1..5):** Die Grenze von maximal 5 ATS-Profilen pro Suchprofil wird nun strikt im Store geprüft.
    - Bei Neuanlage eines Profils: Cap-Prüfung.
    - Bei Namens-Überschreibung eines bestehenden Profils: Cap-Prüfung nur, wenn die Zuordnung zu einem *anderen* Suchprofil geändert wird.
- **Schutz vor Umzuordnung:** Wenn ein Profil bereits einem Suchprofil zugeordnet ist, wird ein versehentlicher Wechsel des Eltern-Profils via Namens-Überschreibung verhindert.

### assignCvAtsProfileToSearchProfile (Integrität)
- **Idempotenz:** Wiederholte Zuordnung zum selben Profil bewirkt keine Änderung und gibt `true` zurück.
- **Kontext-Check:** Prüfung, ob das Ziel-Suchprofil im selben CV-Kontext existiert.
- **Cap-Enforcement:** Auch die nachträgliche Zuordnung von Legacy-Profilen unterliegt der 5-Profil-Grenze.

### Umgekehrte Auflösung (Vorbereitung)
- **Neu implementiert:** `resolveSearchProfileFromAtsProfile(hash, atsProfileId)`.
- Ermöglicht die Kette: `ATS-Profil ID` $\rightarrow$ `searchProfileId` $\rightarrow$ `CvSearchProfileEntry`.
- Diese Funktion bildet die technische Grundlage für die zukünftige ATS-Tag-Suche.

## 3. Validierungsregeln

| Regel | Implementierung | Ort |
|---|---|---|
| Jedes neue ATS-Profil $\rightarrow$ 1 Suchprofil | Pflichtparameter in `saveCvAtsProfile` (über `App.tsx` erzwungen) | `src/App.tsx` / `src/lib/cvProfileStore.ts` |
| Max 5 ATS-Profile pro Suchprofil | Zählung im Store-Bucket vor jedem Save/Assign | `src/lib/cvProfileStore.ts` |
| Kontext-Validierung | `bucket.searchProfiles.some(...)` | `src/lib/cvProfileStore.ts` |
| Legacy-Erhalt | Keine automatische Löschung/Zuordnung ohne User-Interaktion | `src/App.tsx` |
| Idempotente Zuordnung | Check `entry.searchProfileId === searchProfileId` | `src/lib/cvProfileStore.ts` |

## 4. Legacy-Verhalten
- Bestehende Profile ohne `searchProfileId` bleiben erhalten.
- Sie werden im UI als „nicht zugeordnet“ gekennzeichnet.
- Die Zuordnung erfolgt durch Auswahl im Dropdown $\rightarrow$ Aufruf von `assignCvAtsProfileToSearchProfile`.
- Die Kapazitätsgrenze (5) wird auch hier angewandt; ist das Suchprofil voll, schlägt die Zuordnung fehl (UI-Feedback erfolgt über den Store-Rückgabewert).

## 5. Testnachweise & Verifikation

- **Statische Analyse:** Code-Review der Store-Funktionen bestätigt die Umsetzung aller fachlichen Regeln.
- **Typ-Sicherheit:** `npm run build` (TSC) erfolgreich.
- **Funktionale Tests:** `npm test` erfolgreich bestanden.
- **UI-Check:** 
    - Suchprofil-Wechsel $\rightarrow$ ATS-Auswahl wird validiert/zurückgesetzt.
    - ATS-Jobvergleich $\rightarrow$ nutzt nur das aktuell validierte Profil.

## 6. Bekannte Einschränkungen
- Da die Daten im Arbeitsspeicher liegen, werden alle Zuordnungen bei einem Seiten-Reload gelöscht (entspricht dem aktuellen Privacy-Konzept der Session-Buckets).

## 7. Git-Historie
- Baseline: `c012507`
- Current: [Latest Commit]
