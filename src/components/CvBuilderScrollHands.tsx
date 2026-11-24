import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useLang } from "../i18n";

type Direction = "up" | "down";

interface Props {
  topTargetSelector: string;
  bottomTargetSelector: string;
}

export interface CvBuilderScrollHandsHandle {
  stop: () => void;
}

const DOWN_DELAY_MS = 400;
const UP_DELAY_MS = 180;
const DOWN_START_SPEED = 200;
const DOWN_RAMP_MS = 3200;
const DOWN_TURBO_SPEED = 6000;
const UP_SPEED = 1200;
const TARGET_GAP = 24;

function reduceMotion(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hoverCapable(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function targetScroll(direction: Direction, selector: string): number | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (direction === "up") {
    return Math.max(0, window.scrollY + rect.top - TARGET_GAP);
  }
  const target = window.scrollY + rect.top - (window.innerHeight - rect.height - TARGET_GAP);
  return Math.max(0, target);
}

const CvBuilderScrollHands = forwardRef<CvBuilderScrollHandsHandle, Props>(function CvBuilderScrollHands({
  topTargetSelector,
  bottomTargetSelector,
}, ref) {
  const { t } = useLang();
  const rafRef = useRef<number | null>(null);
  const delayRef = useRef<number | null>(null);
  const directionRef = useRef<Direction | null>(null);
  const startedAtRef = useRef(0);
  const lastAtRef = useRef(0);
  const suppressedRef = useRef(false);
  const hoveredDirectionRef = useRef<Direction | null>(null);

  const stopAnimation = useCallback((suppress: boolean) => {
    const wasActive =
      rafRef.current !== null ||
      delayRef.current !== null ||
      directionRef.current !== null;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (delayRef.current !== null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    directionRef.current = null;
    if (suppress && wasActive) suppressedRef.current = true;
  }, []);

  useImperativeHandle(ref, () => ({
    stop: () => stopAnimation(true),
  }), [stopAnimation]);

  const jumpTo = useCallback((direction: Direction) => {
    const selector = direction === "up" ? topTargetSelector : bottomTargetSelector;
    const target = targetScroll(direction, selector);
    if (target === null) return;
    stopAnimation(true);
    window.scrollTo({ top: target, behavior: reduceMotion() ? "auto" : "smooth" });
  }, [bottomTargetSelector, stopAnimation, topTargetSelector]);

  const tickRef = useRef<(now: number) => void>(() => undefined);

  const schedule = useCallback(() => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame((next) => tickRef.current(next));
  }, []);

  tickRef.current = (now: number) => {
    const direction = directionRef.current;
    if (!direction) return;
    if (reduceMotion()) {
      stopAnimation(true);
      return;
    }
    const selector = direction === "up" ? topTargetSelector : bottomTargetSelector;
    const target = targetScroll(direction, selector);
    if (target === null) {
      stopAnimation(true);
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - lastAtRef.current) / 1000));
    lastAtRef.current = now;
    const current = window.scrollY;
    if (direction === "up") {
      if (current <= target + 1) {
        window.scrollTo(0, target);
        stopAnimation(true);
        return;
      }
      const step = Math.min(UP_SPEED * dt, current - target);
      window.scrollBy(0, -step);
      schedule();
      return;
    }

    if (current >= target - 1) {
      window.scrollTo(0, target);
      stopAnimation(true);
      return;
    }
    const elapsed = now - startedAtRef.current;
    const progress = Math.min(1, Math.max(0, elapsed / DOWN_RAMP_MS));
    let speed = DOWN_START_SPEED + (DOWN_TURBO_SPEED - DOWN_START_SPEED) * progress * progress;
    const remaining = target - current;
    if (remaining < 600) {
      speed = Math.min(speed, Math.max(120, remaining * 4));
    }
    const step = Math.min(speed * dt, remaining);
    window.scrollBy(0, step);
    schedule();
  };

  const startAnimation = useCallback((direction: Direction) => {
    if (reduceMotion() || suppressedRef.current) return;
    const selector = direction === "up" ? topTargetSelector : bottomTargetSelector;
    const target = targetScroll(direction, selector);
    if (target === null) return;
    const current = window.scrollY;
    if ((direction === "up" && current <= target + 1) || (direction === "down" && current >= target - 1)) {
      suppressedRef.current = true;
      return;
    }
    stopAnimation(false);
    directionRef.current = direction;
    startedAtRef.current = performance.now();
    lastAtRef.current = startedAtRef.current;
    schedule();
  }, [bottomTargetSelector, schedule, stopAnimation, topTargetSelector]);

  const beginHover = (direction: Direction) => {
    if (!hoverCapable() || reduceMotion()) return;
    // A manual interruption suppresses only the hand that is still hovered.
    // Moving to the other hand is a new deliberate activation.
    if (suppressedRef.current && hoveredDirectionRef.current === direction) return;
    if (hoveredDirectionRef.current !== direction) suppressedRef.current = false;
    hoveredDirectionRef.current = direction;
    stopAnimation(false);
    const delay = direction === "down" ? DOWN_DELAY_MS : UP_DELAY_MS;
    delayRef.current = window.setTimeout(() => {
      delayRef.current = null;
      startAnimation(direction);
    }, delay);
  };

  const endHover = () => {
    hoveredDirectionRef.current = null;
    stopAnimation(false);
    suppressedRef.current = false;
  };

  useEffect(() => {
    const stopForManualInput = () => stopAnimation(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
        stopForManualInput();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".cv-builder-scroll-hands")) {
        stopForManualInput();
      }
    };
    window.addEventListener("blur", stopForManualInput);
    window.addEventListener("wheel", stopForManualInput, { passive: true, capture: true });
    window.addEventListener("touchmove", stopForManualInput, { passive: true, capture: true });
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      stopAnimation(false);
      window.removeEventListener("blur", stopForManualInput);
      window.removeEventListener("wheel", stopForManualInput, true);
      window.removeEventListener("touchmove", stopForManualInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [stopAnimation]);

  useEffect(() => () => stopAnimation(false), [stopAnimation]);

  return (
    <div className="cv-builder-scroll-hands" role="group" aria-label={t("cvBuilder.workspace.scrollHands")}>
      <button
        type="button"
        className="cv-builder-scroll-hand cv-builder-scroll-hand--up"
        aria-label={t("cvBuilder.workspace.scrollTop")}
        onPointerEnter={() => beginHover("up")}
        onPointerLeave={endHover}
        onClick={() => jumpTo("up")}
      >
        <span aria-hidden="true">☝️ ↑</span>
      </button>
      <button
        type="button"
        className="cv-builder-scroll-hand cv-builder-scroll-hand--down"
        aria-label={t("cvBuilder.workspace.scrollBottom")}
        onPointerEnter={() => beginHover("down")}
        onPointerLeave={endHover}
        onClick={() => jumpTo("down")}
      >
        <span aria-hidden="true">👇 ↓</span>
      </button>
    </div>
  );
});

export default CvBuilderScrollHands;
