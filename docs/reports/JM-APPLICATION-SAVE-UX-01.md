# JM-APPLICATION-SAVE-UX-01

**Status:** `READY FOR REVIEW`

**Branch:** `fix/jm-application-save-ux-01`

**Basis:** `origin/main` `431f938`

**Implementation commit:** `2029a4e`

## 1. Ziel

Die Erfolgsmeldung nach dem Anlegen eines manuellen Bewerbungsentwurfs wurde
an den tatsächlich bestätigten Speichermodus angepasst.

## 2. Umsetzung

In `ApplicationsSection.tsx`, `handleSaveManualDraft()`:

- Vor jedem neuen Versuch wird eine eventuell vorhandene alte Erfolgsmeldung
  entfernt.
- Nach erfolgreichem `repository.create()` **und** erfolgreicher
  `repository.list()`-Bestätigung:
  - `storageMode === "remote"`:
    „Bewerbungsentwurf in deinem Konto gespeichert.“ /
    „Application draft saved in your account.“
  - `storageMode === "session"`:
    „Bewerbungsentwurf für diese Sitzung angelegt.“ /
    „Application draft created for this session.“
- Bei Fehlern bleibt die bestehende Fehlerbehandlung aktiv; es wird keine
  Erfolgsmeldung gesetzt.
- Die vorhandene Duplikatmeldung für bereits existierende Entwürfe bleibt
  unverändert.
- Idempotenzschlüssel, Formularzustände, Fehlerbehandlung und
  Bewerbungsverwaltung bleiben unverändert.

Neue i18n-Schlüssel:

```text
applications.new.draftCreatedRemote
```

Der bestehende Session-Schlüssel `applications.new.draftCreated` bleibt
unverändert.

## 3. Tests

### 3.1 Fokussierte Vitest-Prüfungen

**59 PASS** in den direkt betroffenen Application-/Formular-Tests.

Neue Fälle:

- Remote-Create erfolgreich → Konto-Meldung
- Session-Create erfolgreich → Sitzungsmeldung
- RIS-/Repository-Create-Fehler → keine Erfolgsmeldung
- bestehender Entwurf → unveränderte Duplikatmeldung, kein weiterer Create
- englische Remote-Meldung ohne Fetch-/API-Aufruf

### 3.2 Browser-E2E

- `application-draft-save-recovery-01` (Remote/RIS-BFF-Mock): **PASS**
  - erster Create-Fehler zeigt keine Erfolgsmeldung
  - Retry mit demselben Idempotency-Key
  - bestätigte Remote-Speicherung zeigt die Konto-Meldung
  - Reload findet den Entwurf
  - 2 Create-Versuche, 1 Idempotency-Key, 0 AI-Aufrufe
- `manual-application-draft` (Session-Modus, DE/EN, responsive): **PASS**
  - bestehende Sitzungsmeldung bleibt korrekt
  - keine AI-Aufrufe beim Anlegen des Entwurfs

### 3.3 Vollsuite und Build

- Vollsuite: **2091 PASS / 5 skipped** (202 Dateien)
- `npm run build`: **PASS**
- `git diff --check`: **PASS**
- Secret-Scan: **keine Treffer**

## 4. Grenzen

- Keine Änderung an RIS-/AWS-/Cognito-/Consent-/Storage-Verträgen.
- Keine Änderung an gespeicherten Bewerbungsdaten, Statuswechseln oder
  Idempotenz.
- Keine zusätzlichen API- oder KI-Aufrufe.
- Kein Main-Merge und kein Production-Deployment.
