# JM-MOBILE-NAV-UX-01

**Art:** Mobile Navbar / Authentication UX / Responsive Regression
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment, kein Release
**Datum:** 2026-11-01
**Baseline:** `main` @ `3a1e939`, `origin/main` synchron

## 1. Bestandsaufnahme

- Branch: `main`
- HEAD bei Start: `3a1e939`
- Remote: synchron (`0 0`)
- Working Tree: nur vorbestehende, unverwandte untracked Dateien
- Bestehende Scroll-/Fokusänderungen des Anschreiben-Dialogs wurden nicht angefasst.

## 2. Ursache des Mobile-Navbar-Fehlers

1. Auf Mobile wurde per CSS nur `.nav-links` ausgeblendet. Im Glass-Modus liegt der Login/Logout jedoch in `.nav-right` und blieb dadurch außerhalb des Menüs sichtbar.
2. Desktop- und Mobile-Auth-Elemente wurden gleichzeitig gerendert. Auf Mobile existierten dadurch Login/Logout parallel im DOM, auch wenn ein Teil per CSS verborgen war.
3. Das Mobile-Overlay lag innerhalb von `.nav-inner`. Der `backdrop-filter` dieses Glass-Containers erzeugte einen Containing Block für `position: fixed`; Overlay und Menü wurden relativ zur Navbar-Pille statt zum Viewport positioniert. Im E2E lag das Menü dadurch bei `x=390` außerhalb des sichtbaren Bereichs, und ein Outside-Click traf nicht zuverlässig das Overlay.
4. Der Burger blieb beim Öffnen des Menüs nicht zuverlässig als Schließen-Kontrolle erreichbar, und der Fokus wurde beim Schließen nicht gezielt zurückgegeben.

## 3. Änderungen

### 3.1 Responsive Struktur

- Neuer lokaler Hook `useMobileNav()` mit Breakpoint `(max-width: 767px)`.
- Unter 768 px werden Desktop-Links, Desktop-Sprachschalter und Desktop-Auth-Gruppe **nicht gerendert**.
- Ab 768 px bleiben Desktop-/Tablet-Navigation, Login/Logout und Sprachschalter unverändert.
- Mobile: Markenname links, Hamburger rechts.
- Kein doppeltes Login/Logout im DOM.

### 3.2 Mobile Menü

- Menü wird per `createPortal` an `document.body` gerendert.
- Overlay ist vollflächig und liegt mit `z-index: 35` unter der Navbar (`z-index: 40`), damit Burger und Navbar klickbar bleiben.
- Das Menü enthält:
  - Navigationslinks,
  - Profil (angemeldet),
  - Login (abgemeldet),
  - Logout (angemeldet),
  - Sprachauswahl DE/EN.
- Kein horizontales Overflow; das Menü ist auf die Viewport-Breite begrenzt.
- `role="dialog"`, `aria-modal`, `aria-label`, `aria-expanded` und `aria-controls` sind gesetzt.

### 3.3 Auth- und Fokusverhalten

- Auth-Statuswechsel schließt ein offenes Menü; der nächste Öffnen-Vorgang zeigt den aktuellen Zustand.
- Logout schließt das Menü vor der bestehenden `signOut(auth)`-Routine.
- Beim Öffnen wird der erste Menülink fokussiert.
- `Tab`/`Shift+Tab` bleiben im Menü (Fokusfalle).
- Escape, Klick außerhalb und Navigation schließen das Menü.
- Beim Schließen wird der Fokus auf den Burger zurückgegeben.
- Bestehender Body-Scroll-Lock bleibt aktiv.
- Touch-Ziele: Burger und mobile Aktionen mindestens 44 px; sichtbare `:focus-visible`-Zustände.

## 4. Responsive Tests

Browser-E2E mit Playwright:

| Breite | Modus | Gast | Angemeldet |
|---:|---|---|---|
| 390 px | Mobile | PASS | PASS |
| 430 px | Mobile | PASS | PASS |
| 768 px | Desktop/Tablet | PASS | PASS |
| 1024 px | Desktop | PASS | PASS |
| 1440 px | Desktop | PASS | PASS |

Geprüft:

- Markenname links, Burger rechts,
- keine Desktop-Links/Login außerhalb des Menüs unter 768 px,
- genau ein Login bzw. Logout,
- Menülinks, Profil, Sprache,
- Escape und Outside-Click,
- kein horizontaler Overflow,
- Desktop-/Tablet-Navigation ab 768 px,
- Console-Errors: keine.

Der angemeldete E2E-Zustand wird über eine seeded OIDC-Session in `sessionStorage` erzeugt; es wurde **kein echter Cognito-/OIDC-Login** durchgeführt.

## 5. Addendum — Apify-Monatslimit

Die veraltete Angabe in
`docs/reports/MAYS_JOB_MATCHER_STANDARD_TEST_AND_DEPLOYMENT_ROUTINE.md`
wurde korrigiert:

- Alt: `APIFY_MONTHLY_MAX_RUNS=30`
- Neu: `APIFY_MONTHLY_MAX_RUNS=100`

Ergänzter Hinweis: Der Standardwert beträgt 100 Apify-Runs pro Monat. Ein
explizit gesetzter Environment-Wert hat Vorrang; der tatsächliche
Produktionswert muss separat überprüft werden.

Unverändert:

- `APIFY_DETAIL_MAX_PER_USER_PER_DAY=30`
- `APIFY_DETAIL_MAX_PER_IP_PER_DAY=100`
- Apify-Cost-Guards
- Cache-Mechanismen
- Source-Registry
- Apify-Actor-Konfiguration

Historische Reports mit damaligen Ist-Werten wurden nicht rückwirkend
umgeschrieben.

## 6. Tests / Regression

| Prüfung | Ergebnis |
|---|---|
| Navbar-/Auth-Tests (inkl. Mobile) | **17 passed** |
| Gesamtsuite | **1130 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Mobile-Nav-E2E 390/430/768/1024/1440 | PASS |
| E2E Gast + angemeldet | PASS |
| Console-Errors | keine |

## 7. Verbleibende Risiken

1. Der Auth-E2E verwendet eine geseedete OIDC-Session, keinen echten Cognito-Login.
2. Der echte Logout-Redirect zu Cognito wurde im E2E nicht vollständig durchlaufen; die Menü-Schließlogik ist per Unit-Test abgedeckt.
3. Kein Deployment/Release; die Produktionswirkung ist lokal und per Browser-E2E verifiziert, nicht live.
4. Keine Änderungen an Cognito/OIDC/Session/RIS/AWS/Apify/BA.

## 8. Git

- Implementierung: `c701aad`
- Dokumentation: nach diesem Bericht.
- Kein Deployment, kein Release.
