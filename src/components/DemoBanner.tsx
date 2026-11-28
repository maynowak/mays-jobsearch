export function DemoBanner() {
  const demoMode = typeof window !== "undefined" && window.localStorage.getItem("mj-demo-mode-open") === "true";
  if (!demoMode) return null;

  const handleExit = () => {
    window.localStorage.removeItem("mj-demo-mode-open");
    window.location.replace("/");
  };

  return (
    <div
      className="demo-banner"
      aria-label="Exit demo"
      role="banner"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "rgba(0, 150, 200, 0.95)",
        color: "white",
        padding: "0.75rem 1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <span>Demo mode</span>
      <button
        onClick={handleExit}
        style={{
          background: "none",
          border: "none",
          color: "white",
          fontSize: "1.25rem",
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
