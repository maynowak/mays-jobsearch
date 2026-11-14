# Claims & Compliance Matrix

**Status:** DRAFT — basis for JM-MARKETING-03B review
**Stand:** 2026-11-14

Diese Matrix prüft Marketingaussagen gegen den tatsächlichen Produktstand.
Sie ist keine Rechtsberatung. Bei rechtlichen Fragen ist eine separate Prüfung
erforderlich.

---

## 1. Erlaubte Kernaussagen

| Aussage | Bedingung / Einschränkung | Evidence |
|---|---|---|
| „Individuelle Jobsuche mit KI-Unterstützung“ | KI ist optional und unterstützend, keine Garantie | `LandingPage2.tsx`, `api/match.mjs` |
| „Finde Jobs, die wirklich zu dir passen.“ | Marketing-Positionierung, keine Erfolgsgarantie | freigegebene Landingpage |
| „Stellen aus mehreren verfügbaren Quellen“ | Quellen hängen von Konfiguration/Verfügbarkeit ab | `api/_lib/sources/index.mjs`, `sourcePolicy.mjs` |
| „Eigene Suchprofile festlegen“ | manuell oder per CV; sitzungsbasiert oder dauerhaft mit Konto/Consent | `src/i18n.tsx` (`manualProfiles.*`, `profileStorage.*`) |
| „KI-Bewertung auf Wunsch mit Score und Begründung“ | explizite Aktion; Ausgaben können fehlerhaft sein | `api/match.mjs`, `Results.tsx` |
| „Bewerbungen in der aktuellen Sitzung organisieren“ | Standard ist sitzungsbasiert; dauerhaft nur mit Freigabe | `ApplicationsSection.tsx` (`applications.sessionOnly`) |
| „PDF wird lokal im Browser gelesen“ | für die CV-Funktion; extrahierter Text kann an KI-Dienste gehen | `public/legal/datenschutz.md`, `CvUpload.tsx` |
| „Ohne Anmeldung starten“ | Suche/KI-Bewertung ohne Konto; dauerhafte Profile benötigen Konto/Consent | Landingpage, Auth-Flow |
| „Dauerhafte Speicherung nur mit Einwilligung“ | zweckgebunden, versioniert, widerrufbar | `public/legal/datenschutz.md` |

---

## 2. Nicht erlaubte Aussagen

| Aussage | Warum nicht | Stattdessen |
|---|---|---|
| „Garantiert passende Jobs“ | keine Garantie, KI kann irren | „Unterstützung bei der Passungsprüfung“ |
| „Garantierte Einstellung/Einladung“ | Produkt ist kein Recruiter | „Bessere Vorbereitung, keine Garantie“ |
| „Alle Jobbörsen angebunden“ | nur verfügbare/konfigurierte Quellen | „Mehrere verfügbare Quellen“ |
| „Unbegrenzte kostenlose KI-Nutzung“ | freie Modelle/Quoten können sich ändern | „KI-Bewertung auf Wunsch, abhängig von verfügbaren Modellen“ |
| „Vollständig anonym“ | CV-Text kann an KI-Dienste gehen | „PDF lokal gelesen; Text kann für KI-Funktionen übermittelt werden“ |
| „Lebensläufe dauerhaft gespeichert“ | nur mit Konto/Consent und Freigabe | „Sitzungsbasiert; dauerhaft nur mit Einwilligung“ |
| „Bewerbungen werden automatisch gespeichert“ | Standard ist Sitzung | „Standardmäßig in der aktuellen Sitzung“ |
| „Wir tracken dich nicht“ (pauschal) | Hosting/Plattformen können technische Daten verarbeiten | konkrete, dokumentierte Aussage über eingesetzte Mittel |

---

## 3. Funktionsverfügbarkeit

| Funktion | Ohne Konto | Mit Konto | Zusätzliche Voraussetzung | Marketing-Formulierung |
|---|---|---|---|---|
| Stellensuche | ja (freie Quellen) | ja | Quellen/Quoten je Konfiguration | „Suche starten“ |
| Filter (Ort, Umkreis, Arbeitsmodell, Arbeitszeit) | ja | ja | – | „Suchkriterien festlegen“ |
| KI-Bewertung | ja, auf Wunsch | ja | verfügbare Modelle/Quoten | „auf Wunsch bewerten lassen“ |
| CV-Upload/Profil | ja, sitzungsbasiert | ja | PDF, ggf. KI-Dienst | „PDF lokal lesen, Profil prüfen“ |
| Suchprofil dauerhaft | nein | ja | separate Einwilligung | „mit Konto und Einwilligung dauerhaft“ |
| Bewerbungen | ja, Sitzung | ja | dauerhaft nur mit Freigabe/Consent | „in der aktuellen Sitzung organisieren“ |
| Bewerbungsdokumente dauerhaft | nein | nur mit Freigabe/Consent | RIS-Freigabe | nicht als Standard bewerben |

Quellen: `src/i18n.tsx`, `src/App.tsx`, `src/components/ApplicationsSection.tsx`,
`public/legal/datenschutz.md`, `api/_lib/sourcePolicy.mjs`.

---

## 4. Quellenkommunikation

- Sicher nennbar: „mehrere verfügbare Quellen“.
- Beispiele nur, wenn sie in der aktiven Konfiguration verfügbar sind:
  Arbeitnow, Arbeitsagentur (Apify), Adzuna, öffentliche ATS-Quellen.
- **Nicht** als allgemein verfügbar bewerben: JobsPipe, Theirstack (für Gäste
  gesperrt; abhängig von Konfiguration).
- Keine Aussage „alle Jobbörsen“ oder „vollständige Marktabdeckung“.

---

## 5. Datenschutz-/Consent-Aussagen

- Einwilligungen sind zweckgetrennt und versioniert.
- Eine Speicher-Einwilligung ist keine KI-Einwilligung.
- Widerruf verhindert neue abhängige Schreibzugriffe; physische Löschung ist
  nicht sofort garantiert.
- Keine vollständige Anonymität bei externen KI-Diensten.
- Keine Aussage, dass alle CV-Inhalte ausschließlich lokal bleiben.

Evidence: `public/legal/datenschutz.md`, `public/legal/prinzipien.md`,
`docs/reports/JM-RIS-CV-STORAGE-INTEGRATION-01-REPORT.md` (soweit vorhanden).

---

## 6. Review-Regel

Jede neue Marketingaussage wird vor Veröffentlichung in diese Matrix
aufgenommen. Wenn keine Evidence-Zeile existiert, wird die Aussage nicht
veröffentlicht.
