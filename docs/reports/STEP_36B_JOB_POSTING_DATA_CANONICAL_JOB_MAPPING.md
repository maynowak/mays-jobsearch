# STEP 36B — Job Posting Data / Canonical Job Mapping Audit

**AGENT:** Laguna XS 2.1

---

## PLAN

Analysiere die bestehenden Job-Posting-Quellen (Arbeitnow, Bundesagentur/Apify) und deren Datenfluss, um zu ermitteln:

1. Welche Felder im Canonical Job Model bereits existieren
2. Welche Felder für ATS Match & CV Tailoring relevant sind
3. Welche Felder fehlen oder nur in Fließtext vorhanden sind
4. Wie die Datenqualität für verschiedene Szenarien ist

---

## ACTION

### 1. Canonical Job Model analysiert (`src/types.ts:11-28`)

### 2. Arbeitnow Adapter analysiert (`api/_lib/sources/arbeitnow.mjs`)

### 3. BA/Apify Adapter analysiert (`api/_lib/sources/apify/actors.mjs:1-68`)

### 4. Match Pipeline analysiert (`api/match.mjs`, `api/_lib/filter.mjs`)

### 5. CV Extraktion analysiert (`api/profile.mjs`)

---

## RESULT

### CANONICAL JOB MODEL

**Vollständige Definition (src/types.ts:11-28):**

```typescript
interface Job {
  slug: string;
  title: string;
  company_name: string;
  location: string[];
  remote: boolean;
  tags: string[];
  url: string;
  created_at?: number | string;
  source?: JobSource[];
  description?: string;
  descriptionPlain?: string;
  language?: string;
  jobTypes?: string[];
  contractType?: string;
  salary?: string;
  startDate?: string;
}
```

---

### SOURCE MAPPING

#### Arbeitnow (arbeitnow.mjs)

| Field | Raw Source | Normalized Field | Available | ATS Relevance | Notes |
|-------|------------|------------------|-----------|---------------|-------|
| slug | job.slug | slug | ✅ | HIGH | Unique identifier |
| title | job.title | title | ✅ | HIGH | Job title |
| company | job.company_name | company_name | ✅ | HIGH | Employer name |
| location | job.location[] | location[] | ✅ | HIGH | Array of locations |
| remote | job.remote | remote | ✅ | HIGH | Boolean |
| tags | job.tags[] | tags[] | ✅ | HIGH | Skills/keywords |
| url | job.url | url | ✅ | HIGH | Job posting URL |
| created_at | job.created_at | created_at | ✅ | MEDIUM | Publish date |
| source | - | source[] | ✅ | MEDIUM | Source attribution |
| description | job.description | description | ✅ | HIGH | HTML description |
| descriptionPlain | htmlToPlainText() | descriptionPlain | ✅ | HIGH | Plain text |
| language | detectLanguage() | language | ✅ | MEDIUM | Auto-detected |
| jobTypes | job.job_types | jobTypes | ✅ | MEDIUM | Full-time, part-time |
| contractType | - | - | ❌ | LOW | Not provided by Arbeitnow |
| salary | - | - | ❌ | LOW | Not provided |
| startDate | - | - | ❌ | LOW | Not provided |

**Arbeitnow Data Flow:**
1. `fetchArbeitnow()` → API call to arbeitnow.com
2. `compactJob()` → normalizes each field
3. `htmlToPlainText()` → creates descriptionPlain
4. `detectLanguage()` → detects de/en

---

#### Bundesagentur/Apify (apify/actors.mjs:6-34, 43-59)

**Normaler Jobsuche (`includeDetails: false`, `compact: true`):**

| Field | Raw Source | Normalized Field | Available | ATS Relevance | Notes |
|-------|------------|------------------|-----------|---------------|-------|
| slug | record.referenceId | `aa-${referenceId}` | ✅ | HIGH | Prefixed with "aa-" |
| title | record.title | title | ✅ | HIGH | Job title |
| company | record.employer | company_name | ✅ | HIGH | Employer |
| location | record.location | location[] | ✅ | HIGH | Single location |
| remote | record.isRemote | remote | ✅ | HIGH | Boolean |
| tags | - | tags[] | ⚠️ | MEDIUM | Always empty! |
| url | record.portalUrl | url | ✅ | HIGH | Portal URL |
| created_at | record.publishedDate | created_at | ✅ | MEDIUM | Unix timestamp |
| source | - | source[] | ✅ | MEDIUM | "arbeitsagentur" |
| description | record.description | description | ⚠️ | HIGH | May be empty/null |
| descriptionHtml | record.descriptionHtml | - | ⚠️ | HIGH | Rich HTML if available |
| descriptionPlain | htmlToPlainText() | descriptionPlain | ⚠️ | HIGH | May be empty |
| language | detectLanguage() | language | ⚠️ | MEDIUM | Auto-detected |
| jobTypes | - | - | ❌ | LOW | Not directly mapped |
| contractType | record.contractType | contractType | ✅ | MEDIUM | UNBEFRISTET, BEFRISTET, etc. |
| salary | record.salary | salary | ✅ | LOW | As string |
| startDate | record.startDate | startDate | ✅ | LOW | As string |

**Detail-Enrichment (`includeDetails: true`, `compact: false`):**

| Additional Field | Raw Source | Normalized | Available | ATS Relevance | Notes |
|-----------------|------------|------------|-----------|---------------|-------|
| detailed description | record.descriptionHtml | description | ✅ | HIGH | Full HTML |
| structured fields | various | - | ⚠️ | VARIES | Depends on Apify output |

**Kritische Unterschiede:**

| Aspekt | Normaler Job | Nach Detail-Enrichment |
|--------|--------------|------------------------|
| tags[] | immer leer | ggf. mit Skills |
| description | kann leer sein | vollständig HTML |
| descriptionPlain | ggf. leer | vollständig Text |

---

### CANONICAL JOB GAPS

| Field | Existing? | Source Support | ATS Relevance | Gap Type |
|-------|-----------|----------------|---------------|----------|
| `education` | ❌ | Nicht strukturiert | HIGH | Missing |
| `certifications` | ❌ | Nicht strukturiert | HIGH | Missing |
| `experienceRequirements` | ❌ | Nicht strukturiert | HIGH | Missing |
| `responsibilities` | ❌ | Nur im Fließtext | MEDIUM | In Description |
| `benefits` | ❌ | Nicht vorhanden | LOW | Missing |
| `salary_currency` | ❌ | Nur string | LOW | Missing |
| `experience_years` | ❌ | Nicht extrahiert | HIGH | Missing |
| `workplaceType` | ⚠️ | remote (boolean) | MEDIUM | Incomplete |
| `applicationDeadline` | ❌ | Nicht vorhanden | LOW | Missing |

---

### ATS-RELEVANT FIELDS - Bewertung

**HIGH PRIORITY (für MATCHED/PARTIAL/GAP):**

1. **title** - Wird bereits unterstützt
2. **description** / **descriptionPlain** - Wird bereits unterstützt
3. **tags** - Wird unterstützt, aber fehlt bei BA
4. **location** - Wird bereits unterstützt
5. **remote** - Wird bereits unterstützt

**Konnte nicht extrahiert werden (GAP für ATS):**

1. **Education Requirements** - Muss aus Description extrahiert werden
2. **Certification Requirements** - Muss aus Description extrahiert werden
3. **Experience Requirements** - Muss aus Description extrahiert werden
4. **Skills/Technologies** - Teilweise in tags, aber nicht bei BA

---

### DATA QUALITY CASES

| Case | Available Data | ATS Consequence |
|------|----------------|-----------------|
| A | Job mit vollständiger HTML-Description | Vollständige Analyse möglich |
| B | Job nur mit Plain Text | Eingeschränkte Analyse, HTML-Struktur verloren |
| C | Job ohne strukturierte Skills | Skills müssen aus Description extrahiert werden |
| D | BA-Job ohne Detail-Enrichment | tags=[] immer, description kann leer sein |
| E | BA-Job nach Detail-Enrichment | Vollständige Beschreibung verfügbar |
| F | Education/Certification nur im Fließtext | Muss AI-Extraktion nutzen |
| G | Keine Education/Certification-Information | UNKNOWN → kann nicht bewertet werden |
| H | Remote/Workplace strukturiert | Direkte Übertragung möglich |
| I | Remote/Workplace nur im Text | Muss interpretiert werden |
| J | Language vorhanden | kann genutzt werden |
| K | Language fehlt | Standardannahme nötig |

---

### ATS INPUT CONTRACT (VORSCHLAG)

**Minimaler ATS Input Contract:**

```typescript
interface ATSInput {
  // Aus dem Job-Model
  job: {
    slug: string;
    title: string;
    company: string;
    descriptionPlain: string; // Wichtig für Textanalyse
    description?: string;     // Für HTML-Struktur
    location: string[];
    remote: boolean;
    tags: string[];           // Kann leer sein
    language?: string;
    
    // Optional, falls verfügbar
    contractType?: string;
    salary?: string;
    startDate?: string;
  };
  
  // Aus Profile (extrahiert via /api/profile)
  cv: {
    text: string;             // Vollständiger CV-Text
    profile: {
      skills: string[];
      experienceLevel: string;
      targetRoles: string[];
      location: string;
      // Optional erweitert:
      // education?: string;
      // certifications?: string[];
      // experienceYears?: number;
    };
  };
}
```

---

### ARCHITECTURE RECOMMENDATION

**Empfehlung: LEAN CANONICAL JOB + ATS EXTRACTION LAYER**

**Begründung:**

1. **Vorteile der leanen Herangehensweise:**
   - Bestehende Canonical Job Model bleibt unverändert
   - Keine Migration bestehender Daten erforderlich
   - Einfachere Wartung
   - Klarer Trennungsgrad zwischen Rohdaten und Analyse

2. **ATS-Extraktionsschicht:**
   - Extrahiere zusätzliche Felder nur bei Bedarf
   - Normalisiere aus description für Education/Certifications
   - Nutze AI für komplexe Extraktion (wie bereits für Profile)
   - Cache-Ergebnisse analog zum Profile-Cache

3. **Implementierungsansatz:**
   ```
   Job (Canonical) → descriptionPlain → ATS Extractor (AI)
                                    → Field Extractor (regex/parsing)
                                    → ATS Analysis Result
   ```

**Alternative: MORE STRUCTURED JOB MODEL**

- Nachteile:
  - Schema-Änderung erforderlich
  - Bestandsdaten migrieren müssen
  - Boiler-Plate für jede neue Quelle
  - Komplexität erhöht sich

---

### FUTURE JOB SOURCES - Mapping, keine Implementierung

**Adzuna, Greenhouse, Lever, Indeed API, StepStone, XING:**

Mit dem bestehenden Adapter-Muster könnten sie folgendermaßen integriert werden:

```typescript
// Beispiel-Struktur für neuen Adapter
{
  sourceId: "adzuna",
  displayName: "Adzuna",
  provider: "api",
  enabled: () => getConfig().jobSourceAdzunaEnabled,
  fetchJobs: (params) => { ... },
  normalize: (rawJob) => ({
    slug: rawJob.id.toString(),
    title: rawJob.title,
    company_name: rawJob.company_display_name || rawJob.company,
    // ... Mapping
    tags: rawJob.category || [],
    description: rawJob.description,
    // ...
  })
}
```

---

### COST / RISK

| Komponente | Kostenklasse | Anmerkung |
|------------|--------------|-----------|
| Arbeitnow API | [FREE] | Public API, kein Cost |
| BA Apify | [CACHE] / [CONTROLLED-PAID] | Cache + Quota-System existiert |
| ATS-Analyse | [FREE] | Analyse, kein neuer Run |

**Kein neuer Apify-Run erforderlich.**

---

### AUDIT / EVIDENCE

**Verifizierte Dateien:**
- `src/types.ts:11-28` - Canonical Job Model
- `api/_lib/sources/arbeitnow.mjs` - Arbeitnow Adapter
- `api/_lib/sources/apify/actors.mjs` - BA/Apify Adapter
- `api/match.mjs` - Match API
- `api/_lib/filter.mjs` - Filter-Funktionen
- `api/profile.mjs` - Profile-Extraktion

**Analyse-Bestätigung:**
- `npm test` keine Fehler
- `git status` clean
- `HEAD = e8236b6` = `origin/main`

---

### GIT STATE

```
Commit: e8236b6
Branch: main (Tracking origin/main)
Status: Clean
Unchanged Files: Keine
```

---

### OPEN QUESTIONS

1. **Education-Zu-CV-Mapping**: Soll `profile.mjs` um `education`, `certifications`, `experienceYears` erweitert werden? Oder nur während der ATS-Analyse extrahieren?

2. **Ba-Struktur**: Die offizielle BA Jobsuche API bietet strukturierte Felder. Sollten diese für zukünftige Integration geprüft werden?

3. **ATS-Confidence**: Wie soll die Confidence-Bewertung für PARTIAL definiert sein? Schwellenwert für String-Match, Semantic-Search, etc.?

4. **Regex-basierte Extraktion**: Für Felder wie `experienceYears` oder `certifications` - reicht das aus oder braucht es AI-Extraktion?

5. **Cache-Strategie**: Sollte ATS-Analysis resultat für denselben Job+Profile-Cache behalten wie das Profil (30 Tage)?

---

## STOP

Keine Code-Änderungen. Kein Apify-Run. Kein Deployment.

```
STATUS = STEP 36B COMPLETE - ANALYSIS ONLY
```

---