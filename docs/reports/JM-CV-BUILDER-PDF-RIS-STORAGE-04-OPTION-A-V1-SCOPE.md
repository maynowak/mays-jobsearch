# JM-CV-BUILDER-PDF-RIS-STORAGE-04 — OPTION A — EXISTING CV-STORAGE V1

**Status:** `EXISTING V1 SCOPE DOCUMENTED — OPERATOR DECISION RECORDED — PRIVACY/LEGAL CONFIRMATION OPEN — PILOT E2E PREPARED (NOT EXECUTED)`

**Datum:** 2026-11-14
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-builder-pdf-ris-storage-04`
**Basis:** `feature/jm-cv-builder-pdf-ris-storage-01` @ `20f842a`
**Produkt-/Implementierungsstand:** `feature/jm-cv-builder-pdf-ris-storage-01` (PDF-Speichern im CV-Builder)

Kein Produktcode, keine RIS-/Terraform-/AWS-Operation, keine Änderung an
Consent-Text, Hash oder Notice, kein Live-E2E und kein Production-Deployment.

---

## 1. Entscheidung in Kurzform

Die Betreiberin hat entschieden, für den Use Case **„im CV-Builder erzeugte und
durch ausdrückliche Nutzeraktion in der bestehenden RIS-CV-Ablage gespeicherte
PDFs“** die bestehende `cv-storage`-Einwilligung **v1** weiterzuverwenden.

- **Keine v2** für diesen PDF-Snapshot-Use-Case.
- **Keine Änderung** an `cv-storage-consent-2026-11-08-v1`, ihrem SHA-256 oder
  der RIS-Notice `cv-storage/1.0`.
- **Keine automatische Freigabe** für echte Nutzer, Live-E2E oder Production.
- Die **formelle Privacy-/Legal-Bestätigung** der Wortlautauslegung steht
  weiterhin aus und wird ausdrücklich als offen gekennzeichnet.

Die Betreiberentscheidung ist eine Produkt-/Release-Entscheidung. Sie ersetzt
**keine** Privacy-/Legal-Freigabe.

---

## 2. Unveränderte v1-Invarianten

| Feld | Wert | Status |
|---|---|---|
| Purpose | `cv-storage` | unverändert |
| Jobsearch-Textversion | `cv-storage-consent-2026-11-08-v1` | unverändert |
| Jobsearch-SHA-256 | `2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036` | unverändert, lokal nachgerechnet |
| RIS-Notice | `cv-storage/1.0` | unverändert |
| Notice-State | `APPROVED` (limited beta pilot) | unverändert |
| `legalApprovalRef` | `JM-CV-STORAGE-V1-BETA-2026-11-08` | unverändert |
| Approval-Datum | `2026-11-08` | unverändert |
| Approval-Body | Betreiberin May's Job Matcher | unverändert |
| Privacy-Referenz | `/datenschutz`, Version 1.1, 2026-11-07 | unverändert |
| Pilot/Allowlist | bestehende Begrenzung | unverändert |

Verifikation: Die sechs Absätze aus `src/lib/cvStorageConsent.ts` wurden
eingelesen, mit `\n\n` verbunden und mit SHA-256 gehasht. Ergebnis:
`2fe65fd1…79d036` — identisch mit dem veröffentlichten Wert. Die Dateien
`src/lib/cvStorageConsent.ts`, `api/_lib/ris/cvConsentText.mjs` und
`api/_lib/ris/consentNotice.mjs` sind gegenüber `origin/main` unverändert.

---

## 3. Auslegung des v1-Wortlauts

### 3.1 Relevanter Wortlaut

Die v1-Einwilligung beschreibt:

> „… meinen **hochgeladenen** Lebenslauf als PDF-Datei sowie die zugehörigen
> Dokumentmetadaten … dauerhaft in meinem angemeldeten Konto speichert, damit
> ich ihn später abrufen, herunterladen, für Bewerbungen auswählen und löschen
> kann.“

Und für Art. 9:

> „… besondere Kategorien personenbezogener Daten, die in dem von mir
> **hochgeladenen** Lebenslauf enthalten sind …“

### 3.2 Tatsächlicher Datenfluss des Builder-Use-Cases

```text
Builder-Eingaben
  → lokale PDF-Erzeugung mit createCvBuilderPdf()
  → ausdrücklicher Klick „In RIS speichern“
  → File(..., application/pdf)
  → bestehende validateCvFile()
  → bestehende usePersistentCvStorage.upload()
  → bestehendes /api/ris/cvs
  → bestehende private RIS-Dokumentablage
  → bestehende Liste „Meine Lebensläufe“
```

Es werden **nur** das erzeugte PDF und die bestehenden Dokumentmetadaten
gespeichert. Kein strukturiertes Builder-Profil, keine neue KI-Verarbeitung,
kein neuer Empfänger, kein neuer Speicherort, kein neuer Zweck.

### 3.3 Bewertung

Gleich bleiben:

- Zweck: dauerhafte Speicherung eines CV-PDFs,
- Empfänger/Verarbeiter: bestehende RIS-/AWS-Dokumentablage,
- Datenkategorien: PDF-Inhalt und Metadaten, potenziell Art.-9-Inhalte,
- Aufbewahrung, Löschung, Widerruf: bestehendes CV-Storage-Verhalten,
- Pilot-/Allowlist-Begrenzung.

Unterschiedlich ist ausschließlich die **Herkunft** des PDFs:

- v1-Wortlaut: „hochgeladener Lebenslauf“,
- Builder: lokal erzeugtes PDF, das der Nutzer ausdrücklich zum Speichern in
  RIS überträgt.

**Auslegung für Option A:** „Hochgeladen“ beschreibt den expliziten Transfer
in die RIS-Ablage, nicht zwingend die Herkunft der Datei außerhalb der
Anwendung. Der Nutzer erzeugt das PDF aus seinen eigenen Angaben und löst den
Upload durch einen klaren, separaten Klick aus. Es gibt keine automatische,
verdeckte oder anmeldungsunabhängige Speicherung.

Diese Auslegung ist fachlich nachvollziehbar, aber **ohne formelle
Privacy-/Legal-Bestätigung nicht abschließend freigegeben**.

---

## 4. Betreiberentscheidung

| Feld | Wert |
|---|---|
| Entscheidung | **Option A — bestehende v1 weiterverwenden** |
| Entscheidungsdatum | `2026-11-14` |
| Entscheidungsinstanz | Betreiberin May's Job Matcher |
| Geltungsbereich | ausschließlich explizit gespeicherte Builder-PDFs im bestehenden Pilot-/Allowlist-Rahmen |
| v2 für diesen Use-Case | **beendet / nicht erforderlich** |
| Änderung an v1-Text/Hash/Notice | **nein** |
| Allgemeine Nutzerfreigabe | **nein** |
| Production-Deployment | **nein** |

**Begründung der Betreiberin (fachlich):**

1. Der Speicherzweck ist unverändert: dauerhafte Ablage eines CV-PDFs mit
   Abruf, Download, Auswahl für Bewerbungen und Löschung.
2. Empfänger, Datenkategorien, Aufbewahrung, Widerruf und Pilotgrenze sind
   identisch mit dem bereits freigegebenen CV-Storage.
3. Der einzige Unterschied ist die lokale PDF-Erzeugung vor dem expliziten
   Upload; es entsteht kein neuer Datenfluss zu einem neuen Empfänger.
4. Eine v2 würde für diesen eng begrenzten Snapshot-Use-Case eine neue
   Textversion, neue Hashes, neue RIS-Mappings und neue Grants erfordern,
   ohne den Verarbeitungszweck zu ändern.
5. Die bestehende v1 und ihre bereits erteilten Einwilligungen bleiben
   unangetastet; der Pilot bleibt begrenzt.

---

## 5. Offene formelle Privacy-/Legal-Bestätigung

**Status: `PRIVACY/LEGAL CONFIRMATION OPEN`**

Die Betreiberentscheidung bestätigt die Produktabsicht, nicht die rechtliche
Auslegung. Es fehlt weiterhin eine dokumentierte Bestätigung von
Privacy/Legal zu folgender exakter Aussage:

> „Im CV-Builder erzeugte und durch ausdrückliche Nutzeraktion in der
> bestehenden RIS-CV-Ablage gespeicherte PDFs sind vom genehmigten Zweck und
> Wortlaut der `cv-storage`-Einwilligung `cv-storage-consent-2026-11-08-v1`
> einschließlich der Art.-9-Regelung umfasst.“

| Feld | Status |
|---|---|
| Bestätigende Stelle | Privacy/Legal + Release-Owner |
| Datum/Signatur | **offen** |
| Bestätigung im Repo | **nicht vorhanden** |
| Freigabe für echte Nutzer | **nein** |
| Freigabe für Live-E2E | **nein, separates Gate** |

Es wird **keine** Freigabe erfunden. Falls Privacy/Legal die Auslegung nicht
bestätigt, bleibt der konkrete Entscheidungspunkt offen; es wird nicht
automatisch v2 eingeführt.

---

## 6. v2-Vorbereitung beendet

Die in `JM-CV-BUILDER-PDF-RIS-STORAGE-03` vorbereitete Option B ist für diesen
PDF-Snapshot-Use-Case **beendet**:

- Version `cv-storage-consent-2026-11-14-v2` wird **nicht** aktiviert.
- Draft-Hash `7baee3ce544f88c4aa99b2ec5c27ae0277bf0b3b5d7c03b4fe40e894ed888567`
  bleibt ausschließlich historische Dokumentation.
- Keine Änderung an Client-/BFF-Konstanten, Env-Variablen, RIS-Notice oder
  RIS-Mapping.
- Keine neuen Grants, keine Migration, keine neuen Tests für eine v2.
- Die 03-Datei erhält einen Superseded-Hinweis; Option B bleibt dort nur als
  historischer Entscheidungszweig lesbar.

Falls v1 später doch nicht ausreicht, ist eine **neue, separat freigegebene**
Entscheidung erforderlich. Ein automatisches Wiederaufnehmen des v2-Drafts ist
nicht zulässig.

---

## 7. Was ausdrücklich nicht autorisiert ist

- Kein Live-E2E gegen RIS oder Production in diesem Auftrag.
- Kein Production-Deployment.
- Keine allgemeine Nutzerfreigabe oder Entfernung der Pilot-Allowlist.
- Keine Änderung an Consent-Text, Hash, Notice, Purpose oder RIS-Vertrag.
- Keine Änderung an Produktcode, Auth, Matching, Applications oder
  Bewerbungsdaten.
- Keine Speicherung strukturierter Builder-Profile.
- Keine automatische Speicherung ohne expliziten Klick.

---

## 8. Synthetischer Pilot-E2E — Readiness

Der kontrollierte Ablauf ist vorbereitet, aber **nicht ausgeführt**:

`JM-CV-BUILDER-PDF-RIS-STORAGE-04-SYNTHETIC-PILOT-E2E-RUNBOOK.md`

Status: `PREPARED — NOT EXECUTED`.

Voraussetzungen:

- ausschließlich Preview/isolierte Umgebung,
- bestätigte synthetische Pilotidentität in Jobsearch- und RIS-Allowlist,
- bestehende v1-Einwilligung `GRANTED`,
- `VITE_RIS_CV_STORAGE_ENABLED` und die bestehenden BFF-Flags nur im Preview,
- synthetisches Builder-PDF, keine echten CV-/Bewerbungsdaten,
- formelle Privacy-/Legal-Bestätigung und separates Live-Test-GO.

Der Runbook deckt Consent-Baseline, explizites Speichern, List/Reload,
Download-Hash, Löschung, Widerruf/Write-Block und Negativfälle ab.

---

## 9. Ergebnis

**`EXISTING V1 SCOPE DOCUMENTED / PILOT E2E READINESS`**

- Betreiberentscheidung für v1 dokumentiert.
- v1-Text, Hash und RIS-Notice unverändert.
- v2 für diesen Use-Case beendet.
- Formelle Privacy-/Legal-Bestätigung ausdrücklich offen.
- Synthetischer Pilot-E2E vorbereitet, nicht ausgeführt.
- **STOP BEFORE LIVE E2E AND PRODUCTION DEPLOYMENT.**
