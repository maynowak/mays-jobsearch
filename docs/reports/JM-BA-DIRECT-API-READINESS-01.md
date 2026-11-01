# JM-BA-DIRECT-API-READINESS-01

**Art:** Bundesagentur für Arbeit / direkte Jobsuche-API / Machbarkeit und Rechtsgrenzen
**Status:** **BLOCKED** für eine produktive Integration — technisch teilweise machbar, Zugang/Nutzungsrecht nicht geklärt
**Datum:** 2026-11-01
**Baseline:** `main` @ `334371d`, `origin/main` synchron
**Grenzen:** Keine Live-Jobabfrage, keine Apify-Runs, kein Deployment, keine Codeänderung.

## 1. Executive Summary

Die durch `bundesAPI/jobsuche-api` dokumentierte Schnittstelle ist **technisch beschrieben**, aber:

- sie ist **keine offizielle API der Bundesagentur für Arbeit**,
- die dokumentierte Authentifizierung nutzt eine **öffentliche Client-ID der BA-Jobsuche-App**, keinen für Dritte freigegebenen API-Vertrag,
- die BA-Nutzungsbedingungen untersagen Robots/Webspider und die zweckwidrige Nutzung bestehender Schnittstellen zur Datensammlung,
- die BA hat die Schnittstelle nach öffentlicher Dokumentation ausdrücklich als nicht für massenhaften technischen Zugriff gedacht bezeichnet,
- ein offizieller Read-/Search-API-Zugang für Dritte wurde nicht gefunden,
- die offizielle HR-BA-XML-Schnittstelle dient der **Einlieferung** von Stellenangeboten an die BA, nicht dem Auslesen des BA-Stellenmarkts.

**Entscheidung: BLOCKED.** Eine produktive Source `arbeitsagentur-direct` darf erst nach schriftlicher Klärung mit der BA bzw. nach einem belastbaren Kooperations-/Lizenzmodell umgesetzt werden.

Die technische Machbarkeit bleibt dokumentiert; sie ist nicht mit einer Nutzungserlaubnis gleichzusetzen.

## 2. Recherchegrundlagen

Abgerufen am 2026-11-01:

- `bundesAPI/jobsuche-api` README und `openapi.yaml`
- GitHub-Issue #69 „Update Arbeitsagentur API Integration for Current V6 and V4 Response Schemas“ (08.08.2026)
- BA-Nutzungsbedingungen, Stand 08.07.2026
- BA-Seite zur HR-BA-XML-Schnittstelle
- netzpolitik.org-Bericht vom 30.11.2021 zur BA-Schnittstelle
- aktueller Repository-Stand zu BA/Apify

## 3. Technische Analyse

### 3.1 Dokumentierte Endpunkte

OpenAPI-Version: `2.1.0`
Server: `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service`

| Zweck | Dokumentierter Pfad |
|---|---|
| Jobsuche | `GET /pc/v6/jobs` |
| Jobsuche App-Variante | `GET /pc/v4/app/jobs` |
| Jobdetails | `GET /pc/v4/jobdetails/{encryptedJobCode}` |
| Jobdetails alternativ | `GET /pc/v3/jobdetails/{encryptedJobCode}` |
| Arbeitgeberlogo | `GET /ct/v1/arbeitgeberlogo/{kundennummerHash}` |

Die README nennt zusätzlich ein Beispiel mit `/pc/v4/jobs`, das nicht mit den OpenAPI-Pfaden übereinstimmt. Das ist ein erstes Zeichen für Dokumentationsdrift.

### 3.2 Authentifizierung

Die Community-Dokumentation nennt:

```http
X-API-Key: jobboerse-jobsuche
```

Das ist laut Dokumentation die Client-ID der BA-Jobsuche-App. Es ist **kein individueller Drittanbieter-Schlüssel** und kein Nachweis einer Nutzungsfreigabe. Die OpenAPI beschreibt den Header technisch, nicht als öffentliches Zugangsrecht.

### 3.3 Suchparameter

Dokumentiert sind unter anderem:

- `was` – Jobtitel/Freitext
- `wo` – Beschäftigungsort
- `berufsfeld` – Berufsfeld
- `page` – Seite
- `size` – Ergebnisse pro Seite
- `arbeitgeber` – Arbeitgeber
- `veroeffentlichtseit` – 0–100 Tage
- `zeitarbeit` – Zeitarbeit einbeziehen
- `angebotsart` – 1 Arbeit, 2 Selbständigkeit, 4 Ausbildung, 34 Praktikum
- `befristung` – 1 befristet, 2 unbefristet
- `arbeitszeit` – `vz`, `tz`, `snw`, `ho`, `mj`
- `behinderung`, `corona`
- `umkreis` – Radius in km

### 3.4 Dokumentierte Antwortstruktur

Die OpenAPI beschreibt für die Suche o. a. `stellenangebote[]` mit Feldern wie:

- `hashId`
- `beruf`
- `refnr`
- `arbeitgeber`
- `aktuelleVeroeffentlichungsdatum`
- `eintrittsdatum`
- `arbeitsort` mit `plz`, `ort`, `strasse`, `region`, `land`, `koordinaten`
- `kundennummerHash`
- `externeUrl`
- `modifikationsTimestamp`
- `maxErgebnisse`, `page`, `size`, `facetten`

Die Detail-OpenAPI beschreibt u. a.:

- `titel` / `stellenangebotsTitel`
- `refnr` / `referenznummer`
- `stellenbeschreibung` / `stellenangebotsBeschreibung`
- `arbeitsorte`
- `befristung`
- `eintrittsdatum`
- `verguetung`
- `arbeitgeberKundennummerHash`
- `externeUrl`

### 3.5 Abweichungen zwischen OpenAPI und tatsächlichen Antworten

GitHub-Issue #69 dokumentiert erhebliche Abweichungen der aktuellen v6-/v4-Antworten von der OpenAPI:

| Dokumentiert | Tatsächlich beobachtet |
|---|---|
| `stellenangebote` | `ergebnisliste` |
| `refnr` | `referenznummer` |
| `titel` | `stellenangebotsTitel` |
| `arbeitgeber` | `firma` |
| `aktuelleVeroeffentlichungsdatum` | `datumErsteVeroeffentlichung` |
| `arbeitsort` | `stellenlokationen` |
| `modifikationsTimestamp` | `aenderungsdatum` |
| `stellenbeschreibung` | `stellenangebotsBeschreibung` |

Diese Abweichungen sind für einen Adapter entscheidend: Ein strikter OpenAPI-Parser würde an der realen Antwort scheitern. Ein Adapter müsste beide Varianten tolerant lesen und bei strukturellen Abweichungen einen klaren `schema_mismatch` liefern.

### 3.6 Referenznummern und Detailabruf

- BA-Referenznummer: z. B. `10001-1002716922-S`
- Die bestehende Apify-Normalisierung bildet daraus den Slug `aa-<referenznummer>`.
- Details werden mit `base64(refnr)` aufgerufen.
- Standard-Base64 kann `+`, `/` und `=` enthalten; der Pfad muss URL-sicher behandelt werden.
- Ein Detailabruf ist für Vollbeschreibung/Qualifikationen erforderlich; die Liste liefert diese nicht zuverlässig.

### 3.7 Mapping auf das bestehende Job-Modell

Vorgeschlagenes Mapping für einen späteren Adapter:

| Bestehendes Feld | BA-Direct-Mapping |
|---|---|
| `slug` | `aa-${referenznummer}` |
| `title` | `stellenangebotsTitel` oder `titel` |
| `company_name` | `firma` oder `arbeitgeber` |
| `location` | `stellenlokationen` / `arbeitsorte` / `arbeitsort` |
| `remote` | aus Arbeitszeitmodellen/Standortdaten ableiten; Feldlage verifizieren |
| `tags` | `beruf`/`fertigkeiten`, soweit tatsächlich geliefert |
| `url` | `externeUrl` oder BA-Portal-URL |
| `description` | Detail: `stellenangebotsBeschreibung` oder `stellenbeschreibung` |
| `descriptionPlain` | `htmlToPlainText(description)` |
| `language` | `detectLanguage(descriptionPlain)` |
| `contractType` | `befristung` |
| `salary` | `verguetung` (Freitext, nicht strukturiert) |
| `startDate` | `eintrittsdatum` |
| `created_at` | `datumErsteVeroeffentlichung` / `aktuelleVeroeffentlichungsdatum` |

Die bestehende Apify-Normalisierung darf nicht unverändert übernommen werden, weil die Feldnamen und Response-Wrapper abweichen.

### 3.8 Duplikate gegenüber Apify

- Beide Wege liefern dieselbe BA-Referenznummer.
- Deduplizierung muss über `aa-${referenznummer}` bzw. die Referenznummer erfolgen, nicht nur über Titel/Arbeitgeber/Ort.
- Der bestehende `dedupJobs`-Key `title|company|location` reicht bei abweichender Ortsformatierung oder Titel-Schreibweise nicht aus.
- Bei aktivierten beiden Quellen muss ein gemeinsamer Datensatz mit `source[]`-Merge entstehen.
- Detail-Caches müssen referenznummernbasiert geteilt werden, damit eine bereits vorhandene Beschreibung nicht erneut über Apify geholt wird.
- `/api/match` darf für BA-Jobs mit bereits vorhandener Beschreibung keinen weiteren Apify-Detail-Run starten.

## 4. Rechtliche und tatsächliche Zugangslage

### 4.1 BA-Nutzungsbedingungen

Die BA-Nutzungsbedingungen (Stand 08.07.2026) regeln in §2a:

- §2a(1): Die Nutzung des Portals und der Apps ist jeder natürlichen oder juristischen Person **unentgeltlich** erlaubt.
- §2a(3): Es ist unter anderem **nicht zulässig**,
  - Robots, Webspider oder ähnliche Technologien einzusetzen,
  - bestehende Kommunikations- bzw. Programmierschnittstellen entgegen dem von der BA beabsichtigten Zweck zu verwenden und so Inhalte zum Zweck der Datensammlung und -auswertung auszulesen,
  - Sicherheitsmaßnahmen zu umgehen oder zu durchbrechen.

Damit ist die **manuelle Nutzung durch Bürgerinnen und Bürger** erlaubt. Ein automatisierter App-/Server-Abruf von BA-Jobdaten ist damit nicht automatisch erlaubt.

### 4.2 BA-Aussage zur Jobsuche-Schnittstelle

Die BA hat gegenüber netzpolitik.org (30.11.2021) erklärt, die Schnittstelle der Jobsuche-App sei für eine komfortablere Suche und registrierte Nutzer:innen eingerichtet, **nicht für massenhaften Zugriff oder massenhafte Auswertung mit technischen Mitteln**. Sie sehe die öffentliche Dokumentation technisch und rechtlich kritisch.

Das ist keine aktuelle Rechtsauskunft, aber ein relevanter behördlicher Wille, der gegen eine ungefragte direkte Source spricht.

### 4.3 Offizielle Zugangswege

- `bundesAPI/jobsuche-api` ist ein **Community-/Open-Data-Projekt**, keine offizielle BA-API.
- `jobsuche.api.bund.dev` ist die Dokumentationsseite dieses Projekts, nicht ein offizieller BA-Vertriebskanal.
- Die offizielle **HR-BA-XML-Schnittstelle** der BA dient der Einlieferung eigener Stellenangebote aus HR-Systemen in die BA-Jobbörse. Sie ist kein allgemeiner Read-/Search-API-Zugang.
- Für HR-BA-XML ist eine Kooperationsvereinbarung mit der BA erforderlich; Arbeitgeber, Stellenbörsen, öffentlich-rechtliche Institutionen und zugelassene kommunale Träger haben eigene Kooperationsmodelle.
- Ein offizieller, öffentlich dokumentierter Read-API-Zugang für Dritte wurde nicht gefunden.

### 4.4 Browser-nutzt-die-BA-Nuance

Die Aussage „die BA darf von Bürgern benutzt werden, und der Browser läuft beim Bürger“ ist richtig, aber sie löst nicht automatisch die API-Frage:

- **Erlaubt:** Ein Bürger öffnet die BA-Jobbörse manuell im Browser und liest Stellenanzeigen.
- **Erlaubt:** Unsere App verlinkt auf die BA-Portal-URL; der Nutzer öffnet sie selbst.
- **Nicht automatisch erlaubt:** Unsere App ruft die BA-Schnittstelle automatisiert auf, auch wenn der Request technisch im Browser des Nutzers ausgeführt würde. Das kann weiterhin ein Robot/vergleichbarer automatisierter Datenabruf sein.
- **Technisch blockiert:** Ein direkter Browser-`fetch` auf `rest.arbeitsagentur.de` scheitert an 403/CORS; Header-Simulation, Proxy oder Captcha-Umgehung sind ausgeschlossen.
- **Nicht gleichzusetzen:** Die öffentliche Client-ID der Jobsuche-App ist kein Nachweis, dass Dritte sie für eigene Dienste verwenden dürfen.

## 5. Architekturvorschlag (nicht implementiert)

### 5.1 Source-Adapter

Vorgeschlagene optionale Source:

```text
api/_lib/sources/arbeitsagenturDirect.mjs
id: "arbeitsagentur-direct"
provider: "direct-api"
```

Eigenschaften:

- `enabled()` standardmäßig `false`.
- Eigenes Flag, z. B. `JOB_SOURCE_ARBEITSAGENTUR_DIRECT_ENABLED=false`.
- Keine Änderung an `arbeitsagentur`/Apify.
- Keine Default-Aktivierung.
- Keine Secrets im Repo.

### 5.2 Ablauf

1. Suche über BA-Jobsuche.
2. Normalisierung mit toleranter Schema-Erkennung (`stellenangebote`/`ergebnisliste`, `refnr`/`referenznummer`, usw.).
3. Kanonischer Slug `aa-<referenznummer>`.
4. Dedup gegen Apify/andere Quellen über Referenznummer.
5. Detailabruf nur bei Bedarf; Ergebnis in einem gemeinsamen referenznummernbasierten Detail-Cache ablegen.
6. Kein Apify-Detail-Run, wenn eine direkte oder gecachte Beschreibung vorliegt.
7. Eigene Diagnose:
   - `disabled`
   - `missing_config`
   - `http_403`
   - `http_429`
   - `timeout`
   - `schema_mismatch`
   - `no_query`
   - `upstream_unavailable`

### 5.3 Deduplizierung und Detailkosten

- Listen-Dedup: Primärschlüssel `aa-<refnr>`; Merge der `source[]`-Arrays.
- Detail-Cache: gemeinsamer Key `mj-detail:arbeitsagentur:<refnr>` oder ein klar getrennter gemeinsamer Namespace.
- Vor jedem Apify-Detail-Run prüfen, ob die Referenz bereits eine Beschreibung im gemeinsamen Cache hat.
- Bei aktivierter Direct-Source und erfolgreicher Detailantwort keinen zusätzlichen Apify-Run für denselben Job starten.
- Bei Direct-Fehler nicht automatisch kostenpflichtig auf Apify wechseln, ohne explizite Fallback-Entscheidung.

### 5.4 Fehler- und Verfügbarkeitsdiagnose

- 403 nicht retryen, sondern als `http_403` sichtbar machen.
- 429 mit begrenztem Backoff, aber ohne Umgehung.
- Keine Header-/Client-ID-Simulation zur Umgehung von Zugriffsbeschränkungen.
- Keine Live-Abfrage ohne dokumentierte Freigabe.

## 6. Empfohlene Entscheidung

### Entscheidung: **BLOCKED**

**Technisch:** Ein Adapter ist grundsätzlich baubar; die Feldstruktur ist dokumentiert und die Referenznummern sind mit Apify kompatibel.

**Rechtlich/Zugang:** Eine produktive Aktivierung ist ohne schriftliche Klärung mit der BA nicht vertretbar. Die BA-Nutzungsbedingungen und die BA-Aussage zur Schnittstelle sprechen gegen einen ungefragten automatisierten Datenabruf. Die Community-Dokumentation und die öffentliche Client-ID sind keine Nutzungserlaubnis.

### Bedingungen für eine Neubewertung

1. Schriftliche Auskunft/Genehmigung der BA zum automatisierten Lesen von Jobdaten.
2. Geklärte Nutzungs-, Lizenz-, Attributions- und Löschbedingungen.
3. Geklärte API-Zugangsdaten oder offizieller Partnerzugang.
4. Rechtliche Prüfung von DSGVO, Datenbank-/Urheberrecht und Weiterverbreitung.
5. Stabile Response-Schemata oder ein dokumentierter Versionierungsvertrag.
6. Erst danach: Implementierung hinter `JOB_SOURCE_ARBEITSAGENTUR_DIRECT_ENABLED=false`.

## 7. Vergleich Apify vs. Direct

| Aspekt | Apify (bestehend) | BA Direct (Vorschlag) |
|---|---|---|
| Offizieller BA-Zugang | nein, Apify-Actor | nein, Community-Dokumentation |
| Kosten | Apify pay-per-event | keine BA-Gebühr bekannt, aber ungeklärte Rechte |
| Liste | Actor | direkter BA-Endpunkt |
| Details | gezielter Apify-Run | direkter BA-Detail-Endpunkt |
| Schema | vom Actor normalisiert | OpenAPI vs. reale Antwort abweichend |
| Recht | Apify-Vertrag; BA-Rechte separat | ungeklärt |
| Empfehlung | bestehende Route unverändert | **BLOCKED** bis Freigabe |

## 8. Offene Berechtigungsfragen

1. Erlaubt die BA einem Job-Matcher den automatisierten Abruf von Stellenanzeigen für Endnutzer?
2. Ist die öffentliche Jobsuche-Schnittstelle überhaupt für Dritte vorgesehen?
3. Welche Rolle spielt die öffentliche Client-ID `jobboerse-jobsuche` rechtlich?
4. Gibt es ein Partner-/Lizenzmodell für Jobdaten (nicht nur HR-BA-XML-Einlieferung)?
5. Wie sind Speicherung, Cache, Weiterverbreitung und Löschung zu regeln?
6. Dürfen Kontaktdaten/Arbeitgeberdaten verarbeitet werden?
7. Wie ist mit Captcha-/403-Schutz und IP-Blocks umzugehen? (Nicht umgehen.)
8. Welche Attributions- und Quellenangaben verlangt die BA?

## 9. Referenzen

- `https://github.com/bundesAPI/jobsuche-api`
- `https://raw.githubusercontent.com/bundesAPI/jobsuche-api/main/openapi.yaml`
- `https://github.com/bundesAPI/jobsuche-api/issues/69`
- `https://www.arbeitsagentur.de/nutzungsbedingungen` (Stand 08.07.2026)
- `https://www.arbeitsagentur.de/unternehmen/arbeitskraefte/hr-ba-xml-schnittstelle`
- `https://netzpolitik.org/2021/open-data-arbeitsagentur-kaempft-gegen-offene-schnittstelle`
- bestehende Reports: `BA-DIRECT-PROBE-01`, `BA-BROWSER-MODEL-01`, `BA-LIST-DETAIL-01`, `BA-SOURCE-CHECK-02`

## 10. Grenzen dieses Berichts

- Keine Live-Abfrage der BA-Jobsuche.
- Keine Apify-Runs.
- Keine Umgehung von 403/CORS/Captcha.
- Keine produktive Aktivierung.
- Keine Änderung an AWS, RIS, Cognito oder Apify.
- Keine Rechtsberatung; die rechtliche Bewertung muss durch eine befugte Stelle erfolgen.
