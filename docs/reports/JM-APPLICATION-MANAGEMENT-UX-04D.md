# JM-APPLICATION-MANAGEMENT-UX-04D

**Art:** Bewerbungsverwaltung / Wiedervorlagen / Nachfassplanung
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-02
**Branch:** `feature/jm-application-management-ux-04d`
**Ausgangsstand:** UX-04C @ `6f2f66d`
**Grenzen:** Keine neue Persistenz, keine RIS-/AWS-/Cognito-/KI-/Apify-Aufrufe, kein Deployment.

## 1. Datenmodell

`ApplicationFollowUpV1` ergänzt `ApplicationV1` und `SessionApplicationV1`
optional:

```typescript
interface ApplicationFollowUpV1 {
  dueOn: string;              // Kalenderdatum YYYY-MM-DD
  note?: string;              // Grund / geplante Aktion, max. 2000 Zeichen
  status: "open" | "completed";
  completedAt?: string;       // erforderlich bei completed
}
```

- `followUp` ist unabhängig vom Bewerbungsstatus.
- Eine Bewerbung ohne Wiedervorlage bleibt gültig.
- `completed` erfordert `completedAt`; `open` darf kein `completedAt` haben.
- Entfernen geschieht über `followUp: null` in der Session-Update-Semantik.
- Keine leeren Dummy-Objekte werden gespeichert.

## 2. Kalendersemantik

- `dueOn` ist ein reines `YYYY-MM-DD`-Kalenderdatum, kein UTC-Zeitpunkt.
- Die lokale Kalenderdate wird über lokale Jahr-/Monat-/Tag-Werte gebildet.
- Überfällig: `dueOn` liegt vor dem lokalen heutigen Kalenderdatum und
  `status === "open"`.
- Heute: gleiches lokales Kalenderdatum und offen.
- Erledigt: unabhängig vom Datum nicht überfällig.
- Keine Timer/Hintergrundprozesse; Berechnung bei Render/Öffnen.

## 3. Repository-Operationen

Es wurden **keine neuen Repository-Methoden** eingeführt. Alle Änderungen laufen
über:

```text
applicationRepository.update(localId, {
  expectedVersion,
  changes: { followUp },
  signal,
})
```

Erhalten:

- `expectedVersion` und Versionskonflikte
- `AbortSignal`
- Session-Generation/`invalidate()`
- Stale-Operation-Schutz
- `busy`-/Doppelaktionsschutz
- Fehleranzeige und Session-Isolation

## 4. UI-Integration

### Übersicht

- Kompakte Anzeige „Nächste Wiedervorlage: TT.MM.JJJJ“.
- Status-/Fälligkeitszustände:
  - geplant
  - heute fällig
  - überfällig
  - erledigt
- Optionale Notiz wird angezeigt.
- Keine Änderung an Statusverwaltung oder Bewerbungsstatus.

### Kommunikation

Neuer Bereich **Wiedervorlage & Nachfassen** mit:

- Wiedervorlagedatum
- Grund / geplante Aktion
- Wiedervorlage speichern/bearbeiten
- Als erledigt markieren
- Erneut öffnen
- Entfernen

Der Bewerbungsstatus bleibt bei allen Follow-up-Aktionen unverändert. Es wird
kein Verlaufseintrag automatisch erzeugt.

### Bewerbungsübersicht

- Offene Wiedervorlagen erhalten eine kompakte Kennzeichnung:
  - geplante Wiedervorlage
  - „Heute nachfassen“
  - „N Tage überfällig“
- Überfälligkeit ist textlich und nicht ausschließlich farblich markiert.
- Filter- und Sortierlogik bleiben unverändert.

## 5. Vertrag und Export

Aktualisiert:

- `src/lib/applications/contractTypes.ts`
- `src/lib/applications/applicationValidation.ts`
- `src/lib/applications/sessionApplications.ts`
- `docs/contracts/schemas/JOBMATCHER-APPLICATION-V1.schema.json`
- `docs/contracts/JOBMATCHER-APPLICATION-MANAGEMENT-V1.md`
- `docs/contracts/MAYS-RIS-APPLICATION-PERSISTENCE-HANDOFF-V1.md`
- Fixtures:
  - `application.follow-up.json`
  - `application.update-follow-up.json`

Der lokale Export enthält `followUp`, da er den vorhandenen
`SessionApplicationV1`-Datensatz exportiert. Es wird keine RIS-Route
implementiert oder aufgerufen.

Schema-Prüfung mit Python `jsonschema` und FormatChecker:

- gültige Follow-up-Application: PASS
- gültiger Follow-up-Update-Input: PASS
- `completed` ohne `completedAt`: korrekt abgelehnt

## 6. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationsSection | **27 passed** |
| Session-Repository | **16 passed** |
| Application-Domain | **13 passed** |
| Gesamtsuite (`npm test -- --run`) | **1213 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| E2E Applications Desktop 1440 | PASS |
| E2E Applications Mobil 390 | PASS |
| Navigation-BBox | PASS |
| E2E Console-Errors | keine |
| Echte KI-/RIS-/Apify-Aufrufe | keine |

Abgedeckt u. a.:

- Erstellen und Bearbeiten
- Entfernen ohne Dummy-Wert
- Heute/überfällig/zukünftig
- Erledigt/erneut öffnen
- Ungültiges Kalenderdatum
- Unveränderter Bewerbungsstatus
- Export mit Follow-up
- Session-/Versionsschutz über die bestehende Repository-Grenze

Der E2E-Test legt eine synthetische Wiedervorlage an und prüft Anzeige in
Kommunikation, Übersicht und Bewerbungsliste auf Desktop und Mobil.

## 7. Screenshots

- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04D/desktop-1440-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04D/desktop-1440-communication.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04D/mobile-390-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-UX-04D/mobile-390-communication.png`

## 8. Git

- Implementierungscommit: `1d1eccd`
- Dokumentationscommit: dieser Commit
- Branch: `feature/jm-application-management-ux-04d`
- `main` bleibt `b897259`
- UX-04A/04B/04C/04D sind nicht in `main` gemerged
- Kein Push, kein Merge, kein Deployment

## 9. Offene Punkte

- Live-Verifikation nach Deployment.
- Keine automatischen Erinnerungen/E-Mails/Hintergrundprozesse (bewusst).
- RIS-Persistenz und produktiver Follow-up-Adapter bleiben offen.
- UX-04E nicht vorweggenommen.
