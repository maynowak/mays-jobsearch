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
}

function StreamNoteView({ note, size, staticMotion, forcedCheck, onRecycle }: NoteProps): React.ReactElement {
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
  }, [note, size, onRecycle, staticMotion]);

  // Statisch (Reduced Motion / ohne WAAPI): Note auf Bahnhälfte legen.
  const staticPos = staticMotion
    ? {
        left: `${((note.startX + note.endX) / 2) * 100}%`,
        top: `${((note.startY + note.endY) / 2) * 100}%`,
      }
    : undefined;

  return (
    <div ref={ref} className={`js-note ${depthClass(note)}`} style={staticPos}>
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
  const layerRef = useRef<HTMLDivElement>(null);
  const rngRef = useRef<(() => number) | undefined>(undefined);
  if (!rngRef.current) rngRef.current = mulberry32(STREAM_SEED + 1);
  const [userNotes, setUserNotes] = useState<StreamNote[]>([]);
  const userNoteIdRef = useRef(-1);

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
    const measure = () =>
      setSize({ width: layer.clientWidth || 1, height: layer.clientHeight || 1 });
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

  // User Click → zusätzliche Note
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const MAX_USER_ADDED = 3;
    const handleUserPulse = () => {
      setUserNotes((prev) => {
        if (prev.length >= MAX_USER_ADDED) return prev;
        const rng = rngRef.current ?? mulberry32(STREAM_SEED + 2);
        const laneIdx = Math.floor(rng() * LANES.length);
        const [sx0, sy0, ex0, ey0] = LANES[laneIdx];
        const jitter = () => (rng() - 0.5) * 0.06;
        const startX = sx0 + jitter();
        const startY = sy0 + jitter();
        const endX = ex0 + jitter();
        const endY = ey0 + jitter();
        const duration = 11 + rng() * 6;
        const newNote: StreamNote = {
          id: userNoteIdRef.current--,
          gen: 0,
          startX,
          startY,
          endX,
          endY,
          duration,
          delay: -rng() * duration * 0.3,
          rotation: (rng() - 0.5) * 8,
          depth: DEPTHS[laneIdx % DEPTHS.length],
          ambient: false,
          hasCheck: true,
          checkAt: 0.35 + rng() * 0.3,
        };
        return [...prev, newNote];
      });
    };
    window.addEventListener(USER_PULSE_EVENT, handleUserPulse);
    return () => window.removeEventListener(USER_PULSE_EVENT, handleUserPulse);
  }, []);

  const baseVisible = items.slice(0, count);
  const visible = [...baseVisible, ...userNotes];
  // Helper to determine if note is user-added
  const isUserNote = (note: StreamNote) => note.id < 0;

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
          onRecycle={isUserNote(note) ? (id) => setUserNotes(prev => prev.filter(n => n.id !== id)) : recycle}
        />
      ))}
    </div>
  );
}
