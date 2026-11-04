# JM-CV-MANAGEMENT-02C

**Art:** Builder-Lebensläufe mit LetterModal und Bewerbungsverwaltung verbinden
**Status:** **IMPLEMENTED LOCAL**; **PRODUCTION: BLOCKED**
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-management-02c`

> Keine Main-Integration, kein Push, kein Deployment, keine dauerhafte
> Speicherung, keine RIS-/AWS-/Cognito-/CloudFront-Änderung und keine echte
> KI-/Provider-Kommunikation.

## 1. Git-Baseline

Lokal verifiziert:

- lokaler `main`: `cb10666`
- `origin/main`: `4364eab`
- Discovery `feature/jm-cv-management-02a`: `069e6d3`
- CV Management 02B `feature/jm-cv-management-02b`: `4b9eac8`
- Working Tree vor Beginn: clean
- neuer Branch: `feature/jm-cv-management-02c` von `4b9eac8`

Gelesen wurden `docs/AI_AUDITLOG.md`,
`docs/reports/JM-CV-MANAGEMENT-02A.md` und
`docs/reports/JM-CV-MANAGEMENT-02B.md`.

## 2. Zwei CV-Quellen

Die beiden Quellen bleiben getrennt:

- **Uploaded CV:** bestehendes `CvDocument` mit PDF, Hash, Verarbeitung und
  `letterText`.
- **Builder CV:** bestehendes `CvBuilderProfileV1` aus „Meine Lebensläufe“ mit
  `CvBuilderDraftV1`, Template und Session-Version.

Es gibt keine automatische Konvertierung, keine künstlichen `File`-Objekte und
keine zweite CV-Engine. Der bestehende Upload-/Verarbeitungsfluss bleibt
unverändert.

## 3. Builder-CV-Serializer

Neu: `src/lib/cvBuilder/toAnonymizedText.ts`.

`cvBuilderToAnonymizedText(draft, language)` erzeugt deterministisch und ohne
Netzwerkzugriff einen datensparsamen Text aus:

- beruflichem Profil (Headline, Kurzprofil),
- Berufserfahrung,
- Ausbildung,
- Fähigkeiten,
- Projekten inklusive Technologien,
- Zertifikaten,
- Sprachen.

Nicht übertragen werden:

- Name,
- E-Mail,
- Telefonnummer,
- Anschrift,
- persönliche Identifikatoren,
- Links/URLs,
- unbekannte Felder,
- vollständige CV-Profile.

Freitexte laufen durch die bestehende `anonymizeText`-Logik. Zusätzlich werden
bekannte persönliche Werte aus dem Profil (Name, E-Mail, Telefon, Ort) und URLs
in Freitexten redigiert. Das ist eine Risikoreduktion, keine Garantie gegen
Reidentifikation.

`hasCvBuilderTextContent(draft)` prüft, ob überhaupt berufliche, serialisierbare
Inhalte vorhanden sind. Ein Profil mit ausschließlich Kontaktdaten gilt damit
nicht als verwendbar.

## 4. Datenschutzprüfung und Vorschau

Verbindliche Reihenfolge im bestehenden `LetterModal`:

```text
CV auswählen
  -> aktuelles Profil aus dem Repository lesen
  -> strukturierte Daten prüfen
  -> datensparsamen CV-Text erzeugen
  -> bestehende Anonymisierung anwenden
  -> Vorschau der vorgesehenen Daten anzeigen
  -> ausdrückliche Generierungsaktion
  -> bestehende Cover-Letter-API
```

Die CV-Auswahl selbst löst keinen KI-Aufruf aus. Der Serializer wird erst beim
expliziten Generieren oder Übernehmen erneut auf dem aktuellen Profil
ausgeführt. Bei fehlendem, gelöschtem oder leerem Profil wird die Anfrage
verständlich blockiert.

Die Vorschau zeigt ausschließlich den tatsächlich vorgesehenen,
datensparsamen Text. Es werden keine vollständigen CV-Profile geloggt und keine
unredigierten Kontaktdaten an das Modell übergeben.

## 5. CV-Auswahl im LetterModal

Erweitert wurden:

- `LetterCvChoice = "none" | "existing" | "builder"`
- `selectedBuilderCvId`
- `cvBuilderProfiles`
- `resolveCvBuilderProfile(cvId)` für den aktuellen Repository-Zustand

Die bestehende Uploaded-CV-Auswahl bleibt erhalten. Zusätzlich erscheint die
Gruppe „Meine erstellten Lebensläufe“ mit Name und Status:

- bereit,
- nicht verwendbar/leer,
- nicht mehr verfügbar.

Leere Profile sind nicht auswählbar. Fehlt ein ausgewähltes Profil, wird die
Auswahl auf „Ohne Lebenslauf“ zurückgesetzt; es wird kein anderes Profil
automatisch gewählt. Änderungen an CV-Quelle, CV-ID oder Profilstand
invalidieren einen vorhandenen Entwurf und verhindern die stille
Weiterverwendung einer alten Freigabe.

Bestehende Anschreibenoptionen, Versionierung, Bearbeiten, Überarbeiten,
Kopieren und Download bleiben unverändert. Es gibt keine zweite
LetterModal-Instanz.

## 6. Application-CV-Referenz

`ApplicationCvReferenceV1` wurde minimal erweitert:

```ts
interface ApplicationCvReferenceV1 {
  cvId: string;
  documentId?: string;
  label?: string;
  cvSource?: "uploaded" | "builder";
}
```

Abwärtskompatibilität:

- fehlendes `cvSource` bleibt gültig,
- Legacy-Referenzen werden als `uploaded` behandelt,
- bestehende Referenzen werden nicht automatisch umgeschrieben,
- keine vollständigen CV-Daten, PDF-Bytes oder künstlichen RIS-Dokument-IDs in
  der Bewerbung.

Beim ausdrücklichen Übernehmen eines Anschreibens wird die passende
CV-Referenz mit übergeben. Bei einer bestehenden Bewerbung aktualisiert
`adoptCoverLetter` die CV-Referenz zusammen mit der neuen Anschreibenversion,
ohne frühere Versionen zu überschreiben. Ohne neue CV-Auswahl bleibt eine
bestehende Referenz erhalten.

Schema und Vertragsdokumentation wurden entsprechend aktualisiert:

- `docs/contracts/schemas/JOBMATCHER-APPLICATION-V1.schema.json`
- `docs/contracts/JOBMATCHER-APPLICATION-MANAGEMENT-V1.md`

## 7. Lösch- und Orphan-Semantik

Gewählt wurde **Option A**:

- Löschen eines zugeordneten Builder-CV ist nach ausdrücklicher Warnung
  erlaubt.
- Die Bewerbung und ihre Anschreibenversionen bleiben erhalten.
- Die CV-Referenz wird als „nicht mehr verfügbar“ behandelt.
- Es wird kein anderes Profil automatisch ausgewählt oder wiederhergestellt.
- Eine verwaiste Referenz wird nicht für neue KI-Anfragen verwendet.
- Andere Bewerbungen bleiben unverändert.

Die Löschwarnung erscheint in `CvBuilderProfileList`, wenn das Profil in einer
Session-Bewerbung referenziert wird. Die Bewerbungsansicht zeigt die fehlende
Referenz als Warnung und verlangt eine ausdrückliche neue Auswahl.

## 8. Bewerbungsverwaltung

Der Dokumenten-Tab zeigt jetzt:

- CV-Name,
- CV-Quelle (`Hochgeladener Lebenslauf` oder `Meine erstellten Lebensläufe`),
- Warnung bei nicht verfügbarer Referenz,
- Aktion „Zugeordneten Lebenslauf öffnen“ für Builder-CVs,
- Auswahl „Zugeordneten Lebenslauf ändern“.

Die Änderung der Zuordnung erfolgt über das bestehende
`ApplicationRepository.update` mit `expectedVersion`. Sie erzeugt keine neue
Anschreibenversion, keinen KI-Aufruf und keine neue Bewerbung. Hochgeladene und
erstellte CVs können unabhängig zugeordnet werden.

## 9. Session- und Auth-Isolation

Geprüft und abgesichert:

- Bei Logout/Login/Benutzerwechsel wird das CV-Repository invalidiert und die
  Profilliste geleert.
- `LetterModal` wird geschlossen; alte CV- und Anschreibenstände werden nicht
  weiterverwendet.
- Der Resolver liest vor Generierung und Übernahme den aktuellen
  Repository-Zustand.
- Eine Profiländerung während eines offenen LetterModal invalidiert den
  Entwurf über den geänderten Profilstand.
- Eine Löschung während einer laufenden Anfrage führt über die Profil-Props zu
  einer Invalidierung der Anfragefolge; späte Antworten werden verworfen.
- Es gibt keine E-Mail-basierte Identität, keine Gastmigration und keine
  Nutzung von Daten einer vorherigen Identität.

Die bestehende Identitätsgrenze `iss + sub` bleibt unverändert.

## 10. Tests

### Unit / Integration

- Serializer: vollständig, leer, teilweise, verschachtelt, sensible Angaben,
  URLs, Sonderzeichen, lange Eingaben, unbekannte Felder, Determinismus.
- LetterModal: Uploaded CV, Builder CV, Quellenwechsel, fehlendes Profil,
  leeres Profil, keine automatische KI-Anfrage, Vorschau, Adoption,
  CV-Referenz, bestehende Optionen.
- Bewerbungen: Builder-/Uploaded-Zuordnung, Legacy-Referenz, verwaiste
  Referenz, Quellenwechsel, keine zusätzliche Version, keine KI.
- Vertrag: `cvSource`-Validierung, Legacy-Referenzen, ungültige Quelle,
  Erhalt bestehender Versionen.

### Gesamtsuite

```text
1414 passed | 5 skipped (1419)
137 Testdateien passed | 3 skipped (140)
```

Bekannter intermittierender Timeout in `ApplicationsSection.test.tsx` bleibt
dokumentiert; es wurden keine Tests deaktiviert und keine globalen Timeouts
pauschal erhöht.

### Build und Syntax

```text
npm run build       PASS
git diff --check    PASS
node --check tests/e2e/cv-management-02c.mjs PASS
```

### E2E

Neu: `tests/e2e/cv-management-02c.mjs`

Viewports: 1440 / 1024 / 768 / 430 / 390 / 320 px.

Geprüft:

- Builder-CV erstellen,
- im LetterModal auswählen,
- Vorschau des datensparsamen Texts,
- genau eine Cover-Letter-Anfrage,
- kein Name/Kontakt im CV-Text,
- Adoption mit Builder-Referenz,
- Anzeige der CV-Quelle in der Bewerbung,
- Änderung der Zuordnung ohne weitere KI-Anfrage,
- keine horizontalen Überläufe.

Ergebnis: **6/6 Viewports PASS**.

Zusätzlich PASS:

- CV-Management-02B-E2E
- CV-Builder-E2E
- CV-PDF-E2E
- Cover-Letter-E2E
- Direct-Cover-Letter-E2E
- Manual-Application-Draft-E2E
- Applications-E2E
- Mobile-Navigation-E2E
- Profile-/Consent-E2E

Es wurden keine echten KI-, Provider-, RIS-, AWS- oder Apify-Aufrufe
ausgeführt.

## 11. RIS-Handoff

Für eine spätere RIS-Persistenz sind festgehalten:

- **Builder-CV-Identität:** stabile `cvb-<uuid>`-ID; Anzeigename ist kein
  Identifikator.
- **Uploaded-CV-Identität:** bestehende `CvDocument.id` bzw. künftige
  Dokumentreferenz.
- **CV-Referenztyp:** `cvSource: "uploaded" | "builder"`; fehlendes Feld bleibt
  Legacy-`uploaded`.
- **Ownership:** ausschließlich über die verifizierte Identität `iss + sub`;
  keine E-Mail als Fallback.
- **Versionierung:** Application-Version bleibt unabhängig von der
  CV-Profilversion. Eine optionale CV-Version ist nur mit konsistenter
  Application-Semantik vorzusehen.
- **Löschsemantik:** Application-Historie bleibt erhalten; CV-Referenz wird
  nicht verfügbar.
- **Nicht verfügbare Referenzen:** dürfen nicht für neue KI-Anfragen genutzt
  werden und müssen im UI sichtbar bleiben.
- **Consent-Abhängigkeiten:** CV-Datenfreigabe bleibt an die bestehende
  KI-Einwilligung gebunden; die optionale dauerhafte Speicherung ist davon
  unabhängig.

Es wurden keine RIS-Schnittstellen implementiert, keine AWS-Infrastruktur
verändert und keine dauerhafte CV-Speicherung aktiviert.

## 12. Offene Findings

- Builder-CV-Profile bleiben session-only und gehen bei Reload verloren.
- Exactly-once über Tabs/Clients ist mit In-Memory-Repositories nicht garantiert.
- Der Gastzugang zur Profilliste bleibt auf das authentifizierte Dashboard
  beschränkt.
- RIS kann Builder-CV-Referenzen erst verifizieren, wenn ein CV-Ressourcen- und
  Ownership-Vertrag existiert.
- Die Vorschau ist datensparsam, ersetzt aber keine vollständige
  Anonymitätsgarantie bei Reidentifikation über Kontext.
- Der bekannte intermittierende `ApplicationsSection.test.tsx`-Timeout bleibt
  bestehen.

## 13. Commits

- `11fccfe` — `feat(cv): add data-minimised builder CV serializer`
- `899fc94` — `feat(cv): connect builder CVs to letters and applications`
- `4ad2e90` — `test(e2e): cover builder CV letter and application flow`
- Dokumentation in diesem Commit.

Kein Push, kein Merge, kein Deployment.

## 14. Abschlussentscheidung

**CV-MANAGEMENT-02C: READY für Main-Review**

**ACTIVE RIS PERSISTENCE: BLOCKED**

**PRODUCTION: BLOCKED**
