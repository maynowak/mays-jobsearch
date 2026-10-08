import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AUTO_PULSE_EVENT, MATCH_PULSE_EVENT, USER_PULSE_EVENT } from "./MatchPulse";
import {
  createFlightPath,
  segmentCrossesZone,
  zoneOverlap,
} from "../lib/flightPath";
import type { FlightPath, PathDims } from "../lib/flightPath";

// JOB-NOTES-FINETUNING-01 — Phase B: animierter Job-Stream (verfeinert).
// Echte HTML/CSS-Elemente mit Dummy-Daten (keine API, keine Canvas, keine Libs).
// Bewegung: WAAPI pro Zettel, EIN Durchlauf, danach individuelles Recycling
// via onfinish (kein Gesamt-Reset, keine Re-Renders pro Frame).
// Checks: CSS-Pulse (~0,7 s Fenster) synchron zur Noten-Dauer.

export const STREAM_WIDTH = 1600;
export const STREAM_HEIGHT = 900;
export const STREAM_SEED = 20261002;
export const STREAM_COUNTS = { desktop: 11, tablet: 17, mobile: 26 } as const;

/**
 * Manuelles Klick-Fenster: zusätzlich zum Auto-Maximum dürfen per Klick auf
 * den Pulsar noch einmal 10 weitere Karten entstehen (Wunsch Anwender
 * 2026-10-07). Das Auto-Refill bleibt auf seinem eigenen, engeren Fenster
 * begrenzt.
 */
export const MANUAL_EXTRA_NOTES = 10;

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

// Anzahl der Lane-Indizes: legt fest, welche Basis-Notes Ambient/Check tragen.
// Die Flugbahnen selbst kommen seit BUGFIX-FLIGHT-Runde 3 aus der
// Dynamic-Path-Engine (Bildschirmraum). Die früheren LANES lagen im
// normalisierten Raum; weil die Animation mit `startX * size.width` und
// `startY * size.height` rechnet, verzerrte das Aspektverhältnis den Winkel —
// gemessen 94–100 % achsnah statt ~50 % (FINDING 7). Die Lane-Indizes bleiben
// als Struktur erhalten, damit Ambient-/Check-Verteilung stabil bleiben.
const LANE_COUNT = 10;

const DEPTHS = [0.15, 0.4, 0.65, 0.9, 0.3, 0.55, 0.8, 0.2, 0.5, 0.7];

// 2 der 10 Noten sind Ambient (räumliche Tiefe, kein Fokus).
const AMBIENT_IDS = new Set([2, 7]);

// Notfall-Pfad, falls die Engine keinen Pfad liefert (praktisch nie:
// der Startpunkt liegt immer in der Play-Box, der Strahl trifft sie also).
// Linker Gang diagonal — berührt die Safe Zone in keinem Punkt.
const FALLBACK_PATH = {
  startX: -0.1,
  startY: -0.1,
  endX: 0.2,
  endY: 1.1,
};

/**
 * Erzeugt die Basis-Noten.
 *
 * `dims` ist Pflicht: Die Flugrichtung wird im BILDSCHIRMRAUM gezogen und dann
 * in normalisierte Koordinaten zurückgerechnet. Ein Dimensions-Default würde
 * die Aspekt-Verzerrung stillschweigend reintroduzieren (FINDING 7).
 */
export function buildStreamNotes(seed: number, dims: PathDims): StreamNote[] {
  const rng = mulberry32(seed);
  const NOTE_COUNT = 26;
  return Array.from({ length: NOTE_COUNT }, (_, i) => {
    const laneIdx = i % LANE_COUNT;
    // Gleiche Engine wie die dynamischen Noten: Winkel uniform über 2π im
    // Bildschirmraum, Aspekt-korrekt, Safe Zone frei.
    const path = createDynamicPath(rng, dims) ?? FALLBACK_PATH;
    const duration = 11 + rng() * 6;
    return {
      id: i,
      gen: 0,
      startX: path.startX,
      startY: path.startY,
      endX: path.endX,
      endY: path.endY,
      duration,
      delay: -rng() * duration,
      rotation: (rng() - 0.5) * 8,
      depth: DEPTHS[laneIdx],
      ambient: i < LANE_COUNT && AMBIENT_IDS.has(laneIdx),
      hasCheck: i < LANE_COUNT && laneIdx % 5 === 1,
      checkAt: 0.35 + rng() * 0.3,
    };
  });
}

/**
 * Recycling einer Basis-Note: neuer Pfad aus der Dynamic-Path-Engine.
 *
 * Die früheren „Außenbänder" lagen ebenfalls im normalisierten Raum und
 * waren durch das Aspektverhältnis achsnah verzerrt (FINDING 7). Die Engine
 * zieht den Winkel im Bildschirmraum — die Safe Zone bleibt dabei garantiert
 * frei, Start und Ende liegen auf dem Rand der Play-Box.
 *
 * `dims` ist Pflicht (siehe buildStreamNotes).
 */
export function recycleNote(
  prev: StreamNote,
  rng: () => number,
  dims: PathDims
): StreamNote {
  const path = createDynamicPath(rng, dims) ?? FALLBACK_PATH;
  return {
    ...prev,
    gen: prev.gen + 1,
    startX: path.startX,
    startY: path.startY,
    endX: path.endX,
    endY: path.endY,
    duration: 11 + rng() * 6,
    delay: 0.2 + rng() * 1.0,
    rotation: (rng() - 0.5) * 8,
    checkAt: 0.35 + rng() * 0.3,
  };
}

// ---------------------------------------------------------------------------
// Dynamic Path Engine (BUGFIX-FLIGHT) — Extrakt nach src/lib/flightPath.ts
// ---------------------------------------------------------------------------
// Die 360°-Richtungs-/Safe-Zone-Engine ist seit 08-REFACTOR-FLIGHT-PATH-MODULE
// als wiederverwendbares Modul extrahiert. Hier bleiben die jobstream-
// spezifischen Bindungen an die lokale SAFE_ZONE; die Ursachen-Doku
// (Verwerfungs- und Aspekt-Verzerrung) liegt jetzt am Modul.

/** Kompatibilitäts-Alias auf das extrahierte Ergebnismodell. */
export type DynamicPath = FlightPath;

/** Layer-Maße für die Aspekt-Korrektur der Richtungsberechnung. */
export type { PathDims } from "../lib/flightPath";

/**
 * JobStream-Bindung: Bildschirmraum-360°-Pfad, der die lokale SAFE_ZONE
 * (Hero) garantiert frei lässt. Implementierung: src/lib/flightPath.ts.
 */
export function createDynamicPath(
  rng: () => number,
  dims: PathDims
): DynamicPath | null {
  return createFlightPath(rng, dims, SAFE_ZONE);
}

/**
 * EXAKTE Safe-Zone-Überlappung (Liang-Barsky) — bindet die generische
 * `zoneOverlap` an die lokale SAFE_ZONE. 0 = kein Kontakt.
 */
export function safeZonePenalty(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  return zoneOverlap(x0, y0, x1, y1, SAFE_ZONE);
}

/** Exakter Hero-Schutz: schneidet die Strecke die Safe Zone? */
export function segmentCrossesSafeZone(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  return segmentCrossesZone(x0, y0, x1, y1, SAFE_ZONE);
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
  // Erstrender ohne gemessene Layer-Maße: {0,0} lässt die Engine quadratisch
  // rechnen (W = H = 1). Die Bahnen werden weiter unten mit den echten
  // Layer-Maßen neu erzeugt, sobald `size` steht — sonst blieben sie auf dem
  // Erstrender-Aspekt stehen (FINDING 7).
  const [items, setItems] = useState<StreamNote[]>(() =>
    buildStreamNotes(STREAM_SEED, { w: 0, h: 0 })
  );
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
  /** Auto-Prozess-Fenster: +10 über der Basis-Anzahl. */
  const autoMax = Math.max(0, hardCap - count);
  /** Manuelles Klick-Fenster: Auto-Fenster + MANUAL_EXTRA_NOTES. */
  const clickMax = autoMax + MANUAL_EXTRA_NOTES;

  // Stabiler Recycle-Handler für Dynamic Notes. WICHTIG: darf nicht als
  // Inline-Lambda erzeugt werden – sonst ändert sich die Referenz pro
  // Render, der Effekt in StreamNoteView läuft erneut, die WAAPI-Animation
  // wird abgebrochen und startet neu → sichtbarer Sprung zurück zum Start.
  const handleDynamicRecycle = useCallback((id: number) => {
    setDynamicNotes((prev) => prev.filter((d) => d.note.id !== id));
  }, []);

  // Kapazitäts-Absicherung: die harte Grenze ist das MANUELLE Fenster
  // (Basis + Auto-Fenster + 10). Das Auto-Refill hält zusätzlich sein
  // eigenes, engeres Fenster ein — es darf aber niemals manuell erzeugte
  // Karten entfernen.
  useEffect(() => {
    setDynamicNotes((prev) =>
      prev.length <= clickMax ? prev : prev.slice(0, clickMax)
    );
  }, [clickMax]);

  // Basis-Pfade mit den echten Layer-Maßen (neu) erzeugen. Die Engine zieht
  // die Richtung im Bildschirmraum — liegt `size` auf dem Erstrender-Wert
  // {0,0}, entstünden quadratische Bahnen, die beim Rendern auf dem echten
  // Aspekt wieder verzerrt würden (das war FINDING 7).
  const builtForRef = useRef("");
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    const key = `${size.width}x${size.height}`;
    if (builtForRef.current === key) return;
    builtForRef.current = key;
    // Generationen mitführen: Ein Viewport-Wechsel soll die bestehenden
    // Animationen nicht neu aufschlüsseln (der size-Dep-Effekt in
    // StreamNoteView startet sie ohnehin sauber neu).
    setItems((prev) =>
      buildStreamNotes(STREAM_SEED, { w: size.width, h: size.height }).map(
        (n, i) => ({
          ...n,
          gen: prev[i]?.gen ?? n.gen,
        })
      )
    );
  }, [size]);

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
    // sizeRef statt `size`: der Handler hat keine size-Abhängigkeit und
    // würde sonst mit dem Erstrender-Wert {0,0} recyceln. Die Maße stehen
    // spätestens nach dem Mount-Measure, lange vor der ersten Animation.
    const live = sizeRef.current;
    const dims: PathDims = { w: live.width, h: live.height };
    setItems((prev) =>
      prev.map((n) => (n.id === id ? recycleNote(n, rng, dims) : n))
    );
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
  // Manuelles Fenster: Auto-Maximum + MANUAL_EXTRA_NOTES (Klickfenster).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleUserPulse = () => {
      setDynamicNotes((prev) => {
        if (prev.length >= clickMax) return prev;
        const newEntry = createDynamicNote('user');
        if (!newEntry) return prev;
        return [...prev, newEntry];
      });
    };
    window.addEventListener(USER_PULSE_EVENT, handleUserPulse);
    return () => window.removeEventListener(USER_PULSE_EVENT, handleUserPulse);
  }, [clickMax]);

  // Auto Refill — eigener, unregelmäßiger Timer (15–40 s), nie aggressiv,
  // nie synchron zum 2–6 s Visual-Puls oder 6 s MATCH_PULSE_EVENT.
  // Der Timer wird AUSSERHALB des State-Updaters neu geplant.
  // Das Auto-Fenster bleibt absichtlich enger als das Klickfenster.
  // Startet eine Karte, blitzt der Pulsar sichtbar auf (AUTO_PULSE_EVENT).
  useEffect(() => {
    if (staticMotion || typeof window === "undefined") return undefined;
    let timeoutId: number | undefined;
    let disposed = false;
    const scheduleAuto = () => {
      const delay = 15000 + Math.random() * 25000;
      timeoutId = window.setTimeout(() => {
        if (disposed) return;
        setDynamicNotes((prev) => {
          if (prev.length >= autoMax) return prev;
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
  }, [autoMax, staticMotion]);

  // Startet eine Auto-Karte (die Anzahl der 'auto'-Noten wächst), blitzt der
  // Pulsar von selbst auf. Rein reaktiv: der Timer-Updater oben muss rein
  // bleiben (StrictMode), darum lauscht dieser Effekt auf das ERGEBNIS.
  const prevAutoCountRef = useRef(0);
  useEffect(() => {
    const autoCount = dynamicNotes.reduce(
      (n, d) => (d.source === 'auto' ? n + 1 : n),
      0
    );
    if (autoCount > prevAutoCountRef.current) {
      window.dispatchEvent(new CustomEvent(AUTO_PULSE_EVENT));
    }
    prevAutoCountRef.current = autoCount;
  }, [dynamicNotes]);

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
