import { useEffect } from "react";

// AI-MATCH-PULSE-01 — kleiner futuristischer Matching-Kern neben „mit KI".
// Zyklus 6 s: idle → Puls (~1,2 s: Ring expandiert, Punkt hellt auf,
// Text-Glow synchron) → idle. Alle 6 s wird zusätzlich ein
// "lp2:match-pulse"-Event dispatcht, das EINEN Job-Zettel checkt
// (Kopplung, siehe JobStream). Rein dekorativ, keine API.
export const MATCH_PULSE_EVENT = "lp2:match-pulse";
export const MATCH_PULSE_INTERVAL_MS = 6000;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function MatchPulse(): React.ReactElement {
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const id = window.setInterval(() => {
      window.dispatchEvent(new CustomEvent(MATCH_PULSE_EVENT));
    }, MATCH_PULSE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="mp" aria-hidden="true">
      <span className="mp-ring" />
      <span className="mp-dot" />
      <span className="mp-sat mp-sat-1" />
      <span className="mp-sat mp-sat-2" />
      <span className="mp-sat mp-sat-3" />
    </span>
  );
}
