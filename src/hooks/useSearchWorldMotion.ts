import { useCallback, useEffect, useRef } from "react";
import { computeSearchWorldProgress } from "../lib/searchWorldScroll";

// SEARCH-WORLD-04: Scroll-getriebene Motion fuer die Search World.
//
// Technik (bewusst gewaehlt):
//  - KEIN Scroll-Driven-Animation-API (`animation-timeline: view()`), weil die
//    Browser-Supportlage uneinheitlich ist und die Aufgabe keinen harten
//    Support verlangt.
//  - EIN passiver Scroll-Listener, pro Frame höchstens EIN rAF-Callback.
//  - Der Listener schreibt ausschliesslich die CSS-Custom-Property
//    `--sw-progress` (0 → 1). Die gesamte Bewegung liegt danach in CSS
//    (transform/opacity) — kein React-State, kein Re-Rendering, keine
//    Animations-Library, kein Canvas.
//  - `prefers-reduced-motion: reduce` → Listener schreibt nichts, CSS
//    neutralisiert die Transformationen.

const PROGRESS_PROPERTY = "--sw-progress";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useSearchWorldMotion(): (node: HTMLElement | null) => void {
  const nodeRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const update = useCallback(() => {
    frameRef.current = null;
    const node = nodeRef.current;
    if (!node) return;
    if (prefersReducedMotion()) {
      node.style.removeProperty(PROGRESS_PROPERTY);
      return;
    }
    const rect = node.getBoundingClientRect();
    const progress = computeSearchWorldProgress({
      worldTop: rect.top + window.scrollY,
      worldHeight: rect.height,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
    });
    // Außerhalb der Search World bleibt der Wert 0 → keine Bewegung.
    node.style.setProperty(PROGRESS_PROPERTY, progress.toFixed(4));
  }, []);

  const schedule = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(update);
  }, [update]);

  const detach = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  }, [schedule]);

  // Ref-Callback: haengt Listener nur an, solange die Search World existiert.
  const ref = useCallback(
    (node: HTMLElement | null) => {
      detach();
      nodeRef.current = node;
      if (!node) return;
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      update();
    },
    [detach, schedule, update]
  );

  // Cleanup beim Unmount (Route-Wechsel).
  useEffect(() => detach, [detach]);

  return ref;
}

export { PROGRESS_PROPERTY };
