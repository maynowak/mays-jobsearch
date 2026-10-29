import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LangProvider } from '../i18n';
import Navbar from './Navbar';

const authState = vi.hoisted(() => ({
  value: {
    isAuthenticated: false,
    isLoading: false,
    signoutRedirect: vi.fn(),
  },
}));
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock('react-oidc-context', () => ({
  useAuth: () => authState.value,
}));

vi.mock('../lib/authFlow', () => ({
  signOut: signOutMock,
}));

const renderNavbar = (route: 'landing' | 'matcher') =>
  render(
    <LangProvider>
      <Navbar route={route} glass />
    </LangProvider>
  );

describe('MAYS-AUTH-NAVBAR-10: shared auth states', () => {
  beforeEach(() => {
    localStorage.setItem('mj-lang', 'en');
    authState.value = {
      isAuthenticated: false,
      isLoading: false,
      signoutRedirect: vi.fn(),
    };
    signOutMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('landing shows Login and no Alerts when signed out', () => {
    renderNavbar('landing');

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/anmelden');
    expect(screen.queryByText('Alerts')).toBeNull();
  });

  it('search shows Alerts and authenticated Profile plus Logout', () => {
    authState.value = {
      isAuthenticated: true,
      isLoading: false,
      signoutRedirect: vi.fn(),
    };
    renderNavbar('matcher');

    expect(screen.getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/search#alerts');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profil');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(signOutMock).toHaveBeenCalledWith(authState.value);
  });

  it('shows the translated loading state while auth is loading', () => {
    authState.value = {
      isAuthenticated: false,
      isLoading: true,
      signoutRedirect: vi.fn(),
    };
    renderNavbar('landing');

    expect(screen.getByText('Signing in…')).toBeInTheDocument();
  });
});
