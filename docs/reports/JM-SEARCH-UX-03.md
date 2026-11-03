# JM-SEARCH-UX-03

**Art:** Suchmaske / Skills-Hervorhebung / Suchort / Standardumkreis
**Status:** ABGESCHLOSSEN UND LOKAL VERIFIZIERT — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-search-ux-03`
**Baseline:** lokaler `main` `7e4858c`; `origin/main` `4364eab`

## 1. Ziel

Die manuelle Suchmaske wurde im Bereich Skills und Suchort klarer geführt. Zusätzlich
wurde **5 km** als zulässiger Radius ergänzt und als einmaliger Standard bei der
ersten Eingabe eines Suchorts eingeführt.

Die bestehende Parser-, Profil-, API- und Adapter-Semantik bleibt erhalten.

## 2. Skills-Eingabe

Das bestehende Feld `#skills` wurde visuell und sprachlich aufgewertet:

- sichtbare Überschrift „Welche Fähigkeiten bringst du mit?“
- türkisfarbene linke Akzentlinie, dezenter Farbverlauf und Fokusring
- Hilfetext „Gib deine Kenntnisse ein, z. B. Java, Python, AWS oder SQL.“
- Beispiel-Chips `Java`, `Python`, `AWS`, `SQL`
- Eingabefeld und Löschbutton mindestens 44 px hoch
- `aria-describedby` auf Hilfetext und Beispiele
- verstecktes, zugängliches Label `Skills` für bestehende Test-/A11y-Semantik

Der Parser wurde nicht verändert:

- Komma, Semikolon und Zeilenumbruch bleiben Trennzeichen,
- mehrteilige Skills wie `Spring Boot` bleiben beim Tippen erhalten,
- beim Absenden bleibt die bestehende Normalisierung (`Spring, Boot`) erhalten,
- vorhandene Skills werden nicht automatisch verändert.

## 3. Suchort und Hinweis

Die Bezeichnung lautet jetzt:

**„Suchort (Stadt oder PLZ)“**

Der Hinweis berücksichtigt den tatsächlichen Zustand:

| Zustand | Hinweis |
|---|---|
| kein Ort / kein Radius | Standardhinweis mit 5-km-Vorschlag |
| 5 km (auto oder manuell) | Standardhinweis mit 5-km-Vorschlag |
| 10/25/50/100 km | „Aktuell sind {km} km ausgewählt …“ |
| bewusst unbegrenzt | „Aktuell ist die Entfernung nicht begrenzt …“ |

Bei der ersten Eingabe eines Ortes wird die Such-Einstellungen-Sektion
automatisch geöffnet. Der Radius ist damit direkt erreichbar.

## 4. Radius-Semantik

`RADIUS_KM_OPTIONS` enthält jetzt:

```text
5, 10, 25, 50, 100
```

Die UI unterscheidet vier Zustände:

| Zustand | Bedeutung |
|---|---|
| `unset` | noch kein Radius gesetzt; ohne Ort kein Filter |
| `auto` | 5 km wurde durch die erste Ortesingabe gesetzt |
| `manual` | Benutzer hat 5/10/25/50/100 km bewusst gewählt |
| `unlimited` | Benutzer hat „Entfernung egal“ bewusst gewählt |

Regeln:

- Ohne Suchort bleibt der Radius `null`; es entsteht kein Geo-Filter.
- Erste Ortesingabe bei `unset` setzt `radiusKm: 5`.
- Eine manuell gewählte Entfernung wird bei späteren Ortsänderungen nicht überschrieben.
- `10 km` bleibt `10 km`, `50 km` bleibt `50 km`.
- „Entfernung egal“ bleibt `null` und wird nicht durch den 5-km-Standard ersetzt.
- Wird ein automatisch gesetzter Radius durch Leeren des Ortes entfernt, fällt er auf `null` zurück.
- Geladene Suchprofile behalten ihre gespeicherten Werte, einschließlich `null`.
- Ein extern geladenes Profil wird nicht durch den UI-Standard überschrieben.

## 5. Profil- und Adapter-Kompatibilität

Geprüft und kompatibel:

- `RADIUS_KM_OPTIONS` in `src/types.ts`
- `SearchForm`
- `validateSearchConfiguration`
- CV-Suchprofile (`CvProfileResult`)
- manuelle Suchprofile (`ManualSearchProfilesSection`)
- `/api/jobs` Parameter `radiusKm`
- `fetchAllJobs`
- Apify-Actor-Input mit `latitude`, `longitude`, `radiusKm`
- bestehende `null`-Semantik für „Entfernung egal“

Die 5-km-Option wird in CV- und manuellen Suchprofilen angeboten und validiert.
Die automatische 5-km-Vorbelegung gilt für die manuelle Suchmaske; gespeicherte
Profile und bewusst gesetzte Werte bleiben unverändert.

## 6. Tests

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite `npm test -- --run --maxWorkers=2` | **1314 passed, 5 skipped** |
| SearchForm gezielt | **30 passed** |
| CV-Suchprofil | **3 passed** |
| Manuelle Suchprofile | **13 passed** |
| Profilvalidierung | PASS |
| API-/Adapter-Tests | PASS |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax | PASS |
| Search-UX-03-E2E | PASS |
| Search-Results-Mobile-E2E | PASS |
| Guest-CV-E2E 1440/390 | PASS |
| Applications-E2E 1440/390 | PASS |
| Cover-Letter-E2E 1440/390 | PASS |
| Mobile-Navigation 390/430/768/1024/1440 | PASS |
| CV-Builder / CV-PDF-E2E | PASS |
| Console-Errors | keine |
| Echte Provider-/KI-/AWS-/RIS-/Apify-Aufrufe | keine |

### E2E-Messungen

- Skills-Eingabe: 44 px
- Skills-Löschbutton: 44 px
- Suchort-Eingabe: 44 px
- Radius-Select: 44 px
- linker Akzent: 4 px, türkisfarben
- horizontaler Überlauf: 0 px bei 1440/1024/768/430/390/320
- Tastaturfokus erreicht den Löschbutton
- DE/EN-Hinweise und Beispiele vorhanden

## 7. Screenshots

Unter `docs/reports/assets/JM-SEARCH-UX-03/`:

- `desktop-1440-skills-focus.png`
- `desktop-1440-city-5km.png`
- `desktop-1440-city-10km.png`
- `mobile-390-city-5km.png`
- `mobile-390-en.png`

Synthetische Daten; keine echten Stellenanzeigen oder Provider-Aufrufe.

## 8. Offene Findings

- Die automatische 5-km-Vorbelegung ist bewusst auf die manuelle Suchmaske
  begrenzt. Profil-Editoren bieten 5 km an und übernehmen gespeicherte Werte.
- Die bestehende Autocomplete-Anzeige kann bei erfolgloser Ortssuche weiterhin
  einen leeren „Keine Orte gefunden“-Hinweis anzeigen; das ist nicht Teil dieses
  Auftrags und wurde nicht verändert.
- Keine Änderung an Persistenz, Auth, KI, Providern, RIS oder AWS.
- **PRODUCTION: weiterhin BLOCKED.**

## 9. Git

- Implementierung: `9827456` — `feat: improve search skills guidance and radius defaults`
- Dokumentation/Evidenz: dieser Commit
- Branch: `feature/jm-search-ux-03`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 10. Abschlussentscheidung

**JM-SEARCH-UX-03: READY.**

Skills-Hervorhebung, Suchort-Hinweis, 5-km-Standard, bewusste Radiuswerte,
Profilkompatibilität, API-/Adapter-Weitergabe, Responsive und Accessibility sind
lokal verifiziert.

**HARD STOP nach JM-SEARCH-UX-03. Kein Push, kein Merge, kein Deployment.**
