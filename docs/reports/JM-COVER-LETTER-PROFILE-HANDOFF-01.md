# JM-COVER-LETTER-PROFILE-HANDOFF-01

**Art:** Anschreiben / Profilnavigation / Anmeldungshinweis / Bewerbungsverwaltung
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-cover-letter-profile-handoff-01`
**Baseline:** lokaler `main` `7f71459`; `origin/main` `4364eab`
**Grenzen:** Keine neue Route, keine neue Persistenz, keine Migration, keine neuen KI-/Provider-/AWS-/RIS-/Apify-Aufrufe.

## 1. Ziel

Nach Erstellung und Übernahme eines Anschreibens wird die nächste
Benutzeraktion eindeutig geführt:

- Gast: Hinweis auf die Bewerbungsverwaltung nach Anmeldung.
- Angemeldet: Status des übernommenen Bewerbungsentwurfs und direkter Weg in
  die bestehende Bewerbungsverwaltung.
- Keine Garantie dauerhafter Speicherung; Daten bleiben Session-only.

## 2. Entwicklungstabelle

| Bereich | Ergebnis | Nachweis |
|---|---|---|
| Gast-Hinweis | IMPLEMENTIERT | `LetterModal` |
| Anmelden-/Registrieren-Aktion | IMPLEMENTIERT | bestehende Route `/anmelden` |
| Session-Verlust-Warnung | IMPLEMENTIERT | Inline-Bestätigung bei vorhandenen Sitzungsbewerbungen |
| Angemeldeter Erfolgsstatus | IMPLEMENTIERT | nach bestätigter Repository-Operation |
| „Meine Bewerbungen öffnen“ | IMPLEMENTIERT | bestehende Dashboard-Navigation |
| Statustexte erstellt/bearbeitet/übernommen/aktualisiert/fehlgeschlagen | IMPLEMENTIERT | `LetterModal` + i18n |
| Doppelte Bewerbungserstellung | VERHINDERT | `adoptingRef`, `idempotencyKey`, `expectedVersion`; Tests |
| Bestehendes Anschreiben nach Fehler | UNVERÄNDERT | Fehler-/Doppelklick-Test |
| Responsive 1440/390 | VERIFIED LOCAL | E2E |
| Keine Console-Errors | VERIFIED LOCAL | Applications-/Cover-Letter-E2E |

## 3. Gastverhalten

Im Anschreiben-Dialog erscheint nach der Erstellung eines Anschreibens ein
dezenter, nicht automatisch ausgelöster Hinweis:

**„Deine Bewerbungen im Blick behalten“**

Text:

> Nach der Anmeldung erreichst du deine Bewerbungsverwaltung über dein Profil.

Zusätzlich:

> Bewerbungen und Anschreiben werden derzeit ausschließlich während der aktiven
> Sitzung gehalten. Eine Anmeldung garantiert keine dauerhafte Speicherung.

Aktion:

**„Anmelden / Registrieren“**

- verwendet die bestehende Route `/anmelden` und damit den vorhandenen
  Login-/Registrierungsflow,
- schließt den Anschreiben-Dialog beim Wechsel,
- startet keine automatische Migration.

### Auth-Wechsel und Session-Invalidierung

In `src/App.tsx` invalidiert ein Wechsel der Auth-Identität weiterhin:

- `applicationRepository.invalidate()`,
- `beginNewApplicationSession()`,
- `sessionApplications` wird geleert,
- der Anschreiben-Dialog wird geschlossen.

Wenn bereits Sitzungsbewerbungen vorhanden sind, zeigt der Gast-Hinweis vor dem
Wechsel eine Bestätigung:

> Eine Anmeldung startet eine neue Sitzung. Nicht gespeicherte
> Bewerbungsentwürfe dieser Sitzung werden dabei verworfen. Eine automatische
> Übernahme der Gastdaten findet nicht statt.

Abbruch verändert nichts. Erst „Weiter zur Anmeldung“ ruft den vorhandenen
Sign-in-Pfad auf.

## 4. Angemeldete Benutzer

Nach erfolgreicher Übernahme oder Aktualisierung erscheint:

**„Dein Bewerbungsentwurf ist bereit.“**

Statusabhängig:

- `Bewerbungsentwurf erfolgreich übernommen.` — neue Sitzungsbewerbung,
- `Bestehender Bewerbungsentwurf aktualisiert.` — bestehende Bewerbung.

Aktion:

**„Meine Bewerbungen öffnen“**

Die Aktion verwendet keine neue Route. Sie navigiert über die vorhandene
Dashboard-Struktur zu:

```text
/profil?tab=applications
```

`DashboardV2` liest den bestehenden `tab`-Parameter und öffnet direkt den
Bewerbungen-Bereich. Kein zweiter Eintrag wird erzeugt.

## 5. Status- und Fehlermeldungen

| Zustand | Anzeige |
|---|---|
| Anschreiben generiert | „Anschreiben erstellt.“ |
| KI-Revision | „Anschreiben überarbeitet.“ |
| Manuelle Bearbeitung | „Anschreiben bearbeitet.“ |
| Übernahme neu | „Bewerbungsentwurf erfolgreich übernommen.“ |
| Übernahme bestehend | „Bestehender Bewerbungsentwurf aktualisiert.“ |
| Übernahme fehlgeschlagen | „Die Übernahme als Bewerbungsentwurf ist fehlgeschlagen. Dein Anschreiben bleibt unverändert.“ |
| Laufende Übernahme | „Wird übernommen…“ |

Erfolg wird erst nach dem aufgelösten Repository-Callback angezeigt. Ein
Fehler lässt Anschreiben und Anschreiben-Text unverändert.

## 6. Geänderte Komponenten

- `src/components/LetterModal.tsx`
  - Gast-/Auth-Handoff, Login-Bestätigung, Adoption-Status, Doppelklickschutz.
- `src/App.tsx`
  - async Adoption-Callback mit Ergebnis `created | updated`,
  - Sign-in-/Profilnavigation,
  - Session-Epoch-Schutz.
- `src/components/DashboardV2.tsx`
  - Initialer Tab aus bestehendem `?tab=applications`.
- `src/i18n.tsx`
  - DE/EN-Texte für Handoff und Status.
- `src/styles.css`
  - kompakte Handoff-Box, responsive Aktionen, 44-px-Ziele.
- `src/components/DashboardV2.test.tsx`
- `src/components/LetterModal.test.tsx`
- `tests/e2e/applications-dashboard.mjs`
- `tests/e2e/cover-letter-entry.mjs`

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run` erster Lauf | 1259 passed, 2 failed, 5 skipped |
| Fehlschläge | ausschließlich bekannte `ManualSearchProfiles.*`-Volllast-/Timing-Tests |
| Isolierter Lauf der beiden Dateien | **12 passed / 12** |
| Stabiler vollständiger Lauf `--maxWorkers=2` | **1261 passed, 5 skipped** |
| `src/App.test.tsx` | **96 passed** |
| LetterModal + DashboardV2 gezielt | **63 passed** |
| Cover-Letter-API | **23 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Applications-E2E 1440/390 | PASS; keine Console-Errors |
| Applications responsive 1024/768/320 | PASS |
| Cover-Letter-E2E 1440/390 | PASS; keine Console-Errors |
| Echte KI-/Provider-/AWS-/RIS-/Apify-Aufrufe | keine |

Der erste Volllast-Lauf wurde nicht kaschiert. Die beiden Fehlschläge lagen in
den bekannten Profil-Timing-Tests; isoliert bestanden beide Dateien vollständig.
Der stabile vollständige Lauf bestätigt **1261 passed / 5 skipped**.

## 8. Screenshots

Synthetische Daten, Desktop 1440 und Mobil 390:

- `docs/reports/assets/JM-COVER-LETTER-PROFILE-HANDOFF-01/desktop-1440-guest-handoff.png`
- `docs/reports/assets/JM-COVER-LETTER-PROFILE-HANDOFF-01/mobile-390-guest-handoff.png`
- `docs/reports/assets/JM-COVER-LETTER-PROFILE-HANDOFF-01/desktop-1440-adoption-ready.png`
- `docs/reports/assets/JM-COVER-LETTER-PROFILE-HANDOFF-01/mobile-390-adoption-ready.png`

## 9. Git

- Branch: `feature/jm-cover-letter-profile-handoff-01`
- Implementierung: `8dd5651`
- Dokumentation/Screenshots: dieser Commit
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment
- `main` bleibt `7f71459`; `origin/main` bleibt `4364eab`

## 10. Offene Findings

- Bewerbungen und Anschreiben bleiben ausschließlich Session-only.
- Eine Anmeldung garantiert keine dauerhafte Speicherung.
- Auth-Wechsel verwirft Sitzungsdaten weiterhin bewusst; es gibt keine
  automatische Gastdaten-Migration.
- Ohne vorhandene Sitzungsbewerbungen zeigt der Gast-Hinweis keine zusätzliche
  Bestätigung, wohl aber den Session-only-Hinweis; das Anschreiben selbst wird
  beim Wechsel ebenfalls nicht dauerhaft gespeichert.
- Live-Cognito-/Provider-/RIS-/Retention-Freigaben bleiben offen.
- Es wurden keine produktiven Auth-, KI-, AWS-, RIS- oder Apify-Aufrufe
  ausgeführt.

**HARD STOP nach Profile-Handoff-01. Kein Push, kein Deployment.**
