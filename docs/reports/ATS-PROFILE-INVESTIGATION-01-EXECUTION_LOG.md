# ATS-PROFILE-INVESTIGATION-01 — EXECUTION LOG (READ-ONLY-BEFUND + Mini-Fixes)

## Current status
FINALIZED — Befunde dokumentiert; zwei Konsistenz-Mini-Fixes aus der
Untersuchung umgesetzt (in CV-UPLOAD-UX-10, siehe dessen Report).

## Ergebnis der Untersuchung (Stand nach CV-UPLOAD-UX-07/08)

### Was passiert BEI der Auswahl (Datenfluss, verifiziert)
1. Auswahl im CV-Bereich setzt `activeAtsEntryId` (App- oder Box-Select);
   `activeAtsEntry` = Lookup in der Liste des Quelldokuments
   (Inhalts-Hash; erstes ausgewaehltes Dokument, Fallback erstes Dokument).
2. Wirkung: Die per-Treffer-Job ATS-Analyse (AtsOverlay) nutzt dann ein aus
   dem ATS-Profil synthetisiertes Profil (skills + targetRole) STATT des
   allgemeinen Suchprofils (App.tsx, per-job ATSModal-Render).
3. Ohne Auswahl: wie bisher das allgemeine Suchprofil.
4. Consent/Privacy unveraendert: ATS-Aufrufe laufen weiter nur ueber das
   ATS-Overlay mit Einwilligung; ATS-Profile liegen im Session-Speicher
   (12h-Loeschung, LISTS-02).

### Randfaelle / Befunde
- (a) Wechsel des Quelldokuments (andere Auswahl in der CV-Liste): zuvor
  behielt die Auswahl-ID auf eine verwaiste Liste -> stiller Fallback.
  -> BEHOBEN (Reset beider Auswahl-IDs bei Doc-Wechsel, useEffect).
- (b) "CV-Daten entfernen": Speicher geleert, aber Auswahl-IDs blieben ->
  stiller Fallback. -> BEHOBEN (IDs werden in handleCvRemoveData
  zurueckgesetzt).
- (c) 12h-TTL-Ablauf bei offener Seite: Eintrag verschwindet -> Lookup null
  -> stiller Fallback aufs globale Profil; Select zeigt leeren Wert.
  -> Dokumentiert (Privacy-first Design; bewusst kein Verfall-Toast).
- (d) In-Workflow-Tiefenanalyse (ats-processing/Improvements/...) ist ruhend
  (UX-07) — ATS-Profil wirkt aktuell auf die per-Job-Analyse.
  -> Folgetask-Notiz: Start der Tiefenanalyse MIT gewaehltem ATS-Profil.

### Classification
GREEN — Verhalten dokumentiert, gefundene Inkonsistenzen behoben;
kein Consent-/Contract-Unterschied.
