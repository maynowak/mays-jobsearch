// flightPath — wiederverwendbare 360°-Richtungs-Engine für fliegende Elemente
// (aus dem JobStream extrahiert, siehe docs/reports/08-REFACTOR-FLIGHT-PATH-MODULE).
//
// Kernidee: Der Winkel wird EINMAL im BILDSCHIRMRAUM uniform über 2π gezogen
// und dann aspekt-korrekt in normalisierte Koordinaten zurückgerechnet.
// Niemals im Normraum ziehen: `dx * W` gegen `dy * H` staucht die Verteilung
// sonst je nach Layer-Aspekt (gemessen an 1440×738: Ratio 1.31x im Normraum
// → 4.06x auf dem Bildschirm, sichtbar "nur vertikal/horizontal").
//
// Historie (BUGFIX-FLIGHT, gemessen):
//   1) VERWERFUNGS-VERZERRUNG: Winkel verwerfen bei Safe-Zone-Kreuzung oder
//      kurzem Pfad flacht Diagonalen ab (~69 % achsnah statt ~50 %).
//      Fix: Winkel nie verwerfen — stattdessen den Pfad senkrecht
//      verschieben, bis er die Zone umgeht.
//   2) ASPEKT-VERZERRUNG: siehe oben. Fix: dims ist Pflichtparameter.
//
// Start/Ende liegen garantiert auf dem Rand des Play-Bereichs (Ray-Box-
// Clipping statt Clamp), Pfadlänge gebounded, Zone wird umgangen.

/** Layer-Maße für die Aspekt-Korrektur der Richtungsberechnung. */
export interface PathDims {
  w: number;
  h: number;
}

/** Ausgesparte Zone in normalisierten Koordinaten (0…1). */
export interface ZoneRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FlightPath {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Bildschirmwinkel in Radiant (0…2π), unabhängig von der Aspektverhältnis-Verzerrung */
  angle: number;
  pathLength: number;
  /** Pfadlänge relativ zur Layer-Diagonalen (Basis für eine Tempogleichung) */
  relLength: number;
}

// Play-Bereich in normalisierten Koordinaten; Start/Ende dürfen knapp
// außerhalb des sichtbaren Rahmens liegen (Ein-/Ausfahrt ohne Pop-in).
const PLAY_MIN = -0.15;
const PLAY_MAX = 1.15;

/**
 * EXAKTE Zonen-Überlappung eines Pfads: Liang-Barsky-Clipping der Strecke
 * gegen die Zone. Rückgabe ist der Längenanteil der Strecke, der innerhalb
 * der Zone liegt. 0 = kein Kontakt.
 *
 * WARUM EXAKT (nicht gestichprobt): Eine 24er-Stichprobe über eine ~1,3 lange
 * Strecke hat einen Abstand von ~0,054. Die Zonen-Schneiden sind fast immer
 * sehr flache Ecken-Streifen, kürzer als dieser Abstand — die Stichprobe
 * übersah sie komplett. Gemessen mit Liang-Barsky als Referenz:
 *
 *   steps=24  → 0 Treffer   (alle "grün", falsch)
 *   steps=30  → 65 Treffer
 *   steps=200 → 157 Treffer
 *   exakt     → 183 von 4000 = 4,6 % kreuzten die Zone wirklich
 *
 * Ein rein sampling-basierter "Schutz" greift hier also praktisch nicht.
 */
export function zoneOverlap(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zone: ZoneRect
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [
    x0 - zone.x0,
    zone.x1 - x0,
    y0 - zone.y0,
    zone.y1 - y0,
  ];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      // Parallel zur Kante: außerhalb → kein Schnitt.
      if (q[i] < 0) return 0;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return 0;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return 0;
        if (t < t1) t1 = t;
      }
    }
  }
  return t1 > t0 ? t1 - t0 : 0;
}

/** Exakter Zonen-Schutz: schneidet die Strecke die Zone? */
export function segmentCrossesZone(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zone: ZoneRect
): boolean {
  return zoneOverlap(x0, y0, x1, y1, zone) > 0;
}

/** Schnitt des Strahls (p + t*d) mit dem Rechteck [min,max]². */
function clipRayToBox(
  px: number,
  py: number,
  dx: number,
  dy: number,
  min: number,
  max: number
): { tmin: number; tmax: number } | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes: Array<[number, number]> = [
    [px, dx],
    [py, dy],
  ];
  for (const [p, d] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (p < min || p > max) return null;
    } else {
      let t1 = (min - p) / d;
      let t2 = (max - p) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return { tmin, tmax };
}

/**
 * Erzeugt einen Flug-Pfad mit exakt gleichverteilten 360°-Richtungen.
 *
 * rng, dims und zone sind Pflichtparameter: Ein Dimensions-Default würde die
 * Aspekt-Verzerrung stillschweigend reintroduzieren, ein Zonen-Default würde
 * einen fremden Schutzbereich stillschweigend unterstellen.
 */
export function createFlightPath(
  rng: () => number,
  dims: PathDims,
  zone: ZoneRect
): FlightPath | null {
  const W = dims.w > 0 ? dims.w : 1;
  const H = dims.h > 0 ? dims.h : 1;
  const diag = Math.hypot(W, H) || 1;

  // Winkel EINMAL im Bildschirmraum ziehen → exakt uniform, nie verworfen.
  const angle = rng() * Math.PI * 2;
  const screenDx = Math.cos(angle);
  const screenDy = Math.sin(angle);
  // Bildschirmrichtung -> normalisierte Richtung: (dx*W, dy*H) || (cos, sin)
  const rawX = screenDx / W;
  const rawY = screenDy / H;
  const rawLen = Math.hypot(rawX, rawY) || 1;
  const dx = rawX / rawLen;
  const dy = rawY / rawLen;
  const nx = -dy;
  const ny = dx;
  const cx = (PLAY_MIN + PLAY_MAX) / 2;
  const cy = (PLAY_MIN + PLAY_MAX) / 2;

  let fallback: FlightPath | null = null;
  let fallbackPenalty = Infinity;
  // Sauberer Ersatzpfad mit leicht reduzierter Länge. Hat Vorrang vor einem
  // Pfad, der die Zone streift: Kollision ist verboten, eine um ~10 %
  // kürzere Bahn ist dagegen nicht sichtbar.
  let cleanShort: FlightPath | null = null;

  for (let attempt = 0; attempt < 48; attempt++) {
    // Senkrechter Versatz zur Box-Mittellinie.
    const d = (rng() * 2 - 1) * 0.65;
    const px = cx + nx * d;
    const py = cy + ny * d;
    const clip = clipRayToBox(px, py, dx, dy, PLAY_MIN, PLAY_MAX);
    if (!clip) continue;
    const pathLength = clip.tmax - clip.tmin;
    // Weder Winzstrecke noch absurde Überlänge.
    if (pathLength < 1.0 || pathLength > 1.8) continue;
    const startX = px + clip.tmin * dx;
    const startY = py + clip.tmin * dy;
    const endX = px + clip.tmax * dx;
    const endY = py + clip.tmax * dy;
    const relLength =
      Math.hypot((endX - startX) * W, (endY - startY) * H) / diag;
    const candidate: FlightPath = {
      startX, startY, endX, endY, angle, pathLength, relLength,
    };
    const penalty = zoneOverlap(startX, startY, endX, endY, zone);
    if (penalty === 0) return candidate;
    // Kandidat mit geringstem Zonen-Kontakt als letztes Mittel merken.
    if (penalty < fallbackPenalty) {
      fallbackPenalty = penalty;
      fallback = candidate;
    }
  }

  // Zweite Runde: Zone ist Pflicht, Länge darf leicht nachgeben.
  // Verläuft nur, wenn Runde 1 keinen kollisionsfreien Pfad fand.
  for (let attempt = 0; attempt < 48 && !cleanShort; attempt++) {
    const d = (rng() * 2 - 1) * 0.65;
    const px = cx + nx * d;
    const py = cy + ny * d;
    const clip = clipRayToBox(px, py, dx, dy, PLAY_MIN, PLAY_MAX);
    if (!clip) continue;
    const pathLength = clip.tmax - clip.tmin;
    if (pathLength < 0.85 || pathLength > 1.8) continue;
    const startX = px + clip.tmin * dx;
    const startY = py + clip.tmin * dy;
    const endX = px + clip.tmax * dx;
    const endY = py + clip.tmax * dy;
    if (zoneOverlap(startX, startY, endX, endY, zone) !== 0) continue;
    cleanShort = {
      startX, startY, endX, endY, angle, pathLength,
      relLength: Math.hypot((endX - startX) * W, (endY - startY) * H) / diag,
    };
  }

  // Zonen-Schutz schlägt Pfadlänge.
  return cleanShort ?? fallback;
}
