# JM-CV-UX-07 — CV PERSISTENCE, DELETE & EDITOR RETURN

**Status:** `C — BLOCKED — BACKEND DELETE PERMISSION MISSING`  
**Frontend branch:** `feature/jm-cv-ux-07-persistence-delete-editor-return`  
**Base:** `origin/main` `6fc40d2`  
**Implementation:** `0d1a17f`  
**No deployment, Main merge, RIS/AWS/Cognito/Terraform change or real CV deletion.**

## 1. Datenfluss

| Bereich | Speicherung | ID | Verhalten |
|---|---|---|---|
| Session-CV | nur in der aktuellen Browser-Sitzung | `CvDocument.id` | nach Reload nicht dauerhaft |
| RIS-CV | RIS-BFF, PDF und Metadaten | `PersistentCv.cvId` | bleibt nach Reload sichtbar |
| Structured-CV | lokaler CV-Builder-Repository | `CvBuilderProfileV1.cvId` | separater Entwurf; keine dauerhafte RIS-Struktur |
| CV-Suchprofil | RIS-Profil-/Suchkonfiguration | `searchProfileId` | separater Consent und Parent |

Der Editor-Handoff ist:

```text
persistente CV-Karte
  -> Download über /api/ris/cvs?id=...&action=document
  -> handleCvUploadStart (session File, risCvId)
  -> bestehender Session-/AI-Workflow
```

Ein PDF-Dokument und ein strukturiertes CV-Builder-Profil sind nicht
dieselbe Ressource. Es wurde keine neue dauerhafte Structured-CV-Speicherung
eingeführt.

## 2. P0-01 — Persistent CV Delete

### Gefundene UI

Der bestehende Delete-Pfad war bereits vorhanden:

```text
PersistentCvList
  -> onDelete(cvId)
  -> usePersistentCvStorage.remove(cvId)
  -> deleteCvDocument(cvId)
  -> DELETE /api/ris/cvs?id=...
  -> refresh()
```

Er wurde verbessert:

- sichtbarer Button „Löschen“ statt unklarem `×`
- Bestätigungsdialog mit Dateiname
- klare Aktionen „Abbrechen“ und „Dauerhaft löschen“
- Abbrechen löst keinen API-Aufruf aus
- Fehler bleiben sichtbar; Bestätigung bleibt für einen Wiederholungsversuch
  geöffnet
- keine Kaskadenlöschung und keine fremden CV-IDs

Tests:

- erfolgreiche Löschung
- Abbrechen ohne API-Aufruf
- API-Fehler mit sichtbarer Meldung
- bestehende `usePersistentCvStorage.remove`-Tests

### Backend-Blocker

Der echte Production-Delete-Pfad scheitert weiterhin an der bestehenden
RIS-IAM-Policy:

```text
Aktion:    dynamodb:ConditionCheckItem
Rolle:     ris-dev-dev-agent
Ressource: ris-dev-dev-partner-profiles
Ergebnis:  implicitDeny
```

Der CV-Delete verwendet `TransactWriteItems` mit einer ConditionCheck.
Der frühere Live-E2E zeigte dafür `500 internal_error` und
`cv delete reservation failed`.

**Keine RIS-/AWS-Änderung in diesem Auftrag.** Der bereits vorbereitete
RIS-IAM-Plan `c30d9c1928e60332be040d2a2453b5b357c9c14e699404238dddc623077be4e8`
ist nicht angewendet. Bis zu einer separaten Freigabe kann der persistente
CV nicht zuverlässig produktiv gelöscht werden.

## 3. P0-02 — CV verschwindet nach Bearbeiten

### Ursache

`handleProcessPersistentCv` hat nach dem Download des persistenten PDFs
zusätzlich den Storage-Modus auf `session` gesetzt:

```text
setCvStorageMode("session")
```

Damit wurde die persistente CV-Liste ausgeblendet, obwohl das RIS-Dokument
unverändert vorhanden war. Das war ein Anzeige-/Modusfehler, kein
Datenverlust.

### Korrektur

Der automatische Moduswechsel wurde entfernt. Nach dem Download bleibt die
persistente Liste sichtbar. Der Nutzer kann weiterhin bewusst in die
Session-Ansicht wechseln. Das Original-PDF wird nicht gelöscht, nicht
überschrieben und nicht aus RIS entfernt.

Regressionstest:

```text
src/components/CvPersistenceRegression.test.ts
```

prüft, dass der Handler den persistenten Modus nicht mehr auf Session
umschaltet.

## 4. Tests

```text
Fokussiert CV/Persistenz/Delete: 26 PASS
Vollständige Frontend-Suite:     1959 PASS / 11 skipped
npm run build:                    PASS
git diff --check:                 PASS
profile-ux-final E2E:             PASS (lokal, synthetisch)
```

Der Produktions-Delete wurde nicht mit echten Daten ausgeführt.

## 5. Datenschutz

- keine echten CV-Daten in Tests oder Reports
- keine Tokens/Cookies in Reports
- keine neue RIS-/AWS-Ressource
- keine Kaskadenlöschung
- keine Änderung an Consent-, Auth- oder CV-Speicherlogik
- keine dauerhafte Structured-CV-Speicherung

## 6. Offene Findings

1. **P0-01 Backend:** IAM `dynamodb:ConditionCheckItem` fehlt; Production
   Delete bleibt bis zur separaten RIS-Freigabe blockiert.
2. **P0-02:** Frontend-Ursache behoben und durch Regressionstest abgesichert;
   ein authentifizierter Production-Editor-Return wurde wegen fehlender
   freigegebener Schreibtest-Session nicht ausgeführt.
3. Keine Änderung an Main, Production, RIS, Cognito, Terraform oder
   bestehenden Consent-Verträgen.

## 7. Nächster Schritt

Vor einem kontrollierten Integration-/Release-Auftrag:

1. RIS-IAM-Plan separat freigeben und anwenden,
2. CV-Delete mit einem synthetischen CV verifizieren,
3. Editor-Return mit synthetischer autorisierter Sitzung prüfen,
4. erst danach PR/Integration.

**Kein automatischer Merge, kein Deployment.**
