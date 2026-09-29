# JOOBLE-KEY-INTEGRATION-01 — Key-Integration vorbereitet, Env/Deploy beim User

## Current status
READY-BUT-BLOCKED — Code-Seite verifiziert bereit; Key-Wert liegt nicht vor (weder lokal noch im Chat verarbeitbar), Deploy-Ziel mehrdeutig. Exakte Schritte dokumentiert.

## Audit date/time
2026-09-29 17:40:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: a23849b
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
User: "ich habe den apikey, bitte integrieren dann auch auf vercel. 1000 anfragen haben wir". Annahme (ausgesprochen, Korrektur willkommen): gemeint ist der **Jooble**-Key (singular + Request-Kontingent; Adzuna bräuchte zwei Werte). Geprüft: CLI/Auth-Lage, Key-Presence, Projekt-Link, Code-Pfad, Quota-Verbrauch. Kein Secret angefasst/ausgegeben.

## Completed audit sections
1. **Vercel-CLI geprüft**: `vercel` vorhanden, eingeloggt als `gregornowak-6756`; `vercel project ls` zeigt u. a. `mays-job-matcher` (getestete Production-URL) und `mays-jobsearch`.
2. **Key-Presence geprüft** (nur Presence, keine Werte): `JOOBLE_API_KEY` ABSENT, `ADZUNA_APP_KEY` ABSENT — lokal liegt nichts vor.
3. **Projekt-Link geprüft**: `.vercel/repo.json` verlinkt dieses Verzeichnis auf Projekt **`mays-jobsearch`** — getestet wird aber **`mays-job-matcher`** (alle bisherigen Network-Logs). Zwei verschiedene Projekte.
4. **Jooble-Codepfad re-verifiziert**: `enabled()` default true; Key wird pro Request aus Env gelesen (`jooble.mjs:17-25`); ohne Key sauberes `missing_config` (kein Request, keine Kosten); mit Key POST mit `{keywords, location}`.
5. **Quota bewertet**: Jooble-Pfad hat aktuell **kein Cache** — jede `/api/jobs`-Anfrage = 1 POST = 1 Request vom 1000er-Kontingent. Bei jetzigem Verhalten reichen 1000 Requests für ca. 1000 Suchen (Cache-Hits im Browser ausgenommen).

## Actual findings
1. **Ich kann Env/Deploy nicht selbst ausführen**, aus zwei harten Gründen:
   - **Key-Wert fehlt**: Zum Setzen per `vercel env add` bräuchte ich den Wert — Secrets gehören nicht in Chats/Logs/Shell-Historie, daher fasse ich ihn nicht an.
   - **Deploy-Ziel mehrdeutig**: `vercel --prod` hier würde nach `mays-jobsearch` deployen, getestet wird `mays-job-matcher`. Falsches Projekt zu deployen wäre schädlich.
2. **Code ist bereit**: Sobald `JOOBLE_API_KEY` im richtigen Projekt (Production-Scope) gesetzt ist + Redeploy, liefert Jooble (sichtbar dann in `meta.sources.jooble > 0` und `meta.sourceReasons.jooble: null`).
3. **Quota-Hinweis**: Ohne Cache verbrennt jede Suche 1 Request. Falls die 1000 knapp werden → separater Task: L1-Cache (10 Min, wie Apify) für Jooble/Adzuna.

## Evidence / file references
- `vercel whoami` → `gregornowak-6756`; `vercel project ls` → `mays-job-matcher` + `mays-jobsearch` (beide Scope maymilly)
- `.vercel/repo.json` — Link auf `mays-jobsearch` (`prj_j6Akjcc5zFVgCXhmGshDtbibZYmYddIj`)
- Env-Check: `JOOBLE_API_KEY: ABSENT`, `ADZUNA_APP_KEY: ABSENT` (Presence-only)
- `api/_lib/sources/jooble.mjs:13-25` — Enabled-Default + Key-Gate
- `api/_lib/config.mjs` — `joobleApiKey: process.env.JOOBLE_API_KEY || ""` (pro Request gelesen)

## Classification
**YELLOW** — Code bereit, aber blockiert: Key-Wert + Deploy-Ziel-Entscheidung liegen beim User.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/JOOBLE-KEY-INTEGRATION-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert (nichts zu ändern — Pfad verifiziert bereit).

## Open questions
1. **Bestätigen**: Geht es um den Jooble-Key (Annahme) oder Adzuna (`ADZUNA_APP_ID` + `ADZUNA_APP_KEY`)?
2. **Welches Projekt ist Production**: `mays-job-matcher` (getestet) oder `mays-jobsearch` (lokal verlinkt)?

## Risks
Keine durch diesen Befund. Hinweise: Key nur in Vercel-Env (Production-Scope), nie in Chat/Repo; Env-Änderungen brauchen Redeploy des richtigen Projekts; Quota ohne Cache = 1 Request pro Suche.

## Recommended next actions
1. Diesen Report committen + pushen (dieser Schritt).
2. **Du** (oder Folgesession nach Klärung von Frage 1+2):
   a. Vercel-Dashboard → Projekt `mays-job-matcher` → Settings → Environment Variables → `JOOBLE_API_KEY` = Key-Wert, Scope **Production** (+ ggf. Preview) → Save.
   b. Neu deployen (`vercel --prod` im richtigen Projekt-Kontext bzw. Dashboard-Redeploy).
   c. Verifizieren: Suche ausführen → `/api/jobs`-Response → `meta.sources.jooble > 0` und `meta.sourceReasons.jooble: null`.
3. Optional follow-up (separat): L1-Cache für Jooble/Adzuna zum Quota-Schutz.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Integrations-Prüfung (CLI/Auth/Link/Key-Presence als Presence-only, Code-Review, Quota-Bewertung) plus Dokumentation. Keine Secrets gelesen/ausgegeben, kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Befund + Anleitung dokumentiert. Nächster Schritt: Report committen + pushen; dann deine Klärung (Fragen 1+2) und Key-Eintrag durch dich.
