# JOBMATCHER-ATS-SEMANTIC-NORMALIZATION-01 — IMPLEMENTATION REPORT

Status: COMPLETED
Datum: 2026-10-14
Branch: main
Git-Commit: a20d769 (Baseline) -> CURRENT

## 1. Root Cause Analyse
Die beobachteten Qualitätsprobleme in der ATS-Analyse resultierten aus einer zu simplistischen Tokenisierung und einem rein text-basierten Vergleich ohne semantische Normalisierung:
- **Wortfragmente**: Token wie `architect-` wurden als exakte Strings verglichen. Da im CV meist `architect` ohne Bindestrich steht, wurde dies als GAP gewertet.
- **Metadaten**: Begriffe wie `(m/w/d)`, `Vollzeit` oder `Senior` wurden durch die einfache Tokenisierung in `api/_lib/ats.mjs` als Anforderungen erkannt und in die Skill-Liste aufgenommen.
- **Varianten**: `Cloud-Architect` und `Cloud Architect` wurden als unterschiedliche Begriffe behandelt, da lediglich `toLowerCase()` und `trim()` verwendet wurden.

## 2. Implementierte Änderungen

### Semantische Normalisierung (`api/_lib/ats.mjs`)
- **`normalizeSkill(text)`**: Erweitert um die Entfernung von trailing punctuation (z.B. Bindestrichen am Ende eines Tokens).
- **`areSkillsEquivalent(s1, s2)`**: Neue Hilfsfunktion, die über die einfache Normalisierung hinausgeht. Sie ersetzt Bindestriche und Unterstriche durch Leerzeichen und normalisiert Whitespaces, sodass `cloud-architect` $\leftrightarrow$ `cloud architect` als äquivalent erkannt werden.
- **`matchRequirement`**: Nutzt nun `normalizeSkill` und `areSkillsEquivalent`, um Treffer zuverlässiger zu finden, ohne dabei fachlich verschiedene Begriffe (z.B. Java vs. JavaScript) zu verschmelzen.

### Klassifizierung & Filterung (`api/_lib/ats.mjs`)
- **`METADATA_PATTERNS`**: Einführung einer Blacklist für nicht-technische Begriffe:
    - Gender-Marker: `(m/w/d)`, `(w/m/d)`
    - Beschäftigungsart: `full-time`, `vollzeit` etc.
    - Senioritäts-Level: `senior`, `junior`, `lead` etc.
    - Generische Rollen: `software`, `engineer`, `developer`, `architect` (wenn sie als einzelne Tokens auftreten).
- **`isTechnicalSkill(text)`**: Neue Filterfunktion, die Token vor der Aufnahme in die ATS-Requirements prüft. Nur Begriffe, die keine reinen Metadaten sind, werden als `TECHNICAL_SKILL` gewertet.
- **Anwendung**: Diese Filterung wurde in `extractSkillsFromText` sowie in `extractRequirementsFromJob` (für Titel und Tags) integriert.

## 3. Auswirkungen auf ATS-Matching & Reconciliation
- **Gaps**: Irrelevante Begriffe wie `(m/w/d)` erzeugen keine Gaps mehr, da sie bereits bei der Extraktion aus der Jobanzeige gefiltert werden.
- **Normalisierung**: Wortfragmente wie `architect-` werden nun korrekt auf `architect` normalisiert und matchen gegen den CV.
- **Reconciliation**: Da die Filterung in der Extraktionsphase erfolgt, gelangen keine Metadaten-Tokens mehr in die Liste der bestätigbaren Skills im `AtsOverlay`.
- **Idempotenz**: Die bestehende Skill-Reconciliation nutzt weiterhin die Normalisierung, wodurch Duplikate durch unterschiedliche Schreibweisen (z.B. `Cloud-Architect` vs `Cloud Architect`) vermieden werden.

## 4. Testmatrix & Verifikation

| Testfall | Erwartung | Ergebnis |
|---|---|---|
| `architect-` $\leftrightarrow$ `architect` | MATCHED | VERIFIED |
| `cloud-architect` $\leftrightarrow$ `Cloud Architect` | MATCHED | VERIFIED |
| `Java` $\leftrightarrow$ `JavaScript` | NOT MATCHED | VERIFIED |
| `(m/w/d)` | Ignoriert (kein Skill) | VERIFIED |
| `Senior` | Ignoriert (kein Tech-Skill) | VERIFIED |
| `C++` $\leftrightarrow$ `C#` | NOT MATCHED | VERIFIED |
| `Node.js` | Erhalten | VERIFIED |

## 5. Bekannte Einschränkungen
- **Kontext-Ableitung**: Die Unterscheidung zwischen `EXPLICIT` und `CONTEXT_SUPPORTED` wurde auf Ebene der bestehenden `AtsAnalysisResponse` belassen, um keine Breaking Changes an den API-Contracts zu verursachen. Die Verbesserung erfolgt primär über die Qualität der extrahierten Tokens.

## 6. Git-Historie
- Baseline: `a20d769`
- Current: [Latest Commit]
