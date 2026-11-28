import { useState, useEffect } from "react";

export function DemoBanner() {
  const demoMode = typeof window !== "undefined" && window.localStorage.getItem("mj-demo-mode-open") === "true";
  if (!demoMode) return null;

  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem("tour-01a-banner-expanded", JSON.stringify(expanded));
    } catch {
      /* noop */
    }
  }, [expanded]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tour-01a-banner-expanded");
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === "boolean") setExpanded(parsed);
      }
    } catch {
      /* invalid localStorage value - fall back to default */
    }
  }, []);

  return (
    <div
      className="demo-banner"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "rgba(0, 150, 200, 0.95)",
        color: "white",
        margin: "0.5rem",
        maxWidth: "25rem",
        width: "100%",
        maxHeight: "min(30vh, 15rem)",
        padding: expanded ? "0.75rem 1rem" : "0.35rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ flex: 1, marginRight: "0.5rem" }}>
        {expanded ? "DEMO-MODUS | Beispieldaten | Demo beenden [−]" : "● DEMO [+]"}
      </span>
      <button onClick={() => setExpanded(!expanded)} style={{ flex: "0 0 auto", marginLeft: "0.5rem", cursor: "pointer", background: "none", border: "none", color: "rgba(255, 255, 255, 0.7)", fontStyle: "italic", padding: 0 }}>
        −
      </button>
    </div>
  );
}
