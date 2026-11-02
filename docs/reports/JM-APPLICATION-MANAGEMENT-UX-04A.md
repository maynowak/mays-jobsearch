# JM-APPLICATION-MANAGEMENT-UX-04A

**Art:** Bewerbungsverwaltung / editierbare Bewerbungsdetails
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-02
**Branch:** `feature/jm-application-management-ux-04a`
**Tatsächlicher Ausgangsstand:** lokaler `main` @ `b897259` (der zuvor konsolidierte Stand `9083d16` plus lokaler Draft-Reuse-Fix)
**Grenzen:** Keine RIS-/AWS-/Cognito-Änderung, keine neue Persistenz, keine KI-/Apify-Aufrufe, kein Deployment.

## 1. Umgesetzte Bearbeitungsfelder

Die Detailansicht hat jetzt die Aktion **„Bewerbungsdaten bearbeiten“**.
Das Formular ist direkt in die Detailansicht eingebettet.

Bearbeitbar sind:

- Bewerbungsweg (`applicationChannel`)
- Bewerbungsdatum (`applicationDate`)
- Ansprechpartner-Name (`contact.name`)
- Ansprechpartner-E-Mail (`contact.email`)
- Ansprechpartner-Telefon (`contact.phone`)
- Persönliche Notizen (`notes`)
- Gehaltsvorstellung (`salary.expectation`)
- Angebotenes Gehalt (`salary.offer`)

Aktionen:

- Bearbeiten
- Änderungen speichern
- Abbrechen

Beim Abbrechen bleibt der bestehende Datensatz unverändert.

## 2. Repository- und Update-Vertrag

Alle Änderungen laufen ausschließlich über:

```text
applicationRepository.update(localId, {
  expectedVersion,
  changes,
  signal,
})
```

Erhalten bleiben:

- `expectedVersion` und Versionskonfliktbehandlung
- `AbortSignal`
- Session-Generation/`invalidate()`
- Schutz vor verspäteten Operationen
- `busy`-Schutz gegen Doppelklick
- Session-Isolation

### Löschsemantik

Für optionale Felder wurde eine explizite Löschsemantik ergänzt:

- `applicationChannel: null` entfernt den Bewerbungsweg.
- `applicationDate: null` entfernt das Bewerbungsdatum.
- `contact: null` entfernt den gesamten Ansprechpartner.
- `notes: ""` entfernt die persönlichen Notizen.
- `salary: null` entfernt beide Gehaltswerte.
- `salary: { expectation: null, offer: null }` entfernt beide unabhängig.
- `salary: { expectation: null }` entfernt nur die Gehaltsvorstellung.
- `cvReference: null` entfernt die CV-Referenz.

`undefined` bedeutet weiterhin „nicht aktualisieren“. Leere Strings oder
Dummy-Werte werden nicht als Ersatz für das Löschen verwendet.

## 3. Validierung

- E-Mail: Formatprüfung nur bei nichtleerem Wert.
- Telefon: keine Steuerzeichen; Länge max. 500.
- Name/E-Mail/Telefon: vorhandene Feldlängen werden eingehalten.
- Datum: gültiges ISO-Datum; Eingabe wird als UTC-Mitternacht gespeichert, um
  Tagesverschiebungen durch Zeitzonen zu verhindern.
- Gehalt: positiver, endlicher Betrag; ISO-4217-Dreizeichencode; Periode
  `year`/`month`/`hour`.
- Leeres Gehaltsfeld erzeugt keinen künstlichen Betrag `0`.
- Notizen: bestehendes Limit 10.000 Zeichen.
- Ungültige Eingaben bleiben im Formular erhalten und werden als Fehler
  angezeigt.

Das Bearbeiten des Bewerbungsdatums ändert den Status nicht. Ein Entwurf
bleibt Entwurf; `submitted` entsteht weiterhin nur über die ausdrückliche
Versandbestätigung.

## 4. Session-Isolation und Fehler

- Bei `version_conflict`: Formular bleibt offen, Eingaben bleiben erhalten,
  verständliche Meldung.
- Bei `session_ended`: Formular wird beendet; keine weitere Mutation.
- Bei Repository-/Benutzerwechsel wird ein offenes Formular zurückgesetzt.
- Doppelklick auf Speichern löst keine zweite Mutation aus.
- Globaler Status, Verlauf, Anschreiben-Versionen, CV-Referenzen, Export und
  Löschen bleiben unverändert.

## 5. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationsSection | **18 passed** |
| Session-Repository | **14 passed** |
| Gesamtsuite | **1201 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| E2E Applications Desktop 1440 | PASS |
| E2E Applications Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Echte KI-/Apify-/Provider-Aufrufe | keine |

Der E2E-Test öffnet das neue Formular, befüllt Bewerbungsweg, Datum,
Ansprechpartner, Notizen und beide Gehaltswerte, speichert und prüft die
aktualisierte Detailansicht auf Desktop und Mobil.

## 6. Screenshots

- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04A/desktop-1440-edit.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04A/desktop-1440-updated.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04A/mobile-390-edit.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04A/mobile-390-updated.png`

## 7. Git

- Implementierungscommit: `65e314a`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-management-ux-04a`
- Kein Push, kein Merge, kein Deployment.

## 8. Offene Punkte

- Keine serverseitige Persistenz/RIS-Anbindung (bewusst außerhalb des Scopes).
- Live-Verifikation nach Deployment bleibt offen.
- Die umfassende Layout-Modernisierung bleibt UX-04B vorbehalten.
