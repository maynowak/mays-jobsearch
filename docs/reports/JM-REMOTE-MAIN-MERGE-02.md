# JM-REMOTE-MAIN-MERGE-02

**Art:** Kontrollierte lokale Integration von `origin/main` / Regression / Audit
**Datum:** 2026-11-05
**Modus:** Merge, Regression — **kein Push, kein Deployment**
**Status:** **LOCAL MAIN: VERIFIED** — Remote-Lizenzdokumente integriert

---

## 1. Tatsächliche Git-Baseline

| Referenz | Wert |
|---|---|
| Repository | `maynowak/mays-jobsearch` |
| Integrations-Worktree | `/home/dci-student/projects/mays-jobsearch-consolidation` (`main`) |
| Lokaler `main` vor Merge | `9f0e3a1` |
| `origin/main` | `0fa799e` (Tracking und `ls-remote` identisch) |
| Merge-Base | `4364eab` |
| Divergenz vor Merge | **95 ahead / 4 behind** |
| Working Tree vor Merge | clean |
| Fremder Checkout | `Mays-Jobsearch` (`7eb779a`) unverändert |

---

## 2. Remote-Commits

| Commit | Dateien | Wirkung |
|---|---|---|
| `48a9a76` | `LICENSE.md` (−673/+22) | temporärer Austausch mit dem LICENSING-Text |
| `1ad88ab` | 4 neue Dokumente | `COMMERCIAL-LICENSING.md`, `LICENSE-HISTORY.md`, `PREMIUM-SERVICES.md`, `THIRD-PARTY-NOTICES.md` |
| `237ea9a` | `LICENSE.md` (−22/+673) | vollständige Wiederherstellung des AGPL-Textes |
| `0fa799e` | `LICENSING.md` | Überblick als eigene Datei |

Nettoänderung gegenüber der Merge-Base: **5 neue Dateien**, keine Modifikation,
keine Löschung. `LICENSE.md` ist im finalen Baum unverändert.

---

## 3. Merge-Commit und Parents

```text
git merge --no-ff --no-commit origin/main
→ Automatischer Merge abgeschlossen, keine Konflikte
→ commit: "merge: reconcile remote licensing documents"

HEAD:    639ed87
Parents: 9f0e3a1 (lokaler main)
         0fa799e (origin/main)
```

- Genau zwei Parents: lokale und Remote-Historie bleiben vollständig erhalten.
- Kein Rebase, kein Squash, kein Cherry-Pick, keine History-Rewrites.
- Staged vor Commit: ausschließlich 5 `A`-Einträge, +146 Zeilen.
- `git diff --cached --check`: PASS.

---

## 4. Integrierte Lizenzdateien

| Datei | Zeilen | Status |
|---|---|---|
| `LICENSING.md` | 32 | neu |
| `COMMERCIAL-LICENSING.md` | 39 | neu |
| `LICENSE-HISTORY.md` | 23 | neu |
| `PREMIUM-SERVICES.md` | 33 | neu |
| `THIRD-PARTY-NOTICES.md` | 19 | neu |

`LICENSE.md` wurde **nicht** verändert.

---

## 5. Lizenzintegrität

| Prüfung | Ergebnis |
|---|---|
| `LICENSE.md` Blob vor/nach Merge | `b6d1928…` — **byte-identisch** |
| SPDX-Kennung | `AGPL-3.0-only` — unverändert |
| Copyright | `Copyright (C) 2026 Maymilly Nowak` — unverändert |
| Nachträgliche Einschränkung der AGPL-Rechte | **keine**; alle Dokumente betonen den Vorrang von `LICENSE.md` |
| Kommerzielle Nutzung unter AGPL | ausdrücklich erlaubt |
| Zusätzliche kommerzielle Angebote | freiwillig, nur nach separater Vereinbarung |
| Bestehende Third-Party-Lizenzdateien | nicht verändert (u. a. `src/assets/fonts/DejaVu.LICENSE.txt`) |

---

## 6. Unveränderte Produktfunktionen

`git diff --stat 9f0e3a1..HEAD -- api src tests package.json package-lock.json`
ist **leer**. Damit unverändert:

- `api/profile.mjs`: kein `cacheGet`/`cacheSet`/`cv-profile`-Pfad.
- `src/api.ts`: kein Client-Hash im Profilrequest.
- `src/i18n.tsx`: korrigierte Datenschutztexte und „Aus dieser Sitzung entfernen“.
- CV-Builder, CV-Management, Bewerbungsverwaltung, Anschreiben, Session-Repository.
- Cache-Retirement, Datenschutztexte, Consent-Vorbereitung.
- Keine RIS-Persistenz, keine neue Speicherung, keine neuen Cookies.

---

## 7. Regression

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run --maxWorkers=2` | **1414 passed / 5 skipped** (137 Dateien passed, 3 skipped) |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |
| `git diff --check 9f0e3a1..HEAD` | **PASS** |
| `node --check` auf `api/**/*.mjs` | **PASS** |

Keine Regression gegenüber der Vergleichsbasis.

---

## 8. E2E-Ergebnisse (Mock-Daten)

Alle folgenden Suiten **PASS**:

| Suite | Ergebnis |
|---|---|
| CV-Builder | PASS |
| CV-Management 02B | PASS |
| CV-Management 02C | PASS |
| CV-Builder-PDF | PASS |
| Cover-Letter | PASS |
| Direct-Cover-Letter | PASS |
| Manual-Application-Draft | PASS |
| Applications | PASS |
| Profile-Storage-Consent | PASS |
| Guest-CV | PASS |
| Mobile-Navigation | PASS |

Die E2E-Läufe überschrieben versionierte Screenshots; diese wurden
zurückgesetzt. Working Tree danach clean. Keine echten KI-/Provider-/RIS-/
AWS-/Redis-Aufrufe.

---

## 9. Offene Lizenz-Findings

1. **Drittsoftware-Inventar unvollständig** — `THIRD-PARTY-NOTICES.md` listet
   die vendorten DejaVu-Fonts nicht, obwohl die Lizenzdatei vorliegt.
   (REVIEW REQUIRED, kein Konflikt)
2. **`package.json` ohne `license`-Feld** — npm-Metadaten deklarieren
   `AGPL-3.0-only` nicht. (REVIEW REQUIRED, niedrig)
3. **Rechtsprüfung PENDING** — die Dokumente sind informativ, keine
   rechtsverbindliche Freigabe.
4. **`PREMIUM-SERVICES.md`** nennt mögliche künftige serverseitige CV-/
   Bewerbungsverwaltung. Keine aktuelle Zusage; vor Aktivierung Produkt-/
   Rechtsprüfung erforderlich.

---

## 10. Remote-Divergenz nach Integration

```text
main...origin/main: 96 ahead / 0 behind
```

`origin/main` (`0fa799e`) ist vollständig in `main` enthalten. Ein Push ist
**nicht** erfolgt und nicht freigegeben; der Remote-Stand ist unverändert.

---

## 11. Finaler Main-HEAD

- Merge-Commit: **`639ed87`**
- Dokumentations-Commit: siehe Git-Historie
  (`docs: record remote main merge`)
- Working Tree: **clean**
- Feature-Branch: unverändert `3f56568`

---

## 12. Abschlussentscheidung

| Kriterium | Status |
|---|---|
| Git-Historie | **PRESERVED** |
| Remote-Commits | **INTEGRATED** |
| AGPL | **UNCHANGED** |
| Lokale Entwicklung | **PRESERVED** |
| Regression | **PASS** |
| Lizenzinventar | **REVIEW REQUIRED** |
| Legal Review | **PENDING** |
| Local Main | **VERIFIED** |
| Push | **NOT AUTHORIZED** |
| Production | **NOT AUTHORIZED** |

**HARD STOP.** Kein Push, kein Rebase, kein Force-Push, kein Deployment, keine
Lizenzänderung, keine neue Produktfunktion, keine Redis-/RIS-/AWS-/Terraform-/
Cognito-/CloudFront-Änderung.
