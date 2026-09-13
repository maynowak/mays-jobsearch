# STEP 23B — LANDING PAGE ROUTING + VERCEL BRANCH + EXECUTION LOG

**Datum:** 2026-08-27
**Status:** IN PROGRESS
**Aktueller Commit:** 687b5db (HEAD = origin/main)
**Branch:** main

---

## 0. INITIALISIERUNG

**Ziel:** Root Cause für fehlende Landingpage bei User-Interaktion finden und beheben.

**User-Befund:**
- Production URL: https://mays-job-matcher.vercel.app
- Commit: 687b5db deployed
- Privates Browserfenster
- Landingpage erscheint NICHT beim Öffnen / Klick auf Header-Link
- Stattdessen direkt Such-/Results-Ansicht

**Wichtige Unterscheidung:**
- Landingpage WÄHREND Suche: NICHT anzeigen (bestehende Semantik, korrekt)
- Landingpage BEIM EINSTIEG / Header-Link: SOLL angezeigt werden (User-Befund: fehlt)

---

## 1. EXISTIERENDE DOKUMENTATION PRÜFEN

### 1.1 README / Deployment Docs
- `docs/DEPLOYMENT.md` existiert
- `docs/DEPLOYMENT.md:51` — "The project does **not** rely on automatic Vercel Git deployment — production is deployed explicitly."
- `docs/DEPLOYMENT.md:155` — "Recommended: push to GitHub → import in Vercel → auto-deploy on push."
- `docs/DEPLOYMENT.md:163` — "Planned (GitHub + Vercel auto-deploy)."

### 1.2 Vorhandene Reports
- `docs/reports/STEP_8_FINAL_REVIEW_REPORT.md` — existiert
- Kein Step-23-Execution-Log vorhanden → **NEU ERSTELLEN**

---

## 2. VERCEL KONFIGURATION — READ-ONLY PRÜFUNG

### 2.1 Lokale Vercel Config
```
.vercel/project.json: {"projectId":"prj_wdzpRfrGENG82Txi9Sa9QTzKruk9","orgId":"team_yrHBsvD4DskH7V5U4ZWYddIj","projectName":"mays-job-matcher"}
vercel.json: { functions, crons, rewrites: [{ "source": "/top", "destination": "/index.html" }] }
```

**Beobachtung:** `vercel.json` hat nur Rewrite für `/top` → `/index.html`. Kein Catch-all Rewrite für Root `/`.

### 2.2 Vercel Dashboard (Read-Only Prüfung nötig)
**Noch nicht verifizierbar ohne Dashboard-Zugriff:**
- GitHub Repository Connection: `maynowak/mays-jobsearch`?
- Production Branch: `main`?
- Git Integration Status?
- Auto-Deployments enabled?
- Rewrites/Routes im Dashboard?
- Redirect für `/`?
- Git Deployments history?

**Aktion:** Dashboard-Zugriff benötigt für vollständige Verifikation.

---

## 3. HEADER-LINK CODE PRÜFUNG

### 3.1 Navbar Komponente
Datei: `src/components/Navbar.tsx`

**Route-Logik (Zeilen 87-93):**
```typescript
const isLanding = route === "landing";
const links: Array<[string, string]> = isLanding
  ? [[t("nav.search"), "/top"]]
  : [
      [t("nav.search"), "top"],
      [t("nav.alerts"), "#alerts"],
    ];
```

**Navbar Title Link (Zeile 125-126):**
```typescript
<a href="/" className="navbar-title">
  May&rsquo;s Job Matcher
</a>
```

**Aktueller Stand:** Header-Link (`navbar-title`) zeigt auf `href="/"` → **KORREKT** für Landingpage.

### 3.2 Route-Initialisierung in App.tsx
```typescript
const [route] = useState<NavbarRoute>(() =>
  window.location.pathname === "/top" ? "matcher" : "landing"
);
```

**Logik:**
- `/` (Root) → `route = "landing"` → Landingpage
- `/top` → `route = "matcher"` → Suchformular

---

## 4. ROUTING FLOW ANALYSE

### 4.1 Aktueller Flow (Code-Analyse)

| User Action | Pfad | Route | Anzeige |
|-------------|------|-------|---------|
| Initial Öffnen `/` | `/` | `landing` | LandingHero |
| Header-Link Click | `/` | `landing` | LandingHero |
| Landingpage CTA | `/top` | `matcher` | SearchHero |
| Direct `/top` | `/top` | `matcher` | SearchHero |
| Während Suche | `/top` | `matcher` | Search/Results |

### 4.2 Landingpage Condition (App.tsx:240)
```typescript
if (route === "landing" && !isSearching) {
  return <LandingPage />;
}
```

### 4.3 Search-Clearing Semantik (Step 22)
- `runSearch()` setzt `foundJobs = []`, `matches = []`, `dataset = null`
- Aber `route` ändert sich NICHT (bleibt `matcher` bei `/top`)
- Landingpage wird nur bei `route === "landing"` UND `!isSearching` angezeigt

---

## 5. VERGLEICH: 48fe123 vs 687b5db (Routing-relevant)

### 5.1 Commit 48fe123 (funktionierender Stand vor Step 22)
- `route` Init: `pathname === "/top" ? "matcher" : "landing"`
- Landingpage Condition: `route === "landing"` (ohne `isSearching` Check)
- `runSearch()` ruft `performMatch()` automatisch auf
- Kein `isMatching` Phase

### 5.2 Step 22 Änderungen (9b9ff4b → 687b5db)
- **Neu:** `matching` Phase hinzugefügt
- **Neu:** `isMatching = phase === "matching"`
- **Neu:** `hasFoundJobs = !!dataset && foundJobs.length > 0`
- **Geändert:** Landingpage Condition: `route === "landing" && !isSearching`
- **Geändert:** `runSearch()` ruft `performMatch()` NICHT mehr automatisch auf
- **Neu:** Explizites Matching via `handleMatchWithAI()` + Button "Mit KI bewerten"
- **Neu:** `isSearching = phase === "searching" || phase === "scoring"`

### 5.3 Commit "fix: never show the landing page while a search is running" (4391910)
- Fügte `&& !isSearching` zur Landingpage Condition hinzu
- Zweck: Landingpage NICHT während laufender Suche anzeigen
- **Wichtig:** Dies betrifft nur `route === "landing" && !isSearching`

---

## 6. ROOT CAUSE HYPOTHESEN

### Hypothese 1: Vercel Routing Problem (wahrscheinlich)
- Vercel Dashboard hat Rewrite/Redirect für `/` → `/top`
- User öffnet `/` → Vercel leitet zu `/top` um → Route = `matcher` → SearchHero
- Header-Link `/` funktioniert, aber Vercel leitet um

### Hypothese 2: Vercel Production Branch falsch
- Production deployed von Feature-Branch statt `main`
- Aber Footer zeigt `687b5db` → Commit stimmt

### Hypothese 3: Vercel Rewrite für `/` fehlt
- `vercel.json` hat nur `/top` Rewrite
- Kein Catch-all für SPA Routing
- Vercel serviert bei `/` evtl. 404 oder leitet zu `/top`

### Hypothese 4: Code-seitig `route` Initialisierung
- `window.location.pathname` beim Mount könnte `/top` sein
- Wenn User vorher auf `/top` war und Browser Session Restore nutzt

---

## 6. BESTEHENDE TESTS PRÜFEN

### 6.1 App.test.tsx - Landingpage Tests
- Test "Initialzustand: Search-Hero wird angezeigt, keine Landingpage" (Zeile 537)
  - Erwartet: `.landing` = null, `.search-hero` = truthy
  - **Aber:** Test setzt `pushState({}, "", "/top")` in beforeEach!
  - Test prüft Verhalten BEI `/top`, NICHT bei `/`

### 6.2 Neuer Test (App.landing.test.tsx)
- Prüft Root-Pfad `/` → Landingpage
- **PASS** (191 Tests grün)

---

## 7. VERCEL ROUTING PROBLEM IDENTIFIZIERT

### 7.1 vercel.json Analyse
```json
{
  "rewrites": [
    { "source": "/top", "destination": "/index.html" }
  ]
}
```

**Problem:** Nur Rewrite für `/top` → `/index.html`. Kein Catch-all Rewrite für SPA-Routing!

**Folge:** 
- Vercel serviert bei Root `/` keine `index.html` (kein Rewrite definiert)
- Vercel Default-Verhalten: 404 oder Redirect zu `/top` (falls konfiguriert)
- SPA Client-Side Routing funktioniert nicht für Root-Pfad

### 7.2 Benötigte Konfiguration
Für SPA (Single Page Application) mit Client-Side Routing:
```json
{
  "rewrites": [
    { "source": "/top", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

ODER im Vercel Dashboard: **Catch-all Rewrite** für `/(.*)` → `/index.html` konfigurieren.

---

## 8. ENTSCHEIDUNG & NÄCHSTE SCHRITTE

### Bisherige Erkenntnisse:
1. **Code-seitig:** Header-Link (`href="/"`) und Route-Init (`"/" → landing`) sind **korrekt**
2. **Test-seitig:** Landingpage bei Root-Pfad `/` rendert korrekt (Test PASS)
3. **vercel.json:** **FEHLERHAFT** — Fehlender Catch-all Rewrite für SPA-Routing
4. **Vercel Dashboard:** Nicht verifiziert, aber vercel.json ist definitiv unvollständig

### Root Cause:
**vercel.json fehlt Catch-all Rewrite für SPA-Routing** — Root-Pfad `/` wird nicht auf `index.html` gemappt, daher keine Landingpage.

### Nächste Schritte:
1. **vercel.json korrigieren** — Catch-all Rewrite hinzufügen
2. **Header-Link Navigation Test** ergänzen
3. **Tests laufen lassen**
5. **Build & Deploy**
5. **Production verifizieren**

---

## 9. NÄCHSTE SCHRITTE (Priorisiert)

1. ✅ Code-Analyse abgeschlossen
2. 🔄 **vercel.json korrigieren** (Catch-all Rewrite)
3. 🔄 Header-Link Navigation Test ergänzen
4. 🔄 Tests laufen lassen
5. 🔄 Build & Deploy
5. 🔄 Production verifizieren

---

## 10. OFFENE PUNKTE

- [ ] vercel.json Catch-all Rewrite hinzufügen
- [ ] Header-Link Navigation Test ergänzen
- [ ] Tests laufen lassen
- [ ] Build & Deploy
- [ ] Production verifizieren

---

**STATUS:** ROOT CAUSE IDENTIFIED — vercel.json fehlt Catch-all Rewrite
**Nächster Schritt:** vercel.json korrigieren + Header-Link Test