import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateAndScrollNavigatorTarget,
  activeNavigatorTargetId,
  measureNavigatorTargets,
  scrollNavigatorTarget,
  waitForNavigatorElement,
  type NavigatorTarget,
} from "./radarNavigator";

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 200,
    width: 200,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function setRect(element: HTMLElement, top: number, height = 100): void {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect(top, height));
}

function makeTarget(element: HTMLElement, index: number): NavigatorTarget {
  return {
    id: `target-${index}`,
    title: `Target ${index}`,
    element,
    getElement: () => element,
  };
}

describe("shared navigator core measurement", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("measures 20 targets with different heights from their real DOM positions", () => {
    const region = document.createElement("section");
    region.id = "matches";
    document.body.append(region);
    setRect(region, 0, 2_000);
    Object.defineProperty(region, "offsetHeight", { configurable: true, value: 2_000 });
    const heights = [42, 88, 51, 120, 74, 63, 99, 45, 81, 57, 110, 66, 49, 92, 71, 58, 104, 47, 84, 62];
    const targets: NavigatorTarget[] = [];
    let top = 100;
    heights.forEach((height, index) => {
      const element = document.createElement("article");
      region.append(element);
      setRect(element, top, height);
      targets.push(makeTarget(element, index));
      top += height + 17;
    });

    const measured = measureNavigatorTargets(targets, region, 400);
    expect(measured).toHaveLength(20);
    measured.forEach((item, index) => {
      const expected = 14 + ((item.documentTop - 0) / 2_000) * (400 - 28);
      expect(item.top).toBeCloseTo(expected, 5);
      expect(item.documentTop).toBe(100 + heights.slice(0, index).reduce((sum, value) => sum + value + 17, 0));
    });
    expect(measured.map((item) => item.id)).toEqual(targets.map((target) => target.id));
  });

  it("recalculates positions after element heights and document positions change", () => {
    const region = document.createElement("section");
    document.body.append(region);
    setRect(region, 0, 1_000);
    Object.defineProperty(region, "offsetHeight", { configurable: true, value: 1_000 });
    const element = document.createElement("article");
    region.append(element);
    setRect(element, 200, 80);
    const target = makeTarget(element, 0);

    const before = measureNavigatorTargets([target], region, 300)[0];
    setRect(element, 700, 160);
    const after = measureNavigatorTargets([target], region, 300)[0];
    expect(after.top).toBeGreaterThan(before.top);
    expect(after.documentTop).toBe(700);
  });

  it("measures targets inside an independently scrolling container", () => {
    const container = document.createElement("section");
    document.body.append(container);
    setRect(container, 50, 400);
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 1_000 });
    Object.defineProperty(container, "scrollTop", { configurable: true, value: 100 });
    const element = document.createElement("article");
    container.append(element);
    setRect(element, 150, 80);
    const measured = measureNavigatorTargets([makeTarget(element, 0)], container, 300, container);
    expect(measured[0].documentTop).toBe(200);
    expect(measured[0].top).toBeCloseTo(14 + (100 / 1_000) * (300 - 28), 5);
  });

  it("ignores empty and removed DOM elements without throwing", () => {
    const detached = document.createElement("article");
    setRect(detached, 100, 80);
    const target = makeTarget(detached, 0);
    expect(measureNavigatorTargets([target], null, 300)).toEqual([]);
    expect(activeNavigatorTargetId([], 80)).toBeNull();
  });

  it("selects the active target from current DOM positions", () => {
    const region = document.createElement("section");
    document.body.append(region);
    setRect(region, 0, 2_000);
    Object.defineProperty(region, "offsetHeight", { configurable: true, value: 2_000 });
    const elements = [100, 500, 900].map((top, index) => {
      const element = document.createElement("article");
      region.append(element);
      setRect(element, top, 80);
      return makeTarget(element, index);
    });
    const items = measureNavigatorTargets(elements, region, 400);
    expect(activeNavigatorTargetId(items, 80)).toBe("target-0");
    setRect(elements[0].element as HTMLElement, -200, 80);
    setRect(elements[1].element as HTMLElement, 80, 80);
    const updated = measureNavigatorTargets(elements, region, 400);
    expect(activeNavigatorTargetId(updated, 80)).toBe("target-1");
  });
});

describe("shared navigator core scrolling and dynamic adapters", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it("scrolls the browser window to the correct target offset", () => {
    const element = document.createElement("article");
    document.body.append(element);
    setRect(element, 1_200, 80);
    const target = makeTarget(element, 0);
    expect(scrollNavigatorTarget(target, { offset: () => 80 })).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1_120, behavior: "smooth" });
  });

  it("scrolls an independently scrolling container", () => {
    const container = document.createElement("div");
    document.body.append(container);
    setRect(container, 50, 500);
    Object.defineProperty(container, "scrollTop", { configurable: true, value: 100 });
    const scrollTo = vi.fn();
    Object.defineProperty(container, "scrollTo", { configurable: true, value: scrollTo });
    const element = document.createElement("article");
    container.append(element);
    setRect(element, 400, 80);
    const target = makeTarget(element, 0);

    expect(scrollNavigatorTarget(target, { scrollContainer: container, offset: 80 })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 370, behavior: "smooth" });
  });

  it("activates a not-yet-rendered target, waits for rendering and then scrolls", async () => {
    let element: HTMLElement | null = null;
    const target: NavigatorTarget = {
      id: "async-review",
      title: "Review",
      getElement: () => element,
      activate: () => {
        element = document.createElement("article");
        document.body.append(element);
        setRect(element, 700, 80);
      },
    };

    const result = await activateAndScrollNavigatorTarget(target, {
      offset: 80,
      elementTimeoutMs: 50,
    });
    expect(result).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 620, behavior: "smooth" });
  });

  it("opens a collapsed test section before resolving its element", async () => {
    const section = document.createElement("section");
    document.body.append(section);
    let open = false;
    const target: NavigatorTarget = {
      id: "collapsed",
      title: "Collapsed section",
      getElement: () => open ? section : null,
      activate: () => {
        open = true;
        setRect(section, 300, 80);
      },
    };

    await expect(activateAndScrollNavigatorTarget(target, {
      offset: 40,
      elementTimeoutMs: 20,
    })).resolves.toBe(true);
    expect(open).toBe(true);
  });

  it("fails closed for a removed target without throwing", async () => {
    const element = document.createElement("article");
    const target = makeTarget(element, 0);
    setRect(element, 300, 80);
    expect(await waitForNavigatorElement(target, 10)).toBeNull();
    expect(await activateAndScrollNavigatorTarget(target, { elementTimeoutMs: 10 })).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("honours reduced motion instead of smooth scrolling", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const element = document.createElement("article");
    document.body.append(element);
    setRect(element, 500, 80);
    scrollNavigatorTarget(makeTarget(element, 0), { offset: 20 });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 480, behavior: "auto" });
  });
});
