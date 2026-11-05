# Mays-Jobsearch — Konsolidierter Entwicklungs- und Statusbericht

**Stand:** 05.11.2026 · **Quelle:** GitHub-Repository `maynowak/mays-jobsearch`, Branch `main`  
**Referenz-HEAD (direkt auf GitHub gelesen):** `4c1f614ba671c09b1209ba0c7f61f7d952500ec7`  
**Anwendungsversion:** `2.2.0` (`package.json`) · **Projektlizenz:** `AGPL-3.0-only`  
**Umfang:** Neue Jobsearch-Entwicklungen und Reports vom 03.–05.11.2026; ältere Berichte nur zur Einordnung von Abhängigkeiten.  
**Verfahren:** Read-only-Abgleich veröffentlichter GitHub-Reports und Git-Historie; **kein Commit, kein Repository-Write, kein Push, kein Deployment, keine Live-Tests**.

> **Wichtig:** `Mays-Jobsearch` ist das hier untersuchte Repository. `Mays-Jobsearch-APP` ist ein anderes Projekt; RIS ist ein eigenständiger Backend-Dienst. Die Projekte werden in diesem Bericht nicht vermischt. Die frühere Formulierung *„nicht gepusht“* in einzelnen Ausführungsreports beschreibt den Zeitpunkt des jeweiligen Arbeitspakets. Sie ist für den aktuellen GitHub-Stand überholt. Umgekehrt beweist ein GitHub-Push **kein** abgeschlossenes Vercel-Produktionsdeployment.

## 1. Executive Summary

Der neue Entwicklungsstand liegt auf GitHub-`main`. Der Compare-Endpunkt bestätigt für `0fa799e` → `4c1f614`: **108 Commits voraus, 0 dahinter**. Die GitHub-Liste der neuen Commits dokumentiert die Entwicklungsphasen zu Bewerbungsverwaltung, Anschreiben, Lebenslauf-Werkstatt, Session-CV-Verwaltung, Such-UX, Consent-Vorbereitung, Cache-Retirement und Lizenzinventur.

Die **letzte in den konsolidierten Reports nachgewiesene vollständige lokale Regression** lautet **1.414 Tests bestanden / 5 übersprungen**; der Produktions-Build bestand ebenfalls. Die E2E-Ergebnisse wurden lokal mit synthetischen Daten, Mock-APIs und simulierten Auth-Sessions ermittelt. Seit den anschließenden Repository-/Agenten-/Datenschutzdokumentations-Commits ist in diesen Reports **kein neuer vollständiger Testlauf und kein produktiver Live-End-to-End-Test** nachgewiesen.

**Aktuelle Gesamteinstufung:**

| Dimension | Konsolidierter Stand | Bedeutung |
|---|---|---|
| Repository `main` | **PUSHED / VERIFIED** | HEAD `4c1f614`; Git-Historie auf GitHub vorhanden |
| Kernfunktionen | **IMPLEMENTED / VERIFIED LOCAL** | Code in `main`, ältere lokale Regressionen/E2E belegt |
| Anwendungsversion | **2.2.0** | Keine automatische Erhöhung durch neue Commits |
| Persistente Bewerbungen und Builder-CVs | **NOT IMPLEMENTED IN JOBSEARCH** | Weiterhin Browser-Session-State; RIS-Anbindung fehlt |
| RIS-Storage-Consent | **PROPOSED / UI PREPARED / BLOCKED FOR ACTIVATION** | Keine verifizierte serverseitige Consent-Persistenz |
| CV-Profil-Redis-Cache | **REMOVED FROM PRODUCT CODE** | Frühere V2-Cache-Designs sind überholt |
| Historische Redis-Einträge | **NOT VERIFIED / PURGE BLOCKED** | Zielumgebung für kontrollierte Löschung nicht identifiziert |
| Lizenzmetadaten / DejaVu | **VERIFIED LOCAL, IN MAIN** | Drittsoftware-Gesamtprüfung bleibt teilweise offen |
| Produktion / Vercel | **NOT VERIFIED FOR THIS HEAD** | GitHub-Push ≠ unabhängiger Nachweis eines Live-Deployments |
| Datenschutz-/Rechtsfreigabe | **PENDING** | Neue öffentliche Inhalte und künftige Speicherung prüfen |

## 2. Entwicklungstabelle — Neue Funktionen und Integrationen

| Paket / Bereich | Konsolidierte Umsetzung | Aktueller Status | Wesentliche Nachweise / Grenzen |
|---|---|---|---|
| **JM-APPLICATION-MANAGEMENT UX-04/05A–C** | Bewerbungs-Cockpit mit Kennzahlen, Schnellfiltern, kompakten Bewerbungskarten, Wiedervorlagen, Detailtabs, Dokumenten-/Versionsansicht; Responsive- und Accessibility-Feinschliff | **IN MAIN · lokal verifiziert** | UX-05C-Integration; keine P0/P1-Befunde, verbliebene P2-Redundanzen ohne fachliche Änderung |
| **JM-APPLICATION-LETTER-REVISION 01A–E** | Anschreibenversionen vergleichen, KI-Verbesserung mit gesonderter Zustimmung, Wort-Diff, manuelle Korrektur, Version speichern und kontrolliert übernehmen | **IN MAIN · lokal verifiziert** | Nutzung der vorhandenen API; Vorschläge zunächst temporär; Versionierungs-/Session-Schutz; keine dauerhafte Archivierung |
| **JM-APPLICATION-LETTER-OPTIONS-01** | Sprache (DE/EN), Stil einschließlich `formal`, Länge und Verbesserungswunsch in bestehender Anschreiben-Pipeline | **IN MAIN · lokal verifiziert** | Stil und Länge werden nicht als eigenständige historische Metadaten versioniert |
| **JM-COVER-LETTER-PROFILE-HANDOFF-01** | Hinweise nach Anschreibenerstellung: Gäste zum Login, Angemeldete zur Bewerbungsverwaltung; Session-Verlust-Hinweis | **IN MAIN · lokal verifiziert** | Keine automatische Gastdatenmigration und keine Zusage dauerhafter Speicherung |
| **JM-DIRECT-COVER-LETTER 01A–D** | Direkte Anschreibenerstellung aus manuell erfasster Stelle, optionale URL, vorhandene KI-Pipeline, Übernahme in Sitzung, Versionierung | **IN MAIN · lokal verifiziert** | QA: Touch-Ziel/Fallback-Texte korrigiert; keine neuen RIS-Endpunkte |
| **JM-MANUAL-APPLICATION-DRAFT-01** | Manuelle Stelle als **Bewerbungsentwurf ohne KI-Anfrage** anlegen; später zum Anschreiben zurückkehren | **IN MAIN · lokal verifiziert** | `manual:<id>`; Session-only, Beschreibung nach Reload ggf. verloren |
| **JM-CV-BUILDER 01A** | Strukturierter Lebenslauf-Editor mit validierten Feldern und Session-State | **IN MAIN · lokal verifiziert** | Kein automatischer Import aus hochgeladenem PDF |
| **JM-CV-BUILDER 01B** | Live-Vorschau und Vorlagen **Klassisch / Modern / Kompakt**; responsive | **IN MAIN · lokal verifiziert** | Vorlagenauswahl pro Bearbeitung, keine dauerhafte Designpräferenz |
| **JM-CV-BUILDER 01C** | **Lokaler PDF-Export** mit A4-Seiten, auswählbarem Text, DejaVu-Unicode-Schriften, Browser-Download | **IN MAIN · lokal verifiziert** | `pdf-lib` und `@pdf-lib/fontkit`; keine serverseitige Speicherung; keine PDF/A-/A11y-Zertifizierung |
| **JM-CV-MANAGEMENT 02A–C** | Mehrere Builder-CV-Profile anlegen, bearbeiten, duplizieren, auswählen; Builder-CV für Anschreiben und Bewerbungsreferenzen verwenden | **IN MAIN · lokal verifiziert** | Zwei CV-Quellen (Upload vs. Builder) sauber getrennt; datensparsamer Serializer; CV-Referenzen können nach Löschen verwaisen |
| **JM-SEARCH-RESULTS-MOBILE-UX-04** | Kompakte Trefferübersicht, Trefferanzahl, Ergebnissprung, ausdrückliche KI-Bewertungsaktion | **IN MAIN · lokal verifiziert** | Kein Umbau von Suchprovidern, Quoten oder ATS-Logik |
| **JM-SEARCH-UX-03 + NAV** | Klarere Skills-Eingabe, Suchort-Hilfe, **5-km-Radius** als einmaliger manueller Standard, Scroll-/Navigationsverbesserungen | **IN MAIN · lokal verifiziert** | Bestehende Profil-/Adapter-Semantik beibehalten |
| **JM-PROFILE-STORAGE-CONSENT-01** | Profilbereich mit verständlicher Vorbereitung für freiwillige künftige Speicherung | **UI IN MAIN · Speicherung BLOCKED** | Keine echte Consent-API und keine persistente Speicherung aktivieren |
| **JM-PROFILE-CACHE-RETIREMENT-DOCS/MAIN** | Benutzer- und Datenschutzhinweise an entfernten CV-Profilcache angepasst, frühere Cache-Pläne historisch markiert | **IN MAIN · lokal verifiziert** | Historische Redis-Keys weiterhin nicht geprüft/gelöscht |
| **JM-PRIVACY-CACHE-STATEMENT-FIX-01** | Falschen Cache-Satz gezielt in `public/legal/datenschutz.md` und `public/datenschutz/index.html` korrigiert | **IN MAIN · Diff-Check berichtet** | Commit `fff0a37`; keine neue umfassende Rechtsfreigabe |
| **JM-THIRD-PARTY-LICENSE-INVENTORY/MAIN** | npm-/Font-Inventur; AGPL-Root-Metadaten; ausführlichere Third-Party-Notices | **IN MAIN · lokal verifiziert** | Volltext-/Lizenzpflichten- und Rechtsprüfung teilweise offen |
| **JM-WORKTREE-CONSOLIDATION-01** | `Mays-Jobsearch` als Hauptcheckout; drei redundante Worktrees entfernt; alte Änderungen mit Stash/Backup gesichert | **ABGESCHLOSSEN (laut Report)** | Vier lokale untracked Dokumente und temporäre Sicherung gehören nicht zum GitHub-Push |

## 3. Detaillierter Funktionsstand

### 3.1 Bewerbungen und Anschreiben

Bewerbungen können in der Browser-Sitzung verwaltet werden. Der Cockpit-Bereich bietet Status, Kennzahlen, Fälligkeiten und Wiedervorlagen. Historische Anschreibenversionen bleiben über die vorhandene Versionierungssemantik erhalten, **solange die zugehörige Sitzung besteht**. Für KI-Revisionen gibt es einen gesonderten Zustimmungsschritt; Vorschläge werden nicht ungefragt zu gespeicherten Versionen.

Eine neue Funktion erlaubt manuelle Stellenreferenzen mit oder ohne URL. Ein Anschreiben kann direkt erstellt und nach bewusster Aktion einer Sitzung-Bewerbung zugeordnet werden. Alternativ kann eine angemeldete Person die manuelle Stelle ohne KI-Anfrage zunächst als Entwurf anlegen und später die Anschreibenerstellung aufrufen. **„In die Bewerbungsverwaltung übernommen“ ist nicht gleichbedeutend mit serverseitig dauerhaft gespeichert.**

### 3.2 CV-Werkstatt und CV-Verwaltung

Die CV-Werkstatt besitzt einen strukturierten Editor, Live-Vorschau, drei Layoutvorlagen und einen lokalen, mehrseitigen A4-PDF-Export. Der PDF-Text ist auswählbar; DejaVu-Schriften unterstützen typische Unicode-/Umlaut-Fälle. Für spezielle Skripte wie CJK oder Emoji ist keine vollständige Abdeckung zugesichert.

Die spätere Verwaltung ergänzt mehrere Builder-Lebensläufe mit stabiler `cvb-`-ID, Duplikation, Vorlagenauswahl, Session-Repository und Editorintegration. Für Anschreiben kann wahlweise ein hochgeladenes CV oder ein Builder-Profil verwendet werden. Aus dem Builder wird nur ein zweckbezogener, datensparsamer Text erstellt; Datensparsamkeit ist **keine Garantie vollständiger Anonymisierung**. Bei gelöschtem Builder-Profil bleibt eine historische Bewerbungsreferenz ggf. als verwaist gekennzeichnet.

**Nicht enthalten:** Wiederherstellung nach Browser-Neuladen, echte serverseitige CV-Verwaltung, RIS-CV-Ownership-Vertrag, automatische Speicherung, Import aus beliebigen vorhandenen Lebensläufen, eigenständige CV-KI-Optimierung.

### 3.3 Stellensuche und Mobiloberfläche

Die Suchseite bietet eine verbesserte Trefferzusammenfassung und Navigation zu Ergebnissen. Die KI-Bewertung wird als eigene Aktion deutlich sichtbar. Skills- und Ortsangaben sind verständlicher; der 5-km-Radius ist im manuellen Suchformular als erster Standard vorgesehen. Suchprofile, Quellenadapter und Quotenlogik wurden durch diese UI-Pakete nicht neu entworfen.

## 4. Datenschutz, Auth und RIS-Abgrenzung

### 4.1 Bereits implementierte Grenzen

- **Identität:** Bei authentifizierten Funktionen basiert die verifizierte Besitzeridentität auf `iss + sub`; die E-Mail-Adresse ist kein Ersatz für eine verifizierte Identität.
- **Browser-Sitzung:** CV-Builder-Profile, Bewerbungen und manuelle Stellenentwürfe werden im Jobsearch-Frontend nicht dauerhaft gespeichert. Auth-Wechsel/Session-Invalidierung schützen gegen unbeabsichtigte Übernahme zwischen Personen; nach Reload können Daten fehlen.
- **KI-Verarbeitung:** Bestehende Consent- und Datensparsamkeitsmechanismen bleiben bestehen; tatsächliche externe Provider-Verarbeitung wurde in den neuen lokalen E2E-Läufen nicht live geprüft.
- **Cache:** Mit `049edda` wurde der frühere Redis-CV-Profilcache aus dem Produktcode entfernt. Frühere Berichte zu einer V2-Lösch-/Cookie-Architektur sind **SUPERSEDED** und keine neue Implementierungsaufgabe.

### 4.2 Historische Redis-Daten: eigenständiger offener Nachweis

Der gesonderte Bericht `JM-PRIVACY-CV-REDIS-PURGE-02` sagt ausdrücklich: produktives Upstash-Ziel nicht zuverlässig identifiziert; keine realen Löschungen; etwaige historische `cv-profile:*`-Einträge **NOT VERIFIED**. Eine 30-Tage-TTL allein gilt dort nicht als Löschbeleg. **Cache-Code entfernt** darf nicht zu **historischer Redis-Bestand sicher gelöscht** umgedeutet werden. Es wird hier kein neuer Purge angeordnet.

### 4.3 RIS-Speicherung: nicht freigeschaltet

`docs/contracts/JM-RIS-STORAGE-CONSENT-HANDOFF-V1.md` ist ausdrücklich **PROPOSED / NOT IMPLEMENTED / RIS EVIDENCE NOT VERIFIED**. Drei voneinander getrennte Speicherzwecke sind vorgesehen: `cv_storage`, `application_storage`, `search_profile_storage`. Zustimmung ist zweckgebunden, optional und vom KI-Provider-Consent getrennt. Für eine Aktivierung fehlen insbesondere serverseitiger Consent-Dienst und bestätigter Token-/Ownership-Nachweis, freigegebene Textversion, Widerruf, Aufbewahrungsfristen, Export-/Löschregeln und RIS-E2E-Evidence. Eine vorbereitete UI ist **keine erteilte oder gespeicherte Einwilligung**.

### 4.4 Öffentliche Datenschutztexte

Der neue Cache-Satz wurde in **beiden** öffentlichen Dateiquellen korrigiert (Commit `fff0a37`):

> „… zeitlich begrenzte browserseitige Profilzustände dokumentiert; neue CV-Profilanfragen werden ohne einen serverseitigen Profil-Cache verarbeitet.“

Die bestehende Erklärung wurde nicht neu erfunden oder insgesamt umgeschrieben. Die Fassung enthält weiterhin eigene Prüfvorbehalte; eine abschließende Datenschutz-/Rechtsfreigabe ist aus den technischen Reports nicht ersichtlich. Die vier lokal untracked wiederhergestellten Dokumente sind keine neu gepushten Website-Fassungen.

## 5. Lizenz- und Abhängigkeitsstand

| Thema | Stand | Einordnung |
|---|---|---|
| Projektlizenz | `AGPL-3.0-only` | `LICENSE.md` laut Inventur byte-identisch; Root-Metadaten in `package.json` und Lockfile ergänzt |
| Direkte Dependencies | 8 Runtime, 14 Dev | Metadaten untersucht; keine Versionsänderungen bei der Lizenzinventur |
| Transitive Dependencies | 197 erfasst | Keine fehlenden Lizenzmetadaten im damaligen Lockfile-Check; keine vollständige juristische Prüfung aller Volltexte |
| DOMPurify | MPL-2.0 **OR** Apache-2.0 | Wahl/Dokumentation der Apache-2.0-Option bei Distribution noch offen |
| DejaVu-Fonts | Vier TTF + Original-Lizenz | Schriftlizenz nach Report verifiziert; keine Änderung an Binärdateien |
| Dekorative Grafiken | Inventur meldete teilweise fehlende Provenienznachweise | Nutzerangabe: Grafiken wurden gemeinsam in ChatGPT erstellt. Kein neues forensisches Prüfprojekt veranlasst |
| Gesamtrechtsprüfung | PENDING | Metadateninventur ist keine abschließende Lizenz-/Datenschutzprüfung |

## 6. Qualitätssicherung — nachgewiesen, nicht hochgerechnet

| Prüfgegenstand | Zuletzt belegtes Ergebnis | Evidenzgrenze |
|---|---|---|
| Vollständige Unit-/Integrationstest-Suite | **1.414 PASS / 5 SKIPPED** | Mehrfach in Cache-Retirement-, Lizenz- und CV-Management-Reports; vor den letzten Dokumentations-Commits |
| Build (`npm run build`) | **PASS** | Lokal auf den damals geprüften Main-Ständen |
| Git-Diff-Checks | **PASS** | Für Integrations- und Datenschutz-Korrekturen berichtet |
| CV-PDF-E2E | **PASS** | Classic/Modern/Compact; Gast/angemeldet; responsive; lokal |
| CV-Management-E2E | **PASS** | Sechs Viewports, Session-Isolation, Auswahl, Orphans, Letter-Integration; Mock-Sessions |
| Bewerbungen/Anschreiben-E2E | **PASS** | Responsive, Dialoge, Versionen, manuelle Stellen, Entwürfe; synthetische Daten |
| Mobile Such-/Navigations-E2E | **PASS** | Lokale Browserprüfungen |
| Live-Provider / echte AWS-RIS-Endpunkte | **NICHT neu nachgewiesen** | Tests berichteten ausdrücklich Mock-/synthetische Daten |
| GitHub-Push | **VERIFIED** | GitHub-`main` `4c1f614`; Compare `0fa799e` → `4c1f614` = 108 ahead, 0 behind |
| Post-Push-CI / Vercel-Produktionsstand | **NICHT im Review geprüft** | Kein Rückschluss aus GitHub-Push allein |

**Bekanntes Restrisiko:** Intermittierende zeitabhängige Tests (`ApplicationsSection.test.tsx`, teils `ManualSearchProfiles.*`) wurden in älteren Läufen dokumentiert; bei reduzierter Worker-Anzahl bestand die vollständige Suite. Keine Tests wurden dafür deaktiviert. Diese Flakes nicht als vollständig behoben deklarieren.

## 7. Git, Worktrees und Versionsabgleich

| Element | Stand am 05.11.2026 | Kommentar |
|---|---|---|
| GitHub `main` | **`4c1f614`** | Zuletzt über GitHub-API geprüft |
| Vorheriger GitHub-`main` | `0fa799e` | GitHub-Vergleich: 108 Commits übernommen |
| Divergenz zum alten Stand | **108 ahead / 0 behind** | Fast-Forward-Abstammung; kein Force erforderlich gewesen |
| Projektversion | **`2.2.0`** | `package.json` unverändert auf 2.2.0 |
| `Mays-Jobsearch`-Arbeitsverzeichnis | `main` | Worktree-Konsolidierung laut Report abgeschlossen |
| Ehemalige Worktrees | Retirement, Lizenzinventur, Consolidation entfernt | Alle zugehörigen Commits/Dateien laut Git- und Dateibaum-Prüfung in `main` |
| Letzter GitHub-Commit | `4c1f614` | `docs: require approval before deleting branches` |
| Historische Sicherung | Stash + `/tmp/opencode/...` | Lokal; nicht als dauerhafte externe Sicherung bewerten |
| Vier untracked Dokumente | Lokal behalten, nicht committet | Deshalb **nicht** Bestandteil des GitHub-Commits; lokalen Working-Tree-Status nicht als völlig clean behaupten |
| Eigenständiges `Mays-Jobsearch-APP` | **Nicht Teil dieses Reports** | Keine Integration/Umbenennung behauptet |

**Historische Statuskorrektur:** Die zahlreichen früheren Reports mit `NO PUSH`, `NOT DEPLOYED`, `LOCAL MAIN` sind Zeitaufnahmen. *GitHub-Integration* ist inzwischen erfolgt; **Deployment und Freigaben bleiben separat nachzuweisen**. Insbesondere ist die Anzeige `2.2.0 · production · main · 0fa799e` aus dem früheren Nutzerstand **kein Nachweis für die aktuelle Produktions-SHA** nach dem Push.

## 8. Offene Punkte — ohne neue Großbaustelle

| Priorität | Thema | Genau benötigte Entscheidung / Prüfung | Nicht erforderlich |
|---|---|---|---|
| **P0 – vor Produktivfreigabe der neuen Fassung** | Produktions-/Autodeployment-Status | Vercel-Ziel-SHA, Build-/Deploymentstatus, Smoke-Test des tatsächlich ausgelieferten Stands und Rollback-Plan verifizieren | Kein Git-History-Rewrite |
| **P0 – rechtlich/Privacy** | Öffentliche Datenschutzhinweise | Tatsächliche Datenflüsse, KI-Dienstleister, Protokolle, Speicherfristen und Stand der veröffentlichten Erklärung gegen Produktivkonfiguration prüfen | Keine komplette Neuerstellung der bereits vorhandenen Dokumente |
| **P1 – wenn KI-Anschreiben live freigegeben werden** | API-Schutz und Provider-Nachweise | Bestehende `/api/cover-letter`-Abuse-Grenzen, Fehler-/Providerlogs, Datenschutz/Consent sowie Live-Provider-E2E abnehmen; ältere Report-Findings hierzu gezielt schließen | Keine neue KI-Pipeline |
| **P1 – vor dauerhafter RIS-Speicherung** | Consent, Ownership und Datenspeicherung | RIS-Backend-Vertrag, `iss + sub`, separate Zwecke, Freigabetexte, Widerruf, Erasure/Export, Retention und End-to-End-Nachweise | **Jetzt** keine Backend-Aktivierung |
| **P2 – gezielt bei nächster Wartung** | Bekannte Test-Flakes | Timing-/Parallelitätsprobleme reproduzierbar isolieren | Tests nicht deaktivieren |
| **P2 – vor relevanter Distribution** | Drittsoftwarepflichten | Fehlende Lizenzvolltext-/Notice-Pflichten und DOMPurify-Apache-Auswahl dokumentieren | Keine Bildforensik |
| **Separates historisches Gate** | Altdaten im Redis-CV-Profilcache | Nur bei konkreter Entscheidung zur Prüfung/Löschung alte Produktionsdaten verifizieren | Keine neue Cache-V2-Architektur |
| **Lokale Hygiene** | WIP-Stash und temporäres Backup | Bei Gelegenheit dauerhaft und sicher sichern, ehe `/tmp` verschwindet; lokale untracked Docs bewusst behalten | Kein erzwungener Cleanup |

## 9. Abschlussentscheidung

**GITHUB MAIN / CODE CONSOLIDATION: VERIFIED.**  
**LOCAL TEST EVIDENCE: VERIFIED (historischer Main-Stand; letzte volle Suite 1414/5).**  
**FEATURES: IMPLEMENTED IN REPOSITORY.**  
**PRODUCTION FOR CURRENT GITHUB HEAD: NOT VERIFIED.**  
**RIS DURABLE STORAGE / STORAGE CONSENT: NOT ACTIVATED / BLOCKED.**  
**LEGAL/PRIVACY REVIEW: PENDING.**

**Empfohlener nächster eng begrenzter Schritt:** Read-only-Prüfung von Vercel-Deployment und Live-SHA, gefolgt von einem kleinen, freigegebenen Smoke-Test. Keine neuen Features, keine weitere Worktree-Konsolidierung, keine Lizenz-/Bildforensik.

## 10. Quellenindex — direkte GitHub-Reports

GitHub-Pfade sind relativ zum Repository `maynowak/mays-jobsearch`, Branch `main`. Die folgenden Dokumente wurden für diese Konsolidierung direkt gelesen; frühere Zwischenstände wurden anhand der späteren Integrationsberichte eingeordnet.

**Bewerbungsverwaltung/Anschreiben**

- [`JM-APPLICATION-MANAGEMENT-UX-05C-MAIN-INTEGRATION-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-APPLICATION-MANAGEMENT-UX-05C-MAIN-INTEGRATION-01.md)
- [`JM-APPLICATION-MANAGEMENT-UX-05C`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-APPLICATION-MANAGEMENT-UX-05C.md)
- [`JM-APPLICATION-LETTER-REVISION-01-CONSOLIDATED`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-APPLICATION-LETTER-REVISION-01-CONSOLIDATED.md)
- [`JM-APPLICATION-LETTER-REVISION-MAIN-INTEGRATION-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-APPLICATION-LETTER-REVISION-MAIN-INTEGRATION-01.md)
- [`JM-APPLICATION-LETTER-OPTIONS-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-APPLICATION-LETTER-OPTIONS-01.md)
- [`JM-COVER-LETTER-PROFILE-HANDOFF-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-COVER-LETTER-PROFILE-HANDOFF-01.md)
- [`JM-DIRECT-COVER-LETTER-01D-FINAL-QA`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-DIRECT-COVER-LETTER-01D-FINAL-QA.md)
- [`JM-DIRECT-COVER-LETTER-MAIN-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-DIRECT-COVER-LETTER-MAIN-01.md)
- [`JM-MANUAL-APPLICATION-DRAFT-MAIN-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-MANUAL-APPLICATION-DRAFT-MAIN-01.md)

**CV / Suche**

- [`JM-CV-BUILDER-01A`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-CV-BUILDER-01A.md), [`01B`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-CV-BUILDER-01B.md), [`01C`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-CV-BUILDER-01C.md)
- [`JM-CV-MANAGEMENT-02A`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-CV-MANAGEMENT-02A.md), [`02B`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-CV-MANAGEMENT-02B.md), [`02C`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-CV-MANAGEMENT-02C.md), [`MAIN`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-CV-MANAGEMENT-MAIN-01.md)
- [`JM-SEARCH-RESULTS-MOBILE-UX-04`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-SEARCH-RESULTS-MOBILE-UX-04.md)
- [`JM-SEARCH-UX-03`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-SEARCH-UX-03.md)

**Consent / Datenschutz / Git / Lizenz**

- [`JM-PROFILE-STORAGE-CONSENT-MAIN-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-PROFILE-STORAGE-CONSENT-MAIN-01.md)
- [`JM-RIS-STORAGE-CONSENT-HANDOFF-V1`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/contracts/JM-RIS-STORAGE-CONSENT-HANDOFF-V1.md)
- [`JM-PROFILE-CACHE-RETIREMENT-DOCS-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-PROFILE-CACHE-RETIREMENT-DOCS-01.md)
- [`JM-PROFILE-CACHE-RETIREMENT-MAIN-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-PROFILE-CACHE-RETIREMENT-MAIN-01.md)
- [`JM-PRIVACY-CV-REDIS-PURGE-02`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-PRIVACY-CV-REDIS-PURGE-02.md)
- [`JM-REMOTE-MAIN-MERGE-02`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-REMOTE-MAIN-MERGE-02.md)
- [`JM-THIRD-PARTY-LICENSE-INVENTORY-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-THIRD-PARTY-LICENSE-INVENTORY-01.md)
- [`JM-THIRD-PARTY-LICENSE-MAIN-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-THIRD-PARTY-LICENSE-MAIN-01.md)
- [`JM-WORKTREE-CONSOLIDATION-01`](https://github.com/maynowak/mays-jobsearch/blob/main/docs/reports/JM-WORKTREE-CONSOLIDATION-01.md)
- [`Öffentliche Datenschutzerklärung (Repository-Quelle)`](https://github.com/maynowak/mays-jobsearch/blob/main/public/legal/datenschutz.md)

**Quellenmethodik:** Der aktuelle Branch-HEAD, der GitHub-Vergleich zu `0fa799e` und die Paketversion wurden direkt gelesen. Die Testergebnisse und historischen Arbeitszustände stammen aus den jeweiligen veröffentlichten Ausführungsreports; sie wurden nicht eigenständig erneut ausgeführt. Der Bericht ist eine technische Konsolidierung und keine Rechtsberatung oder produktive Freigabe.
