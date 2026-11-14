# JM-CV-BUILDER-PDF-RIS-STORAGE-04 — Synthetic Pilot E2E Runbook

**Status:** `PREPARED — NOT EXECUTED`
**Datum:** 2026-11-14
**Scope:** ausschließlich kontrollierter Preview-/Pilot-Test der expliziten
Builder-PDF-Speicherung in der bestehenden `cv-storage`-v1-Ablage.
**Nicht autorisiert:** Production, allgemeine Nutzer, echte CV-/Bewerbungsdaten,
RIS-/AWS-/Terraform-Änderungen.

> **STOP BEFORE LIVE E2E.** Dieser Runbook beschreibt den Ablauf. Er ist erst
> nach formeller Privacy-/Legal-Bestätigung der v1-Auslegung und separater
> Live-Test-Freigabe auszuführen.

---

## 1. Zweck

Nachweis, dass ein im CV-Builder erzeugtes PDF durch ausdrückliche Nutzeraktion
über den bestehenden `cv-storage`-v1-Pfad gespeichert, geladen, heruntergeladen
und gelöscht werden kann — ohne neue Consent-Version, ohne neuen Zweck, ohne
strukturiertes Profil und ohne Änderung an RIS.

---

## 2. Preconditions

- [ ] Formelle Privacy-/Legal-Bestätigung der v1-Auslegung liegt vor.
- [ ] Separates Live-Test-GO ist dokumentiert.
- [ ] Ausschließlich Preview-/isolierte Umgebung, **kein** Production-Host.
- [ ] Preview-Deployment-ID und Build Identity notiert.
- [ ] Synthetische Pilotidentität ist in **beiden** Allowlists identisch:
  - `RIS_TEST_USER_ALLOWLIST` (Jobsearch),
  - `CONSENT_PILOT_ALLOWLIST` (RIS).
- [ ] Bestehende `cv-storage`-v1-Einwilligung ist für diese Identität
  `GRANTED`; keine v2.
- [ ] Preview-Flags sind bereits wie im CV-Pilot konfiguriert; in diesem
  Auftrag werden **keine** Env-/Vercel-Änderungen vorgenommen.
- [ ] Keine echten CV-, Profil- oder Bewerbungsdaten im Browserprofil,
  Autofill oder Testdokument.
- [ ] Synthetisches Builder-PDF und synthetische Persona vorbereitet.

**Verboten:** Produktions-Token, echte Bewerberdaten, echte E-Mail-Adressen,
RIS-Partner-Credential im Browser/Log, neue Consent-Version, neue RIS-Notice.

---

## 3. Variablen

```bash
export JOBSEARCH_BASE="https://<preview-host>"
export TOKEN="<short-lived pilot access token; never commit>"
export SYNTHETIC_CV_ID=""
```

`TOKEN` niemals in Reports, Screenshots, Shell-History oder Commits übernehmen.
Für die UI-Prüfung kann die authentifizierte Browser-Session verwendet werden.

---

## 4. Ablauf

### 4.1 Consent-Baseline prüfen

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$JOBSEARCH_BASE/api/ris/cv-consents" \
  -o /tmp/cv-consent-baseline.json
```

Erwartung:

- HTTP `200`.
- `consent.purpose = "cv-storage"`.
- `consent.status = "GRANTED"`.
- `noticeVersion = "1.0"`.
- `externalTextVersion = "cv-storage-consent-2026-11-08-v1"`.
- `externalTextSha256 = "2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036"`.
- `specialCategoriesConsent = true`.
- `textMapped = true`, `textApproved = true`.
- Kein `textReason`, kein Notice-Mismatch.

Bei Abweichung: **STOP**, keine Speicherung.

### 4.2 Builder-PDF synthetisch erzeugen und explizit speichern

1. `/cv-builder/workspace` bzw. den authentifizierten CV-Builder öffnen.
2. Synthetische Persona ausfüllen, z. B.:
   - Name: `Alex Muster` (fiktiv),
   - Rolle: `IT-Support Specialist`,
   - Skills: `Windows, Netzwerk, Ticket-System`,
   - eine fiktive Station, keine realen Arbeitgeber.
3. PDF-Vorschau prüfen; Download bleibt separat.
4. **„In RIS speichern“** genau einmal auswählen.
5. Erwartung: Erfolgsmeldung, keine Doppel-Speicherung, keine
   Browser-/Console-Errors, kein Token im DOM.

Negativprüfung: Button während eines laufenden Speichervorgangs erneut
auslösen → keine zweite Datei.

### 4.3 Persistenten Eintrag prüfen

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$JOBSEARCH_BASE/api/ris/cvs?limit=50" \
  -o /tmp/cv-list-after-save.json
```

Erwartung:

- HTTP `200`.
- Genau ein neuer synthetischer Eintrag.
- `contentType = "application/pdf"`.
- `processingStatus = "ready"`.
- Dateiname entspricht dem Builder-Export.
- Kein strukturiertes Builder-Profil, keine zusätzlichen CV-Inhalte.

`SYNTHETIC_CV_ID` aus dem Eintrag setzen. Keine echten IDs in Reports.

### 4.4 Reload / erneute Anmeldung

1. Browser schließen oder neu laden.
2. Erneut mit der Pilotidentität anmelden.
3. „Meine Lebensläufe“ öffnen.

Erwartung: Der synthetische Eintrag ist weiterhin vorhanden; keine
Duplikate; keine Sitzungsdaten werden als dauerhaft gespeichert behauptet.

### 4.5 Download und Hash-Vergleich

1. PDF über die bestehende Download-Aktion herunterladen.
2. SHA-256 des Downloads mit dem ursprünglich erzeugten PDF vergleichen:

```bash
sha256sum /pfad/zum/original-synthetischen.pdf /pfad/zum/download.pdf
```

Erwartung: identische Hashes. Keine Inhaltsveränderung durch die Speicherung.

### 4.6 Löschung

1. Synthetischen Eintrag über die bestehende Löschaktion entfernen.
2. Liste erneut prüfen.

Erwartung:

- Löschung erfolgreich (`200`/`204` je nach bestehendem Vertrag).
- Liste enthält den Eintrag nicht mehr.
- Keine Behauptung einer physischen Purge; bestehende Versionierungs-/
  Delete-Marker-Semantik bleibt unverändert.

### 4.7 Widerruf und Write-Block

1. `cv-storage`-Einwilligung über die bestehende Consent-Funktion widerrufen
   oder:

```bash
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purpose":"cv-storage"}' \
  "$JOBSEARCH_BASE/api/ris/cv-consents?action=withdraw"
```

Erwartung: HTTP `200`, `status = "WITHDRAWN"`.

2. Erneut ein synthetisches Builder-PDF speichern wollen.

Erwartung:

- UI blockiert mit Consent-Hinweis.
- Falls API direkt: `403` `CV_STORAGE_CONSENT_REQUIRED`.
- Kein neuer Eintrag.

3. List/Download/Löschen vorhandener Daten bleiben möglich (soweit nicht
   bereits gelöscht).

### 4.8 Negativfall: nicht allowlistete Identität

Mit einer anderen synthetischen Identität, die **nicht** in beiden Allowlists
steht:

- Jobsearch-BFF: `403` `test_user_not_allowed`, kein RIS-Aufruf.
- Direkter RIS-Partnerpfad (falls getestet): `403` `CV_STORAGE_PILOT_NOT_ALLOWED`.
- Kein Cross-User-Zugriff, keine fremde CV-ID lesbar.

### 4.9 Cleanup

- Synthetische CV-Einträge löschen (Liste leer).
- Consent-Historie **nicht** löschen; sie ist Evidence.
- Preview-Testschalter/Testidentität nur gemäß separater Freigabe entfernen.
- Keine Production-Env, keine RIS-/Terraform-Änderung.
- Keine echten Daten im Browserprofil zurücklassen.

---

## 5. Evidence-Tabelle

| Feld | Wert |
|---|---|
| Datum/Uhrzeit | |
| Preview-URL | |
| Deployment-ID | |
| Build Identity / Commit | |
| Pilotidentität allowlisted (ja/nein) | |
| Consent-Version | `cv-storage-consent-2026-11-08-v1` |
| Consent-Hash | `2fe65fd1…79d036` |
| Notice | `cv-storage/1.0` |
| `SYNTHETIC_CV_ID` | synthetisch |
| Dateiname | synthetisch |
| Save-Ergebnis | |
| List/Reload-Ergebnis | |
| Download-SHA-256 | |
| Delete-Ergebnis | |
| Withdraw-Ergebnis | |
| Write-Block-Ergebnis | |
| Console-/Page-Errors | |

Keine Tokens, keine echten IDs, keine personenbezogenen CV-Inhalte in der
Evidence-Tabelle.

---

## 6. Stop-Bedingungen

Sofort stoppen, wenn:

- Consent-Version/Hash/Notice nicht exakt v1 entsprechen,
- eine Speicherung ohne expliziten Klick oder ohne `GRANTED` erfolgt,
- ein strukturiertes Builder-Profil oder zusätzliche Daten gespeichert werden,
- ein fremder CV-Eintrag sichtbar wird,
- Cross-User-Zugriff möglich erscheint,
- echte Daten im Test auftauchen,
- Production betroffen ist,
- ein RIS-/AWS-/Terraform-Eingriff nötig wäre.

Bei Stop: Deployment-ID, HTTP-Antworten und Consent-Status sichern; keine
weiteren Produktänderungen; kein automatischer Rollback.

---

## 7. Ausführungsstatus

**`PREPARED — NOT EXECUTED`**

Es wurde kein Live-E2E, keine RIS-Anfrage, keine Production-Änderung und keine
Consent-Änderung durchgeführt.
