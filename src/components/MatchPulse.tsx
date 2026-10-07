import { useEffect, useRef } from "react";

// AI-MATCH-PULSE-01 — kleiner futuristischer Matching-Kern neben „mit KI".
// Zufälliger, markanter Pulse: 2–6 s Pause, gelegentlicher Doppelimpuls.
// Dispatcht weiterhin "lp2:match-pulse" für JobStream-Kopplung.
export const MATCH_PULSE_EVENT = "lp2:match-pulse";
export const MATCH_PULSE_INTERVAL_MS = 6000; // legacy constant for tests

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function MatchPulse(): React.ReactElement {
  const containerRef = useRef<HTMLButtonElement>(null);
  const visualTimeoutRef = useRef<number | null>(null);
  const doubleTimeoutRef = useRef<number | null>(null);

  const triggerVisualPulse = () => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.add("is-pulsing");
    window.setTimeout(() => el.classList.remove("is-pulsing"), 1200);

    if (Math.random() < 0.2) {
      doubleTimeoutRef.current = window.setTimeout(() => {
        if (!containerRef.current) return;
        containerRef.current.classList.add("is-pulsing");
        window.setTimeout(() => {
          containerRef.current?.classList.remove("is-pulsing");
        }, 1200);
      }, 300);
    }
  };

  useEffect(() => {
    if (reducedMotion()) return undefined;

    // JobStream-Kopplung bleibt auf festem 6-s-Takt
    const intervalId = window.setInterval(() => {
      window.dispatchEvent(new CustomEvent(MATCH_PULSE_EVENT));
    }, MATCH_PULSE_INTERVAL_MS);

    // Visueller Pulse synchron zu MATCH_PULSE_EVENT
    const eventHandler = () => triggerVisualPulse();
    window.addEventListener(MATCH_PULSE_EVENT, eventHandler);

    // Zufälliger visueller Pulse ohne Event-Dispatch
    const scheduleVisual = () => {
      const delay = 2000 + Math.random() * 4000;
      visualTimeoutRef.current = window.setTimeout(() => {
        triggerVisualPulse();
        scheduleVisual();
      }, delay);
    };

    const initial = 800 + Math.random() * 1200;
    const startId = window.setTimeout(() => {
      triggerVisualPulse();
      scheduleVisual();
    }, initial);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(MATCH_PULSE_EVENT, eventHandler);
      window.clearTimeout(startId);
      if (visualTimeoutRef.current) window.clearTimeout(visualTimeoutRef.current);
      if (doubleTimeoutRef.current) window.clearTimeout(doubleTimeoutRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      className="mp"
      ref={containerRef}
      aria-label="Mit KI pulsieren, Job-Stream aktualisieren"
      onClick={() => window.dispatchEvent(new CustomEvent(MATCH_PULSE_EVENT))}
    >
      <span className="mp-ring" />
      <span className="mp-dot" />
      <span className="mp-sat mp-sat-1" />
      <span className="mp-sat mp-sat-2" />
      <span className="mp-sat mp-sat-3" />
    </button>
  );
}
