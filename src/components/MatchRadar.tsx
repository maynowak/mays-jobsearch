import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";

const MAX_LABELS = 5;
const LABEL_GAP = 30;

interface RadarItem {
  id: string;
  title: string;
  top: number;
  element: HTMLElement;
}

interface Props {
  radarKey: string;
  onActivate: () => void;
}

export function layoutRadarLabels(tops: number[], railHeight: number, minGap = LABEL_GAP): number[] {
  if (tops.length === 0) return [];
  const maxTop = Math.max(0, railHeight - minGap);
  const ordered = tops.map((top) => Math.max(0, Math.min(maxTop, top))).sort((a, b) => a - b);
  const arranged = [...ordered];
  for (let index = 1; index < arranged.length; index += 1) {
    arranged[index] = Math.max(arranged[index], arranged[index - 1] + minGap);
  }
  if (arranged[arranged.length - 1] > maxTop) {
    const shift = arranged[arranged.length - 1] - maxTop;
    for (let index = 0; index < arranged.length; index += 1) {
      arranged[index] = Math.max(0, arranged[index] - shift);
    }
    for (let index = 1; index < arranged.length; index += 1) {
      arranged[index] = Math.max(arranged[index], arranged[index - 1] + minGap);
    }
  }
  return arranged.map((top) => Math.max(0, Math.min(maxTop, top)));
}

function navOffset(): number {
  const nav = document.querySelector<HTMLElement>(".navbar");
  return (nav?.offsetHeight ?? 64) + 16;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function MatchRadar({ radarKey, onActivate }: Props) {
  const { t } = useLang();
  const railRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<RadarItem[]>([]);
  const [railHeight, setRailHeight] = useState(360);
  const [pointerInside, setPointerInside] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const measure = useCallback(() => {
    const section = document.getElementById("matches");
    const rail = railRef.current;
    if (!section || !rail) {
      setItems([]);
      return;
    }
    const currentRailHeight = rail.clientHeight || 360;
    setRailHeight(currentRailHeight);
    const sectionRect = section.getBoundingClientRect();
    const sectionTop = sectionRect.top + window.scrollY;
    const sectionHeight = Math.max(1, section.offsetHeight);
    const padding = 14;
    const usable = Math.max(1, currentRailHeight - padding * 2);
    const nodes = Array.from(
      section.querySelectorAll<HTMLElement>("[data-radar-job-id]")
    ).filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
    });
    const next = nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const documentTop = rect.top + window.scrollY;
      const relative = Math.max(0, Math.min(1, (documentTop - sectionTop) / sectionHeight));
      return {
        id: node.dataset.radarJobId ?? "",
        title: node.dataset.radarJobTitle ?? "",
        top: padding + relative * usable,
        element: node,
      };
    }).filter((item) => Boolean(item.id));
    setItems(next);
  }, []);

  useEffect(() => {
    measure();
    const frame = requestAnimationFrame(measure);
    const section = document.getElementById("matches");
    const sectionObserver = section && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => measure())
      : null;
    if (section && sectionObserver) sectionObserver.observe(section);
    const mutationObserver = section && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => measure())
      : null;
    if (section && mutationObserver) {
      mutationObserver.observe(section, { childList: true, subtree: true });
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      sectionObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [radarKey, measure]);

  useEffect(() => {
    if (items.length === 0) return;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const offset = navOffset();
      let next = items[0];
      for (const item of items) {
        if (item.element.getBoundingClientRect().top <= offset + 24) next = item;
        else break;
      }
      setActiveId((current) => current === next.id ? current : next.id);
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [items]);

  const scrollToItem = (item: RadarItem) => {
    const top = item.element.getBoundingClientRect().top + window.scrollY - navOffset();
    setActiveId(item.id);
    window.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const nearestItem = (clientY: number): RadarItem | null => {
    const rail = railRef.current;
    if (!rail || items.length === 0) return items[0] ?? null;
    const rect = rail.getBoundingClientRect();
    const y = clientY - rect.top;
    return items.reduce((nearest, item) =>
      Math.abs(item.top - y) < Math.abs(nearest.top - y) ? item : nearest
    , items[0]);
  };

  const activate = () => {
    onActivate();
    setPointerInside(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerInside) activate();
    const nearest = nearestItem(event.clientY);
    if (!nearest) return;
    setHoveredId(nearest.id);
    setActiveId(nearest.id);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!pointerInside || items.length === 0) return;
    event.preventDefault();
    const current = items.findIndex((item) => item.id === (hoveredId ?? activeId));
    if (current < 0) return;
    const nextIndex = Math.max(0, Math.min(items.length - 1, current + (event.deltaY > 0 ? 1 : -1)));
    if (nextIndex === current) return;
    const next = items[nextIndex];
    setHoveredId(next.id);
    setActiveId(next.id);
    scrollToItem(next);
  };

  const labelBaseId = hoveredId ?? activeId;
  const baseIndex = items.findIndex((item) => item.id === labelBaseId);
  const labelStart = baseIndex < 0
    ? 0
    : Math.max(0, Math.min(baseIndex - Math.floor(MAX_LABELS / 2), items.length - MAX_LABELS));
  const labelItems = items.slice(labelStart, labelStart + MAX_LABELS);
  const labelTops = layoutRadarLabels(labelItems.map((item) => item.top), railHeight);
  const labelsVisible = pointerInside && labelItems.length > 0 && !panelOpen;

  return (
    <div
      className="match-radar"
      onPointerEnter={activate}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        setPointerInside(false);
        setHoveredId(null);
      }}
      onWheel={onWheel}
    >
      <div
        ref={railRef}
        className="match-radar__rail"
        role="navigation"
        aria-label={t("matchRadar.aria")}
      >
        <span className="match-radar__rail-line" aria-hidden="true" />
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`match-radar__marker${activeId === item.id ? " is-active" : ""}`}
            style={{ top: `${item.top}px` }}
            data-radar-marker-id={item.id}
            aria-label={t("matchRadar.goTo", { title: item.title })}
            aria-current={activeId === item.id ? "true" : undefined}
            onClick={() => {
              activate();
              scrollToItem(item);
            }}
            onFocus={() => {
              activate();
              setHoveredId(item.id);
              setActiveId(item.id);
            }}
            onBlur={() => setHoveredId(null)}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>

      {labelsVisible && (
        <div className="match-radar__labels" aria-hidden="true">
          {labelItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`match-radar__label${activeId === item.id ? " is-active" : ""}`}
              style={{ top: `${labelTops[index]}px` }}
              onClick={() => scrollToItem(item)}
              tabIndex={-1}
            >
              <span className="match-radar__label-dot" />
              <span className="match-radar__label-text">{item.title}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="match-radar__mobile-toggle"
        aria-expanded={panelOpen}
        aria-controls="match-radar-panel"
        onClick={() => {
          const next = !panelOpen;
          setPanelOpen(next);
          if (next) activate();
        }}
      >
        {panelOpen ? t("matchRadar.close") : t("matchRadar.open")}
      </button>

      {panelOpen && (
        <div id="match-radar-panel" className="match-radar__panel" role="dialog" aria-label={t("matchRadar.aria")}>
          <p className="match-radar__panel-title">{t("matchRadar.overview")}</p>
          <ol>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={activeId === item.id ? "is-active" : undefined}
                  onClick={() => {
                    setPanelOpen(false);
                    scrollToItem(item);
                  }}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
