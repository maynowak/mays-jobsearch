# Organic Growth Strategy — May's Job Matcher

**Status:** DRAFT — CONTENT REVIEW PENDING
**Stand:** 2026-11-14
**Kampagnenziel:** Erste 100 qualifizierte Websitebesucher; mindestens 10 Personen testen eine zentrale Produktfunktion.

Die Zahlen sind Planungsziele, keine Prognosen. Es gibt keine Marktforschung mit
externen Volumina; die Zielgruppen- und Keyword-Annahmen sind Hypothesen und
müssen durch echte Resonanz validiert werden.

---

## 1. Positionierung

**Kernbotschaft:** „Finde Jobs, die wirklich zu dir passen.“
**Englisch:** „Find jobs that really fit you.“

May's Job Matcher ist eine individuelle Jobsuche mit KI-Unterstützung — keine
klassische Jobbörse. Die Landingpage verspricht keine Garantie, sondern:

- Stellen aus mehreren verfügbaren Quellen entdecken,
- eigene Suchprofile definieren,
- Anforderungen mit den eigenen Qualifikationen vergleichen,
- Bewerbungen in der aktuellen Sitzung organisieren,
- KI-Bewertung auf Wunsch nutzen.

Quellen: `src/components/LandingPage2.tsx`, `index.html`,
`docs/reports/JM-MARKETING-02-PRODUCT-POSITIONING-LANDING-PAGE-REPORT.md`.

---

## 2. Zielgruppen-Hypothesen

Die folgenden Punkte sind Arbeitshypothesen, keine demografischen oder
verhaltensbezogenen Tatsachenbehauptungen. Sie werden über Feedback und
Kanalresonanz validiert.

### 2.1 IT- und Tech-Fachkräfte

| Feld | Hypothese |
|---|---|
| Problem | Stellenanzeigen nennen viele Technologien, Aufgaben und Anforderungen; die Passung ist schwer einzuschätzen. |
| Bedürfnisse | Schneller Abgleich mit Skills, nachvollziehbare Bewertung, Kontrolle über Suchkriterien. |
| Suchbegriffe (Hypothesen) | „Java Jobs remote“, „AWS Jobs Berlin“, „Fullstack Stellen“, „IT Job Matching“, „Tech Jobs mit Skills abgleichen“ |
| Kanäle | LinkedIn, GitHub, Fachblogs, YouTube, ausgewählte Tech-Communities |
| Einstiegshürden | Misstrauen gegenüber KI-Bewertungen, Datenschutzfragen, Zeitmangel |
| Passende Funktionen | Skills-/Zielrollen-Suche, KI-Matching mit Begründung, Suchprofile |
| Botschaft | „Du bestimmst die Kriterien. Die KI hilft beim Abgleich — du entscheidest.“ |

### 2.2 Berufserfahrene Fachkräfte

| Feld | Hypothese |
|---|---|
| Problem | Viele unpassende Treffer, unklare Anforderungen, mehrere Suchvarianten parallel. |
| Bedürfnisse | Gezielte Suchprofile, Filter nach Ort/Umkreis/Arbeitsmodell, übersichtliche Ergebnisse. |
| Suchbegriffe (Hypothesen) | „passende Jobs finden“, „Stellensuche mit Profil“, „Jobsuche Erfahrung“, „Jobs nach Skills filtern“ |
| Kanäle | LinkedIn, Karriere-Communities, Weiterbildungsträger, Fachblogs |
| Einstiegshürden | Wenig Zeit, Skepsis gegenüber neuen Tools, Wunsch nach Kontrolle |
| Passende Funktionen | Individuelle Suchprofile, Filter, KI-Bewertung auf Wunsch, Bewerbungsübersicht |
| Botschaft | „Nicht mehr alle Stellen — sondern die, die zu deinen Anforderungen passen.“ |

### 2.3 Berufliche Wiedereinsteiger

| Feld | Hypothese |
|---|---|
| Problem | Orientierung nach einer Pause, Unsicherheit bei Anforderungen und Bewerbungsprozess. |
| Bedürfnisse | Struktur, verständliche Schritte, niedrigschwelliger Einstieg, transparente Datennutzung. |
| Suchbegriffe (Hypothesen) | „Wiedereinstieg Jobsuche“, „Jobsuche nach Pause“, „Bewerbung organisieren“, „zurück in den Beruf“ |
| Kanäle | LinkedIn, Weiterbildungsträger, Karriereberatung, Fachblogs, YouTube |
| Einstiegshürden | Angst vor Ablehnung, unklare Qualifikationen, Datenschutzbedenken |
| Passende Funktionen | Schrittweiser Suchaufbau, manuelle Profile ohne CV, Suchprofile, Bewerbungsorganisation |
| Botschaft | „In deinem Tempo: Suche strukturieren, Passung prüfen, Bewerbungen ordnen.“ |

**Gemeinsame Regel:** Die Landingpage bleibt für alle Berufsgruppen
verständlich. Keine Zielgruppe wird durch Fachjargon ausgeschlossen.

---

## 3. Kanalstrategie und Priorisierung

Bewertung: Aufwand (A), Reichweitenpotenzial (R), Zielgruppenrelevanz (Z),
Compliance-Risiko (C) — jeweils niedrig/mittel/höch. Die Priorisierung ist eine
Planungsentscheidung, keine gemessene Kanalperformance.

| Priorität | Kanal | A | R | Z | C | Begründung |
|---|---|---|---|---|---|---|
| 1 | LinkedIn | mittel | mittel–hoch | hoch | niedrig–mittel | Direkte Zielgruppen, beruflicher Kontext, organische Reichweite über bestehendes Netzwerk |
| 2 | SEO-Content | mittel–hoch | hoch (langfristig) | hoch | niedrig | Suchintention, dauerhafte Auffindbarkeit; benötigt erst Blog-Implementierung |
| 3 | YouTube / Shorts | hoch | mittel | hoch | niedrig | Demonstration erklärt Produktnutzen; hoher Produktionsaufwand |
| 4 | GitHub | niedrig | niedrig–mittel | mittel | niedrig | Glaubwürdigkeit für Tech-Zielgruppe; nur wenn Repo öffentlich ist |
| 5 | Weiterbildungsträger/Karriereberatung | hoch | mittel | hoch | mittel | Vertrauensvorsprung, aber manuelle Partnerschaftsarbeit |
| 6 | Fachblogs/Gastbeiträge | mittel–hoch | mittel | hoch | mittel | Autorenschaft und Reichweite; redaktionelle Abhängigkeit |
| 7 | Reddit/Karriere-Communities | niedrig–mittel | mittel | mittel | hoch | Sehr strikte Regeln; meist keine Produktwerbung erlaubt |
| 8 | Instagram | mittel | niedrig–mittel | niedrig–mittel | niedrig | Visuelle Formate passen weniger zur konkreten Jobsuche |

### 3.1 LinkedIn — primärer Launch-Kanal

**Rolle:** Produktvorstellung, Vertrauen, Einladung zum Test.
**Zielgruppen:** Jobsuchende, IT-Fachkräfte, Wiedereinsteiger,
Karriereberater:innen, Weiterbildungseinrichtungen.

**Formatplan (6 Beiträge):**

1. Offizielle Produktvorstellung (DE + EN)
2. Problem unpassender Stellenangebote
3. Individuelle Suchprofile
4. KI-gestütztes Job Matching
5. Datenschutz und Nutzerkontrolle
6. Einladung zum Produkttest

**Rhythmus:** 2 Beiträge pro Woche, keine automatisierten Posts. Jeder Beitrag
wird manuell freigegeben und veröffentlicht. Keine gekauften Follower, keine
Engagement-Pods, keine erfundenen Testimonials.

**Link-Handling:** Links nur mit UTM-Parametern, keine personenbezogenen
Parameter. Ohne freigegebenes Analytics-Tool sind UTM-Parameter nur
Vorbereitung, keine Messung (siehe `../measurement/GROWTH_METRICS.md`).

### 3.2 Reddit — recherchiert, aber nicht als Werbekanal freigegeben

Regeln geprüft am **2026-11-14** über die öffentlichen Community-Regeln
(Reddit-Seiten/Suchindex). Regeln können sich jederzeit ändern und müssen vor
jeder Beteiligung erneut geprüft werden. Es wurde **nichts gepostet**.

| Community | Relevanz | Regelbefund | Empfehlung |
|---|---|---|---|
| `r/jobs` | allgemeine Jobsuche | „No Job Posts, No Self Promotion“; keine Jobbörsen/Services/Werbung, auch nicht kostenlos | Keine Produktposts, keine Links. Nur echte Hilfe ohne Produktbezug; Produktname auch in Kommentaren vermeiden |
| `r/arbeitsleben` | DACH-Arbeitsleben | „Keine Eigen- und Fremdwerbung“ (inkl. Stellenanzeigen/Jobsuche); zusätzlich „Keine LLM-/KI-generierten Inhalte“ | Keine Produktposts und keine KI-generierten Texte; als Kanal für dieses Produkt nicht nutzbar |
| `r/resumes` | CV/Lebenslauf | „No advertising or soliciting users“; ausdrücklich auch Jobsuche-Tools; „Do not use AI generated content“ | Keine Produktposts/Links; keine KI-Texte. Nur menschlich verfasste, produktfreie Hilfe |
| `r/InformatikKarriere` | IT-Karriere DACH | Werbung nur nach Absprache mit Mods; Spam wird kommentarlos gelöscht | Ohne vorherige Mod-Freigabe kein Produktpost; selbst mit Freigabe nur bei echtem Mehrwert |
| `r/cscareerquestions` | internationale Tech-Karriere | Produktvorstellung nur in den monatlichen Stickied-Threads; strikte Karrierebezug-Regeln | Höchstens später ein freigegebener Beitrag im dafür vorgesehenen Thread; kein eigener Promo-Post |

**Entscheidung:** Reddit ist **kein Launch-Kanal**. Höchstens später
kommentarbasierte, menschliche Beteiligung ohne Produktlink und ohne
KI-generierte Texte — nur nach erneuter Regelprüfung und Freigabe.

Quellen (abgerufen 2026-11-14):

- https://www.reddit.com/r/jobs/about/ (Regel „No Job Posts, No Self Promotion“)
- https://www.reddit.com/r/arbeitsleben/about/ (Regeln 3 und 4)
- https://www.reddit.com/r/resumes/ (Regeln 2 und 5)
- https://www.reddit.com/r/InformatikKarriere/about/ (Regel 6 „Werbung nur nach Absprache“)
- https://www.reddit.com/r/cscareerquestions/ (Regeln zu monatlichen Threads, öffentlich referenziert)

### 3.3 YouTube — Demonstrationskanal

**Rolle:** Produktverständnis durch kurze, ehrliche Demos.
**Formate (max. 60–90 Sekunden):**

1. „So funktioniert May's Job Matcher“ — Landingpage → Suche → Ergebnis.
2. „Jobsuche mit individuellen Suchprofilen“ — Skills, Rolle, Ort, Filter.
3. „Lebenslauf und Stellenanzeige vergleichen“ — CV-Auswahl → KI-Bewertung.
4. „Bewerbungen besser organisieren“ — Session-Bewerbungen und Grenzen.

**Produktionsregeln:** nur synthetische Daten, keine echten CVs, keine
Unternehmenslogos ohne Erlaubnis, keine erfundenen Erfolgszahlen. Jede
Bildschirmaufnahme zeigt den tatsächlichen Produktstand. Keine automatische
Veröffentlichung.

### 3.4 GitHub

**Rolle:** Technische Glaubwürdigkeit und Nachvollziehbarkeit.
**Voraussetzung:** Das Repository ist öffentlich und die Betreiberin möchte es
als Referenz zeigen. Keine Veröffentlichung von Secrets, internen Daten oder
Kundendaten.
**Maßnahme:** Kurzer Projektabschnitt mit Produktlink und klarer
Open-Source-/Lizenzangabe; optional ein technischer Beitrag über
Suchstrategie/Filter, ohne Marketingzahlen. Kein Spam in Issues.

### 3.5 Fachblogs und Karriere-Communities

**Rolle:** Tiefe, Vertrauen, SEO-Nebenwirkung.
**Vorgehen:** Gastbeitrag oder Interview anbieten, Thema zuerst, Produkt nur
als transparente Autorenangabe. Keine Massenansprache, keine bezahlten
Platzierungen ohne Freigabe. Community-Regeln vor jeder Beteiligung prüfen.

### 3.6 Weiterbildungsträger und Karriereberatung

**Rolle:** Vertrauensvolle Empfehlung für Wiedereinsteiger und erfahrene
Fachkräfte.
**Vorgehen:** Persönliche, individuelle Ansprache mit kostenlosem
Demo-Angebot; keine Gegenleistung für Empfehlungen ohne transparente
Vereinbarung. Keine Weitergabe von Teilnehmerdaten.

### 3.7 Instagram

**Rolle:** Niedrige Priorität. Visuelle Vorher-/Nachher-Darstellungen können
Interesse wecken, erklären aber die Produktlogik schlechter als Demo/Artikel.
Nur wenn Kapazität frei ist; keine Story-Serien ohne Freigabe.

---

## 4. Funnel und Zieldefinition

| Stufe | Definition | Messbarkeit heute |
|---|---|---|
| Reichweite | Impressionen/Views auf LinkedIn, YouTube, GitHub | Plattform-Aggregatwerte, manuell erfasst |
| Klick | Klick auf einen Kampagnenlink | Plattform-Aggregat + ggf. UTM, aber ohne Analytics keine Website-Auswertung |
| Qualifizierter Besucher | Person aus der Zielgruppe, die die Landingpage erreicht und sich mit dem Produktversprechen beschäftigt | Nur manuell/qualitativ (Kommentar, Nachricht, Rückmeldung) belastbar |
| Aktivierung | Start einer Suche oder einer anderen zentralen Funktion | Ohne Analytics nicht serverseitig messbar; nicht als erreicht behaupten |
| Testnutzer | Person probiert eine zentrale Funktion und gibt Rückmeldung | Manuell über freiwillige Rückmeldung |
| Bindung | erneute Nutzung | Ohne Konto-/Produktanalytik nicht messbar |

**Planungsziele:** 100 qualifizierte Besucher, 10 Testnutzer. Diese Zahlen sind
Ziele, keine Prognosen. Bis ein freigegebenes, datenschutzkonformes
Messverfahren existiert, werden sie nur als manuell geschätzte
Planungsgrößen dokumentiert.

---

## 5. Mess- und Datenschutzgrenzen

- Keine neuen Analytics-Dienste, Cookies, Pixel oder Fingerprinting.
- Keine personenbezogenen CV-/Profil-/Bewerbungsdaten in Marketingauswertungen.
- Keine E-Mail-Adressen in UTM-Parametern oder Links.
- Keine Kampagnen-E-Mails ohne Einwilligung.
- Plattform-Aggregatwerte (LinkedIn/YouTube) und freiwilliges Feedback sind
  die einzigen sofort verfügbaren Quellen.
- Details: `../measurement/GROWTH_METRICS.md`.

---

## 6. Risiken und Gegenmaßnahmen

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| Zu breite Produktversprechen | Vertrauensverlust, Compliance-Risiko | Aussagen-Matrix, keine Garantien, Quellen als „verfügbar“ bezeichnen |
| Reddit-/Community-Regeln | Sperren, Reputationsschaden | Kein Promo-Posting; Regeln vor jeder Beteiligung prüfen |
| Fehlende Analytics | Kampagnenerfolg nicht messbar | Keine erfundenen Zahlen; manuelle Aggregate, später separates Messgate |
| Zu viel Content auf einmal | Qualitätsverlust | 2 LinkedIn-Posts/Woche, ein Demo-Video, drei SEO-Konzepte |
| KI-generierte Texte in strikten Communities | Entfernung/Sperre | Menschliche Überarbeitung; `r/arbeitsleben`/`r/resumes` meiden |
| Datenschutz-Wahrnehmung | Weniger Conversions | Transparenzabschnitt, Datenschutzerklärung verlinken, keine falsche Anonymität |
| GSC noch nicht verifiziert | Keine Suchdaten | Anleitung für Betreiberin; keine Indexierungsbehauptung |

---

## 7. Google Search Console — Readiness und Anleitung

**Status am 2026-11-14:** `SEARCH CONSOLE OWNERSHIP VERIFICATION PENDING`

Öffentliche Prüfung (read-only):

| Ressource | Status |
|---|---|
| `https://www.mays-job-matcher.app/` | HTTP 200, indexierbar, Canonical korrekt |
| `/robots.txt` | HTTP 200, `Allow: /`, `Disallow: /api/`, Sitemap-Verweis |
| `/sitemap.xml` | HTTP 200, valides XML, nur die Startseite |
| DNS-TXT `google-site-verification` | nicht vorhanden (app und www geprüft) |
| HTML-Meta `google-site-verification` | nicht vorhanden |
| Verifikationsdatei | keine im Repo/öffentlich gefunden |
| Search-Console-Property | ohne Kontozugriff nicht feststellbar |
| Sitemap-Einreichung | nicht ausgeführt |

**Technische Indexierbarkeit ≠ Google-Indexierung.** Es wird keine
Indexierung behauptet, solange Google sie nicht bestätigt.

### Anleitung für die Betreiberin

1. **Property wählen:** Bevorzugt Domain-Property `mays-job-matcher.app`
   (erfasst www und non-www). Alternativ URL-Prefix
   `https://www.mays-job-matcher.app/`.
2. **Eigentum verifizieren:** Bei der Domain-Property einen **neuen**
   DNS-TXT-Eintrag `google-site-verification=…` setzen. Bestehende
   SPF-/MX-/DKIM-/DMARC-Einträge nicht verändern. Bei URL-Prefix alternativ
   die von Google bereitgestellte HTML-Datei oder das Meta-Tag verwenden –
   dafür wäre eine separate, freigegebene Website-Änderung nötig.
3. **Verifikation abwarten:** DNS-Propagation kann dauern. Erst nach
   bestätigtem Eigentum weitermachen.
4. **Sitemap einreichen:**
   `https://www.mays-job-matcher.app/sitemap.xml`.
5. **URL Inspection:** Startseite prüfen; Indexierungsstatus, Crawling,
   Google-selected Canonical und Warnungen dokumentieren.
6. **Status trennen:** eingereicht ≠ verarbeitet ≠ URLs entdeckt ≠ indexiert.
7. **Keine erfundenen Werte:** Ohne GSC-Zugriff keine Impressionen, Klicks oder
   Indexierung behaupten.

### Datenschutz-/DNS-Regeln

- Keine DNS-Änderungen ohne ausdrückliche Freigabe der Betreiberin.
- Keine Änderung bestehender MX-/SPF-/DKIM-/DMARC-Einträge.
- Kein fremdes Google-Konto verwenden.
- Keine Sitemap-Einreichung ohne berechtigten Zugriff.
- Keine Search-Console-Daten mit personenbezogenen Daten vermischen.

---

## 8. Freigabe-Gates

1. **Content Review:** Alle Texte gegen Produktstand und Compliance prüfen.
2. **Publication Approval:** Freigabe nach JM-MARKETING-03B.
3. **Search Console:** Eigentumsbestätigung und Sitemap-Einreichung separat.
4. **Measurement:** Kein neues Tracking ohne gesonderte Freigabe.
5. **Community Posting:** Nur nach aktueller Regelprüfung und manueller Freigabe.
