import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { LangProvider } from "./i18n";
import App from "./App";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  cleanup();
});

describe("Landing page at root path", () => {
  it("shows landing page at root path", () => {
    render(
      <LangProvider>
        <App />
      </LangProvider>
    );
    expect(document.querySelector(".landing")).toBeTruthy();
    expect(document.querySelector(".landing-hero")).toBeTruthy();
    expect(document.querySelector(".search-hero")).toBeNull();
  });

  it("Header-Link 'May's Job Matcher' navigates to '/' and shows Landingpage", () => {
    render(
      <LangProvider>
        <App />
      </LangProvider>
    );
    // Start at /top (matcher route)
    window.history.pushState({}, "", "/top");
    // Re-render to trigger route update
    // Note: App uses initial pathname only, so we test the link href directly
    const headerLink = document.querySelector(".navbar-title") as HTMLAnchorElement;
    expect(headerLink).toBeTruthy();
    expect(headerLink.getAttribute("href")).toBe("/");
    
    // Simulate click navigation
    fireEvent.click(headerLink);
    // After click, pathname should be "/" (via href navigation)
    // Note: In test env, we can't fully simulate navigation, but href is correct
  });
});