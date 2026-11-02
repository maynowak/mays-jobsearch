# JM-APPLICATION-MANAGEMENT-02

**Art:** Bewerbungsverwaltung / Dashboard / Session-only MVP
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — Session-only, kein Deployment
**Datum:** 2026-11-02
**Baseline:** `main` @ `c402014`, `origin/main` synchron
**Grenzen:** Keine Backend-/RIS-/AWS-/Cognito-Persistenz, keine KI-/Apify-Aufrufe, kein Deployment.

## 1. Executive Summary

„Meine Bewerbungen“ ist im bestehenden Dashboard aktiv und als
**Session-only-MVP** nutzbar. Die APP-01-Domain- und Validierungsregeln werden
verwendet; für die lokale Vorschau existiert bewusst **kein** `ApplicationV1`
mit gefälschter Server-ID oder Eigentümeridentität.

Die Daten liegen ausschließlich im React-Speicher der aktuellen Sitzung. Beim
Reload gehen sie verloren; die UI weist ausdrücklich darauf hin.

## 2. Implementierte UI

### Dashboard

- `DashboardV2` hat den optionalen `applicationsSection`-Prop.
- Der Menüpunkt „Bewerbungen“ ist aktiv, sobald die Section vorhanden ist.
- `DashboardV2AuthenticatedPreview` reicht die Section an das Dashboard weiter.
- Die bestehende responsive Navigation und die übrigen Dashboard-Bereiche
  bleiben unverändert.

### `ApplicationsSection`

- Übersicht mit Titel, Arbeitgeber, Status, Erstellungsdatum.
- Statusfilter.
- Datumssortierung (neueste/älteste).
- Auswahl einer Bewerbung.
- Detailansicht mit:
  - Stelle, Quelle, Stellenreferenz, Originalanzeige
  - Bewerbungsdatum/-weg, Ansprechpartner, Notizen
  - Gehaltsvorstellung und optionales Angebot
  - Anschreiben-Entwurf, Versionen, CV-Referenz, Dokumentenstatus
  - Statusverwaltung
  - Verlauf aus StatusHistory und History
- Leerer Zustand und Sitzungshinweis.
- Desktop- und Mobil-Layout.
- Export als klar gekennzeichneter lokaler JSON-Entwurf.
- Löschen nur nach Bestätigung.

## 3. Session-Datenmodell

`src/lib/applications/sessionApplications.ts`:

```typescript
interface SessionApplicationV1 {
  schemaVersion: 1;
  localId: string; // only UI/session identity
  job: ApplicationJobReferenceV1;
  documents: ApplicationDocumentsV1;
  ...
  status: ApplicationStatus;
  statusHistory: ApplicationStatusHistoryEntryV1[];
  history: ApplicationHistoryEntryV1[];
  version: number;
}
```

Wichtig:

- Kein `applicationId`.
- Kein `ownerId`.
- Keine Serveridentität.
- Keine Speicherung in `localStorage`, `sessionStorage`, IndexedDB, Redis oder Backend.
- `localId` dient ausschließlich der UI-Zuordnung.
- Export enthält `localDraft: true` und einen klaren Hinweis.

Die APP-01-Domainfunktionen bleiben die Referenz für Statusübergänge und
Validierung. Für die lokale Vorschau wird ein getrennter Session-Zustand
verwendet, damit der Browser keine Serverressource vortäuscht.

## 4. Anschreiben-Assistent

`LetterModal` hat eine optionale, ausdrückliche Aktion:

**„Als Bewerbungsentwurf übernehmen“**

- Nur nach vorhandenem Anschreiben sichtbar.
- Der aktuell bearbeitete Text wird übernommen.
- Die Stellenreferenz der geöffneten Stelle bleibt erhalten.
- Die ausgewählte CV-Referenz wird nur als `cvId`/Label übergeben.
- Kein neuer KI-Aufruf.
- Keine Statusänderung.
- Keine automatische Versionierung.
- Existiert bereits ein Entwurf für dieselbe Stelle, ist die Aktion deaktiviert
  und der bestehende Entwurf wird nicht überschrieben.

„Aktuellen Entwurf als Version speichern“ in der Detailansicht ist eine
separate ausdrückliche Aktion.

## 5. Statusverwaltung

Verwendet die APP-01-Übergänge:

```text
draft -> submitted
submitted -> feedback | interview | rejected | withdrawn
feedback -> interview | offer | rejected | withdrawn
interview -> offer | rejected | withdrawn
offer -> withdrawn
rejected / withdrawn -> terminal
```

- „Beworben / Antwort ausstehend“ zeigt zuerst:
  **„Hast du diese Bewerbung tatsächlich abgeschickt?“**
- Erst „Ja, als versendet markieren“ setzt `submitted`.
- Eine Notiz oder ein Dokument ändert den Status nicht automatisch.
- Ungültige Übergänge werden von der Domain-Schicht abgelehnt.

## 6. Authentifizierung, Isolation und Datenschutz

- Bewerbungen werden nur im Profil-/Dashboard-Kontext angeboten.
- Der Übernahme-Callback wird nur für authentifizierte Nutzer bereitgestellt.
- Bei Logout/Benutzerwechsel setzt der bestehende Auth-Effekt in `App.tsx`
  `sessionApplications` auf leer zurück.
- `ownerId` wird nicht im Browser erzeugt; es gibt keine gefälschte Identität.
- Keine E-Mail-basierte Identität.
- Keine externen KI- oder Apify-Aufrufe.
- Keine Bewerbungsinhalte in Logs.
- Beim Verlassen/Reload warnt `beforeunload`, solange Session-Bewerbungen
  vorhanden sind.
- Beim Reload werden keine Bewerbungen wiederhergestellt; der E2E prüft den
  leeren Zustand nach Reload.

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| ApplicationsSection | **8 passed** |
| Session-Applications | **5 passed** |
| LetterModal (inkl. Übernahme/CV-Referenz) | **45 passed** |
| DashboardV2 | **10 passed** |
| Gesamtsuite | **1173 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Browser-E2E Desktop 1440 | PASS |
| Browser-E2E Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Reload-Leerzustand | PASS |

Abgedeckt:

- Navigation und Übersicht
- Filter/Sortierung
- Details
- Entwurfserstellung aus Anschreiben
- CV-Referenz
- ausdrückliche Submit-Bestätigung
- Statuswechsel/ungültige Übergänge (Domain)
- Feedback, Interview, Notiz
- Anschreiben-Version
- Export
- Löschen mit Bestätigung
- Session-only/Reload
- Gastmodus unverändert
- Keine Backend-/KI-/Apify-Aufrufe

## 8. Screenshots

- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-02/desktop-1440-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-02/desktop-1440-detail.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-02/mobile-390-overview.png`
- `docs/reports/assets/JM-APPLICATION-MANAGEMENT-02/mobile-390-detail.png`

## 9. Offene Punkte

1. RIS-/Backend-Persistenz ist nicht implementiert.
2. Echte serverseitige `ApplicationV1`-Erstellung mit verifizierter `iss + sub`-
   Identität und Server-IDs fehlt weiterhin.
3. Export ist lokaler Entwurf, keine serverbestätigte Ressource.
4. Vollständige Browser-Auth-Matrix (echter Cognito-Login, Logout, Nutzerwechsel)
   ist nicht live verifiziert.
5. Aufbewahrung/Löschung/Rechtstexte bleiben APP-02-nachgelagert.
6. Mobile E2E startet am Seitenanfang; ein bereits gescrollter Navbar-Zustand
   bleibt ein separates Navbar-Thema.

## 10. RIS-Handoff

Ein späterer RIS-Adapter muss:

- `ownerId` aus dem verifizierten `iss + sub`-Kontext setzen,
- `applicationId`, `createdAt`, `updatedAt` und `version` server-seitig erzeugen,
- Ownership bei jedem Lesen/Schreiben/Löschen prüfen,
- Conditional Writes und `version_conflict` unterstützen,
- Export und Löschung autorisieren,
- Session-Daten nur nach ausdrücklicher, gepreviewter Übernahme migrieren.

## 11. Grenzen

- Kein Deployment.
- Keine neue Datenbank.
- Keine RIS-/AWS-/Cognito-Änderung.
- Keine echten KI- oder Apify-Aufrufe.
- Bestehende BA-, ATS-, CV- und Anschreiben-Funktionen bleiben unverändert.
EOF