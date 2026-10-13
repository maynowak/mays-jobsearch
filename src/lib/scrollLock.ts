// SEARCH-SCROLL-REGRESSION-01: Zentraler Scroll-Lock fuer Seite + Dialog.
//
// Hintergrund 1: Vorher schrieben Navbar (Mobile-Menue) und CV-Dialog (App)
// beide direkt `document.body.style.overflow`. Ein spaeter gestarteter Lock
// konnte thereby den Wert eines bereits aktiven Locks als "vorherigen Wert"
// einfangen und beim Cleanup wieder zurueckschreiben — die Seite blieb dann
// dauerhaft auf overflow: hidden (kein Scrollen). Ein Zaehler verhindert das.
//
// Hintergrund 2: `overflow: hidden` allein loest den Dokument-Scroll und
// verwirft die Scrollposition — der Hintergrund sprang beim Oeffnen des
// Dialogs sichtbar nach oben (im Browser gemessen: 500 px -> 18 px).
// Deshalb wird die Position waehrend des Locks gehalten (body fixed +
// top = -scrollY, inkl. Scrollbar-Kompensation) und danach exakt
// wiederhergestellt.
//
// Hintergrund 3: Nur body zu sperren erzeugt einen zweiten Scroll-Container.
// Deshalb werden html UND body gesperrt; beide Originalwerte werden
// exakt wiederhergestellt.

let locks = 0;
let savedHtml: string | null = null;
let savedBody: string | null = null;
let savedPosition = "";
let savedTop = "";
let savedWidth = "";
let savedPaddingRight = "";
let savedScrollY = 0;

export function acquireBodyScrollLock(): void {
  if (typeof document === "undefined") return;
  if (locks === 0) {
    savedHtml = document.documentElement.style.overflow;
    savedBody = document.body.style.overflow;
    savedScrollY = window.scrollY || window.pageYOffset || 0;

    savedPosition = document.body.style.position;
    savedTop = document.body.style.top;
    savedWidth = document.body.style.width;
    savedPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (savedScrollY > 0) {
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = "100%";
      if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    }
  }
  locks += 1;
}

export function releaseBodyScrollLock(): void {
  if (typeof document === "undefined") return;
  if (locks === 0) return;
  locks -= 1;
  if (locks !== 0) return;

  if (savedHtml !== null) document.documentElement.style.overflow = savedHtml;
  if (savedBody !== null) document.body.style.overflow = savedBody;
  document.body.style.position = savedPosition;
  document.body.style.top = savedTop;
  document.body.style.width = savedWidth;
  document.body.style.paddingRight = savedPaddingRight;
  savedHtml = null;
  savedBody = null;

  if (savedScrollY > 0) window.scrollTo(0, savedScrollY);
  savedScrollY = 0;
}

// Nur fuer Tests: Zaehler, Inline-Werte und Position zuruecksetzen.
export function __resetBodyScrollLockForTests(): void {
  locks = 0;
  savedHtml = null;
  savedBody = null;
  savedScrollY = 0;
  if (typeof document !== "undefined") {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.paddingRight = "";
  }
}
