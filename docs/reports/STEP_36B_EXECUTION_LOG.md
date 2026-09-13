# STEP 36B — JOB POSTING DATA / CANONICAL JOB MAPPING AUDIT

## EXECUTIVE SUMMARY

AGENT: Laguna XS 2.1

---

## CONTEXT UNDERSTAND

Nachfolgende Dokumentation analysiert:
- `docs/AGENTS.md`
- `docs/PROJECT_RULES.md`  
- `docs/AI_PROVIDERS.md`
- `docs/MAYS_JOB_MATCHER_STANDARD_TEST_AND_DEPLOYMENT_ROUTINE.md`
- `docs/AI_AUDITLOG.md`
- Execution-Logs STEP_24_*, STEP_36A

---

## FINDINGS

### Existierendes Job-Model (src/types.ts:11-28)

| Feld | Typ | ATS Relevanz |
|------|-----|--------------|
| slug | string | HIGH |
| title | string | HIGH |
| company_name | string | HIGH |
| location[] | string[] | HIGH |
| remote | boolean | HIGH |
| tags[] | string[] | HIGH |
| url | string | MEDIUM |
| created_at | number/string | MEDIUM |
| source[] | string[] | MEDIUM |
| description | string | HIGH |
| descriptionPlain | string | HIGH |
| language | string | MEDIUM |
| jobTypes | string[] | LOW |
| contractType | string | LOW |
| salary | string | LOW |
| startDate | string | LOW |

---

## SOURCE MAPPING

### Arbeitnow

| Raw Field | Normalized | Available | Notes |
|-----------|------------|-----------|-------|
| job.title | title | ✅ | Direkt |
| job.company_name | company_name | ✅ | Direkt |
| job.location[] | location[] | ✅ | Array |
| job.remote | remote | ✅ | Boolean |
| job.tags[] | tags[] | ✅ | Skills |
| job.description | description | ✅ | HTML |
| - | descriptionPlain | ✅ | Via htmlToPlainText() |
| - | language | ✅ | Via detectLanguage() |
| - | contractType | ❌ | Nicht vorhanden |
| - | salary | ❌ | Nicht vorhanden |

### Bundesagentur / Apify

| Raw Field | Normalized | Available | Notes |
|-----------|------------|-----------|-------|
| record.title | title | ✅ | Direkt |
| record.employer | company_name | ✅ | Direkt |
| record.location | location[] | ✅ | Immer [1 Element] |
| record.isRemote | remote | ✅ | Boolean |
| - | tags[] | ⚠️ | **IMMER LEER!** |
| record.description | description | ⚠️ | Kann leer sein |
| record.descriptionHtml | description | ⚠️ | Bei Detail-Enrichment |
| - | descriptionPlain | ⚠️ | Extrahiert aus HTML |
| record.contractType | contractType | ✅ | UNBEFRISTET, BEFRISTET |
| record.salary | salary | ✅ | Als String |

---

## CANONICAL JOB GAPS

| Fehlendes Feld | Relevanz | Problem |
|----------------|----------|---------|
| education | HIGH | Muss aus Description extrahieren |
| certifications | HIGH | Muss aus Description extrahieren |
| experienceRequirements | HIGH | Muss aus Description extrahieren |
| structuredSkills | HIGH | BA hat tags=[] immer |

---

## DATA QUALITY CASES

| Fall | Description | Conséquence |
|------|-------------|-------------|
| A | Vollständige HTML | ✅ Voll analyse |
| B | Nur Plain Text | ⚠️ Eingeschränkt |
| C | Ohne tags | ⚠️ Skills unbekannt |
| D | BA ohne Detail-Enrichment | ❌ tags=[] immer |

---

## ARCHITECTURE RECOMMENDATION

**LEAN CANONICAL JOB + ATS EXTRACTION LAYER**

- Bestehendes Model beibehalten
- Zusätzliche Felder nur in ATS-Analyse extrahieren
- Keine Schema-Änderung

---

## GIT STATE

```
Commit: e8236b6
Branch: main
Status: Clean
```

---

## OPEN QUESTIONS

1. Soll Profile um education/certifications erweitert werden?
2. Wie genau ist PARTIAL confidence definiert?
3. Regex vs AI für Experience Years Extraktion?
4. Welche Felder müssen für UNKNOWN-Zustand definiert sein?

---

## STOP

Keine Code-Änderungen. Keine Apify-Runs. Kein Deployment.

```
STATUS = STEP 36B COMPLETE - ANALYSIS ONLY
```