# JM-PROFILE-STORAGE-CONSENT-01

**Art:** Datenschutz & Datenspeicherung / Einwilligungsvorbereitung für registrierte Benutzer
**Status:** READY für lokale Main-Integration — **AKTIVE CONSENT-PERSISTENZ: BLOCKED**
**Datum:** 2026-11-04
**Branch:** `feature/jm-profile-storage-consent-01`
**Baseline:** lokaler `main` `fb55198`; `origin/main` `4364eab`

## 1. Git-Ausgangspunkt

- lokaler `main`: `fb55198`
- `origin/main`: `4364eab`
- neuer Branch: `feature/jm-profile-storage-consent-01`
- Arbeitsbaum vor Beginn: clean
- keine bestehenden Feature-Branches verändert

## 2. Bestandsaufnahme

Vorhanden:

- Cognito/OIDC-Anmeldung über `react-oidc-context`,
- `deriveAuthProfileKey` mit verifizierter Identität aus `iss + sub`,
- E-Mail wird ausdrücklich nicht als Identitätsersatz verwendet,
- Profilverwaltung über `DashboardV2` / `DashboardV2AuthenticatedPreview`,
- sessionbezogene Bewerbungs-, CV- und Suchprofil-Repositories,
- bestehende KI-Consent-Gates für CV-/ATS-/Anschreiben-Verarbeitung,
- RIS-/ApplicationV1-Handoffs und Session-Isolation.

Nicht vorhanden:

- kein serverseitiger Consent-Dienst,
- keine persistente Consent-API,
- keine produktive RIS-Speicherintegration,
- keine freigegebene Retention-/Erasure-Implementierung für diese Daten.

Die neue UI ist deshalb ausdrücklich **Vorbereitung**, nicht produktive
Einwilligungserfassung.

## 3. Consent-Datenvertrag

Neu: `src/lib/storageConsent.ts`

- `schemaVersion: 1`
- Zwecke:
  - `cv_storage`
  - `application_storage`
  - `search_profile_storage`
- Zustände:
  - `not_requested`
  - `granted`
  - `declined`
  - `withdrawn`
  - `reconsent_required`
- Owner ausschließlich aus verifiziertem `iss + sub` (`deriveStorageConsentOwner`).
- E-Mail ist kein Identitätsersatz.
- Audit-Ereignisse dürfen keine CV-/Anschreibeninhalte enthalten.
- Zeitstempel sind als serverseitig autoritativ dokumentiert.
- `STORAGE_CONSENT_BACKEND_AVAILABLE = false`.
- Text-/Datenschutzhinweisversionen sind separat versioniert.

Der Vertrag ist client-safe und persistiert nichts.

## 4. Profilbereich

Der bestehende Einstellungen-Tab wurde aktiviert und zeigt
**„Datenschutz & Datenspeicherung“**. Zusätzlich erscheint auf der
Profilübersicht ein sichtbarer Vorbereitungshinweis mit direktem Einstieg in
diesen Bereich, damit die Information beim ersten Profilbesuch nicht verborgen
bleibt.

Enthalten:

- eindeutiger Vorbereitungsstatus,
- Hinweis:
  **„Die dauerhafte Speicherung deiner Bewerbungsunterlagen wird vorbereitet und ist derzeit noch nicht verfügbar.“**
- Identitätsstatus (verifiziert/nicht verifiziert),
- drei unabhängige Speicherkategorien,
- Status „Nicht freigegeben“ je Zweck,
- Trennung von:
  - erforderlichen Kontodaten,
  - optionaler Speicherung,
  - externer KI-Verarbeitung,
  - sitzungsbezogenen Browser-Daten,
  - geplanter RIS-Speicherung,
- Widerrufs-/Export-/Löschhinweise,
- Links zu Datenschutz und Datenschutzprinzipien,
- vorbereitete, deaktivierte Aktionen:
  - Speicherfreigaben anzeigen
  - Gespeicherte Daten exportieren
  - Löschung beantragen
  - Einwilligung widerrufen

Es gibt **keine aktive Einwilligungscheckbox**. Eine lokale Zustimmung wird nicht
als dauerhaft gültig dargestellt.

## 5. Auth- und Session-Isolation

- `DashboardV2AuthenticatedPreview` leitet den Identitätsstatus nur aus
  verifizierten OIDC-Claims ab.
- Gäste sehen keine Speicherfreigabe.
- Demo-/nicht verifizierte Kontexte zeigen keinen verifizierten Consent-Status.
- Keine Consent-Übernahme zwischen Benutzern.
- Keine neue Persistenz, keine Migration von Gastdaten.
- Keine Änderung an `expectedVersion`, Request-Sequence, Session-Generation oder
  bestehenden KI-Consent-Grenzen.

## 6. Backend-Abhängigkeiten

Für eine produktive Aktivierung müssen mindestens verfügbar und geprüft sein:

1. serverseitiger Consent-Dienst,
2. Identitätsableitung aus verifiziertem `iss + sub`,
3. freigegebene Consent-/Privacy-Textversionen,
4. serverseitige Speicherung und manipulationsgeschützte Auditnachweise,
5. server-issued Zeitstempel,
6. Widerruf,
7. Retention-/Löschverfahren,
8. RIS-Inspect-/Export-/Erasure-Fähigkeiten.

Details: `docs/contracts/JM-RIS-STORAGE-CONSENT-HANDOFF-V1.md`.

## 7. Rechtsgrundlagen-Prüfbedarf

Für jeden Zweck sind separat zu prüfen und freizugeben:

- Zweck und Datenkategorien,
- Rechtsgrundlage,
- Erforderlichkeit für die Kontofunktion,
- Freiwilligkeit,
- Empfänger/Processor,
- Speicherort und Transfergrundlagen,
- Aufbewahrungsdauer,
- Widerrufsfolgen,
- Löschverfahren,
- Betroffenenrechte,
- endgültige Textfassung.

Diese Implementierung ersetzt keine Datenschutz-/Rechtsfreigabe.

## 8. Tests

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite `npm test -- --run --maxWorkers=2` | **1337 passed, 5 skipped** |
| Testdateien | 125 passed, 3 skipped |
| Storage-Consent-Vertrag | **4 passed** |
| Storage-Consent-UI | **4 passed** |
| DashboardV2/Auth-Preview | **15 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax | PASS |
| Profile-Storage-Consent-E2E Desktop 1440 | PASS |
| Profile-Storage-Consent-E2E Mobil 390 | PASS |
| Guest-Profil ohne Speicherfreigabe | PASS |
| Applications-E2E | PASS |
| Cover-Letter-E2E | PASS |
| Mobile-Navigation-E2E | PASS |
| CV-Builder-E2E | PASS |
| Search-Results-E2E | PASS |
| Console-Errors | keine |
| Echte Cognito-/RIS-/AWS-Mutationen | keine |
| Echte KI-/Provider-/Apify-Aufrufe | keine |

Gezielt geprüft:

- Owner nur aus `iss + sub`,
- E-Mail/fehlende Claims ergeben keinen Owner,
- unabhängige Zwecke,
- alle Consent-Zustände,
- Backend ausdrücklich nicht verfügbar,
- keine Checkbox,
- deaktivierte Datenkontrollen,
- DE/EN,
- verifizierter/nicht verifizierter Identitätsstatus,
- Gast ohne Consent-Bereich,
- responsive ohne Overflow.

## 9. Screenshots

Unter `docs/reports/assets/JM-PROFILE-STORAGE-CONSENT-01/`:

- `desktop-1440-profile-notice.png`
- `desktop-1440-privacy-storage.png`
- `mobile-390-profile-notice.png`
- `mobile-390-privacy-storage.png`

## 10. Offene Findings

- **AKTIVE CONSENT-PERSISTENZ: BLOCKED** — kein geprüfter Backend-Dienst.
- Keine dauerhafte Speicherung, keine RIS-Implementierung, keine neuen
  Backend-Endpunkte.
- Keine produktive Einwilligungserfassung und keine rechtliche Freigabe.
- Retention-/Erasure-Semantik ist als Handoff dokumentiert, nicht implementiert.
- Keine Änderung an bestehenden KI-Consent-Gates.
- **PRODUCTION: weiterhin BLOCKED.**

## 11. Git

- Implementierung: `eeade3f` — `feat: add storage consent preparation area`
- Profilhinweis: `59cbb64` — `feat: surface storage consent notice on profile`
- Responsive E2E: `54b1277` — `test: verify storage consent responsive widths`
- Dokumentation/Evidenz: dieser Commit
- Branch: `feature/jm-profile-storage-consent-01`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 12. Abschlussentscheidung

**PROFILE-STORAGE-CONSENT-01: READY für lokale Main-Integration (Vorbereitung).**

**AKTIVE CONSENT-PERSISTENZ: BLOCKED, solange kein geprüfter Backend-Dienst
vorhanden ist.**

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Keine produktive Einwilligungserfassung ohne Backend-Nachweis.
Keine RIS-Implementierung. Keine dauerhafte Datenspeicherung. Kein Push, Merge
oder Deployment.**
