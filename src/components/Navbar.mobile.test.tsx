import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "../i18n";
import Navbar from "./Navbar";

const authState = vi.hoisted(() => ({
  value: {
    isAuthenticated: false,
    isLoading: false,
    signoutRedirect: vi.fn(),
  },
}));
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("react-oidc-context", () => ({
  useAuth: () => authState.value,
}));

vi.mock("../lib/authFlow", () => ({
  signOut: signOutMock,
}));

function setMobile(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches,
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

function renderMobile(onNavigate = vi.fn()) {
  return render(
    <LangProvider>
      <Navbar route="matcher" glass onNavigate={onNavigate} />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
  setMobile(true);
  authState.value = {
    isAuthenticated: false,
    isLoading: false,
    signoutRedirect: vi.fn(),
  };
  signOutMock.mockClear();
});

afterEach(() => {
  cleanup();
  setMobile(false);
});

describe("JM-MOBILE-NAV-UX-01: mobile guest navigation", () => {
  it("renders only brand and hamburger outside the menu", () => {
    renderMobile();

    expect(screen.getByText(/May.s Job Matcher/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menü öffnen" })).toBeInTheDocument();
    expect(document.querySelector(".nav-links")).toBeNull();
    expect(document.querySelector(".nav-right")).toBeNull();
    expect(document.querySelector(".nav-lang")).toBeNull();
    expect(screen.queryByRole("link", { name: "Anmelden" })).toBeNull();
  });

  it("opens one menu with links, language and exactly one login action", () => {
    renderMobile();
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));

    const menu = screen.getByRole("dialog", { name: "Hauptnavigation" });
    expect(within(menu).getByRole("link", { name: "Suche" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Benachrichtigungen" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Anmelden" })).toHaveAttribute(
      "href",
      "/anmelden"
    );
    expect(within(menu).getByRole("button", { name: "EN" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "DE" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Anmelden" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Profil" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Logout" })).toBeNull();
    expect(within(menu).getByRole("link", { name: "Suche" })).toHaveFocus();
  });

  it("toggles closed through the same hamburger button", async () => {
    renderMobile();
    const burger = screen.getByRole("button", { name: "Menü öffnen" });
    fireEvent.click(burger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menü schließen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape, outside click and navigation", async () => {
    const onNavigate = vi.fn();
    renderMobile(onNavigate);

    const burger = screen.getByRole("button", { name: "Menü öffnen" });
    fireEvent.click(burger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(burger).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    fireEvent.click(document.querySelector(".mobile-overlay") as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    fireEvent.click(screen.getByRole("link", { name: "Suche" }));
    expect(onNavigate).toHaveBeenCalledWith("/search");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps keyboard focus inside the mobile menu", () => {
    renderMobile();
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    const menu = screen.getByRole("dialog");
    const first = within(menu).getByRole("link", { name: "Suche" });
    const last = within(menu).getByRole("link", { name: "Anmelden" });

    first.focus();
    fireEvent.keyDown(menu, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    last.focus();
    fireEvent.keyDown(menu, { key: "Tab" });
    expect(first).toHaveFocus();
  });
});

describe("JM-MOBILE-NAV-UX-01: mobile authenticated navigation", () => {
  it("shows profile and one logout action, then closes on logout", () => {
    authState.value = {
      isAuthenticated: true,
      isLoading: false,
      signoutRedirect: vi.fn(),
    };
    renderMobile();

    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    const menu = screen.getByRole("dialog");
    expect(within(menu).getByRole("link", { name: "Profil" })).toHaveAttribute(
      "href",
      "/profil"
    );
    expect(within(menu).getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Anmelden" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Logout" })).toHaveLength(1);

    fireEvent.click(within(menu).getByRole("button", { name: "Logout" }));
    expect(signOutMock).toHaveBeenCalledWith(authState.value);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("updates the menu after an auth state change", () => {
    const view = renderMobile();
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByRole("link", { name: "Anmelden" })).toBeInTheDocument();

    authState.value = {
      isAuthenticated: true,
      isLoading: false,
      signoutRedirect: vi.fn(),
    };
    view.rerender(
      <LangProvider>
        <Navbar route="matcher" glass />
      </LangProvider>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByRole("link", { name: "Profil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });
});
