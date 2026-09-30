# CAP-50-VERIFY-02 — Wieder exakt 50, nur 2 Quellen: Prüfstand

## Current status
OPEN — Zwei Erklärungen formuliert (alter Deploy-Stand vs. korrekt leere Zusatz-Quellen); Entscheidung hängt an zwei Produktiv-Werten (Footer-Version, `meta.sources`), die nur vor Ort ablesbar sind.

## Audit date/time
2026-09-29 22:10:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 226b44b
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
User-Befund: Anzeige wieder `Arbeitnow 29 + Arbeitsagentur 21 = Insgesamt 50`, keine Cut-Rows sichtbar; Verifizierung ausstehend. Geprüft per Code-Review (kein erneuter Bug-Fund); Entscheidungskriterien für die Deutung dokumentiert. Read-only; keine Codeänderung.

## Completed audit sections
1. **Mögliche Ursache A (wahrscheinlicher): alter Deploy-Stand.** Cut-Rows existieren erst ab Commit `226b44b`; Production deployt explizit per CLI (kein Auto-Deploy). Mit älterem Stand ist die Anzeige physisch unverändert — kein Widerspruch, kein Bug.
2. **Mögliche Ursache B (erwartet): nichts anzuzeigen.** Cut-Rows erscheinen nur bei `raw > 0` UND `final == 0`. Ohne Keys/Boards liefern die Neuen exakt 0 roh (`missing_config`/`no_boards_configured`/0 Instanzen) → korrekterweise keine Zeile. Exakt-50 ist der bekannte Anzeige-Cap (29+21), kein neues Phänomen.
3. **Echte Bug-Bedingung formuliert:** Nur wenn `meta.sources` eine dritte Source mit Wert > 0 zeigt UND keine Cut-Row erscheint, liegt ein Defekt im neuen Code vor.

## Actual findings
- Kein neuer Code-Fehler gefunden (Review von State-Plumbing, Props, Cut-Logik, i18n-Keys, CSS-Klassen gegen implementierten Stand).
- Die Deutung ist ohne zwei Produktiv-Werte nicht entscheidbar: (1) Footer-Build-SHA (≥ `226b44b` nötig), (2) `meta.sources` der `/api/jobs`-Response.
- Ausschlusslogik dokumentiert: `sourceReasons`/`apify`-Felder aus AA-LIVE-VS-WEBSITE-01 und früheren Reports gelten weiter.

## Evidence / file references
- `src/App.tsx` — `foundSources`-State, Setzen in `runSearch`/`runCvSearch`, Prop-Weitergabe (Review, keine Änderung)
- `src/components/JobSources.tsx` — Cut-Row-Bedingung `raw > 0 && final == 0` (Review, keine Änderung)
- `docs/DEPLOYMENT.md` + README — explizite CLI-Deploys, kein Auto-Deploy (Begründung für Ursache A)
- User-Beobachtung: `Arbeitnow 29 + Arbeitsagentur 21 = Insgesamt 50`, keine Cut-Rows

## Classification
**YELLOW** — Kein Bug nachweisbar, aber Abschluss blockiert bis Produktiv-Evidenz (Footer-SHA, `meta.sources`) vorliegt.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/CAP-50-VERIFY-02-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert (bewusst: ohne Evidenz kein Code-Eingriff).

## Open questions
1. Footer-Build-SHA in Production — `226b44b` oder neuer? (Falls nein: deployen, erneut testen.)
2. `meta.sources` der konkreten Response — dritte Source mit Wert > 0, aber keine Cut-Row? (Nur dann: Bug, sofort melden mit Werten.)

## Risks
Keine durch Befund. Hinweis: Voreiliges "Fixen" ohne Evidenz würde funktionierenden Code umbauen — deshalb bewusst nur Diagnose + Entscheidungskriterien.

## Recommended next actions
1. Diesen Report committen + pushen.
2. User liefert Footer-SHA + `meta.sources` → Abschluss (Grün bei A/B, Fix-Task bei Bug-Bedingung).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Read-only Diagnose eines Anzeige-Befunds (Code-Review + Entscheidungskriterien). Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Prüfstand dokumentiert, offen bis Produktiv-Evidenz. Nächster Schritt: Report committen + pushen.
