# JM-PROFILE-CACHE-DELETE-03-AUDIT

**Art:** Security-/Privacy-Audit (read-only)
**Baseline:** `c246868`
**Status:** AUDIT COMPLETE — no code, API, AWS or deployment change

## 1. Ist-Architektur

### Schreibpfad

`api/profile.mjs`:

1. Nimmt `{ text, hash?, model? }` entgegen.
2. Berechnet den Cache-Key **ausschließlich serverseitig**:
   `sha256(text)` → `cv-profile:<hash>`.
3. Ein clientseitig gesendeter `hash` wird nur auf Abweichung geprüft und
   verworfen; er steuert weder Key noch Berechtigung.
4. Bei Cache-Miss wird der Text an den Modellpfad gesendet; das Ergebnis
   (`skills`, `experienceLevel`, `targetRoles`, `location`) wird mit
   `SETEX` unter `cv-profile:<hash>` für **30 Tage** gespeichert.

### Lesepfad

- `cacheGet('cv-profile:<hash>')` liefert bei Treffer das gespeicherte
  `SuggestedProfile` zurück, ohne Modellaufruf.
- Der Key ist inhaltsbezogen, nicht benutzerbezogen. Identischer
  (anonymisierter/normalisierter) Text trifft denselben Eintrag.
- `mj_session` wird für Quoten genutzt, nicht für diesen Cache.

### Löschpfad

- Für `cv-profile:*` existiert **kein** `cacheDel`-Aufruf.
- `handleCvRemoveData` löscht lokalen React-State, Session-Listen und
  Legacy-localStorage. Der Server-Cache bleibt bestehen.
- `cacheDel` wird nur für Apify-Datasets verwendet.
- Einziger Ablaufmechanismus ist die 30-Tage-TTL.

### Redis-Ausfall

`cacheGet`/`cacheSet`/`cacheDel` sind fail-safe: Fehler werden zu `null`
bzw. No-op. Die Profilgenerierung funktioniert weiter (Cache-Miss), ein
Löschaufruf würde bei Redis-Ausfall ebenfalls stillschweigend nichts tun.

## 2. Datenfluss und Aufbewahrung

| Datenkategorie | Ort | Aufbewahrung | Löschung |
|---|---|---|---|
| PDF-Datei | Browser-Heap | Sitzung | Reload/„CV-Daten entfernen“ |
| Extrahierter/verarbeiteter Text | Browser, Request-Body | transient | Request-Ende |
| Abgeleitetes Profil | React-State | Sitzung | Reload/„CV-Daten entfernen“ |
| Session-Profillisten | Browser-Map | 12h lazy TTL | Reset/Reload/Ablauf |
| Server-Profil-Cache | Upstash Redis | 30 Tage | nur TTL |
| Modellverarbeitung | externer Provider | außerhalb des Repos | nicht verifizierbar |

Der Server-Cache enthält **kein Roh-CV**, aber abgeleitete strukturierte
Profildaten inklusive Standort. Er ist damit personenbezogen genug, um nicht
als reine Betriebsdiagnostik zu gelten.

## 3. Bestehende Löschgrenzen

- „CV-Daten entfernen“ / „Endgültig entfernen“ ist **lokal** vollständig,
  aber **nicht** serverseitig.
- Die UI-Formulierung kann eine weitergehende Löschung suggerieren.
- Der Cache ist inhaltlich geteilt: Löschen eines Eintrags würde alle
  Anfragen mit demselben Text betreffen.
- Es gibt keine Eigentümerzuordnung, keine authentifizierte Löschberechtigung
  und keine Idempotenz-/Rate-Limit-Semantik für eine Löschung.

## 4. Sicherheitsrisiken

1. **Unautorisierte Löschung (falls naiv implementiert):** Ein
   `DELETE`-Endpunkt, der einen Client-Hash akzeptiert, wäre ein
   Availability-Angriff: Wer einen Hash kennt oder erraten kann, könnte
   fremde Cache-Einträge löschen. Der aktuelle Client-Hash ist kein
   Berechtigungsnachweis.
2. **Gemeinsame Einträge:** Ein inhaltsbasierter Key teilt Ergebnisse
   zwischen Anfragen. Eine Löschung „für einen Benutzer“ ist technisch nicht
   sauber abgrenzbar.
3. **Kein Löschfeedback:** Redis-Ausfall oder fehlender Key würde bei einem
   naiven Endpunkt leicht als Erfolg gemeldet.
4. **Datenschutz-Erwartung:** „Endgültig entfernen“ deckt den Server-Cache
   nicht ab; das ist eine Kommunikations-/Vertragslücke, kein neuer
   Datenfluss.
5. **Kein Geheimnis im Hash:** Der Hash ist aus dem Text ableitbar; er ist
   kein Authentifizierungsmerkmal.
6. **Externe Provider:** Eine lokale Löschung kann bereits erfolgte
   Provider-Verarbeitung nicht rückgängig machen. Diese Grenze bleibt.

## 5. Lösungsvarianten

| Variante | Sicherheit | Datenschutz | Kosten/Aufwand | Gastbetrieb |
|---|---|---|---|---|
| A. TTL + transparente Aufbewahrungsinformation | mittel | mittel | sehr niedrig | unverändert |
| B. Autorisierte explizite Cache-Löschung | hoch, wenn session-gebunden | hoch | mittel; neue Route + Tests | unverändert, kein Login |
| C. Kein serverseitiger Cache für Profilergebnisse | hoch | hoch | höhere Modellkosten/Latenz | funktioniert, aber teurer |
| D. Session-gebundene Cache-Zuordnung | hoch | hoch | mittel; Cache-Reuse sinkt | unverändert |
| E. Cache nur für anonymisierte Ergebnisse | mittel | mittel–hoch | niedrig | unverändert |

### Bewertung

- **A** ist sofort möglich, beseitigt aber nicht die Löschgrenze.
- **B** ohne **D** ist nicht sauber: Ein inhaltsbasierter Key hat keinen
  Eigentümer. B braucht eine Eigentümer-/Session-Bindung.
- **C** ist am sichersten, erhöht aber Kosten und Modelllast deutlich.
- **D** ist die kleinste tragfähige technische Grundlage für eine sichere
  Löschung: Key z. B. `cv-profile:<sessionHash>:<contentHash>`, wobei
  `sessionHash` serverseitig aus dem HttpOnly-Session-Cookie abgeleitet wird.
  Damit kann ein Löschaufruf ausschließlich den eigenen Eintrag entfernen.
- **E** reduziert das Risiko für nicht anonymisierte Inhalte, ersetzt aber
  keine Löschung.

## 6. Priorisierte Empfehlung

1. **Sofort (Dokumentation/UI):** Aufbewahrungs- und Löschgrenze präzise
   benennen. „CV-Daten entfernen“ darf nicht als serverseitige Löschung
   verstanden werden. Keine Codeänderung in diesem Audit.
2. **Nächstes Implementierungspaket:** Session-gebundene Cache-Zuordnung
   (D) plus autorisierte Löschung (B), ohne Loginpflicht und ohne RIS.
3. **Optional:** Keine Cache-Speicherung für den Modus „nicht anonymisiert“
   (E), da dort der abgeleitete Standort besonders sensibel sein kann.
4. **Nicht empfohlen:** Client-Hash-basierte Löschung ohne Session-Nachweis.

## 7. Abnahmekriterien für eine spätere Implementierung

- Löschberechtigung ausschließlich über serverseitig verifizierte
  Session-/Identitätsbindung; kein Client-Hash als Autorität.
- Key enthält eine serverseitig abgeleitete Session-Komponente.
- Löschung entfernt nur den eigenen Eintrag; fremde/gemeinsame Einträge
  bleiben unberührt.
- Idempotent: wiederholte Löschung liefert denselben sicheren Status ohne
  Existenzleck.
- Redis-Ausfall wird als „nicht gelöscht“ kommuniziert, nicht als Erfolg.
- Rate-Limit gegen Lösch-Missbrauch.
- Kein Login-Zwang; Gast-Workflow bleibt vollständig.
- Tests: ohne Session, fremde Session, fremder Hash, Wiederholung,
  Redis-Ausfall, TTL unverändert, Gast-E2E unverändert.
- UI-/Datenschutztext beschreibt lokale vs. serverseitige Löschung exakt.
- Keine automatische RIS-Speicherung und keine Kontopflicht.

## 8. Offene Produkt-/Datenschutzentscheidungen

1. Soll der Cache überhaupt benutzerübergreifend geteilt bleiben
   (Kosten) oder session-gebunden werden (Isolation)?
2. Soll „nicht anonymisiert“ überhaupt gecacht werden?
3. Wie lange ist 30 Tage fachlich gerechtfertigt, und wie wird das
   transparent kommuniziert?
4. Soll eine Löschung optional auch den Provider-Auftrag betreffen
   (technisch derzeit nicht steuerbar)?
5. Wie wird die spätere freiwillige RIS-Kontospeicherung von diesem Cache
   getrennt und im Erasure-Lifecycle behandelt?

## 9. Geprüfte Quellen

- `api/profile.mjs`
- `api/_lib/cache.mjs`
- `src/App.tsx` (`handleCvRemoveData`)
- `src/api.ts`
- `docs/reports/PERSISTENCE-BOUNDARY-01-EXECUTION_LOG.md`
- `docs/contracts/JOBMATCHER-API-SESSION-BOUNDARY-01.md`
- `docs/mays_job_matcher_datenschutzerklaerung_1.0.txt`

Keine Code-, API-, AWS- oder Deployment-Änderung. Keine echten CV- oder
Providerdaten verwendet.
