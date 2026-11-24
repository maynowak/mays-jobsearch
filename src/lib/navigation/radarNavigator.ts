export type NavigatorTargetKind = "section" | "review" | "error" | "action";
export type NavigatorTargetStatus = "normal" | "pending" | "completed" | "warning";

/**
 * A target is deliberately data-source agnostic. Match Radar can point at job
 * cards; later CV adapters can activate a filter/page or open a collapsed
 * section before the element becomes available.
 */
export interface NavigatorTarget {
  id: string;
  title: string;
  kind?: NavigatorTargetKind;
  status?: NavigatorTargetStatus;
  statusLabel?: string;
  element?: HTMLElement | null;
  getElement?: () => HTMLElement | null;
  activate?: () => void | Promise<void>;
}

export interface MeasuredNavigatorTarget extends NavigatorTarget {
  element: HTMLElement;
  top: number;
  documentTop: number;
}

export interface NavigatorScrollOptions {
  scrollContainer?: HTMLElement | null;
  offset?: number | (() => number);
  onBeforeScroll?: () => void | Promise<void>;
  elementTimeoutMs?: number;
}

export interface NavigatorAdapter {
  getTargets: () => NavigatorTarget[];
  regionSelector: string;
  scrollContainer?: HTMLElement | null;
  offset?: () => number;
}

const LABEL_GAP = 30;
const RAIL_PADDING = 14;
const DEFAULT_OFFSET = 80;

const elementKeys = new WeakMap<HTMLElement, number>();
let nextElementKey = 1;

function elementKey(element: HTMLElement | null): number {
  if (!element) return 0;
  const existing = elementKeys.get(element);
  if (existing) return existing;
  const key = nextElementKey;
  nextElementKey += 1;
  elementKeys.set(element, key);
  return key;
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

export function isReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function navigatorOffset(): number {
  if (typeof document === "undefined") return DEFAULT_OFFSET;
  const nav = document.querySelector<HTMLElement>(".navbar");
  return (nav?.offsetHeight ?? 64) + 16;
}

function elementOf(target: NavigatorTarget): HTMLElement | null {
  const element = target.getElement?.() ?? target.element ?? null;
  return element && element.isConnected ? element : null;
}

function scrollY(): number {
  return typeof window === "undefined" ? 0 : window.scrollY;
}

function absoluteTop(element: HTMLElement, container?: HTMLElement | null): number {
  const rect = element.getBoundingClientRect();
  if (!container) return rect.top + scrollY();
  const containerRect = container.getBoundingClientRect();
  return rect.top - containerRect.top + container.scrollTop;
}

function resolveOffset(offset?: number | (() => number)): number {
  if (typeof offset === "number") return offset;
  return offset?.() ?? DEFAULT_OFFSET;
}

export function navigatorTargetSignature(targets: NavigatorTarget[]): string {
  return targets.map((target) => {
    const element = target.getElement?.() ?? target.element ?? null;
    return [
      target.id,
      target.title,
      target.kind ?? "",
      target.status ?? "",
      elementKey(element),
    ].join(":");
  }).join("|");
}

export function measureNavigatorTargets(
  targets: NavigatorTarget[],
  region: HTMLElement | null,
  railHeight: number,
  scrollContainer?: HTMLElement | null
): MeasuredNavigatorTarget[] {
  const container = scrollContainer ?? null;
  const regionTop = region ? absoluteTop(region, container) : 0;
  const regionHeight = region
    ? Math.max(1, region === container ? region.scrollHeight : region.offsetHeight)
    : Math.max(1, document.documentElement.scrollHeight, (typeof window !== "undefined" ? window.innerHeight : 0) || 0);
  const usable = Math.max(1, railHeight - RAIL_PADDING * 2);
  const measured: MeasuredNavigatorTarget[] = [];
  for (const target of targets) {
    const element = elementOf(target);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0) continue;
    if (typeof getComputedStyle === "function" && getComputedStyle(element).visibility === "hidden") continue;
    const documentTop = absoluteTop(element, container);
    const relative = Math.max(0, Math.min(1, (documentTop - regionTop) / regionHeight));
    measured.push({
      ...target,
      element,
      documentTop,
      top: RAIL_PADDING + relative * usable,
    });
  }
  return measured.sort((left, right) => left.documentTop - right.documentTop);
}

export function waitForNavigatorElement(target: NavigatorTarget, timeoutMs = 800): Promise<HTMLElement | null> {
  const started = Date.now();
  const requestFrame = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
    ? (callback: () => void) => window.requestAnimationFrame(callback)
    : (callback: () => void) => setTimeout(callback, 16);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (element: HTMLElement | null) => {
      if (settled) return;
      settled = true;
      resolve(element);
    };
    const tick = () => {
      const element = elementOf(target);
      if (element) {
        finish(element);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        finish(null);
        return;
      }
      requestFrame(tick);
    };
    tick();
  });
}

export function scrollNavigatorTarget(
  target: NavigatorTarget,
  options: NavigatorScrollOptions = {}
): boolean {
  const element = elementOf(target);
  if (!element) return false;
  const container = options.scrollContainer ?? null;
  const top = Math.max(0, absoluteTop(element, container) - resolveOffset(options.offset));
  const behavior: ScrollBehavior = isReducedMotion() ? "auto" : "smooth";
  if (container) {
    container.scrollTo({ top, behavior });
  } else if (typeof window !== "undefined") {
    window.scrollTo({ top, behavior });
  }
  return true;
}

export async function activateAndScrollNavigatorTarget(
  target: NavigatorTarget,
  options: NavigatorScrollOptions = {}
): Promise<boolean> {
  await options.onBeforeScroll?.();
  await target.activate?.();
  const element = await waitForNavigatorElement(target, options.elementTimeoutMs);
  if (!element) return false;
  return scrollNavigatorTarget(target, options);
}

export function activeNavigatorTargetId(
  items: MeasuredNavigatorTarget[],
  offset: number,
  viewportTop = 0
): string | null {
  if (items.length === 0) return null;
  let active = items[0];
  for (const item of items) {
    if (item.element.getBoundingClientRect().top <= viewportTop + offset + 24) active = item;
    else break;
  }
  return active.id;
}
