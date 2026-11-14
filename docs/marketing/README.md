# Marketing — May's Job Matcher

**Status:** `DRAFT — CONTENT REVIEW PENDING`
**Stand:** 2026-11-14
**Zweck:** Organic-Growth-Strategie, Content-Entwürfe, Messkonzept und 30-Tage-Plan für May's Job Matcher.

> **Nichts in diesem Ordner ist veröffentlicht.** Alle Beiträge, Artikel, Videos
> und Outreach-Nachrichten sind Entwürfe und benötigen eine manuelle Freigabe
> durch die Betreiberin. Es gibt keine automatisierten Social-Media-Posts, keine
> bezahlten Kampagnen und keine neuen Tracking-Dienste.

## Dateien

| Datei | Inhalt |
|---|---|
| `strategy/ORGANIC_GROWTH_STRATEGY.md` | Positionierung, Zielgruppen, Kanäle, Priorisierung |
| `strategy/CLAIMS_AND_COMPLIANCE.md` | Aussagen-Matrix und Produktverfügbarkeit |
| `campaigns/LAUNCH_2026.md` | Launch-Kampagne, Narrative, Freigabe-Gates |
| `content/LINKEDIN_POSTS.md` | Sechs deutsche LinkedIn-Entwürfe + EN-Launch-Post |
| `content/SEO_ARTICLES.md` | Drei SEO-Content-Konzepte (keine Blog-Routen implementiert) |
| `content/PRODUCT_DEMO_SCRIPT.md` | 90-Sekunden-Demo-Drehbuch mit synthetischen Daten |
| `measurement/GROWTH_METRICS.md` | Datenschutzbewusstes Messkonzept |
| `calendar/FIRST_30_DAYS.md` | 30-Tage-Kalender mit Status und Erfolgskriterien |

## Verbindliche Aussagen-Regeln

- Keine Garantie auf passende Jobs oder Einstellungen.
- Keine „alle Jobbörsen“-Aussage; Quellen sind je nach Konfiguration verfügbar.
- Keine unbegrenzte kostenlose KI-Nutzung; freie Modelle und Quoten können sich ändern.
- Keine vollständige Anonymität; CV-Text kann für KI-Funktionen übermittelt werden.
- Dauerhafte Speicherung nur mit Konto und zweckgebundener Einwilligung.
- Keine erfundenen Nutzerzahlen, Bewertungen oder Erfolgsgeschichten.
- Keine personenbezogenen CV-, Profil- oder Bewerbungsdaten in Marketingmaterialien.

## Produkt-Evidence (Auszug)

Die Aussagen in diesem Ordner wurden gegen den aktuellen Stand geprüft:

- Landingpage/Positionierung: `src/components/LandingPage2.tsx`, `index.html`
- Suche/Filter: `api/jobs.mjs`, `api/_lib/sources/index.mjs`, `api/_lib/sourcePolicy.mjs`
- KI-Bewertung: `api/match.mjs`, `src/components/Results.tsx`
- Suchprofile/Speicherung: `src/i18n.tsx` (`manualProfiles.*`, `profileStorage.*`), `src/App.tsx`
- CV-Verarbeitung: `src/components/CvUpload.tsx`, `public/legal/datenschutz.md`
- Bewerbungen: `src/components/ApplicationsSection.tsx` (`applications.sessionOnly`, `applications.remoteNotice`)
- Datenschutz/Consent: `public/legal/datenschutz.md`, `public/legal/prinzipien.md`

## Freigabe

Vor jeder Veröffentlichung:

1. Inhaltliche Prüfung durch die Betreiberin.
2. Prüfung der aktuellen Community-Regeln (insbesondere Reddit).
3. Prüfung der Produktaussagen gegen den dann aktuellen Produktstand.
4. Freigabe nach `JM-MARKETING-03B — ORGANIC LAUNCH CONTENT REVIEW & PUBLICATION APPROVAL`.
