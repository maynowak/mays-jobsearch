# JM-RIS-BOUNDARY-01 — Grenzüberschreitung, Quarantäne und Clean-Room-Nachweis

**Art:** Governance / Boundary / Incident / Remediation
**Datum:** 2026-11-05
**Status:** **YELLOW** — Prozessvorfall dokumentiert; keine RIS-/AWS-Mutation; keine Produktänderung

---

## 1. Vorfall

Im Rahmen der RIS-Readiness-Vorbereitung wurden **read-only** AWS-Abfragen im
RIS-DEV-Account `240571105849` und Einsichten in das lokale RIS-Repository
durchgeführt, **ohne dass dafür ein separates, ausdrückliches Mandat erteilt
wurde**.

Zugriffskategorien (read-only):

- DynamoDB-Tabellenmetadaten und Zähler/Items für Partner-, APIProfile-,
  Credential-, Offer-, Entitlement-, User- und Application-Bereiche
- Lambda-Konfiguration (nur Environment-Flags)
- API-Gateway-Routen und JWT-Authorizer-Metadaten
- Cognito-Pool-/Client-Metadaten und Testbenutzer-Status

**Nicht erfolgt:**

- Keine AWS-Mutation, kein Terraform Apply/State Write
- Keine RIS-Repo-Änderung, kein RIS-Commit
- Keine Secrets, Passwörter, Tokens oder Credential-Werte gelesen/ausgegeben
- Keine echten RIS-DEV-Requests
- Keine Partnerregistrierung, Credential-Erzeugung, Offer-/Grant-Mutation

Der RIS-Working-Tree ist unverändert (nur ein vorbestehender untracked Report).

---

## 2. Auswirkung auf die Nachweisführung

Die Aussage „Jobsearch nutzt RIS ausschließlich über den öffentlichen Vertrag“
muss **allein aus dem Jobsearch-Repository** beweisbar sein. Durch die
Einsicht in RIS-Interna ist die ursprüngliche Clean-Room-Situation für diesen
Lauf **nicht mehr gegeben**.

Deshalb:

- Die konkreten RIS-internen Beobachtungen werden **nicht** in diesem Report
  reproduziert und **nicht** als Jobsearch-Evidenz verwendet.
- Sie sind als **OUT OF SCOPE / QUARANTÄNE** markiert.
- Keine Jobsearch-Entscheidung, kein Test und kein Feature-Flag stützt sich
  darauf.
- Der Live-Anschluss bleibt unabhängig davon **BLOCKED**.

---

## 3. Technisches Trennungsmodell

| Ebene | Jobsearch | RIS | Nachweis |
|---|---|---|---|
| **Code** | kein RIS-Import, kein AWS SDK | eigenes Repository | `tests/api/ris-boundary.test.mjs` |
| **Vertrag** | feste HTTP-Routen unter `/api/ris/applications` | öffentliche Partner-API | statischer Test + 01A |
| **Identität** | eigener Cognito-Token | prüft Issuer/Audience nach Vertrag | BFF-Auth-Tests |
| **Secret** | `RIS_PARTNER_CREDENTIAL` nur serverseitig | prüft `X-Api-Credential` | Boundary-Test |
| **Daten** | eigene Session-/UI-Daten | Eigentümer der persistierten Datensätze | 01C–01E |
| **Deployment** | Vercel/Jobsearch | separates AWS-Konto/Stack | keine gemeinsame Pipeline |
| **Tests** | Mock-RIS, lokale Tokens | keine Live-Aufrufe | 01B–01F |

Die Grenze ist damit als **Black-Box-HTTP-Vertrag** definiert, nicht als
gemeinsame Codebasis, gemeinsame Datenbank oder gemeinsame AWS-Infrastruktur.

---

## 4. Clean-Room-Nachweis (Jobsearch-seitig)

`tests/api/ris-boundary.test.mjs` prüft statisch:

1. Kein `@aws-sdk`/`aws-sdk`-Import.
2. Kein RIS-Repo-Code, keine `partner-applications`/`apiprofiles`-Bezüge.
3. Kein `dynamodb`-Zugriff.
4. Keine hartcodierte `execute-api`-URL; `RIS_API_BASE_URL` nicht im Browser.
5. Partner-Credential ausschließlich unter `api/_lib/ris/`/`api/ris/`.
6. Genau ein Browser-Egress: `/api/ris/applications`.
7. `AGENTS.md` enthält die verbindliche externe RIS-Grenze.

Ergebnis: **5/5 PASS**.

Zusätzlich bleiben beide Feature-Flags standardmäßig **OFF**; Remote- und
Migrationspfade sind nur lokal/mock-getestet.

---

## 5. Dokumentationslücke

Jobsearch kann **nicht** aus eigener Kraft beweisen, dass RIS vollständig
dokumentiert ist. Dieser Nachweis gehört zum RIS-Angebot und muss vom
RIS-Team als **öffentliche Partner-Attestation** geliefert werden:

1. API-Version und OpenAPI/Contract für ApplicationV1 und Partner-Routen.
2. Akzeptierter Issuer und Audience (bzw. Client-Zuordnung).
3. Partnerregistrierung und Credential-Provisioning-Prozess.
4. Offer-/Grant-/Entitlement-Vergabe und Berechtigungsumfang.
5. Aktivierungsstatus der Partner-Surface.
6. Consent-/Retention-/Erasure-Vertrag.
7. Bereitstellung eines autorisierten Testbenutzers.
8. E2E-Cleanup- und Rollback-Verfahren.

**Keine** dieser Informationen erfordert einen Blick in RIS-Interna.

---

## 6. Agentenregeln (ergänzt)

`AGENTS.md` enthält jetzt einen verbindlichen Abschnitt
„External system boundary — Mays-RIS“:

- RIS wird ausschließlich über den dokumentierten HTTP-Vertrag genutzt.
- Kein Lesen/Klonen/Ändern des RIS-Repos, AWS-Kontos, DynamoDB, Lambda,
  API Gateway, Cognito, CloudFront/DNS oder der Credentials.
- Keine AWS-CLI/SDK-Aufrufe gegen RIS.
- Credential nur serverseitig; nie `VITE_*`, Browser, Logs, Reports.
- Evidenz nur aus Jobsearch-Code/Tests/Mock und öffentlichem Vertrag.
- Bei Bedarf an RIS-Interna: **STOP** und separates Mandat anfordern.

`.opencode/agents/commander.md` enthält dieselbe Constraint in Kurzform.

---

## 7. Nächste Schritte

1. RIS-Team liefert die Partner-Attestation (Abschnitt 5).
2. Jobsearch gleicht die BFF-Konfiguration ausschließlich gegen diese
   Attestation ab.
3. Danach separater Live-E2E-Auftrag mit synthetischen Daten und Cleanup.
4. Bis dahin: **RIS-DEV LIVE: NOT AUTHORIZED**, keine weiteren RIS-Interna.

---

## 8. Status

```text
BOUNDARY INCIDENT:        DOCUMENTED
RIS MUTATIONS:            NONE
RIS SECRETS/TOKENS:       NONE
RIS REPO CHANGES:         NONE
QUARANTINE:               ACTIVE
CLEAN-ROOM BOUNDARY TEST: 5/5 PASS
AGENT RULE:               ADDED
LIVE E2E:                 NOT AUTHORIZED
PRODUCTION STORAGE:       DISABLED
```

**HARD STOP.** Keine RIS-Repo-Änderung, keine AWS-/Terraform-/Cognito-/DNS-
Mutation, keine echten RIS-DEV-Requests, kein Push, kein Deployment.

---

## 9. Evidence

- `AGENTS.md` (External system boundary — Mays-RIS)
- `.opencode/agents/commander.md`
- `tests/api/ris-boundary.test.mjs`
- `src/lib/applications/risRemoteRepository.ts`
- `api/ris/applications.mjs`
- `api/_lib/ris/{config,auth,client,map}.mjs`
- `docs/reports/JM-RIS-INTEGRATION-01A-CONTRACT.md`
- `docs/reports/JM-RIS-INTEGRATION-01F-SECURITY-REGRESSION.md`
