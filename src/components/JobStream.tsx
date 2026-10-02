import { useEffect, useMemo, useRef, useState } from "react";

// LANDINGPAGE-02-HERO-ANIMATION-03 — Phase B: animierter Job-Stream.
// Echte HTML/CSS-Elemente mit Dummy-Daten (keine API, keine Canvas, keine Libs).
// Bewegung: WAAPI-Einmal-Setup (transform/opacity only, keine Re-Renders);
// Checks: CSS-Pulse synchron zur Noten-Dauer.

export const STREAM_WIDTH = 1600;
export const STREAM_HEIGHT = 900;
export const STREAM_SEED = 20261002;
export const STREAM_COUNTS = { desktop: 10, tablet: 7, mobile: 4 } as const;

// Zentrale Safe Zone (relativ): Flugbahnen führen darum herum.
export const SAFE_ZONE = { x0: 0.3, x1: 0.7, y0: 0.25, y1: 0.7 };

export interface StreamNote {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Sekunden pro Durchlauf */
  duration: number;
  /** Sekunden, negativ = beim Laden bereits unterwegs */
  delay: number;
  rotation: number;
  /** 0 (hinten) … 1 (vorne) */
  depth: number;
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

// Bahnen in virtuellen Koordinaten (0…1, Start darf außerhalb liegen).
// Durchgehend ↘-Drift (wie die Lichtstreifen), Safe Zone bleibt frei.
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

export function buildStreamNotes(seed: number = STREAM_SEED): StreamNote[] {
  const rng = mulberry32(seed);
  return LANES.map(([sx, sy, ex, ey], i) => {
    const duration = 11 + rng() * 6;
    return {
      id: i,
      startX: sx,
      startY: sy,
      endX: ex,
      endY: ey,
      duration,
      delay: -rng() * duration,
      rotation: (rng() - 0.5) * 8,
      depth: DEPTHS[i % DEPTHS.length],
      // ca. 30 % der Karten erhalten einen Check
      hasCheck: i % 4 === 1,
      checkAt: 0.35 + rng() * 0.3,
    };
  });
}

export function depthClass(depth: number): "js-back" | "js-mid" | "js-front" {
  if (depth < 0.35) return "js-back";
  if (depth < 0.7) return "js-mid";
  return "js-front";
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

export default function JobStream(): React.ReactElement {
  const notes = useMemo(() => buildStreamNotes(), []);
  const [count, setCount] = useState<number>(pickCount);
  const [staticMotion] = useState<boolean>(reducedMotion);
  const layerRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<Array<HTMLDivElement | null>>([]);
  const visible = notes.slice(0, count);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const queries = [window.matchMedia("(max-width: 600px)"), window.matchMedia("(max-width: 900px)")];
    const onChange = () => setCount(pickCount());
    queries.forEach((q) => q.addEventListener?.("change", onChange));
    return () => queries.forEach((q) => q.removeEventListener?.("change", onChange));
  }, []);

  // Einmaliges Bewegungs-Setup (keine Re-Renders pro Frame).
  // Resize: Animationen abbrechen und mit neuen Maßen neu aufsetzen.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || staticMotion) return undefined;
    let animations: Animation[] = [];
    const setup = () => {
      animations.splice(0).forEach((a) => a.cancel());
      const width = layer.clientWidth || 1;
      const height = layer.clientHeight || 1;
      visible.forEach((note, i) => {
        const el = noteRefs.current[i];
        if (!el || typeof el.animate !== "function") return;
        const opacity = 0.35 + note.depth * 0.55;
        const x0 = note.startX * width;
        const y0 = note.startY * height;
        const x1 = note.endX * width;
        const y1 = note.endY * height;
        animations.push(
          el.animate(
            [
              { opacity: 0, transform: `translate(${x0}px, ${y0}px)` },
              { opacity, transform: `translate(${x0}px, ${y0}px)`, offset: 0.08 },
              { opacity, transform: `translate(${x1}px, ${y1}px)`, offset: 0.9 },
              { opacity: 0, transform: `translate(${x1}px, ${y1}px)` },
            ],
            {
              duration: note.duration * 1000,
              delay: note.delay * 1000,
              iterations: Infinity,
              easing: "linear",
            }
          )
        );
      });
    };
    setup();
    window.addEventListener("resize", setup);
    return () => {
      window.removeEventListener("resize", setup);
      animations.forEach((a) => a.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, staticMotion]);

  return (
    <div
      ref={layerRef}
      className="js-stream"
      data-motion={staticMotion ? "static" : "live"}
      aria-hidden="true"
    >
      {visible.map((note, i) => (
        <div
          key={note.id}
          ref={(el) => {
            noteRefs.current[i] = el;
          }}
          className={`js-note ${depthClass(note.depth)}`}
        >
          <div
            className="js-note-inner"
            style={{ transform: `rotate(${note.rotation.toFixed(2)}deg)` }}
          >
            <span className="js-note-icon" />
            <span className="js-note-lines">
              <i style={{ width: "82%" }} />
              <i style={{ width: "64%" }} />
              <i style={{ width: "47%" }} />
              <b />
            </span>
            {note.hasCheck && (
              <span
                className="js-check"
                style={{
                  animationDuration: `${note.duration.toFixed(2)}s`,
                  animationDelay: `${(note.delay + note.checkAt * note.duration).toFixed(2)}s`,
                }}
              >
                ✓
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
