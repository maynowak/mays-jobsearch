#beschreibt das gewünschte Erscheinungsbild.

# My Job Matcher

## Design System

**Version:** 2.0  
**Projekt:** May's Job Matcher  
**Frontend:** React + TypeScript + Vite  
**Deployment:** Vercel

---

# Vision

My Job Matcher ist ein klarer, moderner Job-Such-Assistent.

Er soll seriös und vertrauenswürdig wirken, dabei aber lebendig und motivierend bleiben.

Das Ziel: Der Nutzer versteht in Sekunden, wie gut ein Job passt — und kann sofort weiterarbeiten (bewerben, Anschreiben generieren, Alerts abonnieren).

Die Technik steht im Hintergrund.

Im Vordergrund stehen die Matches.

---

# Farben

Die Farbpalette ist kühl, modern und kontrastreich.

## Primärfarben

- Indigo (`#4f46e5`) — Markenfarbe, Buttons, Links
- Deep Indigo (`#4338ca`) — Hover/Verläufe
- Ink (`#1b2333`) — Text
- White (`#ffffff`) — Karten

## Sekundärfarben

- Slate (`#64748b`) — sekundärer Text
- Cyan Accent (`#22d3ee`) — Verlaufsspitze im Hero
- Green (`#16a34a`) — hoher Score
- Amber (`#d97706`) — mittlerer Score
- Red (`#dc2626`) — niedriger Score / Fehler

## Eigenschaften

- hoher Kontrast für Lesbarkeit
- klare Hierarchie
- kühle, professionelle Grundstimmung
- Farbe für Bedeutung (Scores, Status)

---

# Typografie

Die Typografie ist modern, klar und funktional.

## Überschriften

- fett
- leicht negativer Letter-Spacing
- klare Hierarchie

## Fließtext

- system-ui Font Stack
- Zeilenhöhe 1.5
- gut lesbar auf allen Geräten

## Hervorhebungen

- sparsam einsetzen
- nur für Handlungsimpulse

---

# Komponenten

Alle Komponenten folgen denselben Regeln.

## Buttons

- große Klickfläche
- weiche Rundungen (8–10px)
- Verlauf für primäre Aktionen
- deutlicher Hover-Zustand (Schatten, Verschiebung)
- `:disabled` sichtbar (Opacity, `cursor: not-allowed`)

## Cards

- weiße Fläche
- feiner Rand (`#e2e8f0`)
- weicher Schatten
- großzügige Innenabstände

## Score Badge

- Pill (999px Radius)
- Farbe abhängig vom Wert (75+ grün, 50+ gelb, sonst rot)

## Modal

- Overlay mit Abdunklung
- zentrierte Box mit max-width 680px
- schließbar per ✕, Klick außerhalb, Escape

## Formulare

- Label über dem Feld
- klarer Fokus-Ring (Indigo mit transparentem Glow)
- Fehler als Inline-Statusmeldungen

---

# Statusmeldungen

- Fehler: roter Hintergrund (`#fef2f2`), roter Text
- Info: blauer Hintergrund, blauer Text
- Warnung: gelber Hintergrund, amber Text

---

# Responsive Design

Die Seite funktioniert auf:

- Desktop
- Tablet
- Smartphone

## Verhalten

- `.field-row` stapelt auf kleinen Screens
- Container max-width 820px, zentriert
- Karten bleiben flexibel
- Modal passt sich der Viewport-Höhe an

---

# Accessibility

Alle Besucher sollen die App nutzen können.

## Anforderungen

- ausreichender Farbkontrast
- Tastaturbedienung
- Screenreader-Unterstützung
- semantisches HTML
- sichtbare Fokuszustände
- `aria-live` für Statusmeldungen
- `aria-label` für Icon-Buttons

---

# Grundprinzip

> Fokus auf die Matches. Die Technik unterstützt, sie steht nie im Vordergrund.

Klar, schnell, vertrauenswürdig.

Keine Ablenkung, keine Spielereien.
