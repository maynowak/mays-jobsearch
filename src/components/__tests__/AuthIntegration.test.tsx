import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import LoginForm from "../LoginForm";
import RegisterForm from "../RegisterForm";
import Profile from "../Profile";

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../i18n", () => ({
  useLang: () => ({ t: (k: string) => k }),
}));

import { useAuth } from "react-oidc-context";

describe("Auth Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("LoginForm triggers signinRedirect on button click", () => {
    const signinRedirect = vi.fn();
    (useAuth as any).mockReturnValue({ signinRedirect });
    render(<LoginForm />);
    const btns = screen.getAllByRole("button");
    fireEvent.click(btns[0]);
    expect(signinRedirect).toHaveBeenCalled();
  });

  it("RegisterForm renders", () => {
    const signinRedirect = vi.fn();
    (useAuth as any).mockReturnValue({ signinRedirect });
    render(<RegisterForm />);
    expect(screen.getByText("auth.registerTitle")).toBeTruthy();
  });

  it("Profile shows not authenticated message", () => {
    (useAuth as any).mockReturnValue({ isAuthenticated: false, isLoading: false, error: null });
    render(<Profile />);
    expect(screen.getByText("profile.notAuthenticated")).toBeTruthy();
  });

  it("Profile shows user claims when authenticated", () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      error: null,
      user: { profile: { sub: "123", email: "a@b.c", name: "Test" } },
    });
    render(<Profile />);
    expect(screen.getByText("123")).toBeTruthy();
    expect(screen.getByText("a@b.c")).toBeTruthy();
  });
});
