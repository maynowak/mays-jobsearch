# JM-SEARCH-RESULTS-MOBILE-UX-04

**Art:** Mobile Stellensuche / Trefferanzeige / Ergebnissprung / KI-Aktionsbutton
**Status:** ABGESCHLOSSEN UND LOKAL VERIFIZIERT — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-search-results-mobile-ux-04`
**Baseline:** lokaler `main` `e098fbd`; `origin/main` `4364eab`

## 1. Ziel

Nach einer erfolgreichen Stellensuche erhält der Nutzer eine kompakte
Ergebnisübersicht mit tatsächlicher Trefferzahl, direktem Sprung zu den
Ergebnissen und einer ausdrücklichen KI-Bewertungsaktion.

Unverändert bleiben:

- `foundJobs`, `matches`, `dataset` und die vorhandene KI-Aktion,
- Such- und Provider-Infrastruktur,
- Quoten-/Fallback-/Fehlerbehandlung,
- Session- und Datenschutzgrenzen.

## 2. Trefferanzeige

Neue Komponente:

`src/components/SearchResultsSummary.tsx`

Nach erfolgreicher Suche:

- **„1 Stelle gefunden“** bzw. **„{count} Stellen gefunden“**
- **„Zu der Stelle“** bzw. **„Zu den {count} Stellen“**
- **„✨ Mit KI bewerten“**

Die Zahl stammt ausschließlich aus `foundJobs.length`. `matches` wird nicht
addiert. Die Übersicht wird bei einer neuen laufenden Suche ausgeblendet, weil
`foundJobs` zu Beginn der Suche geleert wird.

## 3. Ergebnissprung

- Ziel ist der vorhandene Ergebnisbereich `#matches`.
- Der Sprung löst keine Suche und keine KI-Anfrage aus.
- Ein neues `resultsExpandAllSignal` öffnet eingeklappte Match-Ergebnisse.
- `Results` setzt `expanded`/`moreOpen` und fokussiert `#matches-heading`.
- `scroll-margin-top` berücksichtigt die Sticky-Navigation.
- `prefers-reduced-motion` wird bei der Scrollbewegung berücksichtigt.

Nach einer erfolgreichen Suche wird die kompakte Übersicht automatisch in den
sichtbaren Bereich gescrollt; der explizite Ergebnissprung bleibt zusätzlich
verfügbar.

## 4. KI-Aktion

Die KI-Bewertung verwendet ausschließlich den vorhandenen Handler
`handleMatchWithAI`.

- Der bisherige separate Match-Button im App-Suchformular wird nicht mehr
  gerendert; die sichtbare Aktion liegt in der Ergebnisübersicht.
- `SearchForm` behält seine optionale Match-Fähigkeit für bestehende
  Komponenten-/Unit-Tests.
- Doppelklicks werden durch den bestehenden `busyRef` und den deaktivierten
  Ladebutton verhindert.
- Während der Bewertung: `Bewerte mit KI…`, Spinner, `aria-busy`, disabled.
- Fehler/Quota/Modell-Fallback bleiben über den bestehenden Statuspfad erhalten.
- Bei Fehlern bleiben `foundJobs` und die Ergebnisliste sichtbar.

## 5. Button-Hervorhebung

Die Klasse `.match-btn` erhielt:

- türkise/cyane Farbgewichtung,
- mindestens 44 px Höhe,
- sichtbaren `:focus-visible`-Zustand,
- Hover-/Active-/Disabled-Zustände,
- keine dauerhafte Animation; nur der vorhandene Lade-Spinner,
- `prefers-reduced-motion`-freundliche Übergänge.

Auf Desktop und Mobil wird derselbe Button verwendet.

## 6. Zustandslogik

| Zustand | Verhalten |
|---|---|
| Suche läuft | `foundJobs` geleert, keine Trefferzahl/keine KI-Aktion |
| 0 Stellen | keine Ergebnisübersicht, keine KI-Aktion |
| Stellen gefunden | Trefferzahl + Sprung + KI-Aktion |
| KI läuft | deaktivierter Ladebutton, keine Doppelanfrage |
| KI erfolgreich | bestehende Bewertungs-/Statusdarstellung |
| KI fehlgeschlagen | Fundstellen bleiben erhalten, Fehlerstatus sichtbar |
| Modell nicht verfügbar | bestehende Modell-Recovery/Statusmeldung |
| Neue Suche | Übersicht an neuen Datensatz angepasst |

## 7. Responsive und Accessibility

- Trefferübersicht kompakt; Aktionen auf schmalen Geräten untereinander.
- Keine horizontalen Überläufe bei 1440/1024/768/430/390/320.
- Touch-Ziele ≥ 44 px.
- `role="status"` für die Trefferzahl.
- Semantische Buttons mit eindeutigen Labels.
- Fokus nach Ergebnissprung auf der Ergebnisüberschrift.
- Keine wiederholten Live-Region-Meldungen bei jedem Tastendruck.
- DE/EN-Texte und Singular/Plural.

## 8. Tests

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run --maxWorkers=2` | **1265 passed, 5 skipped** |
| `SearchResultsSummary` gezielt | **4 passed** |
| App/Results/SearchForm gezielt | **127 passed** |
| Cover-Letter-API | **23 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax | PASS |
| Search-Results-E2E | PASS |
| Search-Results responsive 1440/1024/768/430/390/320 | PASS |
| Guest-CV-E2E 1440/390 | PASS |
| Applications-E2E 1440/390 | PASS |
| Cover-Letter-E2E 1440/390 | PASS |
| Mobile-Navigation-E2E | PASS |
| Console-Errors | keine |
| Echte KI-/Provider-/RIS-/AWS-/Apify-Aufrufe | keine |

Der Search-Results-E2E deckt ab:

- eine Stelle und Pluralfall,
- Trefferzahl und Ergebnissprung mit Fokus,
- eingeklappte/aufgeklappte Ergebnisse,
- KI-Ladezustand,
- KI-Fehler mit erhaltenen Stellen,
- Desktop-Button-Höhe ≥ 44 px,
- responsive Breiten.

## 9. Screenshots

Unter `docs/reports/assets/JM-SEARCH-RESULTS-MOBILE-UX-04/`:

- `desktop-1440-ai-button.png`
- `mobile-390-one-job.png`
- `mobile-390-one-job-evaluated.png`
- `mobile-390-multiple-jobs.png`
- `mobile-390-ai-running.png`
- `mobile-390-ai-failed.png`
- `mobile-390-expanded-results.png`

Synthetische Stellen; keine echten Bewerber- oder Providerdaten.

## 10. Offene Punkte

- Live-Provider-/Quotenverifikation bleibt offen.
- Der automatische Reveal-Scroll nach der Suche ist bewusst aktiv; der manuelle
  Ergebnissprung bleibt zusätzlich verfügbar.
- Die Ergebnisübersicht zeigt nur die Trefferzahl, keine erfundene
  Bewertungsquote.
- Keine Änderung an ATS-Einzelbewertungen oder Bewerbungsverwaltung.
- **PRODUCTION: weiterhin BLOCKED.**

## 11. Git

- Trefferübersicht/Ergebnissprung/KI-Aktion: `a0a7f00`
- E2E/Screenshots: `72c492c`
- Screenshot-Aktualisierung: `a8ec5be`
- Dokumentation: dieser Commit
- Branch: `feature/jm-search-results-mobile-ux-04`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 12. Abschlussentscheidung

**SEARCH-RESULTS-MOBILE-UX-04: READY für die kontrollierte lokale Integration.**

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Kein Push, kein Deployment.**
