# Growth Metrics — datenschutzbewusstes Messkonzept

**Status:** DRAFT — NO TRACKING IMPLEMENTED
**Stand:** 2026-11-14

> Es wurden **keine** Analytics-, Cookie-, Pixel- oder Fingerprinting-Dienste
> implementiert. Dieses Dokument beschreibt, was heute ehrlich messbar ist,
> was nicht, und welche Voraussetzungen eine spätere Messung hätte.

---

## 1. Grundsätze

1. Keine personenbezogenen CV-, Profil- oder Bewerbungsdaten für Marketing.
2. Keine neuen Cookies, Pixel, Fingerprints oder Cross-Site-Tracker.
3. Keine E-Mail-Adressen, Namen oder Bewerbungs-IDs in URLs/UTM-Parametern.
4. Nur aggregierte Plattformwerte und freiwilliges Feedback.
5. Keine gemessenen Werte behaupten, die nicht tatsächlich erhoben wurden.
6. Planungsziele klar von Messwerten trennen.

---

## 2. Kennzahlen und heutige Messbarkeit

| Kennzahl | Definition | Quelle heute | Verfügbar? | Frequenz |
|---|---|---|---|---|
| Websitebesucher | Aufrufe der Landingpage | Ohne Analytics nicht auf der Website messbar | **Nein** | – |
| Besucher nach Kanal | Traffic-Herkunft | UTM nur mit Analytics auswertbar; Plattform-Klicks als Proxy | **Teilweise/Proxy** | wöchentlich |
| Start der Jobsuche | Klick/Interaktion, die eine Suche startet | Keine Produktanalytik | **Nein** | – |
| Nutzung von Suchprofilen | Anlegen/Laden eines Profils | Keine Produktanalytik | **Nein** | – |
| Wiederkehrende Nutzung | erneuter Besuch/erneute Suche | Keine Produktanalytik | **Nein** | – |
| Qualitatives Feedback | freiwillige Kommentare/Nachrichten | manuelle Notizen | **Ja** | laufend |
| LinkedIn-Impressionen | Auslieferungen des Beitrags | LinkedIn-Insights, soweit verfügbar | **Teilweise** | pro Post |
| LinkedIn-Link-Klicks | Klicks auf den Link | LinkedIn-Insights, soweit verfügbar | **Teilweise** | pro Post |
| YouTube-Views | Aufrufe des Videos | YouTube Studio | **Ja** (nach Veröffentlichung) | wöchentlich |
| GitHub-Referrers | Klicks aus GitHub | GitHub-Statistik, soweit verfügbar | **Teilweise** | wöchentlich |
| Search-Console-Impressionen | Suchanfragen, in denen die Seite erscheint | Google Search Console | **Nein, bis Eigentum bestätigt** | wöchentlich |
| Search-Console-Klicks | Klicks aus Google-Suchergebnissen | Google Search Console | **Nein, bis Eigentum bestätigt** | wöchentlich |

**Wichtig:** „Besucher nach Kanal“ ist ohne Analytics kein belastbarer
Website-Wert. Plattform-Klicks sind ein Proxy für Interesse, nicht für
qualifizierte Besucher.

---

## 3. Definition „qualifizierter Besucher“

Ohne Website-Analytics ist eine harte Definition nicht messbar. Für die
Kampagne gilt eine **manuelle Arbeitsdefinition**:

> Eine Person aus einer definierten Zielgruppe, die über einen
> Kampagnenkontext auf die Landingpage kommt und freiwillig erkennen lässt,
> dass sie sich mit dem Produktversprechen beschäftigt (z. B. konkrete
> Rückfrage, Feedback, Testzusage).

Diese Definition ist bewusst konservativ. Sie ist **kein** automatisierter
Unique-Visitor-Wert und darf nicht als solcher berichtet werden.

---

## 4. Planungsziele vs. Messwerte

| Größe | Wert | Typ |
|---|---|---|
| Qualifizierte Websitebesucher | 100 | Planungsziel, nicht gemessen |
| Testnutzer | 10 | Planungsziel, nicht gemessen |
| LinkedIn-Posts | 6 | produzierbar/veröffentlichbar |
| Demo-Video | 1 | produzierbar |
| SEO-Konzepte | 3 | dokumentiert |
| Freiwillige Feedback-Meldungen | ≥ 5 | manuell zählbar |

Die Zahlen sind keine Prognosen. Nach 30 Tagen wird ausschließlich berichtet,
was tatsächlich als Aggregat oder Feedback vorliegt.

---

## 5. UTM-Konzept

```text
utm_source=linkedin | youtube | github | partner
utm_medium=organic_social | organic_video | organic_repo | referral
utm_campaign=jm_launch_2026
utm_content=launch_de | launch_en | problem | profiles | ai_matching | privacy | test_invite | demo_01
```

Regeln:

- Keine personenbezogenen Werte (Name, E-Mail, Konto-ID, CV-Inhalt).
- Keine Weitergabe an Dritte außer dem jeweiligen Kanal.
- UTM-Parameter werden nur mit einem freigegebenen Analytics-Tool auswertbar.
- Ohne Analytics bleiben sie Dokumentation der Link-Herkunft, kein Reporting.
- Hosting-/Server-Logs können technisch URLs/IPs enthalten; sie werden nicht
  für Marketingprofiling genutzt.

---

## 6. Manuelles Wochenprotokoll

Nur Aggregate, keine personenbezogenen Daten:

```text
Woche:
Kanal:
Beitrag/Video-ID:
Impressionen (falls verfügbar):
Link-Klicks (falls verfügbar):
Freiwillige Rückmeldungen (Anzahl):
Themen des Feedbacks (aggregiert):
Auffälligkeiten:
Nächste Aktion:
```

Das Protokoll wird lokal bei der Betreiberin geführt. Es enthält keine Namen,
E-Mail-Adressen, CV-Inhalte oder Bewerbungsdaten. Wenn Feedback personenbezogene
Daten enthält, werden diese nicht in Marketingauswertungen übernommen.

---

## 7. Search Console

Nach Eigentumsbestätigung und Sitemap-Einreichung sind aggregierte Werte
verfügbar:

- Impressionen, Klicks, CTR, durchschnittliche Position,
- Suchanfragen (aggregiert),
- Indexierungsstatus der Startseite.

**Nicht verfügbar:** On-Site-Aktivierung, Suchprofil-Nutzung, Bewerbungen.
Search-Console-Daten sind kein Ersatz für Produktanalytik.

Keine Indexierung behaupten, bevor Google sie tatsächlich bestätigt.
„Technisch indexierbar“ ≠ „indexiert“.

---

## 8. Datenschutzprüfung vor späterer Messung

Eine spätere Implementierung von Website-Analytics benötigt mindestens:

1. Zweck und Rechtsgrundlage,
2. Datenschutzerklärung-Update,
3. Prüfung von Cookies/§ 25 TDDDG,
4. Datenminimierung und Speicherfrist,
5. Auftragsverarbeitung/Anbieterprüfung,
6. keine Übertragung von CV-/Profil-/Bewerbungsinhalten,
7. dokumentierte Freigabe.

Bis dahin gilt: **keine Implementierung**.

---

## 9. Berichtsregeln

- Gemessene Werte klar als gemessen kennzeichnen.
- Nicht verfügbare Werte als „nicht verfügbar“ ausweisen.
- Manuelle Schätzungen als „manuell“ kennzeichnen.
- Planungsziele nicht als Ergebnisse darstellen.
- Keine Screenshots mit personenbezogenen Daten in Reports.
- Keine Erfolgsaussagen aus Plattform-Impressionen ableiten.
