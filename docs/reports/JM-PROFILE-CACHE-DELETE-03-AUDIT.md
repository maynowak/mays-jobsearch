# JM-PROFILE-CACHE-DELETE-03-AUDIT

**Art:** Security-/Privacy-Audit (read-only, Architekturentscheidung vorbereitend)
**Bekannte Baseline:** `c246868`
**Re-Verifikation:** `aec3ef9` (2026-10-31) — `git diff c246868..aec3ef9 -- api src` ist leer; alle Befunde
beziehen sich auf unveränderten Produktivcode seit der Baseline.
**Branch:** `main`
**Status:** AUDIT COMPLETE — YELLOW; keine Code-, API-, Redis-, AWS- oder Deployment-Änderung
**Scope:** Lösch- und Aufbewahrungssemantik des serverseitigen CV-Profil-Caches
(`cv-profile:<sha256>`) einschließlich Client-Hash, anonymer Sitzungsidentität,
Redis-Ausfallverhalten, Datenschutzvertrag und Gast-Kompatibilität.

**Methode:** Gezielte Datei-Lektüre, repository-weite Suche nach Cache-/Lösch-/Session-Pfaden,
Abgleich mit vorhandenen Tests. Verhalten ist aus dem Code abgeleitet und als
„Code-inferred“ gekennzeichnet, wo kein Laufzeitnachweis geführt wurde. Es wurden
keine echten CV-, Provider- oder Redis-Daten verwendet.

> **Keine neue API implementiert.** Dieses Dokument beschreibt den Ist-Zustand und
> bewertet Varianten. Die spätere Design-/Entscheidungsebene ist bereits in
> `docs/reports/JM-PROFILE-CACHE-DELETE-03-DESIGN-GATE.md` (Design-Gate, Commit
> `481218b`) und `docs/reports/JM-PROFILE-CACHE-DELETE-03-SECURITY-DECISION-04.md`
> (Commit `ecdb1e1`) dokumentiert; dieses Audit wiederholt diese Entwürfe nicht,
> sondern liefert die prüfbare Grundlage dafür.

---

## 0. Management Summary

1. Der Cache-Key wird **ausschließlich serverseitig** aus dem empfangenen Text
   gebildet (`sha256(text)` → `cv-profile:<hash>`). Ein clientseitig gesendeter
   Hash wird nur auf Abweichung geprüft und auf `console.warn` reduziert; er
   steuert weder Key noch Berechtigung (`api/profile.mjs:104-117,153-155`).
2. Der Cache ist **inhaltsadressiert, nicht besitzergebunden**. Er ist damit
   weder einem Konto noch einer Sitzung zugeordnet; identischer Text trifft
   denselben Eintrag über Geräte, Browser und Nutzer hinweg.
3. Für `cv-profile:*` existiert **kein Löschpfad**. `cacheDel` wird im gesamten
   Repository nur für Apify-Datasets aufgerufen, nicht für Profil-Caches.
   Einziger Ablaufmechanismus ist die 30-Tage-TTL.
4. „CV-Daten entfernen“ löscht lokal vollständig (Dokumente, React-State,
   12h-Listen, Legacy-localStorage), aber **keine serverseitigen Daten**.
5. Die **Datenschutzerklärung ist überwiegend konsistent** mit dem Code: Sie
   nennt einen „zeitlich begrenzten serverseitigen Cache für strukturierte
   Profilinformationen“, ohne 30 Tage zu beziffern, und schließt eine
   vollständige Löschung ausdrücklich nicht ein. Die **UI-Formulierung
   „Endgültig entfernen“** ist dagegen enger gefasst als der tatsächliche
   Geltungsbereich und nennt den Server-Cache nicht.
6. Redis-Ausfall ist **fail-safe** (Miss/No-op), aber für eine künftige
   Löschung **nicht ehrlich genug**: `cacheDel` liefert keinen Status, ein
   Löschaufruf könnte einen Ausfall stillschweigend als Erfolg darstellen.
7. Eine client-hash-basierte Löschung wäre eine **unautorisierte
   Verfügbarkeitsänderung** und würde zudem fremde, geteilte Einträge treffen.
   Sie ist als Lösungsweg auszuschließen.

**Klassifikation: YELLOW.** Kein akuter Vertraulichkeitsbruch, aber eine
dokumentierte Aufbewahrungs-/Löschlücke mit Kommunikationsrisiko und einer
Implementierungsentscheidung, die vor einer Produktzusage nötig ist.

---

## 1. Überprüfte Ist-Architektur

### 1.1 Schreibpfad

`api/profile.mjs`:

| Schritt | Verhalten | Referenz |
|---|---|---|
| Eingabe | `POST { text, hash?, model? }`, `x-mj-attempt` optional | `:86-89` |
| Validierung | Text nicht leer, max. 30 000 Zeichen; Hash nur per Regex `^[a-f0-9]{32,128}$` | `:6,17-19,91-102` |
| Key-Ableitung | `hashText(text)` = `sha256(trimmed text, "utf8")` → `cv-profile:<hash>` | `:9-15,88,107` |
| Client-Hash | wird bei Abweichung verworfen (`console.warn`), nie für den Key benutzt | `:89,108-110` |
| Cache-Read | `cacheGet('cv-profile:<hash>')`; bei gültigem Objekt sofortige Antwort | `:112-117` |
| Modellaufruf | `chat({ system, prompt, json:true, temperature:0.2, maxTokens:900, model })` (Prompt-Aufbau `:119-133`, Aufruf `:135-143`) | `:135-143` |
| Parsing | `parseProfile` akzeptiert nur `skills[]`, `experienceLevel`, `targetRoles[]`, `location`; sonst `502 bad_ai_response` | `:49-75,145-151` |
| Cache-Write | `cacheSet(key, profile, 30*24*60*60)` → `SETEX` | `:7,153-155` |

### 1.2 Lesepfad

- Ein Treffer liefert das gespeicherte `SuggestedProfile` **ohne Modellaufruf**
  (`api/profile.mjs:113-116`; belegt durch `tests/api/profile-cache.test.mjs:60-71`).
- Der Key ist inhaltsbezogen; es gibt keinen Sitzungs-, Konto- oder
  Mandantenanteil.
- `mj_session` wird im Profilpfad **nicht gelesen** — `api/profile.mjs`
  importiert weder `identity.mjs` noch Usage-/Quota-Helfer.

### 1.3 TTL-Semantik

- `SETEX` setzt eine **absolute** Ablaufzeit von 30 Tagen ab dem Schreibzeitpunkt
  (`api/_lib/cache.mjs:41-43`).
- Ein **Cache-Hit verlängert die TTL nicht** (kein `EXPIRE` im Lesepfad).
- Nach Ablauf entsteht beim nächsten identischen Text ein neuer Eintrag mit
  erneut 30 Tagen. Die Aufbewahrung ist damit „30 Tage ab letzter
  (Re-)Generierung“, nicht „30 Tage ab Ersterfassung“.
- Ohne Redis-Konfiguration oder bei Redis-Fehler wird nicht geschrieben; die
  Antwort ist trotzdem erfolgreich (Cache ist rein optional).

### 1.4 Löschpfad

- **Es existiert kein Löschpfad für `cv-profile:*`.** Repository-weite Suche
  nach `cacheDel`: einziger Produktivaufruf in
  `api/_lib/sources/apify/index.mjs:86` (Dataset-Key).
- `handleCvRemoveData` (`src/App.tsx:679-735`) führt ausschließlich lokale
  Schritte aus:
  1. `resetCvProfileLists()` → leert die Modul-`Map` aller 12h-Listen
     (`src/lib/cvProfileStore.ts:249`),
  2. `purgeLegacyCvListsFromLocalStorage()` → entfernt `mj-cv-lists:*`
     (`src/lib/cvProfileStore.ts:255`),
  3. React-Resets auf `cvState`-Initialwerte (Dokumente, Consent, Profile,
     ATS-/Improvement-Ergebnisse, Auswahl-IDs).
- Ein Einzel-Dokument-Remove (`handleRemoveCvDocument`, `src/App.tsx:628-645`)
  hat ebenfalls keinen Serverbezug.
- Der Bestätigungsdialog ist lokal formuliert („Alle CV-Dokumente und
  gespeicherten Profil-Listen wirklich entfernen?“,
  `src/i18n.tsx:843-846`), der Button heißt aber „Endgültig entfernen“.

### 1.5 Endpoint-Eigenschaften (relevant für Löschanforderungen)

- `Access-Control-Allow-Origin: *`, `Allow-Headers: Content-Type`, kein
  Credentials-Header (`api/profile.mjs:78-80`).
- Keine Authentifizierung, keine Sitzungsbindung, kein Rate-Limit, keine
  Usage-/Quota-Prüfung im Handler. (Der AI-Pfad selbst prüft ein globales
  Provider-Monatslimit: `api/_lib/providers/index.mjs:76`.)
- Nur `POST`; `OPTIONS` → `204`; andere Methoden → `405` (`:80-83`).

---

## 2. Cache-Key-Ableitung und Client-Hash

### 2.1 Ableitung

```
client: normalizeText(anonymizeText?(pdfText))      // src/App.tsx:919-926
        sha256Hex(normalized) → doc.hash            // src/App.tsx:512-522
        POST /api/profile { text: normalized, hash } // src/api.ts:271-284

server: hash = sha256(received text)                // api/profile.mjs:13-15
        key  = "cv-profile:" + hash                 // api/profile.mjs:9-11
```

Der Client-Hash und der Server-Hash sind nur dann identisch, wenn der Client
exakt den Text sendet, den er gehasht hat. Das ist im Normalpfad der Fall
(`src/App.tsx:925-926,944`), ist aber **keine Sicherheitsannahme**: Der Server
verlässt sich nicht darauf.

### 2.2 Client-Hash-Verhalten

- `isHash` akzeptiert `[a-f0-9]{32,128}` (nicht nur 64 Zeichen).
- Der Wert wird kleingeschrieben und nur verglichen.
- Bei Abweichung: `console.warn("[/api/profile] ignoring mismatched client hash")`
  — **kein Fehler, keine Ablehnung**.
- Der Client-Hash hat damit heute **null Autorität**. Er ist weder
  Cache-Selektor noch Löschberechtigung.

### 2.3 Beweislage

`tests/api/profile-cache.test.mjs` belegt:

- Cache-Hit liefert das Profil ohne AI-Aufruf und ohne erneutes `cacheSet`
  (`:60-71`).
- Cache-Miss schreibt unter `cv-profile:<sha256(text)>` (`:72-93`).
- Ein **fremder** Client-Hash wird ignoriert: gelesen wird
  `cv-profile:<hash(text)>`, nicht `cv-profile:<clientHash>` (`:94-118`).
- Unbrauchbare Modellantwort → `502`, **kein** Cache-Write (`:119-129`).
- Ausschließlich `cv-profile:`-Namespace, keine Vermischung mit Match-Daten
  (`:130-146`).

### 2.4 Konsequenz

Ein Client kann weder durch einen gewählten Hash einen fremden Eintrag lesen
noch einen Eintrag „adressieren“. Genau deshalb kann ein Client-Hash aber auch
**keine Löschberechtigung** sein: Er beweist nichts über den Urheber des
Eintrags, und er ist aus dem Text reproduzierbar.

---

## 3. Anonyme Sitzungsidentität

- `mj_session` ist eine 32-Hex-Zufalls-ID, `HttpOnly`, `SameSite=Lax`,
  `Path=/`, `Max-Age` 365 Tage, `Secure` nur in Production
  (`api/_lib/identity.mjs:3-6,35-56`).
- Der Server akzeptiert **jeden** shape-validen 32-Hex-Wert und erzeugt nur bei
  ungültiger Form eine neue ID (`api/_lib/identity.mjs:32-45`). Der Kommentar
  benennt selbst, dass der IP-Backstop die eigentliche Missbrauchsgrenze ist.
- Der Profil-Cache nutzt diese Identität **nicht**. Es gibt also heute keine
  Verbindung zwischen „wer fragt“ und „welcher Cache-Eintrag“.

**Bewertung:** `mj_session` ist für grobe Quota-Zählung geeignet, aber **kein
Eigentumsnachweis**. Eine Löschberechtigung darauf zu stützen, ohne die
Cookie-Integrität serverseitig zu verifizieren (Signatur oder Register), würde
Session-Fixation und fremde Löschungen ermöglichen. Diese Bewertung deckt sich
mit dem Design-Gate (`…DESIGN-GATE.md`, Abschnitte 4–5).

---

## 4. Zugriff auf Cache-Daten

### 4.1 Wer kann lesen

- Jeder, der den **exakten normalisierten Text** kennt und ihn an
  `POST /api/profile` sendet, erhält das abgeleitete Profil — auch ohne
  Modellaufruf.
- Das ist keine Offenlegung gegenüber demjenigen, der den Text bereits besitzt;
  es ist aber eine Bestätigung, dass der Cache als **Nachschlage-Orakel** für
  bekannte Texte wirkt.
- Direkte Key-Enumeration ist ohne Redis-Zugangsdaten nicht möglich; der
  Endpoint bietet keine Listen-/Get-by-Key-Funktion.

### 4.2 Inhalt des Eintrags

Gespeichert werden ausschließlich abgeleitete Felder:
`skills[]`, `experienceLevel`, `targetRoles[]`, `location`
(`api/profile.mjs:66-74,153-155`). Kein Roh-PDF, kein vollständiger CV-Text,
keine E-Mail, kein Dateiname. `location` und `targetRoles` sind jedoch
personenbezogen genug, dass der Eintrag nicht als reine Betriebsdiagnostik gilt.

### 4.3 Gemeinsam genutzte Einträge

Weil der Key nur vom Inhalt abhängt:

- Zwei Geräte/Personen mit identischem normalisiertem Text teilen **einen**
  Eintrag.
- Eine Löschung „für einen Nutzer“ ist technisch nicht abgrenzbar; sie würde
  alle Treffer desselben Textes entfernen.
- Umgekehrt kann ein geteilter Eintrag nach der Löschung durch einen anderen
  Aufrufer sofort neu entstehen (siehe Abschnitt 7).

### 4.4 Cross-Site-Erreichbarkeit

`ACAO: *` erlaubt beliebigen Websites, den Endpoint im Namen des Besuchers
aufzurufen (ohne Cookies). Das ist heute nur ein Kosten-/Quota-Risiko, würde
aber bei einer künftigen, cookie-autorisierten Löschroute ohne
Same-Origin-/CSRF-Schutz zu einem echten Löschangriff werden.

---

## 5. Risiken unberechtigter Löschanforderungen

| Angriff / Fehlbedienung | Heute möglich? | Wirkung | Bewertung |
|---|---|---|---|
| Löschung per Client-Hash | Nein (kein Endpoint) | — | Wäre bei naiver Umsetzung eine unautorisierte Löschung fremder Einträge |
| Löschung per geratenem/abgeleitetem Hash | Nein | — | Hash ist aus Text reproduzierbar, also kein Geheimnis |
| Löschung per fremdem `mj_session` | Nein | — | Cookie ist shape-only, also kein Nachweis; Fixation wäre möglich |
| Cross-Site-Löschung | Nein | — | Würde Same-Origin-/CSRF-Schutz erfordern |
| Wiederherstellung durch parallelen Request | Ja (prinzipiell) | Gelöschter Eintrag entsteht neu | Muss durch Generation/CAS verhindert werden |
| Löschung als Erfolg bei Redis-Ausfall | Ja (bei naiver Umsetzung) | Falsche Datenschutzaussage | `cacheDel` liefert heute keinen Status |
| Enumeration fremder Einträge | Nein | — | Kein Listen-Endpoint; Redis-Zugriff nur serverseitig |

**Kernaussage:** Eine Löschung ohne serverseitig verifizierten Eigentümerbezug
ist keine Datenschutzmaßnahme, sondern eine Verfügbarkeitsänderung an fremden
Daten. Sie ist daher abzulehnen.

---

## 6. Verhalten bei Redis-Ausfall

`api/_lib/cache.mjs`:

- `cacheConfig()` → `null`, wenn URL/Token fehlen (`:3-8`).
- `cacheCommand` fängt Netzwerk-, HTTP- und Redis-Fehler und gibt `null`
  zurück (`:10-29`).
- `cacheGet` → `null` (Miss) (`:31-39`).
- `cacheSet` → No-op, kein Fehler nach außen (`:41-43`).
- `cacheDel` → **kein Rückgabewert** (`:45-47`).

Folgen für den Ist-Zustand:

- Profilgenerierung funktioniert ohne Redis weiter, nur ohne Cache.
- Kein Nutzer sieht einen Fehler; es entsteht lediglich zusätzliche Modelllast.
- **Für eine Löschung ist das unzureichend:** Ein Aufruf könnte bei Ausfall
  stillschweigend nichts tun und trotzdem als Erfolg erscheinen. Eine spätere
  Implementierung braucht ein striktes Ergebnis
  (`deleted | missing | unavailable`) und muss `unavailable` als
  nicht-erfolgreich kommunizieren.

---

## 7. Mehrfachaufrufe, Wiederholbarkeit, Races

- **Identischer Text, sequenziell:** erster Aufruf schreibt, alle weiteren
  lesen. Kein Modellaufruf, keine TTL-Verlängerung.
- **Identischer Text, parallel (Cache-Stampede):** mehrere Requests können
  gleichzeitig einen Miss sehen und das Modell mehrfach aufrufen; alle
  schreiben denselben Key/Wert. Ergebnis ist idempotent, die Kosten sind es
  nicht.
- **Modell-Fallback:** `withModelFallback` kann bis zu
  `MODEL_FALLBACK_MAX_ATTEMPTS` (Default 3) Versuche über verschiedene Modelle
  und ggf. Provider fahren (Grenze `src/api.ts:89-95`, Schleife `:125-164`); jeder erfolgreiche Versuch
  schreibt denselben Key.
- **Wiederholte Löschanforderung:** muss idempotent sein und darf keine
  Existenzinformation preisgeben (kein Unterschied zwischen „gelöscht“ und
  „war nie da“ nach außen).
- **Race „Modell antwortet nach Löschung“:** ohne Generation/CAS würde ein
  bereits laufender Request den gelöschten Eintrag wieder anlegen. Das ist der
  wichtigste technische Grund, Löschung nicht nur als `DEL` zu implementieren.
- **Retry nach Timeout:** derselbe Text kann mehrfach an Modelle gehen; eine
  Löschung kann bereits erfolgte Provider-Verarbeitung nicht zurückholen.

---

## 8. Datenfluss und Aufbewahrungszeiten

| Datenkategorie | Ort | Aufbewahrung | Löschung | Beleg |
|---|---|---|---|---|
| PDF-Datei | Browser-Heap (`cvState.documents[].file`) | Sitzung | Reload / „CV-Daten entfernen“ | `src/App.tsx:541-547,679-735` |
| Extrahierter Rohtext | lokale Variable | Request-/Funktionsdauer | automatisch | `src/App.tsx:907` |
| Anonymisierter/normalisierter Text | lokale Variable → Request-Body | transient | Request-Ende | `src/App.tsx:920-926` |
| Abgeleitetes Profil (Anzeige) | React-State | Sitzung | Reload / Remove | `src/App.tsx:949-955` |
| Such-/ATS-Profillisten | Modul-`Map` | 12 h lazy TTL, kein Refresh | Reset / Reload / Ablauf | `src/lib/cvProfileStore.ts:13,79,249` |
| **Server-Profil-Cache** | Upstash Redis `cv-profile:<sha256>` | **30 Tage ab letztem Write** | **nur TTL** | `api/profile.mjs:7,153-155` |
| Modellverarbeitung | externer Provider | außerhalb des Repos | nicht steuerbar | `api/profile.mjs:135-143` |
| Session-Cookie | Browser | 365 Tage Max-Age | kein Produkt-Löschpfad | `api/_lib/identity.mjs:6,47-56` |
| Usage-/Quota-Zähler | Redis | 62 Tage / 24 h | TTL | `api/_lib/usage.mjs`, `detailEnrich.mjs` |
| Alert-Abos | Redis `alerts` | ohne TTL | `DELETE /api/alerts` | `api/_lib/alerts.mjs` |

Der Server-Cache ist die **einzige serverseitige, CV-abgeleitete und zeitlich
begrenzte** Ablage. Er enthält kein Roh-CV, aber strukturierte
Profilinformationen inklusive Standort.

---

## 9. Datenschutzvertrag: fünf Ebenen

### 9.1 Gegenüberstellung

| Ebene | Technischer Ist-Zustand | Belegt? | Reichweite |
|---|---|---|---|
| **1. Lokales Entfernen der CV-Daten** | Dokumente, React-State, 12h-Listen, Legacy-localStorage werden geleert | **Ja** — `src/App.tsx:679-735`, Test `src/App.test.tsx:1338-1379` | nur Browser |
| **2. Serverseitige Cache-Löschung** | **nicht vorhanden**; kein `cacheDel` für `cv-profile:*` | **Nein** | — |
| **3. Automatischer Ablauf nach 30 Tagen** | `SETEX` mit 30 Tagen; kein Refresh beim Lesen | **Ja** — `api/profile.mjs:7`, `cache.mjs:41-43` | Redis-Eintrag |
| **4. Übermittlung an externe Modellanbieter** | normalisierter (ggf. anonymisierter) Text geht an `chat()` | **Ja** — `api/profile.mjs:135-143` | Provider, nicht rückholbar |
| **5. Künftige freiwillige RIS-Kontospeicherung** | nicht implementiert; kein Auto-Save, keine Migration | **Nein (nicht vorhanden)** | Zukunft |

### 9.2 Prüfung der bestehenden Datenschutzhinweise

| Aussage | Fundstelle | Technisch belegt? | Anmerkung |
|---|---|---|---|
| „Die PDF bleibt auf deinem Gerät.“ | `src/i18n.tsx:704-705` | **Ja** | `extractPdfText` läuft clientseitig (`src/App.tsx:907`); kein Upload-Pfad für die Datei |
| „Nur der gelesene, **anonymisierte** Text wird … an die KI gesendet.“ | `src/i18n.tsx:59-60,704-705` | **Nein, zu allgemein** | Der Hinweis steht unkonditional im Upload-Panel; der Modus „Nicht anonymisiert“ (`CvAnonymizationChoice.tsx:19-23`, `i18n.tsx:784-787`) sendet den unmaskierten Text |
| „Listen bleiben im Speicher dieser Session, werden 12 Stunden nach der Verarbeitung geleert …“ | `src/i18n.tsx:841-842` | **Ja, mit Präzisierung** | 12h ab erstem Save, lazy Purge; kein Refresh. „nach der Verarbeitung“ ist leicht unpräzise |
| „CV-Dateien bleiben in dieser Browsersitzung … keine dauerhafte Kontospeicherung.“ | `src/i18n.tsx:1186` | **Ja** | entspricht React-State/12h-Listen |
| „zeitlich begrenzter serverseitiger Cache für strukturierte Profilinformationen ist dokumentiert“ | `…datenschutzerklaerung_1.0.md:60-61` | **Ja, aber unquantifiziert** | 30 Tage, Key-Art und Löschgrenze werden nicht genannt |
| „Aufbereitungsfunktionen setzen keine Zustimmung zu einer dauerhaften CV-Speicherung voraus.“ | `…datenschutzerklaerung_1.0.md:40-41` | **Konsistent** | Der 30-Tage-Cache ist keine „dauerhafte CV-Speicherung“, wird aber auch nicht als eigene Retention benannt |
| „Für bestimmte Daten in RIS existiert ein technischer Löschprozess …“ | `…datenschutzerklaerung_1.0.md:62-63` | **NICHT VERIFIZIERT** | RIS ist außerhalb des Repository-Scopes |
| Button „Endgültig entfernen“ | `src/i18n.tsx:846` | **Irreführend** | Bezieht sich nur auf lokale Daten; Server-Cache bleibt bis TTL |

**Ergebnis:** Die öffentliche Datenschutzerklärung ist vorsichtig und
überverspricht nicht — sie nennt den Cache und schließt eine vollständige
Löschung ausdrücklich nicht ein. Die **Produktoberfläche** ist an zwei Stellen
zu stark: „Endgültig entfernen“ und der unkonditionale Anonymisierungs-Satz.

---

## 10. Bestehende Löschgrenzen

1. **Lokal vollständig, serverseitig leer:** „CV-Daten entfernen“ erreicht
   keinen Redis-Eintrag.
2. **Kein Eigentümerbezug:** Es gibt keine technische Größe, mit der ein
   Cache-Eintrag einem Aufrufer zugeordnet werden könnte.
3. **Geteilte Einträge:** Eine Löschung würde alle Nutzer desselben Textes
   treffen.
4. **Kein Löschfeedback:** `cacheDel` kann Erfolg/Misserfolg nicht
   unterscheiden.
5. **Keine Idempotenz-/Rate-Limit-Semantik:** existiert für diesen Namespace
   nicht.
6. **Provider-Grenze:** bereits übermittelte Texte können lokal nicht
   zurückgerufen werden.
7. **TTL ist kein Nachweis:** Der Ablauf ist wahrscheinlich, aber nicht
   protokolliert; Redis-Eviction kann ihn verkürzen, ein erneuter Upload kann
   ihn verlängern.

---

## 11. Lösungsvarianten

| Variante | Sicherheit | Datenschutz | Kosten / Aufwand | Gastbetrieb | Bewertung |
|---|---|---|---|---|---|
| **A. TTL + transparente Aufbewahrungsinformation** | mittel (unverändert) | mittel | sehr niedrig (Text/UI) | unverändert | Sofortmaßnahme; beseitigt die Löschgrenze nicht |
| **B. Autorisierte explizite Cache-Löschung** | hoch **nur mit** verifizierter Sitzung | hoch | mittel (Route, Tests, CSRF, Rate-Limit) | unverändert, kein Login | Ohne Eigentümerbindung nicht sicher |
| **C. Verzicht auf serverseitige Speicherung** | hoch | hoch | höhere Modellkosten/-latenz, geringere Trefferquote | funktioniert, teurer | Sicherste Variante; als Rückfalloption geeignet |
| **D. Technische Anpassung der Cache-Zuordnung** (Session-Bindung) | hoch | hoch | mittel; Hit-Rate sinkt | unverändert | Kleinste tragfähige Grundlage für B |
| **E. Kein Cache für „nicht anonymisiert“** | mittel | mittel–hoch | niedrig | unverändert | Sinnvolle Ergänzung, kein Ersatz für Löschung |

### Bewertung

- **A** ist sofort und ohne Risiko möglich, verschiebt die Entscheidung aber nur.
- **B ohne D** ist nicht tragfähig: Ein inhaltsadressierter Key hat keinen
  Eigentümer, also gibt es nichts, worauf eine Berechtigung sich stützen könnte.
- **C** maximiert den Datenschutz, kostet aber Modellaufrufe bei jedem Upload
  und verschlechtert die UX bei Wiederholungen. Als bewusste Option für
  besonders sensible Modi (z. B. „nicht anonymisiert“) sinnvoll.
- **D** ist die Voraussetzung für eine ehrliche Löschung: Key z. B.
  `cv-profile:v2:<ownerScope>:<contentDigest>` mit serverseitig abgeleitetem
  `ownerScope`. Das Design-Gate hat diese Variante bereits im Detail
  ausgearbeitet (signiertes Gast-Cookie, kein V1-Fallback, strikte
  Redis-Ergebnisse, Generation/CAS).
- **E** reduziert das Risiko für den sensibelsten Modus, ersetzt aber keine
  Löschung.

**Nicht empfohlen:** jede Löschung, die einen Client-Hash, einen
client-gelieferten Owner-Scope oder ein ungeprüftes `mj_session` als
Berechtigung akzeptiert.

---

## 12. Gast-Kompatibilität

Unverändert und durch dieses Audit **nicht** anzutasten:

- CV-Verarbeitung bleibt **ohne Anmeldung** vollständig verfügbar.
- **Keine Kontopflicht**, kein Login-Redirect im CV-Flow.
- **Keine automatische Speicherung in RIS**, keine Gast→Konto-Migration.
- Die bestehende Hierarchie **CV (max. 10) → Suchprofil (Produktziel 2) →
  ATS-Profil (max. 5 pro Parent)** bleibt unverändert. Dieses Audit ändert
  keine Kapazität, keine TTL der 12h-Listen und keine ATS-Semantik.
- Ein künftiger Lösch-Endpoint muss ohne Konto funktionieren; eine
  Sitzungsbindung darf den Gastbetrieb nicht zu einem Login zwingen.

---

## 13. Priorisierte Empfehlung

1. **Sofort, ohne Codeentscheidung (Dokumentation/UI):** Aufbewahrungs- und
   Löschgrenze präzise benennen. „CV-Daten entfernen“ darf nicht als
   serverseitige Löschung verstanden werden; der Server-Cache und seine
   30-Tage-Frist müssen in der UI-Hilfe genannt werden. Zusätzlich den
   Anonymisierungs-Satz an den tatsächlich gewählten Modus koppeln.
2. **Nächstes Implementierungspaket (nach Freigabe):** Variante **D + B** —
   session-gebundene Cache-Zuordnung und autorisierte, idempotente Löschung,
   ohne Loginpflicht und ohne RIS. Das Design-Gate liefert dafür bereits den
   Vertrag; die Umsetzung ist **nicht** Teil dieses Audits.
3. **Ergänzend:** Variante **E** prüfen (kein Cache für „nicht anonymisiert“),
   weil dort der abgeleitete Standort besonders sensibel ist.
4. **Fallback:** Variante **C** für den Fall, dass keine belastbare
   Sitzungsidentität freigegeben wird.
5. **Nicht umsetzen:** Client-Hash-basierte Löschung, Löschung ohne
   Redis-Ergebnisprüfung, Löschung mit `ACAO: *`.

---

## 14. Abnahmekriterien für eine spätere Implementierung

**Berechtigung**
- [ ] Löschberechtigung ausschließlich über eine serverseitig verifizierte
      Sitzung (Signatur oder Register); kein Client-Hash, kein
      client-gelieferter Owner-Scope.
- [ ] Ein nicht verifizierbares/fehlendes Cookie führt zu `401`, nicht zu
      einer stillen Löschung.
- [ ] Fremde Sitzung kann den Eintrag einer anderen Sitzung nicht löschen
      (Test mit zwei Sessions).

**Schlüsselbindung**
- [ ] Key enthält eine serverseitig abgeleitete Owner-Komponente; rohe
      Session-IDs erscheinen nicht im Key.
- [ ] Kein V1-Fallback: alte `cv-profile:<hash>`-Keys werden nicht gelesen und
      nicht einer Sitzung zugeschrieben.
- [ ] Gleicher Text in zwei Sitzungen erzeugt getrennte Einträge.

**Löschsemantik**
- [ ] Löschung entfernt nur den eigenen Eintrag; fremde/geteilte Einträge
      bleiben unberührt.
- [ ] Idempotent: wiederholte Löschung liefert denselben Status ohne
      Existenzleck.
- [ ] Redis-Ausfall wird als „nicht gelöscht“ (`503`, retryable) kommuniziert,
      niemals als Erfolg.
- [ ] Rate-Limit pro Sitzung und IP gegen Lösch-Missbrauch.
- [ ] Same-Origin-/CSRF-Schutz; keine `ACAO: *`-Freigabe für die Löschroute.
- [ ] Eine laufende Modellantwort kann einen gelöschten Eintrag nicht wieder
      anlegen (Generation/CAS).
- [ ] Ein „Alle löschen“-Pfad ist begrenzt (kein Redis-`SCAN`) und bricht bei
      Teilfehlern ehrlich ab.

**Aufbewahrung**
- [ ] 30-Tage-TTL bleibt unverändert oder wird mit dokumentierter Entscheidung
      geändert; Lesen verlängert die TTL nicht.
- [ ] Retention ist in UI und Datenschutzerklärung mit Dauer und Geltungsbereich
      benannt; keine Aussage suggeriert vollständige Löschung.
- [ ] Provider-seitige Verarbeitung wird weiterhin als nicht lokal löschbar
      ausgewiesen.

**Gastbetrieb**
- [ ] Kein Login-Zwang; CV-Flow funktioniert vollständig anonym.
- [ ] Keine automatische RIS-Speicherung, keine Kontopflicht.
- [ ] Hierarchie CV 10 / Suchprofil 2 / ATS 5 unverändert.

**Tests**
- [ ] Ohne Session, fremde Session, fremder Hash, Wiederholung, Redis-Ausfall,
      Race „Antwort nach Löschung“, TTL unverändert, Gast-E2E unverändert.
- [ ] Kein CV-Text, keine Session-ID und kein vollständiger Digest in Logs.

---

## 15. Offene Produkt-/Datenschutzentscheidungen

1. **Soll der Cache benutzerübergreifend geteilt bleiben** (Kosten) oder
   session-gebunden werden (Isolation)? — Entscheidung erforderlich.
2. **Soll „nicht anonymisiert“ überhaupt gecacht werden?** — Entscheidung
   erforderlich; hängt an Variante E.
3. **Sind 30 Tage fachlich gerechtfertigt**, und wie werden Dauer und Zweck
   transparent kommuniziert? — Entscheidung erforderlich.
4. **Soll eine Löschung auch den Provider-Auftrag betreffen?** — technisch
   derzeit nicht steuerbar; nur als Aussage möglich.
5. **Wie wird die spätere freiwillige RIS-Kontospeicherung** vom Cache
   getrennt und in den Erasure-Lifecycle eingebunden? — offen, RIS außerhalb
   des Scopes.
6. **Sollen Alt-Keys (`cv-profile:<hash>`) administrativ gelöscht werden** oder
   nur per TTL auslaufen? — Entscheidung erforderlich; ein administrativer
   Purge wäre ein separater, freigabepflichtiger Vorgang.
7. **Wie lange darf/soll das signierte Gast-Cookie leben** (Design-Gate
   empfiehlt 180 Tage)? — Entscheidung erforderlich.
8. **Reicht eine reine UI-Klarstellung, bis D+B umgesetzt sind**, oder ist eine
   sofortige Übergangslösung (z. B. Cache aus) nötig? — Produktentscheidung.

---

## 16. Geprüfte Quellen und Negativbefunde

**Gelesen / geprüft**

- `api/profile.mjs` (vollständig)
- `api/_lib/cache.mjs` (vollständig)
- `api/_lib/identity.mjs` (vollständig)
- `src/App.tsx`: `sha256Hex` (`:512-522`), `handleRemoveCvDocument`
  (`:628-645`), `handleCvRemoveData` (`:679-735`), `createProfileFromPdf`
  (`:888-977`)
- `src/api.ts`: `createProfile` (`:271-284`), `withModelFallback` (`:125-164`)
- `src/lib/cvProfileStore.ts`: TTL (`:13`), Bucket (`:79`), Reset/Legacy-Purge
  (`:249-255`)
- `src/i18n.tsx`: `cv.removeData*` (`:843-846`), `cv.profilesPrivacyNote`
  (`:841-842`), `cv.privacyNote` (`:704-705`), `dashboard.cvSessionNote`
  (`:1186`), Anonymisierungsoptionen (`:782-787`)
- `src/components/CvUpload.tsx:88`, `src/components/CvProfilesOverlay.tsx:92`,
  `src/components/CvAnonymizationChoice.tsx`
- `tests/api/profile-cache.test.mjs`
- `docs/reports/PERSISTENCE-BOUNDARY-01-EXECUTION_LOG.md`
- `docs/contracts/JOBMATCHER-API-SESSION-BOUNDARY-01.md`
- `docs/mays_job_matcher_datenschutzerklaerung_1.0.md` (§§ 6–8, 12–14)
- `docs/mays_job_matcher_datenschutzprinzipien.md`
- `docs/reports/JM-PROFILE-CACHE-DELETE-03-DESIGN-GATE.md` (nur zur Abgrenzung)

**Negativbefunde (gesucht, nicht vorhanden)**

- Kein `cacheDel` für `cv-profile:*` (nur Apify-Dataset).
- Keine Sitzungs-/Eigentümerbindung im Profil-Cache.
- Keine Löschroute für den Profil-Cache.
- Kein Rate-Limit und keine Usage-Prüfung in `api/profile.mjs`.
- Keine Protokollierung von CV-Text in `api/profile.mjs` oder den
  Provider-Adaptern (Fehlerlogs enthalten Modell/Status/Provider-Meldung,
  nicht den Prompt).
- Keine automatische RIS-Speicherung, kein Gast→Konto-Übertrag.
- Keine TTL-Verlängerung beim Cache-Hit.

---

## 17. Grenzen der Prüfung

- Keine Laufzeit-Tests gegen echtes Redis, echte Provider oder Produktion.
- Provider-seitige Aufbewahrung, Logging und Trainingsnutzung sind aus dem
  Repository nicht feststellbar.
- RIS-Löschprozesse sind außerhalb des Repository-Scopes und **nicht
  verifiziert**.
- Browser-HTTP-Caches/Header wurden nicht auditiert.
- Die Aussagen sind Code-inferred; sie ersetzen keinen Penetrationstest.

---

## 18. Audit-Nachweis

- Keine Änderung an `src/`, `api/`, `tests/`, Konfiguration, Infrastruktur
  oder Deployment.
- Keine AWS-Operation, kein Terraform-Lauf, kein `vercel`-Aufruf.
- Keine echten CV-, Provider- oder Redis-Daten verwendet.
- Geänderte Dateien: ausschließlich Dokumentation
  (`docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT.md`,
  `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT-EXECUTION_LOG.md`,
  `docs/AI_AUDITLOG.md`).
- Ausführlicher Verlauf:
  `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT-EXECUTION_LOG.md`.

**Status: YELLOW.** Nächster Schritt ist eine Produkt-/Datenschutzentscheidung
zu Abschnitt 15; die Implementierung von D+B bleibt bis zur Freigabe gesperrt.
