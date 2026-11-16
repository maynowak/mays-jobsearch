# JM-CV-UX-03 — CV-Editor UX Consolidation

**Status:** `COMPLETE — LOCAL/UNIT VERIFIED — LIVE RIS E2E NOT EXECUTED`
**Datum:** 2026-11-16
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-ux-03-editor-consolidation`
**Basis:** `feature/jm-cv-ux-02-save-actions` @ `7f78161`
**Implementierungs-Commit:** `48f5450`

Kein Main-Merge, kein Production-Deployment, keine RIS-/AWS-/Terraform-/Cognito-
Änderung, keine Consent-/ATS-/Speicher-API-Änderung, keine neue Komponenten-
architektur.

---

## 1. Ausgangslage

`JM-CV-UX-02` war zum Start **nicht** in `origin/main` (`464783b`) enthalten.
Der Branch wurde daher auf UX-02 (`7f78161`) aufgebaut; UX-01-/UX-02-Verhalten
bleibt vollständig erhalten.

---

## 2. Editor-Layout

- Abschnitte bleiben einzeln auf-/zuklappbar (`<details>`).
- Abschnittsnavigation bleibt erhalten und öffnet den Zielabschnitt.
- **Neu:** Jeder Abschnitt zeigt bei Validierungsfehlern einen sichtbaren
  Badge („1 Fehler“ / „N Fehler“) und eine rote Rahmenmarkierung.
- **Neu:** Fehlerhafte Abschnitte werden beim Navigieren nicht automatisch
  geschlossen.
- „Zum ersten Fehler“ aus UX-01 öffnet weiterhin den richtigen Abschnitt,
  scrollt und fokussiert das Feld.
- Bestehende Einträge und Reihenfolge bleiben unverändert.
- Keine automatische Datenänderung, keine neue Komponentenarchitektur.

### Desktop-Vorschau

- Modal: bestehende unabhängige Scrollbereiche für Editor und Vorschau bleiben.
- Vollansicht: Vorschau bleibt auf Desktop sichtbar (`position: sticky`) und
  scrollt bei langen Lebensläufen unabhängig (`max-height: calc(100vh - 32px)`).
- Formularbereich behält ausreichend Breite.

### Mobile

- Umschaltung „Bearbeiten“/„Vorschau“ bleibt erhalten.
- Kein horizontaler Overflow.
- Footer mit Speicheraktionen ist in der Vollansicht mobil sticky am unteren
  Rand, damit er beim Scrollen langer Inhalte erreichbar bleibt.
- Primäre Aktion „PDF dauerhaft speichern“ bleibt mobil volle Breite.

Die PDF-Ausgabe wurde nicht verändert.

---

## 3. Fähigkeiten

- Alle vorhandenen Fähigkeiten bleiben vollständig erhalten.
- **Suche/Filter:** „Fähigkeit suchen …“ filtert nur die Anzeige, nicht die
  Daten.
- **Visuelle Reduktion:** standardmäßig maximal 12 Fähigkeiten; „Alle N
  anzeigen“ / „Weniger anzeigen“.
- **Entfernen:** jede sichtbare Fähigkeit hat einen eigenen Entfernen-Button;
  die Textarea wird synchron aktualisiert.
- **Zähler:** „N Fähigkeiten“.
- Keine automatische Gruppierung oder KI-Neuinterpretation, da das Datenmodell
  keine sicheren Skill-Kategorien enthält.
- Die Live-Vorschau zeigt weiterhin alle tatsächlichen Fähigkeiten.

---

## 4. Importprüfung

- Importangaben bleiben nach CV-Abschnitten gruppiert.
- Die manuelle Prüfliste wird zusätzlich nach Zielabschnitt gruppiert
  (Profil, Berufserfahrung, Ausbildung, Fähigkeiten, Projekte, Zertifikate,
  Links, Nicht übernehmen).
- **Filter:** Alle / Ungeprüft / Übernehmen / Nicht übernehmen bleiben.
- **Fortschritt:** Fortschrittsbalken + „X von Y geprüft“.
- **Unsichere Angaben:** zusätzlicher Badge „Prüfen“ bei mehrdeutigen oder
  unvollständigen Angaben.
- Einzelaktionen (Zuordnen, Übernehmen, Bearbeiten, Ignorieren, Rückgängig)
  bleiben erhalten.
- Beim Filter-/Gruppenwechsel bleiben Entscheidungen indexbasiert erhalten.
- Keine ungeprüften Inhalte werden stillschweigend übernommen; die bestehende
  explizite Bestätigung im Summary bleibt.
- Keine Gruppenaktion ergänzt, um versehentliche Massenübernahme zu vermeiden.
- Keine KI-gestützte Neuinterpretation und keine Änderung der
  Import-/Provenienzregeln.

---

## 5. Konsistenz

- Modal und Vollansicht nutzen dieselbe Editor-Komponente.
- DE/EN-Texte für neue Badges, Fortschritt und Skills ergänzt.
- Tastatur/Screenreader: native `<details>/<summary>`, Buttons mit
  `aria-label`, Fortschrittsbalken mit `role="progressbar"`, Live-Zähler.
- UX-01-Fehlernavigation und UX-02-Speicheraktionen bleiben funktionsfähig.
- Keine Änderung an Importdaten, PDF-Erzeugung oder RIS-Speicherung.

---

## 6. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/CvBuilderEditor.tsx` | Abschnittsfehler-Badges, Skill-Suche/-Collapse/-Entfernen, scrollIntoView-Guard, sticky Footer-Hinweis |
| `src/components/CvBuilderImportReview.tsx` | Gruppen nach Zielabschnitt, Fortschritt, Unsicher-Badge |
| `src/styles.css` | Abschnittsfehler, Skill-Liste, Fortschritt, Sticky-Preview/Footer |
| `src/i18n.tsx` | DE/EN-Texte |
| `src/components/CvBuilderEditor.test.tsx` | Abschnittsfehler, kein Auto-Schließen, Skills |
| `src/components/CvBuilderImportDialog.test.tsx` | Fortschritt/Gruppierung |
| `docs/reports/assets/JM-CV-UX-03/` | Desktop-/Mobile-Screenshots |
| `docs/reports/JM-CV-UX-03-REPORT.md` | Dieser Bericht |
| `docs/AI_AUDITLOG.md` | Audit-Eintrag |

Keine Änderung an `api/**`, RIS, AWS, Terraform, Cognito, Auth, Consent,
ATS-Matching oder Speicher-APIs.

---

## 7. Tests

### Fokussiert (final)

```text
npx vitest run --maxWorkers=2 \
  src/components/CvBuilderEditor.test.tsx \
  src/components/CvBuilderEditorRisStorage.test.tsx \
  src/components/CvBuilderEditorPdf.test.tsx \
  src/components/CvBuilderImportDialog.test.tsx \
  src/components/CvBuilderWorkspacePage.test.tsx \
  src/App.test.tsx
```

Finaler Lauf: **4 Dateien / 61 PASS** für die zuletzt geänderten
Editor-/Import-Dateien; der breitere UX-02-/UX-03-Lauf davor: **7 Dateien /
166 PASS**. Abgedeckt:

- Öffnen/Schließen von Abschnitten,
- Fehlerbadge und kein Auto-Schließen,
- „Zum ersten Fehler“/Fokus,
- 71 Fähigkeiten: Collapse, Suche, Entfernen,
- Importfilter, Gruppierung, Fortschritt,
- keine verlorenen Entscheidungen,
- keine unbeabsichtigte Übernahme,
- UX-02-Speicherungen und PDF-Download.

### Vollsuite

```text
npx vitest run --maxWorkers=2
Test Files  179 passed | 4 skipped (183)
     Tests  1902 passed | 11 skipped (1913)
```

### Build / Diff

```text
npm run build
✓ built in 1.08s

git diff --check
# Exit 0, keine Fehler
```

### Browser-Screenshots

Erstellt mit lokalem Vite-Dev-Server, synthetischem leeren CV und 20
Fähigkeiten:

- `docs/reports/assets/JM-CV-UX-03/desktop-1440.png`
- `docs/reports/assets/JM-CV-UX-03/mobile-390.png`

Ergebnis: kein horizontaler Overflow, 12 sichtbare Fähigkeiten, „Alle 20
anzeigen“, Speicherbutton vorhanden, 0 Console-/Page-Errors. Mobile Screenshot
zeigt die Vorschau-Umschaltung.

### Live-RIS

**Nicht ausgeführt.** Keine Live-Test-Freigabe mit synthetischen Daten und
genehmigter RIS-/Preview-Umgebung. Die Screenshots sind lokale UI-Evidence,
kein RIS-Live-E2E.

---

## 8. Verbleibende Einschränkungen

1. **Live-RIS-/S3-E2E nicht verifiziert.**
2. **Importprüfung** wurde per Komponenten-Tests, nicht per Screenshot
   visuell abgenommen.
3. **Skill-Gruppierung** ist bewusst nur Suche/Collapse, da keine sicheren
   semantischen Kategorien im Datenmodell existieren.
4. **Kein Production-Deployment.**
5. Sticky Preview/Footer ist CSS-basiert und wurde nicht in jedem Browser
   separat geprüft.

---

## 9. Git

| Feld | Wert |
|---|---|
| Branch | `feature/jm-cv-ux-03-editor-consolidation` |
| Basis | `7f78161` (UX-02, nicht in main) |
| Implementierungs-Commit | `48f5450` |
| Remote-Branch | `origin/feature/jm-cv-ux-03-editor-consolidation` |
| Push | bestätigt |
| Main-Merge | nein |
| Production-Deployment | nein |

Der Report-/Audit-Commit folgt auf demselben Branch.

---

## 10. Ergebnis

**COMPLETE — im autorisierten lokalen Testumfang.**

Der Editor ist übersichtlicher, fehlerhafte Abschnitte sind sichtbar, lange
Fähigkeitslisten sind reduziert und durchsuchbar, und die Importprüfung zeigt
Gruppen/Fortschritt ohne Daten- oder Entscheidungsverlust. UX-01-/UX-02-
Funktionen bleiben erhalten.
