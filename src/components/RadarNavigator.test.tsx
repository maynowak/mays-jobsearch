import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RadarNavigator, { type RadarNavigatorLabels } from "./RadarNavigator";
import type { NavigatorTarget } from "../lib/navigation/radarNavigator";

const labels: RadarNavigatorLabels = {
  aria: "Section navigation",
  open: "Overview",
  close: "Close overview",
  overview: "All sections",
  goTo: (title) => `Go to ${title}`,
};

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

let regionCounter = 0;

function createTargets(count: number): {
  targets: NavigatorTarget[];
  elements: HTMLElement[];
  regionSelector: string;
} {
  regionCounter += 1;
  const region = document.createElement("section");
  region.id = `radar-test-region-${regionCounter}`;
  document.body.append(region);
  setRect(region, 0, 2_000);
  Object.defineProperty(region, "offsetHeight", { configurable: true, value: 2_000 });
  const elements = Array.from({ length: count }, (_, index) => {
    const element = document.createElement("article");
    region.append(element);
    setRect(element, 100 + index * 180, 80 + index * 5);
    return element;
  });
  return {
    elements,
    regionSelector: `#${region.id}`,
    targets: elements.map((element, index) => ({
      id: `section-${index}`,
      title: `Section ${index}`,
      element,
      getElement: () => element,
      status: index === 1 ? "pending" : "normal",
    })),
  };
}

describe("shared RadarNavigator", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders its markers as real buttons and labels as decorative content only", async () => {
    const { targets, regionSelector } = createTargets(3);
    const { container } = render(
      <RadarNavigator targets={targets} labels={labels} navigationKey="a11y" regionSelector={regionSelector} />
    );
    await waitFor(() => expect(container.querySelectorAll("[data-navigator-marker-id]")).toHaveLength(3));
    expect(container.querySelectorAll("[data-navigator-marker-id]")[0].tagName).toBe("BUTTON");

    fireEvent.pointerEnter(container.querySelector(".radar-navigator") as Element);
    await waitFor(() => expect(container.querySelector(".radar-navigator__labels")).not.toBeNull());
    const hoverLabels = container.querySelector(".radar-navigator__labels");
    expect(hoverLabels?.getAttribute("aria-hidden")).toBe("true");
    expect(hoverLabels?.querySelectorAll("button, a, input, select, textarea, [tabindex]")).toHaveLength(0);
  });

  it("does not change the scroll position during initialization", async () => {
    const { targets, regionSelector } = createTargets(3);
    const { container } = render(
      <RadarNavigator targets={targets} labels={labels} navigationKey="initial" regionSelector={regionSelector} />
    );
    await waitFor(() => expect(container.querySelectorAll("[data-navigator-marker-id]")).toHaveLength(3));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps marker buttons focusable for native keyboard activation", async () => {
    const { targets, regionSelector } = createTargets(3);
    const { container } = render(
      <RadarNavigator targets={targets} labels={labels} navigationKey="keyboard" regionSelector={regionSelector} />
    );
    await waitFor(() => expect(container.querySelectorAll("[data-navigator-marker-id]")).toHaveLength(3));
    const marker = container.querySelector('[data-navigator-marker-id="section-1"]') as HTMLButtonElement;
    marker.focus();
    expect(marker).toHaveFocus();
    expect(marker.tagName).toBe("BUTTON");
  });

  it("returns focus to the mobile toggle on Escape", async () => {
    const { targets, regionSelector } = createTargets(3);
    render(<RadarNavigator targets={targets} labels={labels} navigationKey="escape" regionSelector={regionSelector} />);
    const toggle = screen.getByRole("button", { name: "Overview" });
    toggle.focus();
    fireEvent.click(toggle);
    expect(screen.getByRole("dialog", { name: "Section navigation" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Section navigation" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });

  it("navigates to a clicked target with one coordinated scroll", async () => {
    const { targets, regionSelector } = createTargets(3);
    const onBeforeNavigate = vi.fn();
    const { container } = render(
      <RadarNavigator
        targets={targets}
        labels={labels}
        navigationKey="click"
        onBeforeNavigate={onBeforeNavigate}
        regionSelector={regionSelector}
      />
    );
    await waitFor(() => expect(container.querySelectorAll("[data-navigator-marker-id]")).toHaveLength(3));
    fireEvent.click(container.querySelector('[data-navigator-marker-id="section-1"]') as Element);
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledTimes(1));
    expect(onBeforeNavigate).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 200, behavior: "smooth" });
    expect(container.querySelector('[data-navigator-marker-id="section-1"]')?.className).toContain("is-active");
  });

  it("moves forward and backward with the wheel", async () => {
    const { targets, regionSelector } = createTargets(3);
    const { container } = render(
      <RadarNavigator targets={targets} labels={labels} navigationKey="wheel" regionSelector={regionSelector} />
    );
    const radar = container.querySelector(".radar-navigator") as Element;
    await waitFor(() => expect(container.querySelectorAll("[data-navigator-marker-id]")).toHaveLength(3));
    fireEvent.pointerEnter(radar);
    fireEvent.pointerMove(radar, { clientY: 14 });
    await waitFor(() => expect(container.querySelector(".radar-navigator__labels")).not.toBeNull());
    const wheelDown = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    radar.dispatchEvent(wheelDown);
    expect(wheelDown.defaultPrevented).toBe(true);
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled());
    const downActive = container.querySelector("[data-navigator-marker-id].is-active")?.getAttribute("data-navigator-marker-id");
    fireEvent.wheel(radar, { deltaY: -120 });
    await waitFor(() => expect(container.querySelector("[data-navigator-marker-id].is-active")?.getAttribute("data-navigator-marker-id")).not.toBe(downActive));
  });

  it("activates a target that is rendered only after the adapter callback", async () => {
    function AsyncHarness() {
      const [visible, setVisible] = useState(false);
      const target: NavigatorTarget = {
        id: "hidden-section",
        title: "Hidden section",
        getElement: () => document.getElementById("hidden-section"),
        activate: () => setVisible(true),
      };
      return (
        <>
          <RadarNavigator targets={[target]} labels={labels} navigationKey="async" />
          {visible && <section id="hidden-section" />}
        </>
      );
    }
    render(<AsyncHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Hidden section" }));
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Section navigation" })).toBeNull();
  });

  it("renders nothing and attaches no resize listener when disabled", () => {
    const { targets, regionSelector } = createTargets(2);
    const addEventListener = vi.spyOn(window, "addEventListener");
    const { container, unmount } = render(
      <RadarNavigator targets={targets} labels={labels} navigationKey="disabled" regionSelector={regionSelector} enabled={false} />
    );
    expect(container.querySelector(".radar-navigator")).toBeNull();
    expect(addEventListener.mock.calls.filter(([type]) => type === "resize")).toHaveLength(0);
    unmount();
  });

  it("removes the window resize listener on unmount", async () => {
    const { targets, regionSelector } = createTargets(2);
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <RadarNavigator targets={targets} labels={labels} navigationKey="cleanup" regionSelector={regionSelector} />
    );
    await waitFor(() => expect(addEventListener.mock.calls.filter(([type]) => type === "resize")).toHaveLength(1));
    unmount();
    expect(removeEventListener.mock.calls.filter(([type]) => type === "resize")).toHaveLength(1);
  });
});
