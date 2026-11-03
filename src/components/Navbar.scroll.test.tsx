import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Navbar from "./Navbar";
import { LangProvider } from "../i18n";

const originalScrollTo = window.scrollTo;

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value });
}

function setViewportMetrics(scrollHeight = 3000, innerHeight = 800) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
}

function setMatchMedia(mobile = false, reducedMotion = false) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("max-width: 767px") ? mobile : reducedMotion,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderNavbar() {
  return render(
    <LangProvider>
      <Navbar route="matcher" glass />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  setScrollY(0);
  setViewportMetrics();
  setMatchMedia();
  window.scrollTo = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    window.setTimeout(() => callback(0), 0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.scrollTo = originalScrollTo;
  setScrollY(0);
  localStorage.clear();
});

describe("JM-NAV-SCROLL-UX-02: direction-aware navbar", () => {
  it("hides after a deliberate downward scroll and reveals on a short upward move", async () => {
    renderNavbar();
    const header = document.querySelector("header.navbar") as HTMLElement;

    setScrollY(1000);
    fireEvent.scroll(window);
    await waitFor(() => expect(header.className).toContain("scrolled"));

    setScrollY(980);
    fireEvent.scroll(window);
    await waitFor(() => expect(header.className).not.toContain("scrolled"));
  });

  it("ignores small upward noise and reveals at the top", async () => {
    renderNavbar();
    const header = document.querySelector("header.navbar") as HTMLElement;

    setScrollY(1000);
    fireEvent.scroll(window);
    await waitFor(() => expect(header.className).toContain("scrolled"));

    setScrollY(997);
    fireEvent.scroll(window);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(header.className).toContain("scrolled");

    setScrollY(0);
    fireEvent.scroll(window);
    await waitFor(() => expect(header.className).not.toContain("scrolled"));
  });

  it("keeps the navbar visible while the mobile menu is open", async () => {
    setMatchMedia(true);
    renderNavbar();
    const header = document.querySelector("header.navbar") as HTMLElement;
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    setScrollY(1000);
    fireEvent.scroll(window);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(header.className).not.toContain("scrolled");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the navbar when keyboard focus enters it", async () => {
    renderNavbar();
    const header = document.querySelector("header.navbar") as HTMLElement;
    setScrollY(1000);
    fireEvent.scroll(window);
    await waitFor(() => expect(header.className).toContain("scrolled"));

    fireEvent.focus(screen.getByText(/May.s Job Matcher/));
    await waitFor(() => expect(header.className).not.toContain("scrolled"));
  });

  it("shows a 44px back-to-top button after deep scrolling and scrolls without a route change", async () => {
    renderNavbar();
    setScrollY(1200);
    fireEvent.scroll(window);
    const button = await screen.findByRole("button", { name: "Nach oben" });
    expect(button).toHaveClass("back-to-top");

    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("uses immediate scrolling when reduced motion is requested", async () => {
    setMatchMedia(false, true);
    renderNavbar();
    setScrollY(1200);
    fireEvent.scroll(window);
    const button = await screen.findByRole("button", { name: "Nach oben" });
    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
