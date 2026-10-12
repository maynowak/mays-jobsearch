import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
}

// HOLOGRAPHIC-CONSOLE-01: schwebende 3D-Hologramm-Konsole für /anmelden und
// /registrieren. Maus-Tilt maximal 3°, Lichtreflex via CSS-Variablen,
// ref-basiert (keine Re-Renders). Touch ohne Tilt über Pointer-Query.
export default function AuthCard({ label, children }: Props) {
  const cardRef = useRef<HTMLElement | null>(null);
  const hoverCapableRef = useRef(false);

  useEffect(() => {
    // jsdom/SSR-Sicherheit: matchMedia fehlt ggf. -> Touch-Verhalten (kein Tilt).
    if (typeof window.matchMedia !== "function") return;
    hoverCapableRef.current = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;
  }, []);

  // A11Y + Mobile: Tilt nur auf Geräten mit Maus; Touch -> keine Neigung.
  const handleMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!hoverCapableRef.current) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * 6; // -> [-3, +3] Grad
    const ry = (px - 0.5) * 6;
    el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  }, []);

  const handleLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  }, []);

  return (
    <div className="auth-card-outer">
      <section
        ref={cardRef}
        className="card auth-card"
        aria-label={label}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {children}
      </section>
    </div>
  );
}
