# CV-BUILDER-02F-CORRECTION-01 — REAL PDF IMPORT CORRECTION

**Status:** `CV-BUILDER-02F-CORRECTION — IMPLEMENTED / VERIFIED LOCAL / REAL PDF ACCEPTED`
**Branch:** `feature/cv-builder-02f-correction-01`
**Base:** `main` @ `e894229`
**Feature-HEAD:** `90b1a63` (code), documentation commit follows

## 1. Ausgangsdefekte

Die private 3-seitige Referenz zeigte:

1. Personalangaben vollständig leer.
2. Nur zwei breite Skill-Kandidaten statt Einzeltechnologien.
3. Bachelor und Berufsausbildung in einem Degree-String vermischt.
4. Drei Projekte, aber leere Technologiefelder.

Zusätzlich: ATS-Hinweis konnte im Kurzprofil landen; Review hatte 62 Items.

## 2. Technische Ursachen und Änderungen

- **PDF-Struktur/Personal:** Wiederholte Kopfzeilen mit Seitenzahl wurden als
  Profilüberschrift behandelt; dadurch landeten Kontaktzeilen im Profilbereich.
  Kopfzeilen werden nun auch bei heading-ähnlichem Text als Header erkannt. Der
  Name wird als Fallback aus dem Header übernommen, Dokumentname hat Vorrang.
  Kontaktzeilen werden nicht mehr in den Namen gemerged; Standort/Telefon
  werden aus kombinierten Kontaktzeilen getrennt.
- **Skills:** Skill-Werte wie `Software Architecture`, `Solution Architecture`,
  `Enterprise Integration`, `Distributed Systems` werden innerhalb eines
  Skills-Abschnitts als Inhalte, nicht als neue Überschriften behandelt.
  Aufzählungen mit `,`, `;`, `·` und ` / ` werden getrennt; Gruppenlabels und
  Trainings-/Kursnamen werden gefiltert. Keine Projektbeschreibungen als Skills.
- **Ausbildung:** Mehrere Degree-/Qualifikationszeilen in einem Block werden
  in separate Education-Einträge aufgeteilt. Hochschule, Fachrichtung,
  Abschluss und Beschreibung bleiben getrennt; Weiterbildung wird separat
  geführt.
- **Projekttechnologien:** Nur belegte Technologien aus expliziten Tech-Zeilen
  oder klaren Technologie-Aufzählungen werden übernommen; Projektzuordnung
  bleibt blocklokal, Duplikate werden entfernt.
- **Profilhinweise:** `PROFILE NOTE`/Publikationshinweise werden als
  Dokumenthinweise behandelt und nicht in die professionelle Summary
  übernommen.
- **Keine Architektur-/Persistenz-/API-Änderung.**

## 3. Vorher-/Nachher-Matrix (private Referenz)

| Bereich | Vorher | Nachher |
|---|---|---|
| Persönliche Angaben | 0/4 | **4/4** (Name, E-Mail, Telefon, Standort) |
| Berufserfahrung | 5, Feldvertauschungen | **5 korrekt**; z. B. DevOps/1und1, Web Services/BaFin, E-Commerce/Contenido |
| Ausbildung | 1 vermischter Degree | **3 getrennte Einträge**: Bachelor, Berufsausbildung, Additional AWS Training |
| Skills | 2 breite Kandidaten | **71 Einzelkandidaten**, 0 vorausgewählt |
| Projekttechnologien | 0, 0, 0 | **7, 4, 5** belegte Technologien |
| Zertifikatsziele | 3 als Zertifikat | **3 im Review, 0 erworbene Zertifikate** |
| Review | 62 | **34** (8 Training, 14 unvollständige Erfahrung, 5 Projektverweis, 2 Dokumenthinweis, 2 unklar, 3 Zertifikatsziel) |
| Profil | Kontakt/ATS vermischt | Kontakt getrennt; ATS-Hinweis nicht in Summary |
| Desktop-Scroll | gekoppelt | **unabhängig**; Modal/Window 0 |
| PDF-Export | 2 Seiten | **3 Seiten**, echter Download, Berufserfahrung/Ausbildung/Projekte enthalten |

Die Reduktion von 62 auf 34 erfolgte durch nachvollziehbare Abschnitts-,
Skill-, Timeline- und Dokumenthinweis-Zuordnung; keine stillen Löschungen.

## 4. Verifikation

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Parser-/Struktur-/Editor-Tests | **66 PASS** |
| Serielle Gesamtsuite | **1772 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Import-01A / Parser-02B / Mapping-02C / Workflow-02A | **PASS** |
| Import-UX-02D / PDF / PDF-Fix-01 | **PASS** |
| 02E-E2E 320–1440 | **PASS** |
| Private Referenzimport (lokal, privates PDF) | **PASS** |
| Privater PDF-Export (nur `/tmp`) | **PASS**, 3 Seiten |
| `git diff --check` / Secret-/Privacy-Scan | **PASS** |
| API-/RIS-Writes | nur `GET /api/models`, keine Writes |

Datenschutz: Das private PDF wurde ausschließlich lokal verarbeitet; keine
Rohtexte, Kontaktdaten, Screenshots oder private PDFs im Repository. Der
PDF-Export wurde nur unter `/tmp` abgelegt. Keine RIS-/AWS-/Cognito-/Terraform-
oder Consent-Änderung.

## 5. Commits

- `b928ac4` — PDF-Struktur, Personal, Skills, Ausbildung, Projekttechnologien,
  Profilhinweise und Tests
- `90b1a63` — Dokumentname hat Vorrang vor Header-Fallback
- Abschluss-Dokumentations-Commit (HEAD)

**Gepusht:** `origin/feature/cv-builder-02f-correction-01`

## 6. Verbleibende Grenzen

- 71 Skill-Kandidaten sind bewusst nicht vorausgewählt; der Benutzer entscheidet.
- 34 Review-Items bleiben wegen unvollständiger Erfahrungs-/Projektangaben und
  Trainings prüfbar.
- Zwei-Spalten-Layouts bleiben durch PDF.js-Lesereihenfolge begrenzt.
- Kein Merge, kein Production-Deployment; Feature-Branch-Preview bleibt aktiv.

**GO für Review der Korrektur und eine erneute kontrollierte Main-Freigabe.**
