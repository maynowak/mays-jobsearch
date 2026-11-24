import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  activeNavigatorTargetId,
  activateAndScrollNavigatorTarget,
  layoutRadarLabels,
  measureNavigatorTargets,
  navigatorOffset,
  navigatorTargetSignature,
  type MeasuredNavigatorTarget,
  type NavigatorTarget,
} from "../lib/navigation/radarNavigator";

const MAX_LABELS = 5;

export interface RadarNavigatorLabels {
  aria: string;
  open: string;
  close: string;
  overview: string;
  goTo: (title: string) => string;
}

export interface RadarNavigatorProps {
  targets: NavigatorTarget[];
  labels: RadarNavigatorLabels;
  navigationKey: string;
  onActivate?: () => void;
  onBeforeNavigate?: () => void | Promise<void>;
  regionSelector?: string;
  scrollContainer?: HTMLElement | null;
  offset?: () => number;
  classNamePrefix?: string;
  maxLabels?: number;
  panelId?: string;
  enabled?: boolean;
}

export default function RadarNavigator({
  targets,
  labels,
  navigationKey,
  onActivate,
  onBeforeNavigate,
  regionSelector,
  scrollContainer = null,
  offset = navigatorOffset,
  classNamePrefix = "radar-navigator",
  maxLabels = MAX_LABELS,
  panelId,
  enabled = true,
}: RadarNavigatorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const targetsRef = useRef(targets);
  const onActivateRef = useRef(onActivate);
  const onBeforeNavigateRef = useRef(onBeforeNavigate);
  const offsetRef = useRef(offset);
  targetsRef.current = targets;
  onActivateRef.current = onActivate;
  onBeforeNavigateRef.current = onBeforeNavigate;
  offsetRef.current = offset;
  const [items, setItems] = useState<MeasuredNavigatorTarget[]>([]);
  const [railHeight, setRailHeight] = useState(360);
  const [pointerInside, setPointerInside] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const navigationOverrideRef = useRef<{ id: string; until: number } | null>(null);
  const wheelHandlerRef = useRef<(event: WheelEvent) => void>(() => undefined);

  const targetSignature = useMemo(() => navigatorTargetSignature(targets), [targets]);
  const resolvedPanelId = panelId ?? `${classNamePrefix}-panel`;

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      setItems([]);
      return;
    }
    const region = regionSelector ? document.querySelector<HTMLElement>(regionSelector) : null;
    const currentRailHeight = rail.clientHeight || 360;
    setRailHeight(currentRailHeight);
    setItems(measureNavigatorTargets(targetsRef.current, region, currentRailHeight, scrollContainer));
  }, [regionSelector, scrollContainer]);

  useEffect(() => {
    if (!enabled) return;
    let measureFrame: number | null = null;
    const scheduleMeasure = () => {
      if (measureFrame !== null) return;
      measureFrame = requestAnimationFrame(() => {
        measureFrame = null;
        measure();
      });
    };
    measure();
    scheduleMeasure();
    const region = regionSelector ? document.querySelector<HTMLElement>(regionSelector) : null;
    const regionObserver = region && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleMeasure)
      : null;
    regionObserver?.observe(region as Element);
    const mutationObserver = region && typeof MutationObserver !== "undefined"
      ? new MutationObserver(scheduleMeasure)
      : null;
    mutationObserver?.observe(region as Element, { childList: true, subtree: true });
    const railObserver = railRef.current && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleMeasure)
      : null;
    if (railRef.current && railObserver) railObserver.observe(railRef.current);
    const containerObserver = scrollContainer && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleMeasure)
      : null;
    if (scrollContainer && containerObserver) containerObserver.observe(scrollContainer);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      if (measureFrame !== null) cancelAnimationFrame(measureFrame);
      regionObserver?.disconnect();
      mutationObserver?.disconnect();
      railObserver?.disconnect();
      containerObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [enabled, measure, navigationKey, targetSignature, regionSelector, scrollContainer]);

  useEffect(() => {
    if (!enabled || items.length === 0) return;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const offset = offsetRef.current();
      const viewportTop = scrollContainer ? scrollContainer.getBoundingClientRect().top : 0;
      const navigation = navigationOverrideRef.current;
      if (navigation && Date.now() < navigation.until) {
        const target = items.find((item) => item.id === navigation.id);
        if (target && target.element.getBoundingClientRect().top > viewportTop + offset + 24) {
          setActiveId(navigation.id);
          return;
        }
        navigationOverrideRef.current = null;
      }
      const next = activeNavigatorTargetId(items, offset, viewportTop);
      setActiveId((current) => current === next ? current : next);
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    const scrollTarget: HTMLElement | Window = scrollContainer ?? window;
    update();
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [enabled, items, scrollContainer]);

  const activate = () => {
    onActivateRef.current?.();
    setPointerInside(true);
  };

  const navigateTo = async (target: NavigatorTarget, notifyActivate = false) => {
    if (notifyActivate) onActivateRef.current?.();
    navigationOverrideRef.current = { id: target.id, until: Date.now() + 1_200 };
    setActiveId(target.id);
    const result = await activateAndScrollNavigatorTarget(target, {
      scrollContainer,
      offset: () => offsetRef.current(),
      onBeforeScroll: onBeforeNavigateRef.current,
      elementTimeoutMs: 900,
    });
    if (!result) navigationOverrideRef.current = null;
    return result;
  };

  const closePanel = useCallback((restoreFocus: boolean) => {
    setPanelOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePanel(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelOpen, closePanel]);

  useEffect(() => {
    if (!enabled) return;
    const clearNavigationOverride = () => {
      navigationOverrideRef.current = null;
    };
    window.addEventListener("wheel", clearNavigationOverride, { passive: true, capture: true });
    window.addEventListener("touchmove", clearNavigationOverride, { passive: true, capture: true });
    window.addEventListener("pointerdown", clearNavigationOverride, true);
    document.addEventListener("keydown", clearNavigationOverride, true);
    return () => {
      window.removeEventListener("wheel", clearNavigationOverride, true);
      window.removeEventListener("touchmove", clearNavigationOverride, true);
      window.removeEventListener("pointerdown", clearNavigationOverride, true);
      document.removeEventListener("keydown", clearNavigationOverride, true);
    };
  }, [enabled]);

  const nearestItem = (clientY: number): MeasuredNavigatorTarget | null => {
    const rail = railRef.current;
    if (!rail || items.length === 0) return items[0] ?? null;
    const rect = rail.getBoundingClientRect();
    const y = clientY - rect.top;
    return items.reduce((nearest, item) =>
      Math.abs(item.top - y) < Math.abs(nearest.top - y) ? item : nearest
    , items[0]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerInside) activate();
    if (panelOpen) return;
    const nearest = nearestItem(event.clientY);
    if (!nearest) return;
    setHoveredId(nearest.id);
    setActiveId(nearest.id);
  };

  wheelHandlerRef.current = (event: WheelEvent) => {
    if (!pointerInside || panelOpen || items.length === 0) return;
    event.preventDefault();
    const current = items.findIndex((item) => item.id === (hoveredId ?? activeId));
    if (current < 0) return;
    const nextIndex = Math.max(0, Math.min(items.length - 1, current + (event.deltaY > 0 ? 1 : -1)));
    if (nextIndex === current) return;
    const next = items[nextIndex];
    setHoveredId(next.id);
    setActiveId(next.id);
    void navigateTo(next);
  };

  useEffect(() => {
    if (!enabled || !rootRef.current) return;
    const root = rootRef.current;
    const onWheel = (event: WheelEvent) => wheelHandlerRef.current(event);
    // React's delegated wheel listener is passive. The radar needs a native
    // non-passive listener so wheeling over the rail does not scroll the page.
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [enabled]);

  const labelBaseId = hoveredId ?? activeId;
  const baseIndex = items.findIndex((item) => item.id === labelBaseId);
  const labelStart = baseIndex < 0
    ? 0
    : Math.max(0, Math.min(baseIndex - Math.floor(maxLabels / 2), items.length - maxLabels));
  const labelItems = items.slice(labelStart, labelStart + maxLabels);
  const labelTops = layoutRadarLabels(labelItems.map((item) => item.top), railHeight);
  const labelsVisible = pointerInside && labelItems.length > 0 && !panelOpen;

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className={classNamePrefix}
      onPointerEnter={activate}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        setPointerInside(false);
        setHoveredId(null);
      }}
    >
      <div
        ref={railRef}
        className={`${classNamePrefix}__rail`}
        role="navigation"
        aria-label={labels.aria}
      >
        <span className={`${classNamePrefix}__rail-line`} aria-hidden="true" />
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              `${classNamePrefix}__marker`,
              activeId === item.id ? "is-active" : "",
              item.kind ? `${classNamePrefix}__marker--${item.kind}` : "",
              item.status && item.status !== "normal" ? `${classNamePrefix}__marker--${item.status}` : "",
            ].filter(Boolean).join(" ")}
            style={{ top: `${item.top}px` }}
            data-radar-marker-id={item.id}
            data-navigator-marker-id={item.id}
            data-navigator-kind={item.kind}
            data-navigator-status={item.status}
            aria-label={labels.goTo(item.title)}
            aria-current={activeId === item.id ? "true" : undefined}
            onClick={() => {
              activate();
              void navigateTo(item);
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
        <div className={`${classNamePrefix}__labels`} aria-hidden="true">
          {labelItems.map((item, index) => (
            <span
              key={item.id}
              className={`${classNamePrefix}__label${activeId === item.id ? " is-active" : ""}`}
              style={{ top: `${labelTops[index]}px` }}
              onClick={() => void navigateTo(item)}
            >
              <span className={`${classNamePrefix}__label-dot`} />
              <span className={`${classNamePrefix}__label-text`}>{item.title}</span>
            </span>
          ))}
        </div>
      )}

      <button
        ref={mobileToggleRef}
        type="button"
        className={`${classNamePrefix}__mobile-toggle`}
        aria-expanded={panelOpen}
        aria-controls={resolvedPanelId}
        onClick={() => {
          if (panelOpen) {
            closePanel(false);
            return;
          }
          setPanelOpen(true);
          activate();
        }}
      >
        {panelOpen ? labels.close : labels.open}
      </button>

      {panelOpen && (
        <div id={resolvedPanelId} className={`${classNamePrefix}__panel`} role="dialog" aria-label={labels.aria}>
          <p className={`${classNamePrefix}__panel-title`}>{labels.overview}</p>
          <ol>
            {targets.map((target) => (
              <li key={target.id}>
                <button
                  type="button"
                  className={[
                    target.id === activeId ? "is-active" : "",
                    target.kind ? `${classNamePrefix}__panel-item--${target.kind}` : "",
                  ].filter(Boolean).join(" ") || undefined}
                  data-navigator-panel-id={target.id}
                  data-navigator-status={target.status}
                  onClick={() => {
                    closePanel(true);
                    void navigateTo(target, true);
                  }}
                >
                  {target.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
