# JOBMATCHER-SEARCH-SCROLL-REGRESSION-01 — EXECUTION LOG

Status: GREEN
Datum: 2026-10-13
Branch: main
Priorität: HIGH

## Mission
Vertikales Scrollen auf /search funktionierte nicht mehr (Regress seit den
Modal-/UI-Gates). Ursache im Code ermittelt und gezielt behoben.

## 1) ROOT CAUSE (nachgewiesen, nicht vermutet)

### A) Primärursache — Lock an falsches Flag gekoppelt
Eingeführt in **JOBMATCHER-CV-MODAL-ISOLATION-01** (`src/App.tsx`):

```tsx
const cvOverlayActive =
  cvState.step !== "document-selected" &&
  !(cvState.step === "consent-required" && consentDismissed) &&
  cvState.step !== "ats-complete";
```

Diese Bedingung ist für `step === "idle"` ebenfalls **TRUE** (sie filtert nur
`document-selected`, `consent-dismissed`, `ats-complete`). Das Rendering war
zusätzlich mit `step !== "idle"` abgesichert, der neue Scroll-Lock in Gate
CV-MODAL-ISOLATION-01 aber **nur** an `cvOverlayActive` gekoppelt:

```tsx
useEffect(() => { if (!cvOverlayActive) return; ... body.style.overflow = "hidden"; ... }, [cvOverlayActive]);
```

Folge: `document.body.style.overflow = "hidden"` bereits **beim Laden** von
/search → `body` wird zweiter Scroll-Container (`bodyScrollHeight ===
bodyClientHeight`) → **Mausrad scrollt nicht**.

### B) Sekundärbefund — konkurrierende Scroll-Locks
Navbar (Mobile-Menü) und CV-Dialog schrieben beide direkt
`document.body.style.overflow`. Ein später gestarteter Lock konnte den Wert
eines aktiven Locks als "vorherigen Wert" einfangen und beim Cleanup wieder
zurückschreiben → dauerhafter Lock.

### C) Nebenbefund — Scrollposition ging beim Lock verloren
Messung im echten Browser (Chromium, 390 px): Scrollen auf 500 px →
Dialog öffnet → Hintergrund sprang auf 18 px. Ursache: `overflow: hidden`
verwirft die Dokumentposition. Vorher durch A) verdeckt (die Seite war
schon beim Laden gesperrt).

### Gegenprüfung B) — App-eigenes Scrollen (KEIN Fehler des Locks)
Messung: 500 px → Klick auf "Lebenslauf hochladen" → **18 px** (vor dem Lock).
Das ist das bestehende Scroll-to-CV-Panel-Verhalten der App (cvWorkflowRef,
BUG-19) und wurde erst durch A) sichtbar. Kein Fix des Locks nötig.

### Nicht die Ursache (explizit geprüft)
- Kein `overflow: hidden` auf html/body/#root in CSS (grep: nur `body`-Basisregel)
- Keine der fünf letzten UI-Gates fügte Scroll-Locks oder `position: fixed`
  auf Seitenebene hinzu (Diff-Kontrolle: keine url()/image-set-Änderung)
- Kein `min-height`/`100dvh`-Problem: `.cv-workflow-overlay` existiert nur bei
  geöffnetem Dialog

## 2) Fix (minimal)
1. `src/App.tsx`: neues Flag `cvDialogOpen = cvState.step !== "idle" && cvOverlayActive`.
   Scroll-Lock-Effekt, Portal und Schließen-Button hängen jetzt daran
   (nicht mehr an `cvOverlayActive`).
2. `src/lib/scrollLock.ts` (neu, ohne Dependency): zentraler Lock mit
   - Zähler gegen konkurrierende Locks (Navbar + Dialog),
   - html **und** body gesperrt (kein zweiter Scroll-Container),
   - Scrollposition während des Locks gehalten (`body position: fixed;
     top: -scrollY`) und danach exakt wiederhergestellt, inkl.
     Scrollbar-Kompensation.
3. `src/components/Navbar.tsx`: Mobile-Menü nutzt denselben Helper.
4. Keine CSS-Änderung nötig → Design Preservation automatisch erfüllt.

## 3) Browser-Verifikation (VERIFIED, Chromium via Playwright)
`vite preview` (Produktions-Build) + echter Browser, Rad-Scrolling:

| Viewport | A: kein Lock + Rad scrollt | B: Dialog offen | C: Escape → scrollt |
|---|---|---|---|
| 1920 | PASS (lock "", wheel 500) | PASS (lock hidden, Rad 0) | PASS (lock "", 500) |
| 1440 | PASS | PASS | PASS |
| 1024 | PASS | PASS | PASS |
| 768 | PASS | PASS | PASS |
| 390 | PASS | PASS | PASS |
| 360 | PASS | PASS | PASS |
| 1440 @125 % | PASS | PASS | PASS |
| 1440 @150 % | PASS | PASS | PASS |

Zusätzlich geprüft: keine horizontale Scrollbar (scrollWidth === clientWidth),
Dialog liegt im Portal, `role="dialog"` + `aria-modal="true"` vorhanden.

**Vorher-Messung (Beweis der Regression):**
`body.style.overflow === "hidden"` beim Laden, `mouse.wheel(0, 800)` →
`window.scrollY === 0`.
**Nachher:** `body.style.overflow === ""`, `mouse.wheel(0, 800)` →
`window.scrollY === 800`.

## 4) Regressionstests
- `src/lib/scrollLock.test.ts` (6): Overflow-Werte bleiben erhalten,
  Sperre/Freigabe, Mehrfach-Öffnen, konkurrierende Locks, Fehlerpfad,
  kein `position: fixed` ohne Scrollposition.
- `src/App.test.tsx` (6 neue): /search ohne Dialog ohne Lock · Dialog sperrt ·
  Schließen gibt frei · Escape gibt frei · Unmount (cleanup) gibt frei ·
  Mehrfach-Öffnen/Schließen.
- Bestehende Dialog-/Portal-/Fokus-/Escape-Tests unverändert grün.

## 5) Test- und Build-Ergebnis
- `npm test` → **786 passed**, 5 skipped (71 Dateien)
- `npm run build` → erfolgreich

## 6) Design / Funktionalität
Unverändert: Job-Lobby, Hero, Navbar, Holographic Workspace, Filter Console,
Notification Panel, Intelligence-Dekoration, AI/MATCH/ATS, Glass Dock,
Hologramm ATS Studio, Skill-Chips, Stepper, Bilddateien (0 CSS-Bildänderungen).
Unverändert: Jobsuche, Filter, ATS, CV-Upload, Einwilligung, Anonymisierung,
Modellwahl, API, Cognito/OIDC/PKCE, RIS, AWS/Terraform, Vercel.

## 7) Offene Punkte
- Kein manuelles Deployment durchgeführt (Gate-Verbot). Browser-Verifikation
  lief gegen den lokalen Produktions-Build, nicht gegen die Live-Domain.
- `body position: fixed` während des Locks: die Navbar ist in diesem Zustand
  nicht am Viewport-Oberrand gepinnt (sie liegt hinter dem Dialog). Bewusst
  akzeptiert; die Scrollposition des Hintergrunds bleibt exakt erhalten.

## 8) Files changed
- src/lib/scrollLock.ts (neu)
- src/lib/scrollLock.test.ts (neu)
- src/App.tsx (cvDialogOpen + Helper)
- src/components/Navbar.tsx (Helper)
- src/App.test.tsx (6 Regressionstests)
- docs/reports/JOBMATCHER-SEARCH-SCROLL-REGRESSION-01-EXECUTION_LOG.md
