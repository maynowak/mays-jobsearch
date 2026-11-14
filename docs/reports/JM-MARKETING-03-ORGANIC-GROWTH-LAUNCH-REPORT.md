# JM-MARKETING-03 — Organic Growth Launch Report

**Status:** `ORGANIC GROWTH CAMPAIGN READY — CONTENT REVIEW PENDING`
**Datum:** 2026-11-14 (Europe/Berlin)
**Branch:** `feature/jm-marketing-03-organic-growth`
**Basis:** `origin/main` @ `a5640d1`
**Bekannter Altstand:** `854da77` (in `a5640d1` enthalten)

Kein Merge nach `main`, kein Production-Deployment, keine Veröffentlichung,
keine neuen Analytics-/Tracking-Dienste, keine RIS-/AWS-/Cognito-/Terraform-
Änderung, keine Auth-/Consent-/Matching-Änderung.

---

## 1. Git und Baseline

| Prüfung | Ergebnis |
|---|---|
| `origin/main` bei Arbeitsbeginn | `a5640d1` (Merge PR #18, XRepo-Shared-State) |
| Bekannter Stand aus Auftrag | `854da77` — ist Ancestor von `a5640d1` |
| Production (read-only) | Footer `Version 2.2.0 · production · main · a5640d1` |
| Neuer Branch | `feature/jm-marketing-03-organic-growth` von `origin/main` |
| Änderungstyp | ausschließlich Dokumentation |
| Untracked Fremddateien | 4, unverändert |

Der Auftrag nannte `854da77` als Production/main-Stand. Der tatsächliche
`origin/main` war am 2026-11-14 bereits `a5640d1`; `854da77` ist darin
enthalten. Es gab keine Produktänderung an der Landingpage, nur den
nachgelagerten XRepo-Merge. Der Marketing-Branch basiert daher auf dem
aktuellen `origin/main`.

---

## 2. Erstellte Marketing-Assets

```text
docs/marketing/
├── README.md
├── strategy/
│   ├── ORGANIC_GROWTH_STRATEGY.md
│   └── CLAIMS_AND_COMPLIANCE.md
├── campaigns/
│   └── LAUNCH_2026.md
├── content/
│   ├── LINKEDIN_POSTS.md
│   ├── SEO_ARTICLES.md
│   └── PRODUCT_DEMO_SCRIPT.md
├── measurement/
│   └── GROWTH_METRICS.md
└── calendar/
    └── FIRST_30_DAYS.md
```

Alle Dateien sind `DRAFT — CONTENT REVIEW PENDING`.

---

## 3. Strategie und Positionierung

**Kernbotschaft:** „Finde Jobs, die wirklich zu dir passen.“
**Englisch:** „Find jobs that really fit you.“

Positionierung als individuelle Jobsuche mit KI-Unterstützung, nicht als
klassische Jobbörse. Die Strategie enthält:

- drei Zielgruppen-Hypothesen (IT/Tech, berufserfahrene Fachkräfte,
  Wiedereinsteiger) mit Bedürfnissen, Suchbegriff-Hypothesen, Kanälen,
  Einstiegshürden, passenden Funktionen und Botschaften,
- Kanalpriorisierung (LinkedIn, SEO, YouTube, GitHub, Weiterbildungsträger,
  Fachblogs, Reddit/Communities, Instagram),
- Funnel-/Zieldefinition,
- Datenschutzgrenzen,
- Risiken und Freigabe-Gates.

Die Zielgruppen- und Keyword-Annahmen sind ausdrücklich Hypothesen, keine
demografischen Tatsachenbehauptungen.

---

## 4. Content

### LinkedIn

Sechs deutsche Beiträge plus englische Launch-Version:

1. Offizielle Produktvorstellung (DE + EN)
2. Problem unpassender Stellenangebote
3. Individuelle Suchprofile
4. KI-gestütztes Job Matching
5. Datenschutz und Nutzerkontrolle
6. Einladung zum Produkttest

Jeder Beitrag enthält Zielgruppe, Ziel, CTA, Link und Hashtags. Es gibt keine
erfundenen Nutzerzahlen, Testimonials oder Erfolgsquoten.

### SEO-Konzepte

Drei Konzepte, jeweils mit Suchintention, Keyword-Hypothesen, Arbeitstitel,
Meta-Description, Struktur, interner Verlinkung, Produktbezug und CTA:

1. „Wie finde ich Jobs, die wirklich zu meinem Lebenslauf passen?“
2. „ATS-Matching verstehen: Lebenslauf und Stellenanzeige vergleichen“
3. „Jobsuche organisieren: Von der Stellenanzeige bis zur Bewerbung“

**Wichtig:** Es wurden keine Blog-/Artikel-Routen implementiert. Die Konzepte
sind nicht veröffentlicht und benötigen einen separaten Umsetzungsauftrag.

### Produktdemo

90-Sekunden-Drehbuch mit Szenen, Sprechtext, Untertiteln und Produktionsregeln.
Ausschließlich synthetische Persona/Stelle; keine echten CV- oder
Bewerbungsdaten. Keine erfundenen Scores oder Trefferquoten.

---

## 5. Reddit-Recherche (Stand 2026-11-14)

Geprüft wurden die öffentlichen Regeln; es wurde nichts gepostet. Regeln können
sich ändern und sind vor jeder Beteiligung erneut zu prüfen.

| Community | Befund | Konsequenz |
|---|---|---|
| `r/jobs` | „No Job Posts, No Self Promotion“; keine Services/Werbung, auch nicht kostenlos | Kein Produktpost/Link |
| `r/arbeitsleben` | „Keine Eigen- und Fremdwerbung“; zusätzlich keine LLM-/KI-generierten Inhalte | Kein Produktpost, keine KI-Texte |
| `r/resumes` | „No advertising or soliciting users“; ausdrücklich Jobsuche-Tools; keine KI-Inhalte | Kein Produktpost/Link |
| `r/InformatikKarriere` | Werbung nur nach Absprache mit Mods; Spam wird gelöscht | Ohne Mod-Freigabe kein Post |
| `r/cscareerquestions` | Produktvorstellung nur in monatlichen Stickied-Threads | Kein eigener Promo-Post |

**Entscheidung:** Reddit ist kein Launch-Kanal. Höchstens später
kommentarbasierte, menschliche Beteiligung ohne Produktlink — nach erneuter
Regelprüfung und Freigabe.

Quellen: öffentliche Community-Regeln (`reddit.com/r/jobs/about/`,
`r/arbeitsleben/about/`, `r/resumes/`, `r/InformatikKarriere/about/`,
`r/cscareerquestions/`), abgerufen 2026-11-14.

---

## 6. Google Search Console

**Status:** `SEARCH CONSOLE OWNERSHIP VERIFICATION PENDING`

| Prüfung | Ergebnis |
|---|---|
| Landingpage | HTTP 200, indexierbar, Canonical korrekt |
| `robots.txt` | HTTP 200, `Allow: /`, `Disallow: /api/`, Sitemap-Verweis |
| `sitemap.xml` | HTTP 200, valides XML, nur Startseite |
| DNS-TXT `google-site-verification` | nicht vorhanden (app/www geprüft) |
| HTML-Meta-Verifikation | nicht vorhanden |
| Verifikationsdatei | nicht vorhanden |
| Property/Sitemap-Einreichung | **nicht ausgeführt** |
| Google-Indexierung | **nicht behauptet** |

Die konkrete Anleitung (Domain-Property, DNS-TXT ohne SPF/MX/DKIM-Änderung,
Sitemap-Einreichung, URL Inspection, Status-Trennung) ist in
`docs/marketing/strategy/ORGANIC_GROWTH_STRATEGY.md` §7 dokumentiert.

---

## 7. Messkonzept

- Keine Analytics-, Cookie-, Pixel- oder Fingerprinting-Dienste implementiert.
- Keine personenbezogenen CV-/Profil-/Bewerbungsdaten für Marketing.
- UTM-Parameter sind vorbereitet (`jm_launch_2026`), aber ohne freigegebenes
  Analytics-Tool nicht auswertbar.
- Websitebesucher, Start der Jobsuche, Suchprofil-Nutzung und Wiederkehr sind
  heute **nicht** messbar.
- Verfügbar sind nur Plattform-Aggregate (soweit die Plattform sie zeigt) und
  freiwilliges qualitatives Feedback.
- Planungsziele: 100 qualifizierte Besucher, 10 Testnutzer — keine Prognosen,
  keine gemessenen Werte.

Details: `docs/marketing/measurement/GROWTH_METRICS.md`.

---

## 8. 30-Tage-Plan

`docs/marketing/calendar/FIRST_30_DAYS.md` enthält vier Wochen:

- **Woche 1:** Search Console, LinkedIn-Launch (DE/EN), Demo-Probe.
- **Woche 2:** Suchprofile, KI-Matching, SEO-Entwürfe, Demo-Veröffentlichung.
- **Woche 3:** Datenschutz, Testeinladung, Weiterbildungsträger, Feedback.
- **Woche 4:** Auswertung, Content-Optimierung, Search-Console-Status,
  nächster Zyklus.

Jede Maßnahme hat Ziel, Zielgruppe, Kanal, Inhalt, Verantwortlichkeit, Aufwand,
Erfolgskriterium und Status. Alle Status sind `DRAFT`.

---

## 9. Compliance-Prüfung

`docs/marketing/strategy/CLAIMS_AND_COMPLIANCE.md` prüft Aussagen gegen den
Produktstand. Nicht verwendet werden:

- Garantien auf passende Jobs/Einstellung,
- „alle Jobbörsen“,
- unbegrenzte kostenlose KI-Nutzung,
- vollständige Anonymität,
- dauerhafte Speicherung ohne Einwilligung,
- erfundene Nutzerzahlen/Testimonials.

Erlaubte Formulierungen unterscheiden:

- Suche ohne Konto vs. dauerhafte Profile mit Konto + Consent,
- KI-Bewertung auf Wunsch vs. Garantie,
- verfügbare Quellen vs. „alle Quellen“,
- lokale PDF-Verarbeitung vs. mögliche KI-Textübermittlung,
- sitzungsbasierte Bewerbungen vs. dauerhafte Speicherung.

---

## 10. Qualitätssicherung

Da ausschließlich Dokumentation geändert wurde, wurden keine vollständigen
Anwendungstests als künstlich erforderlich dargestellt.

| Prüfung | Ergebnis |
|---|---|
| Markdown-Dateien | 9 erstellt |
| Lokale Dateiverweise | alle vorhanden |
| Externe Links (Produktion, Reddit) | 19 URLs geprüft, alle HTTP 200 am 2026-11-14 |
| Meta-Description-Längen | 140 / 138 / 135 Zeichen |
| Verbotene Aussagen | nur in Ablehnungs-/Regelkontexten, nicht als Produktversprechen |
| `git diff --check` | PASS |
| Secret-Audit | keine Secrets/Tokens gefunden |
| App-Tests/Build | **nicht ausgeführt** (keine Produktcodeänderung) |

---

## 11. Risiken und offene Punkte

| ID | Schwere | Punkt |
|---|---|---|
| F1 | MINOR | Google Search Console noch nicht verifiziert; keine Suchdaten |
| F2 | MINOR | Keine Website-Analytics; On-Site-Conversion nicht messbar |
| F3 | MINOR | Reddit für Produktwerbung nicht nutzbar; teilweise KI-Inhalte verboten |
| F4 | MINOR | SEO-Artikel sind Konzepte; keine Blog-Routen implementiert |
| F5 | INFO | Production/main ist aktuell `a5640d1`, nicht `854da77`; Landingpage unverändert |
| F6 | INFO | Alle Content-Assets benötigen manuelle Freigabe |

Keine BLOCKER, keine MAJOR-Findings.

---

## 12. Release-/Kampagnenstatus

**A — ORGANIC GROWTH CAMPAIGN READY — CONTENT REVIEW PENDING**

- Strategie, Zielgruppen, Kanäle, Content, Search-Console-Anleitung,
  Messkonzept und 30-Tage-Plan sind vollständig vorbereitet.
- Nichts wurde veröffentlicht.
- Kein Merge, kein Production-Deployment.
- Nächster Schritt: `JM-MARKETING-03B — ORGANIC LAUNCH CONTENT REVIEW &
  PUBLICATION APPROVAL`.
