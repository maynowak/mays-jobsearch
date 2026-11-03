# JM-NAV-SCROLL-UX-02

**Art:** Intelligente Hauptnavigation / Scroll-Verhalten / Schnellnavigation
**Status:** READY für lokale Main-Integration — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-nav-scroll-ux-02`
**Baseline:** `feature/jm-search-ux-03` `a467d63`; lokaler `main` `7e4858c`; `origin/main` `4364eab`

## 1. Ziel

Die Hauptnavigation wurde richtungsabhängig gemacht und um einen
barrierefreien „Nach oben“-Button ergänzt. Auf langen Seiten bleibt das Menü
mit einer kurzen Aufwärtsbewegung erreichbar; beim Scrollen nach unten blendet
es sich aus.

## 2. Git-Ausgangspunkt

- Basisbranch: `feature/jm-search-ux-03` @ `a467d63`
- `main`: `7e4858c`
- `origin/main`: `4364eab`
- Abstammung `main` → UX-03 → neuer Branch bestätigt
- neuer Branch: `feature/jm-nav-scroll-ux-02`
- Arbeitsbaum vor Beginn: clean

## 3. Bestehendes Verhalten

Vorher:

- `hideOnScroll` war nur auf ausgewählten Dashboard-Routen aktiv.
- Ausblenden erfolgte ab 50 px nach unten.
- Einblenden erfolgte nur, wenn die Scrollposition wieder unter 50 px lag.
- Die Navbar nutzte eine feste `top: -70px`-Regel.
- Die Bewerbungsverwaltung hatte eine `position: relative`-Ausnahme.
- Es gab keinen globalen „Nach oben“-Button.

## 4. Neue Scroll-Erkennung

`src/components/Navbar.tsx` verwendet jetzt:

- passive Scroll-Listener,
- `requestAnimationFrame`-Koaleszierung,
- Richtungsdelta statt reiner absoluter Position,
- Hysterese:
  - Ausblenden ab **12 px** Abwärtsbewegung und Scrollposition > 80 px,
  - Einblenden ab **6 px** Aufwärtsbewegung, unabhängig von der absoluten Position,
  - Scrollposition 0 zeigt die Navbar immer,
- keine Re-Renders bei unverändertem Zustand,
- Cleanup von Listener und Animation Frame,
- Initialzustand bei Browser-Scroll-Restoration.

Die Navbarhöhe wird per `ResizeObserver` in `--navbar-height` geschrieben.
Dadurch funktioniert das Ausblenden auch bei der höheren Glass-Navbar und bei
dynamischen Layoutänderungen ohne feste Pixelannahme.

`prefers-reduced-motion` deaktiviert die Navbar- und Button-Transition.

## 5. Hamburger-Menü

Die bestehende Portal-Implementierung bleibt erhalten.

- Öffnen/Schließen über denselben Burger,
- Escape schließt,
- Outside-Click schließt,
- Fokusfalle bleibt,
- Fokus kehrt zum Burger zurück,
- Login/Logout, Profil und Sprachumschaltung bleiben erhalten,
- bei geöffnetem Menü wird die Navbar nicht durch Scrollen ausgeblendet,
- nach dem Schließen greift das normale Scrollverhalten wieder.

## 6. Nach-oben-Button

Neuer Button:

**↑ Nach oben**

- erscheint erst bei langer Seite und Scrollposition > 480 px,
- mindestens 44 × 44 px,
- feste Position unten rechts,
- Safe-Area-Abstände über `env(safe-area-inset-*)`,
- keine neue Route, kein Reload, kein Formular-/Ergebnisverlust,
- sanftes Scrollen,
- bei `prefers-reduced-motion` sofortiges Scrollen,
- Fokus geht anschließend auf den Markenlink.

## 7. Bewerbungsverwaltung

Die bestehende `position: relative`-Ausnahme wurde bewusst beibehalten.
Ein Test mit `position: sticky` zeigte, dass die Navbar dabei Application-
Filter, Selects und Karten überlagert. Das widerspricht der bestehenden
UX-04B-Anforderung „keine verdeckten Bedienelemente“.

Deshalb:

- keine pauschale `fixed`-Umstellung,
- keine Überlagerung von Formularfeldern oder Aktionsbuttons,
- der „Nach oben“-Button bleibt als Rückweg zum Hauptmenü verfügbar,
- bestehende Applications-E2E-Prüfungen bleiben vollständig grün.

**Offener Finding:** Auf der Bewerbungsverwaltung ist das Hauptmenü wegen der
bestehenden relativen Ausnahme nicht per kurzer Aufwärtsbewegung sichtbar,
sondern über den „Nach oben“-Button. Eine sticky Variante wurde verworfen, weil
sie die vorhandene Overlay-/Fokusfreiheit verletzt.

## 8. Ergebnissprung

Der bestehende Ablauf aus `JM-SEARCH-RESULTS-MOBILE-UX-04` bleibt intakt:

- „Zu den gefundenen Stellen“,
- `#matches`,
- Fokus auf `#matches-heading`,
- Sticky-Abstände,
- Reduced Motion,
- keine doppelte Suche.

Die Search-Results-E2E-Prüfung ist weiterhin erfolgreich.

## 9. Responsive und Accessibility

Geprüft bei 1440/1024/768/430/390/320 px:

- Navbar am Seitenanfang sichtbar,
- Ausblenden nach unten,
- Einblenden nach 20 px Aufwärtsbewegung,
- sehr lange Seite,
- Hamburger öffnen/schließen,
- Nach-oben-Button mit 44 px,
- kein horizontaler Overflow,
- keine Console-Errors,
- Tastaturfokus auf versteckte Navbar macht sie sichtbar,
- Reduced-Motion-Verhalten.

## 10. Tests

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite `npm test -- --run --maxWorkers=2` | **1320 passed, 5 skipped** |
| Testdateien | 123 passed, 3 skipped |
| Navbar-Scroll-Unit-Tests | **6 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax | PASS |
| Nav-Scroll-E2E 1440/1024/768/430/390/320 | PASS |
| Navbar-Hamburger/Fokus | PASS |
| Reduced Motion | PASS |
| Search-Results-E2E | PASS |
| Applications-E2E | PASS |
| Cover-Letter-E2E | PASS |
| Guest-CV-E2E | PASS |
| Mobile-Navigation-E2E | PASS |
| CV-Builder-E2E | PASS |
| CV-PDF-E2E | PASS |
| Console-Errors | keine |
| Echte Provider-/KI-/AWS-/RIS-/Apify-Aufrufe | keine |

## 11. Screenshots

Unter `docs/reports/assets/JM-NAV-SCROLL-UX-02/`:

- `desktop-1440-nav-visible.png`
- `desktop-1440-nav-hidden.png` inkl. „Nach oben“
- `desktop-1024-nav-visible.png`
- `desktop-1024-nav-hidden.png`
- `tablet-768-nav-visible.png`
- `tablet-768-nav-hidden.png`
- `mobile-430-nav-visible.png`
- `mobile-430-nav-hidden.png`
- `mobile-430-menu-open.png`
- `mobile-390-nav-visible.png`
- `mobile-390-nav-hidden.png`
- `mobile-390-menu-open.png`
- `mobile-320-nav-visible.png`
- `mobile-320-nav-hidden.png`
- `mobile-320-menu-open.png`

Synthetische Daten; keine echten Stellenanzeigen oder Provider-Aufrufe.

## 12. Offene Findings

- Bewerbungsverwaltung: bestehende `position: relative`-Ausnahme beibehalten;
  „Nach oben“-Button als Rückweg, keine sticky-Überlagerung.
- Der Button wird erst nach ausreichender Scrolltiefe und auf langen Seiten
  eingeblendet; das ist beabsichtigt.
- Keine Änderung an Auth, Persistenz, KI, Providern, RIS oder AWS.
- **PRODUCTION: weiterhin BLOCKED.**

## 13. Git

- Implementierung: `2cba196`
- Dokumentation/Evidenz: dieser Commit
- Branch: `feature/jm-nav-scroll-ux-02`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 14. Abschlussentscheidung

**NAV-SCROLL-UX-02: READY für lokale Main-Integration.**

Die richtungsabhängige Navigation, der Hamburger-Schutz, der Nach-oben-Button,
Responsive-/Reduced-Motion-Verhalten und die bestehenden Such-/Bewerbungs-/
CV-Flows sind lokal verifiziert. Die Applications-Ausnahme ist als offener
Finding dokumentiert.

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP nach UX-02. Kein Push, kein Merge, kein Deployment.**
