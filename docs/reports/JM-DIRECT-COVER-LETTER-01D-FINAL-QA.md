# JM-DIRECT-COVER-LETTER-01D — FINAL QA & MERGE READINESS

**Art:** Abschluss-QA / Integration / Regression / Merge-Readiness
**Status:** **READY FOR MAIN MERGE REVIEW**; **PRODUCTION: BLOCKED**
**Datum:** 2026-11-04
**Branch:** `feature/jm-direct-cover-letter-01c`
**Basis:** Phase C `b229bf3`; lokaler `main` `7a4a64e`; `origin/main` `4364eab`

> Kein Merge, kein Deployment, keine RIS-/AWS-/Cognito-/Provider-Änderung.
> Es wurden keine echten KI-/Apify-/RIS-Aufrufe ausgeführt.

## 1. Executive Summary

Die direkte Anschreibenerstellung aus einer manuellen Stellenanzeige ist
lokal vollständig integriert und QA-geprüft:

- manuelle Stelle mit und ohne URL,
- bestehende KI-Pipeline und bestehendes `LetterModal`,
- explizite Adoption für authentifizierte Benutzer,
- Erstellung und Aktualisierung derselben Bewerbung,
- erste und weitere `CoverLetterVersionV1`,
- Refresh der Bewerbungsliste ohne Seitenneuladung,
- gezielte Navigation zu Übersicht und Dokumenten,
- Gastmodus ohne Adoption.

Im QA-Gate wurden zwei reale Defekte gefunden und korrigiert:

1. Der Adoptionsbutton lag unter 44 px Touch-Höhe.
2. Die neutralen Titel-/Firmen-Fallbacks waren in der englischen UI deutsch.

Nach Korrektur: Gesamtsuite **1378 passed / 5 skipped**, Build PASS, alle
relevanten E2E-Suiten PASS.

## 2. Git-Baseline

| Prüfung | Ergebnis |
|---|---|
| Branch | `feature/jm-direct-cover-letter-01c` |
| HEAD vor QA | `b229bf3` |
| HEAD nach QA-Korrekturen | `38a6238` |
| Working Tree vor QA | clean |
| `main` | `7a4a64e` |
| `origin/main` | `4364eab` |
| Remote-Feature-Branch vor QA | `b229bf3` |
| Merge-Basis zu `main` | `7a4a64e` |
| Divergenz `main...HEAD` | 0 behind; `main` ist Ancestor |
| `main` Ancestor von HEAD | ja |
| Konfliktprognose | keine; Fast-Forward möglich |

Die QA-Korrekturen sind lokal committed. Kein Push nach Phase D.

## 3. Phase-A–C-Konsolidierung

Verifizierte Reports:

- `docs/reports/JM-DIRECT-COVER-LETTER-01A.md`
- `docs/reports/JM-DIRECT-COVER-LETTER-01B.md`
- `docs/reports/JM-DIRECT-COVER-LETTER-01C.md`

Die Phase-C-Aussagen zu Adoption, Versionierung, Refresh, Navigation und
Session-Schutz wurden gegen Code und Tests geprüft. Die bekannten
Einschränkungen bleiben bestehen und werden nicht als behoben dargestellt.

## 4. Authentifizierter E2E-Ablauf

Geprüft bei 1440, 1024, 768, 430, 390 und 320 px:

1. `/profil?tab=applications`
2. „+ Neue Bewerbung“
3. Stellenbeschreibung einfügen
4. optional Titel/Unternehmen/Standort/URL
5. Anschreiben-Assistent öffnen
6. explizit generieren
7. bearbeiten
8. „Als Bewerbungsentwurf übernehmen“
9. Erfolgsstatus
10. „Dokumente öffnen“
11. Anschreibenversion im Dokumenten-Tab
12. zweite explizite Adoption derselben Stelle
13. Versionshistorie wächst, keine zweite Bewerbung

Ergebnis: PASS für alle sechs authentifizierten Viewports.

Zusätzlich geprüft:

- manuelle Stelle mit URL,
- manuelle Stelle ohne URL,
- genau eine Bewerbung nach zwei Adoptionen,
- Version 1 und Version 2 sichtbar,
- Dokumenten-Tab nach Adoption aktiv,
- kein vollständiger Reload erforderlich.

## 5. Gast-E2E-Ablauf

Geprüft bei 1024, 768, 430, 390 und 320 px:

- manuelle Stelle einfügen,
- Anschreiben-Assistent öffnen,
- generieren,
- bearbeiten,
- Kopieren/Download über bestehende Tests,
- keine Adoptionsaktion,
- keine Bewerbung im Repository,
- Gast-Handoff bleibt sichtbar.

Ergebnis: PASS.

## 6. Versionierungssemantik

| Wert | Bedeutung |
|---|---|
| `generated` | KI-generiert |
| `revised` | KI-überarbeitet |
| `manual` | manuell bearbeitet |

Gespeichert werden zusätzlich:

- Sprache `de`/`en`,
- aktives Modell,
- `jobId`, `versionId`, `createdAt`.

Mutationsgrenze:

- Einfügen, Öffnen, Modellwahl, Sprache, Generieren, Bearbeiten und Vorschau
  erzeugen keine Version.
- Erst die ausdrückliche Adoption schreibt Draft und Version.
- Neue Bewerbung: erste Version im selben Create-Vorgang.
- Bestehende Bewerbung: neue Version wird angehängt, alte bleiben erhalten.

## 7. Idempotenz- und Konfliktverhalten

Geprüft:

- `expectedVersion`,
- `adoptingRef`,
- deaktivierter Adoptionsbutton nach Erfolg,
- Idempotency-Key `adopt:<jobId>`,
- idempotency-conflict-Recovery,
- doppelte Version-ID,
- fremde `jobId`,
- veraltete Version,
- erneute Adoption.

Ergebnis: PASS innerhalb der unterstützten Session.

**Bekannte Grenze:** Exactly-once über mehrere Tabs, Browser oder Clients ist
mit dem In-Memory-Session-Repository nicht garantiert. Diese Einschränkung
bleibt bestehen; es wurde keine Cross-Client-Persistenz ergänzt.

## 8. Session-/Auth-Sicherheit

Geprüft:

- Session-Epoch im Adoptionspfad,
- Repository-Invalidierung,
- `session_ended` nach `invalidate()`,
- keine Datenübernahme in ein neues Repository,
- verspätete Antworten werden verworfen,
- Gäste erhalten keine Adoptionsaktion.

Repository-Test ergänzt:

- `adoptCoverLetter` nach Session-Invalidierung → `session_ended`.

Ein vollständiger E2E-Auth-Wechsel mitten in einer laufenden Adoption wurde
nicht simuliert. Der Code schützt über `sessionEpochRef`, invalidiertes
Repository und `session_ended`; das verbleibende Restrisiko wird dokumentiert.

## 9. Stellenkontext

Aktuelle Semantik:

- manuelle Beschreibung ist session-lokal,
- `manualJobSession` ist speicherintern,
- Reload kann die Beschreibung verlieren,
- keine dauerhafte Speicherung,
- keine erfundene Rekonstruktion.

Bekannte Folgearbeiten bleiben:

- „Als Entwurf anlegen“,
- sicherer Wiedereinstieg in denselben manuellen Stellenkontext,
- dauerhafte Beschreibungspersistenz,
- persistierter Verbesserungskontext,
- RIS-Handoff mit `jobOrigin: "manual"` und optionaler URL.

## 10. Responsive-Abnahme

| Breite | Auth | Gast |
|---|---|---|
| 1440 | PASS | optional |
| 1024 | PASS | PASS |
| 768 | PASS | PASS |
| 430 | PASS | PASS |
| 390 | PASS | PASS |
| 320 | PASS | PASS |

Geprüft:

- kein horizontaler Overflow,
- Formular und Dialog vollständig erreichbar,
- Adoptionsbutton ≥ 44 px,
- Dokumenten-Tab erreichbar,
- Bewerbungsliste und Detailansicht nutzbar,
- keine überdeckten Bedienelemente,
- stabile Scroll-/Fokuspfade.

## 11. Accessibility

Geprüft:

- Formularfelder mit Labels,
- Fokus im Beschreibungstextfeld beim Öffnen,
- Dialog-Semantik,
- Fokus auf Erfolgsstatus nach Adoption,
- Escape/Fokusführung über bestehende `LetterModal`-Tests,
- Disabled-/Busy-Zustände,
- Tastaturbedienbare Tabs und Aktionen,
- Adoption success status is announced/focused,
- Touch-Ziel des Adoptionsbuttons.

Kein separates automatisiertes Axe-Audit ausgeführt; die Prüfung stützt sich
auf bestehende Unit-/E2E-Tests und die neuen Browser-Checks.

## 12. Regression und Build

### Gesamtsuite

```text
npm test -- --run --maxWorkers=2
```

- **1378 passed**
- **5 skipped**
- **132 Testdateien passed, 3 skipped**

### Build / Syntax

- `npm run build` — PASS
- `node --check api/cover-letter.mjs` — PASS
- `node --check tests/e2e/direct-cover-letter.mjs` — PASS
- `git diff --check` — PASS

### E2E

- Direct-Cover-Letter: 11 Viewports (6 Auth, 5 Gast) — PASS
- Applications — PASS
- Cover Letter — PASS
- CV Builder — PASS
- Search Results — PASS
- Mobile Navigation — PASS

Keine Console-Errors; keine echten Provider-/KI-/AWS-/RIS-/Apify-Aufrufe.

Screenshots:
`docs/reports/assets/JM-DIRECT-COVER-LETTER-01D/` — 40 Dateien.

Fremde Screenshot-Änderungen aus bestehenden E2E-Skripten wurden vor dem
Commit zurückgesetzt.

## 13. Gefundene Defekte

| ID | Befund | Schwere | Korrektur |
|---|---|---|---|
| D-QA-01 | Adoptionsbutton < 44 px Touch-Höhe | Accessibility/Responsive | CSS-Mindesthöhe für Adoptions-/Handoff-Buttons |
| D-QA-02 | Englische UI zeigte deutsche Fallbacks „Initiativbewerbung“ / „Unternehmen nicht angegeben“ | UX/Konsistenz | lokalisierte Fallbacks in `manualJob`/`NewApplicationForm` |

Keine weiteren Produktdefekte wurden in Phase D festgestellt.

## 14. Korrekturen mit Commit-Zuordnung

| Commit | Inhalt |
|---|---|
| `34ee0fa` | Touch-Ziel des Adoptionsbuttons, lokalisierte Fallbacks, Session-Invalidierungstest |
| `38a6238` | erweiterte Direct-Cover-Letter-QA-Matrix für Auth-Mobile und zweite Adoption |
| Dokumentationscommit | Report, Auditlog, Phase-D-Screenshots |

## 15. Noch offene Findings

1. Exactly-once über mehrere Tabs/Clients bleibt außerhalb der
   In-Memory-Semantik.
2. Manuelle Stellenbeschreibung bleibt session-lokal; Reload kann sie
   verlieren.
3. Verbesserungspfad aus der Bewerbungsverwaltung hat keinen persistierten
   Stellenkontext.
4. „Als Entwurf anlegen“ bleibt separates Arbeitspaket.
5. RIS-Backend muss `jobOrigin: "manual"` und optionale `originalUrl`
   akzeptieren.
6. Gastbereich der ApplicationsSection bleibt eine Produktentscheidung.
7. Kein Live-Provider-/RIS-/AWS-Test.

## 16. RIS-Handoff-Abhängigkeiten

Die Jobsearch-Seite ist auf folgende Serverannahmen vorbereitet:

- `ApplicationJobReferenceV1.jobOrigin` optional `"source" | "manual"`,
- `originalUrl` optional für manuelle Stellen,
- `source: ["manual"]`,
- stabile `manual:<opaque>`-ID,
- Versionierung über bestehende `CoverLetterVersionV1`.

Die RIS-Seite muss diese Felder akzeptieren, ohne eine erfundene externe
Job-ID oder URL zu verlangen. Das bleibt ein separater Backend-Handoff.

## 17. Merge-Readiness

- Merge-Basis: `7a4a64e`.
- `main` ist Ancestor von `feature/jm-direct-cover-letter-01c`.
- 0 behind; `main` ist Ancestor.
- Keine Konfliktprognose; Fast-Forward möglich.
- Änderungsumfang: 40 Nicht-Asset-Dateien, 3640 Insertions / 106 Deletions.
- Keine Änderungen an `main`, RIS, AWS, Cognito, CloudFront, DNS oder
  Deployment-Konfiguration.
- Testabdeckung: vollständige Suite plus 11-Viewport-Direct-Cover-Letter-E2E
  und bestehende E2E-Suiten.

**MAIN MERGE: READY FOR REVIEW.**
Kein Merge wurde ausgeführt.

## 18. Produktionsstatus

**PRODUCTION: BLOCKED.**

Gründe:

- finale rechtliche/Privacy-Freigabe für dauerhafte Speicherung fehlt,
- RIS-Persistenz und Auth-Handoff nicht aktiviert,
- kein Deployment,
- keine Live-Provider-Verifikation,
- bekannte session-lokale Kontextverluste.

## 19. Abschlussentscheidung

**JM-DIRECT-COVER-LETTER-01D: READY.**

**MAIN MERGE: READY FOR REVIEW.**

**PRODUCTION: BLOCKED.**

**STOP — READY FOR MAIN MERGE REVIEW. Kein automatischer Merge, kein
Deployment, keine RIS-Backend-Integration, keine AWS-/Cognito-Änderung.**
