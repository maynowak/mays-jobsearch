# JM-PROFILE-CACHE-DELETE-03-AUDIT — EXECUTION LOG

## Status

AUDIT COMPLETE — **YELLOW** — read-only, keine Code-/API-/Redis-/AWS-/
Deployment-Änderung.

## Zeit / Baseline

- Audit-Zeitpunkt: 2026-10-31 13:47 (Europe/Berlin)
- Bekannte Baseline des Auftrags: `c246868`
- Branch: `main`
- HEAD bei Abschluss: `aec3ef9` (`docs: record security decision commit`)
- Nachweis Baseline-Konstanz: `git diff c246868..aec3ef9 -- api src` ist leer;
  der geprüfte Produktivcode ist seit der Baseline unverändert.
- Re-Verifikation der bereits vorhandenen Audit-Datei (Erstfassung aus
  Commit `0bb8e0b`) gegen den aktuellen Code.

## Scope

Analyse der Lösch- und Aufbewahrungssemantik des serverseitigen
CV-Profil-Caches (`cv-profile:<sha256>`) einschließlich:

- Cache-Schreib-, Lese-, TTL- und Löschpfade
- Cache-Key-Ableitung und Client-Hash
- anonyme Sitzungsidentität (`mj_session`)
- Zugriff auf Cache-Daten und geteilte Einträge
- Risiken unberechtigter Löschanforderungen
- Redis-Ausfallverhalten
- Mehrfachaufrufe / Wiederholbarkeit / Races
- Datenschutzvertrag (fünf Ebenen) und Prüfung der Datenschutzhinweise
- Lösungsvarianten und Abnahmekriterien
- Gast-Kompatibilität (keine Kontopflicht, keine RIS-Speicherung, 10/2/5)

Nicht im Scope: RIS-Implementierung, AWS, Provider-Verträge, Browser-Cache-
Header-Audit, Penetrationstest.

## Abgeschlossene Abschnitte

1. Bestandsanalyse der genannten Dateien — abgeschlossen
2. Sicherheitsanalyse (Key, Client-Hash, Session, Zugriff, Löschmissbrauch,
   Redis-Ausfall, Mehrfachaufrufe) — abgeschlossen
3. Datenschutzvertrag (5 Ebenen) und Claim-Prüfung der Hinweise — abgeschlossen
4. Lösungsvarianten A–E — abgeschlossen
5. Gast-Kompatibilität — abgeschlossen
6. Bericht `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT.md` — erstellt
7. Auditlog-Eintrag — erstellt

## Tatsächliche Findings

1. Cache-Key = `cv-profile:` + `sha256(empfangener Text)`, ausschließlich
   serverseitig (`api/profile.mjs:13-15,107`).
2. Client-Hash wird nur geprüft und bei Abweichung verworfen
   (`api/profile.mjs:89,108-110`); keine Key-/Berechtigungswirkung.
3. TTL 30 Tage via `SETEX` (`api/profile.mjs:7`, `api/_lib/cache.mjs:41-43`);
   kein TTL-Refresh beim Lesen.
4. Kein `cacheDel` für `cv-profile:*`; einziger Produktivaufruf ist
   Apify-Dataset (`api/_lib/sources/apify/index.mjs:86`).
5. „CV-Daten entfernen“ ist rein lokal (`src/App.tsx:679-735`).
6. `mj_session` ist shape-validiert, nicht signiert/registriert
   (`api/_lib/identity.mjs:32-45`) und wird im Profilpfad nicht gelesen.
7. Redis-Fehler → `null`/No-op; `cacheDel` liefert keinen Status
   (`api/_lib/cache.mjs:10-47`).
8. Datenschutzerklärung nennt den Cache, aber ohne Dauer; „Endgültig
   entfernen“ und der unkonditionale Anonymisierungs-Satz sind zu stark
   (`src/i18n.tsx:59-60,704-705,846`).
9. Paralleler/verspäteter Modell-Response kann einen gelöschten Eintrag
   wiederherstellen — heute unkritisch (keine Löschung), für die Zukunft
   relevant.
10. Ein client-hash-basierter Lösch-Endpoint wäre eine unautorisierte
    Verfügbarkeitsänderung an fremden, geteilten Einträgen.

## Evidence / Dateireferenzen

- `api/profile.mjs:6-19,86-117,135-166`
- `api/_lib/cache.mjs:3-47`
- `api/_lib/identity.mjs:3-56`
- `api/_lib/sources/apify/index.mjs:86`
- `src/App.tsx:512-522,628-645,679-735,888-977`
- `src/api.ts:125-164,271-284`
- `src/lib/cvProfileStore.ts:13,79,249-255`
- `src/i18n.tsx:59-60,196-201,704-705,782-787,841-846,1186`
- `src/components/CvUpload.tsx:88`, `CvProfilesOverlay.tsx:92`,
  `CvAnonymizationChoice.tsx:19-23`
- `tests/api/profile-cache.test.mjs:60-146`
- `src/App.test.tsx:1338-1379` (Remove-Test)
- `docs/mays_job_matcher_datenschutzerklaerung_1.0.md:36-63`
- `docs/contracts/JOBMATCHER-API-SESSION-BOUNDARY-01.md:28,122`
- `docs/reports/PERSISTENCE-BOUNDARY-01-EXECUTION_LOG.md:20,83,129`

## Klassifikation

**YELLOW** — begrenzte, dokumentierte Aufbewahrung (30 Tage), kein akuter
Vertraulichkeitsbruch, aber fehlende Löschmöglichkeit, geteilte Einträge,
kein Eigentumsnachweis und eine zu starke UI-Formulierung. Kein RED, da keine
unautorisierte Exposition und keine falsche Löschbehauptung im Rechtstext
gefunden wurde.

## Terraform-Checks

Keine ausgeführt (read-only Audit, keine Infrastruktur im Scope).

## Unabhängige Gegenprüfung

- Read-only Cross-Check der zehn Kernaussagen gegen den Code durchgeführt.
- Ergebnis: alle zehn Aussagen bestätigt; keine falsche Aussage gefunden.
- Korrigiert wurden nur Präzisierungen: Key über den **getrimmten** Text
  (`api/profile.mjs:88,107`), Funktionsende `createProfileFromPdf` `:888-977`,
  Test-Spanne `src/App.test.tsx:1338-1379`, Quellenangabe zur
  Fallback-Grenze (`src/api.ts:89-95,125-164`), Hinweis auf das globale
  Provider-Monatslimit (`api/_lib/providers/index.mjs:76`).

## Git-Status bei Abschluss

- Branch `main`, HEAD `aec3ef9`
- Geändert: `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT.md`
- Neu: `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT-EXECUTION_LOG.md`
- Geändert: `docs/AI_AUDITLOG.md`
- Unverändert: `src/`, `api/`, `tests/`, Konfiguration, Infrastruktur
- Vorbestehende, unabhängige untracked Dateien wurden nicht angefasst.

## Bestätigung

- Keine produktiven Codeänderungen.
- Keine API-, Redis-, AWS-, Cognito- oder Terraform-Änderung.
- Kein Deployment.
- Keine echten CV-, Provider- oder Redis-Daten verwendet.
- Tests: keine ausgeführt (Audit-only; vorhandene Tests nur referenziert).

## Offene Fragen

1. Cache weiterhin benutzerübergreifend teilen oder session-binden?
2. „Nicht anonymisiert“ cachen?
3. Sind 30 Tage fachlich gerechtfertigt und wie kommuniziert?
4. Provider-seitige Löschung möglich/erforderlich?
5. Trennung von späterer RIS-Kontospeicherung?
6. Alt-Keys administrativ löschen oder per TTL auslaufen lassen?
7. Lebensdauer des signierten Gast-Cookies?
8. Reicht UI-Klarstellung als Übergang, oder Cache sofort deaktivieren?

## Risiken

- Ohne Implementierung bleibt eine Diskrepanz zwischen lokaler
  Löscherwartung und serverseitiger Aufbewahrung.
- Eine naive Löschimplementierung könnte fremde Einträge löschen oder
  Redis-Ausfall als Erfolg melden.
- Eine Session-Bindung senkt die Cache-Hit-Rate und erhöht Modellkosten.

## Empfohlene nächste Aktionen

1. Produkt-/Datenschutzentscheidung zu den offenen Fragen (Abschnitt 15 des
   Berichts).
2. Danach Implementierungsfreigabe für Variante D + B auf Basis des
   Design-Gates; optional E.
3. UI-Hinweis präzisieren (lokale vs. serverseitige Löschung, 30 Tage).

## Resume-Punkt

Audit abgeschlossen. Bericht, Execution Log und AI_AUDITLOG-Eintrag sind
committet (`a89727b`, nur Dokumentation). Nächster sinnvoller Einstieg:
Entscheidungsvorlage zu Abschnitt 15, nicht erneute Ist-Analyse.
