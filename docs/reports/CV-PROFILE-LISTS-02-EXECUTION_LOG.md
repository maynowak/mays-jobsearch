# CV-PROFILE-LISTS-02 — EXECUTION LOG

## Current status
FINALIZED — CV-PROFILE-LISTS-02 (Memory+12h-TTL), -03 (Namensvorschlaege),
-04 (Entfernen-Button) und -05 (Namensfeld oben + "<Basis> - Profil<N>/
ATS<N>") umgesetzt; alle Validierungen gruen. Commit steht aus
(Nutzerfreigabe).

## Final state
- Checks: 503/503 Tests PASS, TSC PASS, Build PASS, diff --check CLEAN.
- Files changed: src/lib/cvProfileStore.ts, src/lib/cvProfileStore.test.ts,
  src/App.tsx, src/App.test.tsx, src/components/CvDocumentList.tsx,
  src/components/CvDocumentList.test.tsx, src/components/CvProfileResult.tsx,
  src/components/CvProfilesOverlay.tsx, src/i18n.tsx, src/styles.css,
  docs/AI_AUDITLOG.md, diese Datei.
- Neue Tests: Store (8: Memory, Hash-Trennung, Defaults, TTL-Ablauf,
  Fenster-Verlaengerung ausgeschlossen, Legacy-Purge, Reset), Flow
  (Namensvorschlaege + Fokus-Markierung; Entfernen-Button mit Bestaetigung).
- Zusatzarbeit UX-03: Namensvorschlaege "Profil1..n" / "ATS-Profil1..n"
  (Zaehler je CV-Liste), Klick ins Feld markiert den ganzen Text.
- Zusatzarbeit UX-04: "CV-Daten entfernen" (alertdialog-Bestaetigung +
  Hinweis auf erneutes Hochladen; kompletter Reset von Dokumenten, Listen
  und Workflow-State).
- Resume point: abgeschlossen; bei Fortsetzung git status pruefen.

## Audit date/time
2026-09-26 (nach CV-PROFILE-LISTS-01, HEAD 3b9bb88 gepusht)

## Task / Purpose (User-Request, Datenschutz)
1. Listen duerfen einen Reload NICHT ueberleben (Reload-Persistenz nur durch
   Fehler denkbar / Fremdnutzer-Problem am selben Browser).
2. Nach Upload + Verarbeitung eines CVs werden die zugehoerigen Listen nach
   12 Stunden automatisch geleert — auch wenn der Browser offen bleibt.
3. Altlasten: mj-cv-lists:* aus der v1 (localStorage) im Browser entfernen.

## Design-Entscheidungen
- Speicher wird MEMORY (module-level Map<hash, bucket>) statt localStorage
  -> Reload leert alles von selbst. Kein Server-Kontakt.
- Bucket je CV-Hash: expiresAt = Zeitpunkt der ersten Verarbeitung + 12h;
  weitere Saves verlaengern NICHT (festes Fenster, privacy-vorhersehbar).
- Lazy-Purge bei jedem lesenden/schreibenden Zugriff (abgelaufene Buckets
  werden entfernt). Overlay liest pro Render -> Anzeige ist garantiert frisch.
- Neuer API: resetCvProfileLists() (alles leeren; Tests + Spaeter-Button),
  purgeLegacyCvListsFromLocalStorage() (Einmal-Bereinigung beim App-Start).
- Transparenz: Hinweis im Overlay ("lokal, wird nach 12 h / beim Neuladen
  geloescht").

## Checks (werden bei Abschluss eingetragen)
PENDING

## Classification
PENDING

---

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

### CV-PROFILE-LISTS-02 — LISTEN NUR SESSION-SPEICHER + 12H-AUTO-LOESCHUNG (PRIVACY)
- Date: 2026-09-26
- Task: CV-PROFILE-LISTS-02 (User-Request, Datenschutz)
- Purpose: Die Profil-Listen duerfen einen Reload NICHT ueberleben (nur
  Fehler-/Fremdnutzer-Fall) und sollen 12 Stunden nach Verarbeitung eines
  CVs von selbst geleert werden — auch bei offenem Browser.
- Umsetzung:
  - cvProfileStore.ts von localStorage auf MEMORY (module-level Map)
    umgestellt -> Reload entfernt alles automatisch.
  - TTL: Bucket je CV-Hash mit festem expiresAt (= erste Verarbeitung + 12h;
    weitere Saves verlaengern NICHT). Lazy-Purge bei jedem Zugriff.
  - Neue API: resetCvProfileLists() (sofort leeren; Grundlage fuer UX-04),
    purgeLegacyCvListsFromLocalStorage() (entfernt mj-cv-lists:*-Altlasten
    aus v1; laeuft einmalig beim App-Start).
  - Overlay: Transparenz-Hinweis (cv.profilesPrivacyNote, de/en).
- Consent-/Contract-Bezug: keine Aenderung; datenschutzfreundlicher als v1
  (weniger Persistenz).
- Files changed: src/lib/cvProfileStore.ts (Memory+TTL), src/App.tsx,
  src/components/CvProfilesOverlay.tsx, src/i18n.tsx,
  src/lib/cvProfileStore.test.ts (TTL-/Purge-/Reset-Tests),
  src/App.test.tsx (Test-Isolation via resetCvProfileLists()),
  docs/AI_AUDITLOG.md, docs/reports/CV-PROFILE-LISTS-02-EXECUTION_LOG.md
- Tests: 503/503 PASS; TypeScript PASS; Build PASS; diff --check CLEAN
- Classification: GREEN — Listen nur noch sessionbasiert + 12h-Auto-Leerung.
