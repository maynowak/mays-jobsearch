# JM-APPLICATION-MANAGEMENT-UX-05A

**Art:** Bewerbungs-Cockpit / Statusübersicht / Schnellfilter
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-application-management-ux-05a`
**Ausgangsstand:** UX-04E `b6e5bed`
**main:** `b897259` (unverändert)
**Grenzen:** Keine neue Persistenz, keine Repository-/Backend-/RIS-/AWS-/Cognito-/KI-/Apify-Änderung, kein Deployment.

## 1. Kennzahlen

Die Kennzahlen werden ausschließlich aus der vorhandenen `applications`-Collection
abgeleitet; es gibt keine zusätzlichen Zähler oder Repository-Abfragen.

| Kennzahl | Semantik |
|---|---|
| Bewerbungen gesamt | Anzahl aller Session-Bewerbungen |
| Entwürfe | aktueller Status `draft` |
| Versendet | aktueller Status `submitted` |
| Gespräche | aktueller Status `interview` |
| Offene Wiedervorlagen | `followUp.status === "open"` |

Die Wiedervorlagenzählung ist unabhängig vom Bewerbungsstatus. „Versendet“ zählt
bewusst nur den aktuellen Status `submitted`, nicht früher erreichte Status.

Karten sind rein visuell; die Filterung erfolgt über die gemeinsame
Schnellfilter-Leiste.

## 2. Handlungsbedarf

Aus offenen Wiedervorlagen werden drei Gruppen berechnet:

- **Überfällig:** `dueOn` vor dem lokalen heutigen Kalenderdatum
- **Heute fällig:** `dueOn` gleich dem lokalen heutigen Kalenderdatum
- **Nächste 7 Tage:** `dueOn` 1–7 Tage in der Zukunft

Erledigte Wiedervorlagen werden ausgeschlossen. Ohne offene Aufgaben erscheint
der unaufdringliche Leerzustand „Aktuell keine fälligen Wiedervorlagen.“
Ein Klick auf einen Eintrag öffnet die Bewerbung und den Tab **Kommunikation**;
bestehende Bearbeitungsschutzregeln aus UX-04C werden respektiert.

## 3. Schnellfilter

Gemeinsamer Filterzustand:

- Alle
- Entwürfe
- Versendet
- Gespräche
- Offene Wiedervorlagen
- Überfällig

Die vorhandene Statusfilter-Auswahl nutzt denselben Zustand und bleibt für
weitere Statuswerte erhalten. Filterwechsel sind reiner UI-State, erzeugen
keine Repository-Mutation und keine zusätzliche Anfrage. Der aktive Filter ist
über `aria-pressed` und eine sichtbare Umrandung/Fläche erkennbar.

## 4. Sortierung

Neue Option **„Nächste Wiedervorlage“**:

1. offene Wiedervorlagen nach `dueOn` aufsteigend
2. Bewerbungen ohne offene Wiedervorlage danach
3. deterministische sekundäre Sortierung über `updatedAt` und `localId`

Die bestehenden Optionen „Neueste zuerst“ und „Älteste zuerst“ bleiben
unverändert. Der Standard bleibt „Neueste zuerst“.

## 5. Responsive UI

- Kennzahlen: 5 Spalten Desktop, 3 Spalten ≤980 px, 2 Spalten ≤600 px.
- Handlungsbedarf: 3 Gruppen Desktop, einspaltig ≤980 px.
- Schnellfilter: umbrechen mobil; keine horizontale Seitenüberlauf.
- 1440/1024/768/390/320 px per E2E/Bounds geprüft.
- Navbar-Überlagerung bleibt durch den UX-04B-Schutz ausgeschlossen.
- Dashboards/30-70-Detail-Layout, Tabs und Formulare bleiben erhalten.

## 6. Sicherheit und Datenschutz

Unverändert:

- `ApplicationRepository`, Session-Generation, `AbortSignal`, `invalidate()`
- `expectedVersion`, Versionskonflikte, Doppelaktionsschutz
- Stale-Operation- und Auth-/Session-Isolation
- keine neue Browser-Persistenz
- keine Backend-/RIS-/KI-/Apify-Aufrufe
- Kennzahlen/Filter nur aus bestehenden Session-Daten

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationsSection | **30 passed** |
| Gesamtsuite (`npm test -- --run`) | **1216 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Applications-E2E Desktop 1440 | PASS |
| Applications-E2E Mobil 390 | PASS |
| Responsive 1024 / 768 / 320 | PASS, kein Overflow |
| Navigation-BBox | PASS |
| Cover-Letter-E2E Desktop 1440 | PASS |
| Cover-Letter-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Echte KI-/RIS-/Apify-Aufrufe | keine |

Getestet u. a.:

- Kennzahlen aus aktuellem Status
- Handlungsbedarf (überfällig, heute, demnächst)
- Schnellfilter und Reset
- gemeinsamer Filterzustand mit Statusselect
- Follow-up-Sortierung
- Öffnen einer Bewerbung aus Handlungsbedarf
- bestehende Tabs, Editing, Follow-up-, Export- und Löschabläufe
- Session-/Doppelaktions-/Versionsschutz

## 8. Screenshots

- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05A/desktop-1440-cockpit.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05A/desktop-1440-filter.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05A/desktop-1440-action-needed.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05A/mobile-390-cockpit.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05A/mobile-390-filter.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-05A/mobile-390-action-needed.png`

Synthetische Daten; keine echten Bewerberdaten.

## 9. Git

- Implementierungscommit: `11815ad`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-management-ux-05a`
- `main` bleibt `b897259`
- Kein Push, Merge oder Deployment

## 10. Offene Punkte

- Live-Verifikation nach Deployment.
- UX-05B nicht vorweggenommen.
- RIS-/Backend-Persistenz und Live-Auth-Matrix bleiben außerhalb des Scopes.
