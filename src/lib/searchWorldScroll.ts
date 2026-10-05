// SEARCH-WORLD-04: Scroll-Fortschritt der Search World als reine Funktion.
// Bewusst ohne DOM-/React-Bezug, damit sie direkt testbar bleibt und die
// Motion-Berechnung von der Listener-Logik getrennt ist.

export interface SearchWorldProgressInput {
  /** Dokumentposition der Search World (oberer Rand, scroll-unabhängig). */
  worldTop: number;
  /** Höhe der Search World. */
  worldHeight: number;
  /** Aktueller Scroll-Versatz. */
  scrollY: number;
  /** Aktuelle Viewport-Höhe. */
  viewportHeight: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Fortschritt 0 → 1 über die komplette Durchfahrt der Search World
 * durch den Viewport:
 *  - 0, sobald die Search World gerade in den Viewport eintritt
 *  - 1, sobald sie ihn unten vollständig verlassen hat
 * außerhalb des Bereichs bleibt der Wert 0 bzw. 1 (keine Bewegung).
 */
export function computeSearchWorldProgress({
  worldTop,
  worldHeight,
  scrollY,
  viewportHeight,
}: SearchWorldProgressInput): number {
  const travel = viewportHeight + worldHeight;
  if (travel <= 0) return 0;
  return clamp01((scrollY + viewportHeight - worldTop) / travel);
}
