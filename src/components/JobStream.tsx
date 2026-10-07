import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MATCH_PULSE_EVENT, USER_PULSE_EVENT } from "./MatchPulse";

// JOB-NOTES-FINETUNING-01 — Phase B: animierter Job-Stream (verfeinert).
// Echte HTML/CSS-Elemente mit Dummy-Daten (keine API, keine Canvas, keine Libs).
// Bewegung: WAAPI pro Zettel, EIN Durchlauf, danach individuelles Recycling
// via onfinish (kein Gesamt-Reset, keine Re-Renders pro Frame).
// Checks: CSS-Pulse (~0,7 s Fenster) synchron zur Noten-Dauer.

export const STREAM_WIDTH = 1600;
export const STREAM_HEIGHT = 900;
export const STREAM_SEED = 20261002;
export const STREAM_COUNTS = { desktop: 11, tablet: 17, mobile: 26 } as const;

// Zentrale Safe Zone (relativ): Flugbahnen führen darum herum.
export const SAFE_ZONE = { x0: 0.3, x1: 0.7, y0: 0.25, y1: 0.7 };

export interface StreamNote {
  id: number;
  /** Recycling-Generation (Key-Wechsel pro Zyklus) */
  gen: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Sekunden pro Durchlauf */
  duration: number;
  /** Sekunden, negativ = beim Laden bereits unterwegs */
  delay: number;
  rotation: number;
  /** 0 (hinten) … 1 (vorne), stabil pro Zettel */
  depth: number;
  /** dezente Hintergrund-Note (räumliche Tiefe, kein Fokus) */
  ambient: boolean;
  hasCheck: boolean;
  /** Zeitpunkt des Checks als Anteil des Durchlaufs (0…1) */
  checkAt: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Initial-Bahnen in virtuellen Koordinaten (0…1, Start darf außerhalb
// liegen). Durchgehend ↘-Drift (wie die Lichtstreifen), Safe Zone frei.
const LANES: Array<[number, number, number, number]> = [
  [-0.1, 0.06, 0.72, 0.18],
  [0.15, 0.02, 1.1, 0.13],
  [0.04, -0.1, 0.2, 1.1],
  [0.16, 0.3, 0.05, 1.08],
  [1.08, 0.3, 0.86, 1.05],
  [0.9, -0.08, 1.06, 0.55],
  [0.1, 0.95, 1.08, 0.8],
  [-0.08, 0.84, 0.6, 0.97],
  [-0.08, 0.45, 0.24, 0.99],
  [0.3, 0.02, 1.05, 0.22],
];

const DEPTHS = [0.15, 0.4, 0.65, 0.9, 0.3, 0.55, 0.8, 0.2, 0.5, 0.7];

// 2 der 10 Noten sind Ambient (räumliche Tiefe, kein Fokus).
const AMBIENT_IDS = new Set([2, 7]);

export function buildStreamNotes(seed: number = STREAM_SEED): StreamNote[] {
  const rng = mulberry32(seed);
  const NOTE_COUNT = 26;
  return Array.from({ length: NOTE_COUNT }, (_, i) => {
    const laneIdx = i % LANES.length;
    const [sx0, sy0, ex0, ey0] = LANES[laneIdx];
    const jitter = () => (rng() - 0.5) * 0.06;
    const startX = sx0 + jitter();
    const startY = sy0 + jitter();
    const endX = ex0 + jitter();
    const endY = ey0 + jitter();
    const duration = 11 + rng() * 6;
    return {
      id: i,
      gen: 0,
      startX,
      startY,
      endX,
      endY,
      duration,
      delay: -rng() * duration,
      rotation: (rng() - 0.5) * 8,
      depth: DEPTHS[laneIdx % DEPTHS.length],
      ambient: i < LANES.length && AMBIENT_IDS.has(laneIdx),
      hasCheck: i < LANES.length && laneIdx % 5 === 1,
      checkAt: 0.35 + rng() * 0.3,
    };
  });
}

function insideSafe(x: number, y: number, margin = 0.05): boolean {
  return (
    x > SAFE_ZONE.x0 + margin &&
    x < SAFE_ZONE.x1 - margin &&
    y > SAFE_ZONE.y0 + margin &&
    y < SAFE_ZONE.y1 - margin
  );
}

// Recycling: neuer Pfad in Außenbändern (↘-Drift bleibt), Kennung stabil.
export function recycleNote(prev: StreamNote, rng: () => number): StreamNote {
  const bands = [
    // oben: y bleibt über der Zone
    () => {
      const sx = -0.1 + rng() * 0.9;
      return { sx, sy: 0.02 + rng() * 0.1, ex: sx + 0.4 + rng() * 0.5, ey: 0.1 + rng() * 0.12 };
    },
    // links: x bleibt links der Zone
    () => {
      const sy = -0.1 + rng() * 0.6;
      return { sx: rng() * 0.12, sy, ex: 0.02 + rng() * 0.18, ey: sy + 0.4 + rng() * 0.4 };
    },
    // rechts: x bleibt rechts der Zone
    () => {
      const sy = -0.08 + rng() * 0.48;
      return { sx: 0.88 + rng() * 0.2, sy, ex: 0.82 + rng() * 0.23, ey: sy + 0.35 + rng() * 0.4 };
    },
    // unten: y bleibt unter der Zone
    () => {
      const sx = -0.08 + rng() * 0.68;
      return { sx, sy: 0.8 + rng() * 0.18, ex: sx + 0.3 + rng() * 0.5, ey: 0.76 + rng() * 0.19 };
    },
  ];
  const pick = bands[Math.floor(rng() * bands.length)]();
  // Sicherheitsnetz: Endpunkte nie tief in der Zone
  const fix = (x: number, y: number) => (insideSafe(x, y) ? { x: 0.15, y } : { x, y });
  const s = fix(pick.sx, pick.sy);
  const e = fix(pick.ex, pick.ey);
  return {
    ...prev,
    gen: prev.gen + 1,
    startX: s.x,
    startY: s.y,
    endX: e.x,
    endY: e.y,
    duration: 11 + rng() * 6,
    delay: 0.2 + rng() * 1.0,
    rotation: (rng() - 0.5) * 8,
    checkAt: 0.35 + rng() * 0.3,
  };
}

// ---------------------------------------------------------------------------
// Dynamic Path Engine (BUGFIX-FLIGHT)
// ---------------------------------------------------------------------------
// Zwei unabhängige Verzerrungen wurden gefunden und behoben:
//
//   1. CLAMP/VERWERFUNGS-VERZERRUNG: Der erste Ansatz wählte eine zufällige
//      Kante als Start und clamped die Endpunkte. Diagonalen wurden auf
//      Rechteck-Ecken abgeflacht → sichtbar fast nur vertikal/horizontal
//      (gemessen: 69 % achsnah statt ~50 %).
//      Fix: Winkel uniform über 2π ziehen und NIEMALS verwerfen; den Pfad
//      stattdessen senkrecht verschieben, bis er die Safe Zone umgeht.
//
//   2. ASPEKT-VERZERRUNG: Der Layer ist z. B. 1440×738 (Aspekt ~1.95).
//      `dx * W` gegen `dy * H` staucht eine im normalisierten Raum
//      gleichverteilte Winkelmenge auf dem Bildschirm (gemessen: Ratio
//      1.31x → 4.06x, achsnah 51 % → 57 %).
//      Fix: Winkel im BILDSCHIRMRAUM ziehen, dann in normalisierte
//      Koordinaten zurückrechnen.
//
// Start/Ende liegen garantiert auf dem Rand des Play-Bereichs (Ray-Box-
// Clipping statt Clamp), Pfadlänge gebounded, Safe Zone wird umgangen.

const PLAY_MIN = -0.15;
const PLAY_MAX = 1.15;

export interface DynamicPath {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Bildschirmwinkel in Radiant (0…2π), unabhängig von der Aspektverhältnis-Verzerrung */
  angle: number;
  pathLength: number;
  /** Pfadlänge relativ zur Layer-Diagonalen (Basis für die Tempogleichung) */
  relLength: number;
}

/** Layer-Maße für die Aspekt-Korrektur der Richtungsberechnung. */
export interface PathDims {
  w: number;
  h: number;
}

/**
 * EXAKTE Safe-Zone-Überlappung eines Pfads: Liang-Barsky-Clipping der Strecke
 * gegen das Hero-Rechteck. Rückgabe ist der Längenanteil der Strecke, der
 * innerhalb der Zone liegt. 0 = kein Kontakt.
 *
 * WARUM EXAKT (nicht gestichprobt): Eine 24er-Stichprobe über eine ~1,3 lange
 * Strecke hat einen Abstand von ~0,054. Die Safe-Zone-Schneiden sind fast
 * immer sehr flache Ecken-Streifen, kürzer als dieser Abstand — die Stichprobe
 * übersah sie komplett. Gemessen mit Liang-Barsky als Referenz:
 *
 *   steps=24  → 0 Treffer   (alle „grün", falsch)
 *   steps=30  → 65 Treffer
 *   steps=200 → 157 Treffer
 *   exakt     → 183 von 4000 = 4,6 % kreuzten wirklich die Hero-Zone
 *
 * Ein rein sampling-basierter „Schutz" hat hier also praktisch nicht gegriffen.
 */
export function safeZonePenalty(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [
    x0 - SAFE_ZONE.x0,
    SAFE_ZONE.x1 - x0,
    y0 - SAFE_ZONE.y0,
    SAFE_ZONE.y1 - y0,
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

/** Exakter Hero-Schutz: schneidet die Strecke die Safe Zone? */
export function segmentCrossesSafeZone(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  return safeZonePenalty(x0, y0, x1, y1) > 0;
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
 * Erzeugt eine Dynamic-Flight-Pfad mit exakt gleichverteilten 360°-Richtungen.
 *
 * Zwei unabhängige Fehlerquellen wurden behoben:
 *
 * 1) VERWERFUNGS-VERZERRUNG: Der Winkel wurde verworfen, wenn der Pfad die
 *    Safe Zone kreuzte oder zu kurz war. Diagonale Chords durch die Box
 *    werden dabei fast immer verworfen, axiale Randbahnen nie → sichtbare
 *    Häufung von vertikal/horizontal (69 % achsnah statt ~50 %).
 *    Fix: Winkel EINMAL ziehen, nie verwerfen. Stattdessen den Pfad
 *    senkrecht verschieben (offset d), bis er die Safe Zone umgeht.
 *
 * 2) ASPEKT-VERZERRUNG: Die Layer ist z. B. 1440×738 (Aspekt ~1.95).
 *    `dx * W` gegen `dy * H` staucht eine uniforme Winkelverteilung im
 *    normalisierten Raum auf dem Bildschirm (gemessen: Ratio 1.31x → 4.06x).
 *    Fix: Winkel wird im BILDSCHIRMRAUM gezogen und dann in normalisierte
 *    Koordinaten zurückgerechnet.
 *
 * rng und dims sind Pflichtparameter: Ein Dimensions-Default würde die
 * Aspekt-Verzerrung stillschweigend reintroduzieren (siehe Punkt 2).
 */
export function createDynamicPath(
  rng: () => number,
  dims: PathDims
): DynamicPath | null {
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

  let fallback: DynamicPath | null = null;
  let fallbackPenalty = Infinity;
  // Sauberer Ersatzpfad mit leicht reduzierter Länge. Hat Vorrang vor einem
  // Pfad, der die Hero-Zone streift: Spec verbietet Hero-Kollisionen,
  // eine um ~10 % kürzere Bahn ist dagegen nicht sichtbar.
  let cleanShort: DynamicPath | null = null;

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
    const candidate: DynamicPath = {
      startX, startY, endX, endY, angle, pathLength, relLength,
    };
    const penalty = safeZonePenalty(startX, startY, endX, endY);
    if (penalty === 0) return candidate;
    // Kandidat mit geringstem Safe-Zone-Kontakt als letztes Mittel merken.
    if (penalty < fallbackPenalty) {
      fallbackPenalty = penalty;
      fallback = candidate;
    }
  }

  // Zweite Runde: Safe Zone ist Pflicht, Länge darf leicht nachgeben.
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
    if (safeZonePenalty(startX, startY, endX, endY) !== 0) continue;
    cleanShort = {
      startX, startY, endX, endY, angle, pathLength,
      relLength: Math.hypot((endX - startX) * W, (endY - startY) * H) / diag,
    };
  }

  // Hero-Schutz schlägt Pfadlänge.
  return cleanShort ?? fallback;
}

export function depthClass(note: StreamNote): string {
  if (note.ambient) return "js-back js-ambient";
  if (note.depth < 0.35) return "js-back";
  if (note.depth < 0.7) return "js-mid";
  return "js-front";
}

/** Basis-Opacity je Note (WAAPI-Envelope nutzt denselben Wert). */
export function noteOpacity(note: StreamNote): number {
  if (note.ambient) return 0.22;
  if (note.depth < 0.35) return 0.3;
  if (note.depth < 0.7) return 0.6;
  return 0.9;
}

function pickCount(): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return STREAM_COUNTS.desktop;
  }
  if (window.matchMedia("(max-width: 600px)").matches) return STREAM_COUNTS.mobile;
  if (window.matchMedia("(max-width: 900px)").matches) return STREAM_COUNTS.tablet;
  return STREAM_COUNTS.desktop;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface NoteProps {
  note: StreamNote;
  size: { width: number; height: number };
  staticMotion: boolean;
  forcedCheck: boolean;
  onRecycle: (id: number) => void;
  isDynamic?: boolean;
  /** Quelle der Dynamic Note ("user" | "auto"); Base Notes: undefined */
  source?: 'user' | 'auto';
}

function StreamNoteView({ note, size, staticMotion, forcedCheck, onRecycle, isDynamic, source }: NoteProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || staticMotion || typeof el.animate !== "function") return undefined;
    const opacity = noteOpacity(note);
    const x0 = note.startX * size.width;
    const y0 = note.startY * size.height;
    const x1 = note.endX * size.width;
    const y1 = note.endY * size.height;
    const anim = el.animate(
      [
        { opacity: 0, transform: `translate(${x0}px, ${y0}px)` },
        { opacity, transform: `translate(${x0}px, ${y0}px)`, offset: 0.08 },
        { opacity, transform: `translate(${x1}px, ${y1}px)`, offset: 0.9 },
        { opacity: 0, transform: `translate(${x1}px, ${y1}px)` },
      ],
      {
        duration: note.duration * 1000,
        delay: note.delay * 1000,
        iterations: 1,
        easing: "linear",
        fill: "both",
      }
    );
    // Individuelles Recycling: Pause, dann neuer Pfad (kein Gesamt-Reset).
    let timer: number | undefined;
    anim.onfinish = () => {
      timer = window.setTimeout(() => onRecycle(note.id), 400 + (note.id % 3) * 200);
    };
    return () => {
      window.clearTimeout(timer);
      anim.cancel();
    };
  }, [note, onRecycle, staticMotion, isDynamic ? undefined : size]);

  // Statisch (Reduced Motion / ohne WAAPI): Note auf Bahnhälfte legen.
  const staticPos = staticMotion
    ? {
        left: `${((note.startX + note.endX) / 2) * 100}%`,
        top: `${((note.startY + note.endY) / 2) * 100}%`,
      }
    : undefined;

  return (
    <div
      ref={ref}
      className={`js-note ${depthClass(note)}`}
      style={staticPos}
      data-source={source ?? 'base'}
    >
      <div className="js-note-inner" style={{ transform: `rotate(${note.rotation.toFixed(2)}deg)` }}>
        <span className="js-note-icon" />
        <span className="js-note-lines">
          <i style={{ width: "82%" }} />
          <i style={{ width: "64%" }} />
          <i style={{ width: "47%" }} />
          <b />
        </span>
        {forcedCheck && (
          <span className="js-check js-check-once">✓</span>
        )}
      </div>
    </div>
  );
}

export default function JobStream(): React.ReactElement {
  const notes = useMemo(() => buildStreamNotes(), []);
  const [items, setItems] = useState<StreamNote[]>(notes);
  const [count, setCount] = useState<number>(pickCount);
  const [staticMotion] = useState<boolean>(reducedMotion);
  // Gekoppelter Check (AI-MATCH-PULSE-01): genau eine Note pro Puls.
  const [forcedId, setForcedId] = useState<number | null>(null);
  const forceCounter = useRef(0);
  const forceTimer = useRef<number | undefined>(undefined);
  const clearTimer = useRef<number | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Frischer Layer-Maße-Zug auch in Callbacks, die nicht von `size` abhängen.
  const sizeRef = useRef({ width: 0, height: 0 });
  const layerRef = useRef<HTMLDivElement>(null);
  const rngRef = useRef<(() => number) | undefined>(undefined);
  if (!rngRef.current) rngRef.current = mulberry32(STREAM_SEED + 1);
  type DynamicNote = { note: StreamNote; source: 'user' | 'auto' };
  const [dynamicNotes, setDynamicNotes] = useState<DynamicNote[]>([]);
  const dynamicIdRef = useRef(-1);
  const hardCap = count + 10;

  // Stabiler Recycle-Handler für Dynamic Notes. WICHTIG: darf nicht als
  // Inline-Lambda erzeugt werden – sonst ändert sich die Referenz pro
  // Render, der Effekt in StreamNoteView läuft erneut, die WAAPI-Animation
  // wird abgebrochen und startet neu → sichtbarer Sprung zurück zum Start.
  const handleDynamicRecycle = useCallback((id: number) => {
    setDynamicNotes((prev) => prev.filter((d) => d.note.id !== id));
  }, []);

  // Hard-Cap-Absicherung: bei Viewport-Wechsel (kleineres Base-Count)
  // überschüssige Dynamic Notes entfernen, nie über die Invariant kommen.
  useEffect(() => {
    setDynamicNotes((prev) => {
      const maxDynamic = Math.max(0, hardCap - count);
      return prev.length <= maxDynamic ? prev : prev.slice(0, maxDynamic);
    });
  }, [hardCap, count]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const queries = [window.matchMedia("(max-width: 600px)"), window.matchMedia("(max-width: 900px)")];
    const onChange = () => setCount(pickCount());
    queries.forEach((q) => q.addEventListener?.("change", onChange));
    return () => queries.forEach((q) => q.removeEventListener?.("change", onChange));
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || typeof window === "undefined") return undefined;
    const measure = () => {
      const next = {
        width: layer.clientWidth || 1,
        height: layer.clientHeight || 1,
      };
      // Ref IMMER parallel zur State halten: Die Klick-/Auto-Refill-Effects
      // hängen nicht von `size` ab (Deps [count, hardCap]) und würden sonst
      // den Closure-Wert des ERSTEN Renders behalten – damals {0,0}.
      // Folge war ein stummer Fallback auf 1440×738, während die Layer z. B.
      // 412×915 misst: Engine und Rendering rechneten mit verschiedenen
      // Maßen (gemessen: 74 % achsnah statt ~50 % auf mobile).
      sizeRef.current = next;
      setSize(next);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const recycle = useCallback((id: number) => {
    const rng = rngRef.current ?? mulberry32(STREAM_SEED + 1);
    setItems((prev) => prev.map((n) => (n.id === id ? recycleNote(n, rng) : n)));
  }, []);

  // Kopplung: Match-Puls → 600 ms Versatz → genau eine sichtbare,
  // check-berechtigte Note bekommt 850 ms den Check.
  useEffect(() => {
    if (staticMotion || typeof window === "undefined") return undefined;
    const onPulse = () => {
      window.clearTimeout(forceTimer.current);
      window.clearTimeout(clearTimer.current);
      forceTimer.current = window.setTimeout(() => {
        setItems((prev) => {
          const eligible = prev.filter((n) => n.hasCheck);
          if (!eligible.length) return prev;
          const pick = eligible[forceCounter.current++ % eligible.length];
          setForcedId(pick.id);
          return prev;
        });
        clearTimer.current = window.setTimeout(() => setForcedId(null), 900);
      }, 600);
    };
    window.addEventListener(MATCH_PULSE_EVENT, onPulse);
    return () => {
      window.removeEventListener(MATCH_PULSE_EVENT, onPulse);
      window.clearTimeout(forceTimer.current);
      window.clearTimeout(clearTimer.current);
    };
  }, [staticMotion]);

  // User Click → zusätzliche dynamische Note.
  // Kapazität wird atomar im Updater geprüft, aber NICHTS wird darin
  // erzeugt/seiteneffektiert (StrictMode-Doppelausführung würde sonst
  // doppelte Karten erzeugen).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleUserPulse = () => {
      setDynamicNotes((prev) => {
        const maxDynamic = Math.max(0, hardCap - count);
        if (prev.length >= maxDynamic) return prev;
        const newEntry = createDynamicNote('user');
        if (!newEntry) return prev;
        return [...prev, newEntry];
      });
    };
    window.addEventListener(USER_PULSE_EVENT, handleUserPulse);
    return () => window.removeEventListener(USER_PULSE_EVENT, handleUserPulse);
  }, [count, hardCap]);

  // Auto Refill — eigener, unregelmäßiger Timer (15–40 s), nie aggressiv,
  // nie synchron zum 2–6 s Visual-Puls oder 6 s MATCH_PULSE_EVENT.
  // Der Timer wird AUSSERHALB des State-Updaters neu geplant.
  useEffect(() => {
    if (staticMotion || typeof window === "undefined") return undefined;
    let timeoutId: number | undefined;
    let disposed = false;
    const scheduleAuto = () => {
      const delay = 15000 + Math.random() * 25000;
      timeoutId = window.setTimeout(() => {
        if (disposed) return;
        setDynamicNotes((prev) => {
          const maxDynamic = Math.max(0, hardCap - count);
          if (prev.length >= maxDynamic) return prev;
          const newEntry = createDynamicNote('auto');
          if (!newEntry) return prev;
          return [...prev, newEntry];
        });
        scheduleAuto();
      }, delay);
    };
    scheduleAuto();
    return () => {
      disposed = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [count, hardCap, staticMotion]);

  const createDynamicNote = (source: 'user' | 'auto'): DynamicNote | null => {
    const rng = rngRef.current ?? mulberry32(STREAM_SEED + 2);
    // Layer-Maße für Aspekt-Korrektur. sizeRef statt `size`: die erzeugenden
    // Effects hängen nicht von `size` ab und würden einen veralteten
    // Closure-Wert ({0,0} beim ersten Render) kapern.
    const live = sizeRef.current;
    const dims = {
      w: live.width > 0 ? live.width : 1440,
      h: live.height > 0 ? live.height : 738,
    };
    const path = createDynamicPath(rng, dims);
    if (!path) return null;
    // Tempogleichung: Dauer aus BILDSCHIRMPfadlänge relativ zur Diagonalen.
    // Gleiche wahrgenommene Geschwindigkeit, Variation bleibt innerhalb
    // der grünen 11–17s-Baseline.
    const duration = Math.min(
      17,
      Math.max(11, path.relLength * 16)
    );
    const note: StreamNote = {
      id: dynamicIdRef.current--,
      gen: 0,
      startX: path.startX,
      startY: path.startY,
      endX: path.endX,
      endY: path.endY,
      duration,
      // JOBSTREAM-05-Baseline: strikt negativer Delay, kein Flash.
      delay: -rng() * duration * 0.3,
      rotation: (rng() - 0.5) * 8,
      depth: 0.3 + rng() * 0.6,
      ambient: false,
      hasCheck: true,
      checkAt: 0.35 + rng() * 0.3,
    };
    return { note, source };
  };

  const baseVisible = items.slice(0, count);
  const dynamicVisible = dynamicNotes.map(d => d.note);
  const visible = [...baseVisible, ...dynamicVisible];
  const isDynamicNote = (note: StreamNote) => note.id < 0;
  // Quelle pro Dynamic Note für Debug/Diagnose im DOM (data-source).
  const sourceById = useMemo(() => {
    const m = new Map<number, 'user' | 'auto'>();
    dynamicNotes.forEach((d) => m.set(d.note.id, d.source));
    return m;
  }, [dynamicNotes]);

  return (
    <div
      ref={layerRef}
      className="js-stream"
      data-motion={staticMotion ? "static" : "live"}
      aria-hidden="true"
    >
      {visible.map((note) => (
        <StreamNoteView
          key={`${note.id}:${note.gen}`}
          note={note}
          size={size}
          staticMotion={staticMotion}
          forcedCheck={forcedId === note.id}
          onRecycle={isDynamicNote(note) ? handleDynamicRecycle : recycle}
          isDynamic={isDynamicNote(note)}
          source={sourceById.get(note.id)}
        />
      ))}
    </div>
  );
}
