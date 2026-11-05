# JM-PROFILE-CACHE-RETIREMENT-DOCS-01

**Art:** Dokumentationsbereinigung / Datenschutztransparenz / i18n-Textkorrektur
**Datum:** 2026-11-05
**Modus:** Dokumentation, i18n-Texte, Tests und Audit — **keine Produktlogik**
**Status:** COMPLETE — lokal verifiziert; kein Push, kein Merge, kein Deployment

---

## 1. Tatsächliche Git-Baseline

| Referenz | Wert |
|---|---|
| Repository | `maynowak/mays-jobsearch` |
| Checkout (verifiziert) | `/home/dci-student/projects/mays-jobsearch-retirement-docs` (neuer Worktree) |
| Arbeitsbranch | `feature/jm-profile-cache-retirement-docs-01` |
| Branch-Basis | lokaler `main` @ `63b5965` (`docs: record CV management main integration`) |
| Lokaler `main` | `63b5965` |
| `origin/main` | `4364eab` (abweichend; **nicht** synchronisiert) |
| Cache-Removal | `049edda` (`fix: remove CV profile cache and sanitize search logging`) |
| Abstammung `049edda` | bestätigt (`git merge-base --is-ancestor 049edda HEAD` → true) |
| Verschmutzter Alt-Checkout | `Mays-Jobsearch` auf `fix/cover-letter-model-fallback` — **nicht angefasst** |

Hinweis: Der Auftrag nannte Remote-`main` `0fa799e`; tatsächlich ist `origin/main`
`4364eab`. Es wurde keine automatische Synchronisierung oder Integration
durchgeführt. Gearbeitet wurde ausschließlich auf dem verifizierten lokalen
`main`-Stand.

Die vorhandenen fremden Änderungen im alten Checkout
(`.opencode/agents/*`, `opencode.json`, untracked Dateien) blieben vollständig
unberührt. Es wurde ein separater Worktree verwendet.

---

## 2. Cache-Removal-Nachweis

Geprüft auf dem Branch (identisch mit `main`):

- `api/profile.mjs` importiert nur noch `HttpError` und `chat`; **kein**
  `cacheGet`, **kein** `cacheSet`, kein Key-Builder.
- `src/api.ts:275-288` sendet `{ text, model? }`; **kein** Client-Hash.
- `tests/api/profile-no-cache.test.mjs` belegt: zwei identische Anfragen →
  zwei AI-Aufrufe, `cacheGet`/`cacheSet` werden nicht aufgerufen; ein
  Legacy-`hash`-Feld wird ignoriert.
- Verbleibende `cv-profile:`-Referenzen sind ausschließlich:
  - `scripts/purge-cv-profile-cache.mjs` (einmaliges Purge-Werkzeug),
  - `tests/tools/verify-cv-profile-purge.mjs` (isolierter Test),
  - UI-Klassennamen (`cv-profiles-overlay`, `cv-profile-name`), ohne Cachebezug.
- Andere Redis-Funktionen (Job-Source-, Detail-, Geo-, Usage-Caches, Alerts)
  bleiben bestehen. **Redis ist nicht vollständig aus Jobsearch entfernt.**

**Ergebnis:** CACHE REMOVAL FROM PRODUCT CODE: **VERIFIED**.

---

## 3. Geänderte Benutzertexte (`src/i18n.tsx`)

### 3.1 `cv.privacyNote`

**Vorher (DE):** „… Nur der gelesene, anonymisierte Text wird zur
Profilerstellung an die KI gesendet.“

**Nachher (DE):** Die PDF wird lokal im Browser ausgelesen; der extrahierte Text
kann an einen externen KI-Anbieter übermittelt werden; die gewählte
Anonymisierungsoption bestimmt die Aufbereitung; bei „Nicht anonymisiert“
können personenbezogene Angaben enthalten sein; vollständige Anonymität kann
nicht garantiert werden.

**Englisch:** inhaltlich identisch („Your PDF is read locally … may be sent to
an external AI provider … depends on the anonymization option … Complete
anonymity cannot be guaranteed.“).

Damit ist die bisherige unbedingte Anonymisierungszusage entfernt.

### 3.2 Löschbeschriftung

| Schlüssel | Vorher (DE) | Nachher (DE) |
|---|---|---|
| `cv.removeData` | „CV-Daten entfernen“ | unverändert (Einstieg/Titel) |
| `cv.removeDataConfirm` | „Alle CV-Dokumente und gespeicherten Profil-Listen wirklich entfernen?“ | „Alle CV-Dokumente, gespeicherten Profil-Listen und CV-Builder-Profile aus dieser Sitzung entfernen?“ |
| `cv.removeDataHint` | „… erneut hochgeladen werden.“ | zusätzlich: „Bereits an einen KI-Anbieter übermittelte Daten werden dadurch nicht gelöscht.“ |
| `cv.removeDataConfirmButton` | „Endgültig entfernen“ | **„Aus dieser Sitzung entfernen“** |

Englisch analog: „Remove permanently“ → **„Remove from this session“**.

Die Formulierung deckt das tatsächliche `handleCvRemoveData`-Verhalten:
Dokumente, React-State, 12h-Listen, Legacy-localStorage **und** die
CV-Builder-Profile werden aus der Sitzung entfernt. Es wird nicht behauptet,
dass Provider-Daten oder historische Redis-Einträge gelöscht werden.

**Testanpassung:** Zwei bestehende Zusicherungen in `src/App.test.tsx` nannten
den alten Button-Text und wurden auf „Aus dieser Sitzung entfernen“ aktualisiert
(keine Tests deaktiviert, keine Timeouts verändert).

---

## 4. Datenschutzerklärungsänderungen

Datei: `docs/mays_job_matcher_datenschutzerklaerung_1.0.md`

- Kopfzeile trägt einen unsichtbaren HTML-Kommentar:
  „ENTWURF zur Datenschutz-/Rechtsprüfung (2026-11-05), nicht veröffentlicht.“
- Abschnitt 14 unterscheidet nun vier Ebenen:
  1. **Aktuelle Verarbeitung:** neue CV-Profilanfragen ohne serverseitigen
     Redis-Profil-Cache; keine Speicherung der strukturierten Profildaten in Redis.
  2. **Historische Daten:** frühere `cv-profile:<hash>`-Einträge können noch
     vorhanden sein; vollständige Löschung nicht bestätigt; Ablauffrist wird
     nicht als vollständiger Löschungsnachweis zugesichert.
  3. **Provider:** bereits übermittelte Inhalte unterliegen den Bedingungen der
     KI-Anbieter; lokale Löschung wirkt nicht automatisch.
  4. **RIS:** freiwillige RIS-Speicherung ist getrennt und derzeit nicht aktiviert.
- Keine neuen gesetzlichen Fristen erfunden, keine Vollständigkeitsgarantie,
  keine rechtliche Freigabe simuliert.
- Das Dokument wurde **nicht veröffentlicht** und nicht deployed.

---

## 5. Historische Berichtskennzeichnung

In alle drei Berichte wurde direkt unter dem Titel ein identischer
Blockquote-Hinweis eingefügt:

**HISTORICAL STATUS — SUPERSEDED FOR CURRENT CV PROFILE CACHE IMPLEMENTATION**

Inhalt: früherer Cache-Zustand; Entfernung mit `049edda`; V2 nicht
implementiert und derzeit nicht erforderlich; historische Redis-Einträge sind
ein separates Thema; ursprüngliche Befunde, Empfehlungen und Zeitpunkte bleiben
unverändert; nichts gilt rückwirkend als genehmigt.

Betroffen:

- `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT.md`
- `docs/reports/JM-PROFILE-CACHE-DELETE-03-DESIGN-GATE.md`
- `docs/reports/JM-PROFILE-CACHE-DELETE-03-SECURITY-DECISION-04.md`

Es wurden **keine** ursprünglichen Befunde, Daten oder Empfehlungen verändert.

---

## 6. Legacy-Redis-Abgrenzung

In `docs/reports/JM-PRIVACY-CV-REDIS-PURGE-02.md` ergänzt:

```text
CACHE REMOVAL FROM PRODUCT CODE:   VERIFIED (`049edda`)
LEGACY REDIS DATA REMOVAL:         NOT VERIFIED
PRODUCTION PURGE:                  BLOCKED
```

- Keine Redis-Operation in diesem Auftrag: kein `SCAN`, kein `DELETE`, kein
  Purge-Lauf gegen echte Infrastruktur, keine Secret-/Vercel-/Credential-Änderung.
- Das Purge-Werkzeug bleibt unverändert; keine neue Lösch-API.
- Eine 30-Tage-TTL kann Einträge auslaufen lassen; ohne geprüfte
  Schreibzeitpunkte ist das tatsächliche Ablaufdatum nicht bekannt. Zeitablauf
  wird nicht als vollständiger Purge-Nachweis gewertet.

---

## 7. Provider-Aufbewahrungsgrenzen

- Der extrahierte (ggf. anonymisierte) CV-Text wird weiterhin an den
  konfigurierten KI-Anbieter übermittelt; das ist unverändert.
- Eine lokale Löschung oder das Entfernen aus der Sitzung wirkt nicht auf
  bereits übermittelte Provider-Daten.
- Provider-seitige Aufbewahrung, Logging und Trainingsnutzung sind aus dem
  Repository nicht feststellbar und werden nicht zugesichert.
- Es wurden keine echten Provider-Aufrufe ausgeführt.

---

## 8. RIS-Persistenz-Abgrenzung

- Keine automatische Speicherung in RIS; keine Gast→Konto-Migration.
- RIS ist von der technischen CV-Profilverarbeitung getrennt.
- Der Datenschutztext stellt dies ausdrücklich klar.
- Keine AWS-/Terraform-/Cognito-/CloudFront-Änderung.

---

## 9. Testresultate

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run --maxWorkers=2` | **1414 passed, 5 skipped** (140 Dateien: 137 passed, 3 skipped) |
| `npm run build` (`tsc -b && vite build`) | **PASS** |
| `git diff --check` | **PASS** |
| `npm run test:e2e:guest-cv` | **PASS** (1440/390, 1 `/api/profile`, 1 `/api/jobs`, 0 `/api/match`, 0 Login, 0 Overflow, keine Console-Errors) |
| `npm run test:e2e:profile-storage-consent` | **PASS** (768/430/320, kein Overflow) |
| `npx vitest run src/App.test.tsx --maxWorkers=2` | 96 passed |

Hinweis zur Testumgebung: Ein erster Lauf nutzte ein `node_modules`-Symlink
außerhalb des Projektroots und scheiterte in 8 pdfjs-Tests an Vites
`fs.allow` („Denied ID“). Nach Materialisierung von `node_modules` im Worktree
liefen alle Tests grün. Das war ein Umgebungsartefakt, kein Codefehler.

Die vom E2E-Lauf überschriebenen, versionierten Screenshots wurden
zurückgesetzt; sie sind nicht Teil der Commits.

---

## 10. Offene Findings

1. **Legacy-Redis-Purge weiterhin BLOCKED** — Produktionsziel nicht
   identifiziert; keine Löschung bestätigt.
2. **Rechtsprüfung PENDING** — Datenschutzerklärung ist Entwurf, nicht
   veröffentlicht.
3. **Remote-`main` abweichend** (`4364eab` vs. lokal `63b5965`); keine
   Synchronisierung durchgeführt.
4. **Bekannter intermittierender Timeout** in `ApplicationsSection.test.tsx`
   ist dokumentiert; im aktuellen Lauf **nicht** aufgetreten.
5. **Provider-Aufbewahrung** bleibt außerhalb der lokalen Kontrolle.
6. **Alt-Deployments:** Ältere Vercel-Deployments könnten theoretisch alten
   cachenden Code ausführen, falls jemand die konkrete URL kennt (bereits in
   `JM-PRIVACY-CV-REDIS-PURGE-02` als NOT VERIFIED vermerkt).

---

## 11. Commits

| Commit | Inhalt |
|---|---|
| `d022c56` | `fix: clarify CV privacy and session removal text` (i18n DE/EN + Testnamen) |
| `3b68393` | `docs: align privacy declaration with retired CV profile cache` |
| `870f94c` | `docs: mark retired CV cache reports as historical` |
| `653dc65` | `docs: separate legacy Redis purge status from code removal` |
| _(folgt)_ | `docs: record CV cache retirement documentation cleanup` |

Branch: `feature/jm-profile-cache-retirement-docs-01`, Basis `63b5965`.
**Kein Push. Kein PR. Kein Merge. Kein Deployment.**

---

## 12. Freigabeentscheidung

| Bereich | Status |
|---|---|
| CACHE REMOVAL | **VERIFIED** |
| DOCUMENTATION ALIGNMENT | **COMPLETE** |
| USER-FACING PRIVACY TEXT | **VERIFIED** |
| LEGAL REVIEW | **PENDING** |
| LEGACY REDIS PURGE | **BLOCKED** |
| CACHE V2 IMPLEMENTATION | **NOT REQUIRED** |
| RIS PERSISTENCE | **UNCHANGED** |
| PRODUCTION DEPLOYMENT | **NOT AUTHORIZED** |

**HARD STOP.** Keine Cache-Neuentwicklung, keine Lösch-API, keine
Redis-Operation, keine Cookie-/HMAC-Änderung, keine AWS-/Terraform-/RIS-/
Cognito-/CloudFront-Änderung, kein Push, kein Merge, kein Deployment.
