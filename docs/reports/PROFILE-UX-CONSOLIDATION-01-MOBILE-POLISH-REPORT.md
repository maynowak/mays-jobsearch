# PROFILE-UX-CONSOLIDATION-01 — MOBILE VISUAL REVIEW & POLISH

**Status:** `PROFILE-UX-CONSOLIDATION-01 — MOBILE POLISH VERIFIED LOCAL / FEATURE BRANCH PUSHED`
**Basis:** `origin/main` `3bfe391`
**Branch:** `feature/profile-ux-consolidation-01-mobile-polish`
**Feature-Branch gepusht auf explizite Operator-Anweisung. Kein Merge oder Deployment.**

## 1. Tatsächlich reproduzierte Probleme

1. **Veraltete Speichertexte:** In `Einstellungen` und in der Datenschutz-Zusammenfassung
   stand trotz aktiver `search-profile-storage`-Freigabe weiterhin
   „Suchprofile bleiben vorerst sitzungsbezogen“. Die Kategorien zeigten
   „Suchprofile speichern — Nicht freigegeben“.
2. **Unklare Profil-Ladezustände:** Die CV-Karten zeigten während des Ladens
   keine eindeutige Zusammenfassung und konnten vorübergehend wie ein leeres
   Ergebnis wirken. Bei Fehlern fehlte ein Retry direkt an der Karte.
3. **Zu viele gleichzeitig offene ATS-Bereiche:** Mehrere CV-Suchprofile
   konnten ihre ATS-Listen parallel aufklappen und die mobile Ansicht stark
   verlängern.
4. **Zu kleine Touch-Ziele:** 235 interaktive Treffer unter 44 × 44 px in der
   Vorher-Messung, u. a. Profilaktionen (34–36 px), CV-Speichermodus (38 px),
   schwebendes Menü (32 px) und Sprachumschalter (39 px breit).
5. **Job-Präferenzen-Badge:** „Dauerhaft im RIS-Konto“ brach mobil auf drei
   Zeilen um, wirkte wie ein großer Kreis und verdrängte den Titel.
6. **Rechtsseiten ohne Padding:** `.legal-main` und `.legal-container` nutzten
   nicht definierte Legacy-Tokens (`--space-xl`, `--space-md`); dadurch lief
   der Datenschutztext am Viewport-Rand und die Überschrift brach ungünstig.
7. **Landingpage bei 320 px:** Die Headline war für die Inhaltsbreite zu groß;
   „mit KI“ hatte auf dem hellen Hintergrund zu wenig Kontrast.

Nicht reproduziert: Menüüberlagerung, fehlerhafte aktive Dashboard-Auswahl
oder ein echter Sticky-Navigation-Bug. Die vorhandene Navigation blieb
funktional; Full-Page-Artefakte wurden nicht als UI-Fehler gewertet.

## 2. Behobene Probleme

### Speicherstatus

- Speichertexte werden jetzt aus den tatsächlichen Zuständen abgeleitet:
  Anwendungen, CVs und Such-/ATS-Profile.
- Neue gemeinsame Helfer in `src/lib/storageConsentDisplay.ts` erzeugen die
  aktiven und sitzungsbezogenen Bereiche.
- Die Übersicht und die Einstellungen zeigen z. B.
  „Dauerhaft über RIS gespeichert: Bewerbungen, Lebensläufe und Such- und
  ATS-Profile. Nicht genannte Bereiche bleiben sitzungsbezogen.“
- Die Suchprofil-Kategorie zeigt nun `Freigegeben`, wenn die separate
  Einwilligung tatsächlich vorliegt. Es wird keine pauschale Speicherung
  behauptet.

### Profil-Ladezustände

- CV-Karten zeigen eine gemeinsame Statuszeile:
  - Laden: „Such- und ATS-Profile werden geladen …“
  - Erfolg: „2 Suchprofile · 1 ATS-Profil“
  - Leer: „Noch keine Such- oder ATS-Profile.“
  - Fehler: „Profile konnten nicht geladen werden.“ mit **Erneut versuchen**
- Während des Ladens wird keine vorläufige Null als Ergebnis angezeigt.
- Requests sind über CV-ID, Request-ID und Generation an den aktuellen
  Dokument-/Identitätsstand gebunden; verspätete Antworten werden verworfen.
- Die Profilverwaltung zeigt eine Lade-/Erfolgszusammenfassung und einen
  Retry bei Ladefehlern.

### Mobile Profil-Hierarchie

- CV → CV-Suchprofile → ATS-Profile bleibt erhalten.
- ATS-Bereiche funktionieren als Accordion: Es ist höchstens ein ATS-Bereich
  gleichzeitig geöffnet.
- Kompaktere Karten, zweispaltige Fakten auf Mobile, Skill-Chips und
  vollflächige Aktionen bei sehr schmalen Viewports.
- Bearbeiten, Löschen und Erstellen bleiben unverändert verfügbar.

### Touch, Navigation und Badges

- `.btn-ghost`, `.aurora-btn`, `.letter-btn`, CV-Modus und weitere zentrale
  Aktionen haben mindestens 44 px Höhe.
- Schwebendes Menü, Sprachumschalter, Lösch-Icon und Match-Pulse haben
  44 × 44 px Trefferflächen.
- Persistente Job-Präferenzen-Badges bleiben einzeilig und kompakt; auf
  schmalen Viewports rutschen sie unter den Titel statt ihn einzuquetschen.
- Die bestehende Hamburger-/Dashboard-Navigation und Fokusführung bleiben
  erhalten.

### Landingpage und Rechtsseiten

- 320-px-Headline kompakter, „mit KI“ kontrastreicher.
- Rechtsseiten erhalten echtes Mobile-Padding, lesbare Überschriften und
  definierte Abstände; keine Inhalte wurden aus Platzgründen entfernt.
- Speicher-/Datenschutztexte haben eine lesbare Zeilenlänge.

### May-Hilfe

- Unverändert einklappbar, standardmäßig geschlossen, lokaler UI-Zustand
  `mj-may-help-open` bleibt erhalten. Keine Chatbot-Funktion.

## 3. Screenshots

**Vorher:** `docs/reports/assets/PROFILE-UX-CONSOLIDATION-01-MOBILE/before/`
**Nachher:** `docs/reports/assets/PROFILE-UX-CONSOLIDATION-01-MOBILE/after/`

Abgedeckte Ansichten bei 320 / 390 / 430 / 768 / 1024 / 1440 px:

- Landingpage
- Mobiles Hauptmenü (bis 900 px)
- Login
- Dashboard-Übersicht
- Mein Profil
- Lebenslauf – Sitzung
- Lebenslauf – RIS (inkl. Karte, Lade- und Fehlerzustand)
- CV-/ATS-Profilverwaltung
- Bewerbungen
- Job-Präferenzen
- Einstellungen / Datenschutz
- Datenschutzerklärung

Die `before/`- und `after/`-Ordner enthalten die vergleichbaren Viewport-Shots.
Metriken: `before/metrics.json`, `after/metrics.json`.

Messung:

| Metrik | Vorher | Nachher |
| --- | --- | --- |
| Horizontale Overflows | 0 | **0** |
| Interaktive Ziele < 44 px | 235 | **0** |
| E2E-Screenshot-Läufe | 70 | **82** |

## 4. Tests

| Prüfung | Ergebnis |
| --- | --- |
| Profil-/Storage-/App-Fokustests | **127 PASS** |
| Serielle Gesamtsuite | **1685 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Mobile Visual E2E (13 Ansichten × 6 Breiten + Menü) | **PASS**, 82 Shots |
| Mobile Navigation E2E | **PASS** |
| Bestehender Profil-UX-E2E | **PASS** |
| E2E-Checks: kein Overflow, kein vorläufiges Null-Ergebnis, kein stale Session-Text | **PASS** |

Der Browser-Harness nutzt eine synthetische OIDC-Session und gemockte
`/api/ris/*`-Antworten. Es fanden keine echten RIS-, Cognito- oder
AWS-Aufrufe statt.

## 5. Commits

- `f1922a0` — Speicherstatus und Profil-Ladezustände
- `839d8ea` — mobile Karten-, Badge-, Touch- und Legal-Optimierung
- `1ddbcfc` — Full-Page-Screenshot-Artefakte entfernt
- Abschlussbericht und Auditlog (HEAD)

## 6. Verbleibende Einschränkungen

- Kein authentifizierter Live-RIS-E2E: Es war kein freigegebenes synthetisches
  Testkonto verfügbar. Gemockte Browser-Tests sind kein Production-Nachweis.
- Keine Änderung an RIS, AWS, Terraform, Cognito, Consent-Verträgen oder
  produktiven Benutzerdaten.
- Feature-Branch gepusht; kein Merge oder Production-Deployment.
- Persistente Banner-/Consent-Texte bleiben an die bestehenden serverseitigen
  Verträge gebunden; nur die Anzeige wurde an die tatsächlichen Zustände
  angepasst.

## 7. Empfehlung

**GO für lokale Abnahme und PR-Review.**
**NO-GO für Production-E2E**, bis ein freigegebenes synthetisches RIS-Testkonto
für den authentifizierten Lese-/Schreib-/Reload-Test vorliegt.
