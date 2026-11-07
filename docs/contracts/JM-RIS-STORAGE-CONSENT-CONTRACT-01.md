# JM-RIS-STORAGE-CONSENT-CONTRACT-01

**Von:** Mays-Jobsearch

**An:** Mays-RIS (externer API-Anbieter)

**Datum:** 2026-11-06

**Status:** OPEN — AWAITING RIS RESPONSE

**Bezug:** `docs/contracts/JM-RIS-STORAGE-CONSENT-HANDOFF-V1.md`

**Zweck:** Klärung, ob RIS die für eine dauerhafte ApplicationV1-Speicherung erforderlichen zweckgebundenen Speicher-Einwilligungen bereits verwaltet.

## 1. Kontext und Grenzen

Mays-Jobsearch hat die ApplicationV1-Anbindung implementiert, aber die dauerhafte Speicherung von Bewerbungen noch nicht aktiviert. Vor jeder Aktivierung muss Jobsearch anhand des veröffentlichten RIS-Vertrags feststellen können, ob eine gültige, zweckgebundene Einwilligung vorliegt.

Diese Anfrage:

- verwendet ausschließlich die veröffentlichte Partner-API und den vereinbarten Vertrag,
- benötigt **keine RIS-internen Implementierungsdetails**,
- leitet die Identität ausschließlich aus einem verifizierten JWT (`iss + sub`) ab,
- verwendet keine E-Mail-Adresse als Identitätsersatz,
- enthält keine Secret-Werte, JWTs, Passwörter oder Benutzerkennungen,
- ist keine Aussage darüber, dass eine Consent-API, ein Endpoint, eine Tabelle, eine Retention oder ein Erasure-Workflow bereits existiert.

Der vorbereitete Schnittstellenentwurf ist:

`docs/contracts/JM-RIS-STORAGE-CONSENT-HANDOFF-V1.md`

Dieser Entwurf ist **PROPOSED / NOT IMPLEMENTED / RIS EVIDENCE NOT VERIFIED**.

## 2. Fragen an RIS

### Frage 1 — Bestehende Einwilligung

Speichert RIS für einen authentifizierten Benutzer bereits Einwilligungsentscheidungen für die Zwecke:

- `application_storage`
- `cv_storage`
- `search_profile_storage`

Falls ja: Über welchen **veröffentlichten Partner-API-Endpunkt** kann Jobsearch den aktuellen Status abrufen?

Bitte angeben:

- HTTP-Methode und vollständiger Pfad,
- Authentifizierung (insbesondere die Bindung an `iss + sub`),
- Request-/Response-Schema,
- Fehlercodes,
- ob der Status pro Zweck getrennt ist.

### Frage 2 — Nachweis

Kann RIS für eine aus dem verifizierten JWT (`iss + sub`) abgeleitete Identität folgende Informationen bereitstellen?

- Zweck und aktueller Status,
- Version des Einwilligungstextes,
- Version der Datenschutzhinweise,
- serverseitiger Entscheidungszeitpunkt,
- Widerrufsstatus und serverseitiger Widerrufszeitpunkt.

Bitte angeben, ob diese Felder über einen veröffentlichten Endpoint abrufbar sind und welches Schema/Versionierung gilt.

### Frage 3 — Neue Einwilligung

Welche **veröffentlichte API-Operation** erlaubt es Jobsearch, nach einer ausdrücklichen Benutzerentscheidung die Einwilligung serverseitig zu registrieren?

Bitte bestätigen:

- ob RIS die erfolgreiche Persistierung zurückmeldet, **bevor** Bewerbungsdaten gespeichert werden,
- ob die Operation idempotent ist und welcher Idempotency-Key erwartet wird,
- wie mit veralteten oder nicht übereinstimmenden Text-/Notice-Versionen umgegangen wird,
- welches Response-Schema den persistierten Zustand und den serverseitigen Zeitstempel enthält,
- ob ein fehlgeschlagener oder nicht verfügbarer Consent-Check die Speicherung zuverlässig verhindert.

### Frage 4 — Widerruf, Export und Löschung

Welche **offiziell bereitgestellten Operationen** unterstützen:

- Widerruf einer Einwilligung,
- Export der gespeicherten Einwilligungs-/Auditdaten,
- Löschung der Einwilligungsdaten,
- Löschung der zugehörigen Bewerbungs-/CV-/Profil-Daten,
- Aufbewahrungs- und Löschfristen.

Bitte Widerruf und Löschung getrennt beschreiben. Eine Widerrufsbestätigung darf nicht als sofortige Löschung dargestellt werden, sofern die Löschung nicht separat bestätigt ist.

### Frage 5 — ApplicationV1-Anschluss

Bitte die verbindlichen Werte beziehungsweise Vertragsangaben bestätigen für:

- RIS-Partner-API-Basisadresse (ausschließlich HTTPS),
- akzeptierten Cognito-Issuer,
- akzeptierten Cognito-Client,
- Partner-Credential-Authentifizierung (Header, Format, Rotation),
- Berechtigung des bestehenden Partners `mays-jobsearch` für ApplicationV1,
- zuständigen Tenant-/Ownership-Kontext, sofern RIS einen solchen benötigt.

Bitte keine Secret-Werte in der Antwort übermitteln; die Bestätigung der Metadaten und der sichere Übertragungsweg genügen.

### Frage 6 — Unterstützung des bestehenden Handoffs

Bitte für jede Sektion von `JM-RIS-STORAGE-CONSENT-HANDOFF-V1.md` angeben, ob sie bereits unterstützt wird, teilweise unterstützt wird, nicht unterstützt wird oder unbekannt ist.

| Handoff-Sektion | Thema | RIS-Status | Endpoint/Contract-Referenz | Anmerkung |
|---|---|---|---|---|
| §1 | Identity boundary (`iss + sub`, kein E-Mail-Ersatz) | supported / partial / not supported / unknown | | |
| §2 | Zwecke `application_storage`, `cv_storage`, `search_profile_storage` | supported / partial / not supported / unknown | | |
| §3 | Consent-States (`not_requested`, `granted`, `declined`, `withdrawn`, `reconsent_required`) | supported / partial / not supported / unknown | | |
| §4 | Versioned record (Text-/Notice-Version, serverseitige Zeitstempel, Append-only-Audit) | supported / partial / not supported / unknown | | |
| §5 | API surface (`GET`, `PUT`, `POST .../withdraw`) | supported / partial / not supported / unknown | | |
| §6 | Backend-Gate vor dauerhafter Speicherung | supported / partial / not supported / unknown | | |
| §7 | Retention, Widerruf und Erasure | supported / partial / not supported / unknown | | |
| §8 | Privacy-Capabilities (Inspect, Export, Erasure, Ownership, Audit) | supported / partial / not supported / unknown | | |
| §9 | Legal Review / freigegebene Textversionen | supported / partial / not supported / unknown | | |
| §10 | Client-Integration (nur serverbestätigter Zustand) | supported / partial / not supported / unknown | | |

## 3. Abnahmekriterium

Jobsearch muss **vor jeder dauerhaften Speicherung** anhand des veröffentlichten RIS-Vertrags feststellen können, ob eine gültige, zweckgebundene Einwilligung vorliegt.

Fehlt diese Einwilligung, muss Jobsearch eine ausdrückliche Benutzerentscheidung einholen und deren serverseitige Persistierung bestätigen lassen.

Eine fehlgeschlagene oder nicht verfügbare Consent-Prüfung darf **keine dauerhafte Speicherung** auslösen. Ein fehlender Datensatz ist nicht gleichbedeutend mit Einwilligung.

## 4. Erbetenes Antwortformat

Bitte pro Frage und pro Handoff-Sektion:

| Feld | Inhalt |
|---|---|
| Antwort | ja / nein / teilweise / unbekannt |
| Status | supported / partial / not supported / unknown |
| Endpoint | Methode + Pfad oder „kein veröffentlichter Endpoint“ |
| Contract-Referenz | Dokument, Version, Datum |
| Schema | Request/Response/Fehlercodes oder Referenz |
| Einschränkungen | Retention, Tenant, Versionierung, Idempotency |
| Nächster Schritt | erforderliche RIS-/Jobsearch-Aktion |

Falls eine Angabe nicht veröffentlicht ist, bitte ausdrücklich als **Dokumentationslücke** kennzeichnen. Keine Ableitung aus RIS-Interna.

## 5. Nicht Gegenstand dieser Anfrage

- keine RIS-Repository- oder AWS-Zugriffe,
- keine Änderung an RIS, Cognito, CloudFront, DNS oder Terraform,
- keine Ausstellung oder Rotation von Partner-Credentials,
- keine echten RIS-API-Writes,
- keine produktiven Bewerberdaten,
- keine Aktivierung der dauerhaften Speicherung in Jobsearch.
