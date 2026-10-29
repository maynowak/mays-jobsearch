import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LangProvider } from '../i18n';
import DashboardV2AuthenticatedPreview from './DashboardV2AuthenticatedPreview';

interface MockAuth {
  isLoading: boolean;
  isAuthenticated: boolean;
  error?: Error;
  user?: { profile: { sub?: string; email?: string; name?: string } };
  signinRedirect: ReturnType<typeof vi.fn>;
  signoutRedirect: ReturnType<typeof vi.fn>;
}

const authState = vi.hoisted(() => ({
  value: {
    isLoading: false,
    isAuthenticated: false,
    error: undefined,
    user: undefined,
    signinRedirect: vi.fn(),
    signoutRedirect: vi.fn(),
  } as MockAuth,
}));
const signInMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock('react-oidc-context', () => ({
  useAuth: () => authState.value,
}));

vi.mock('../lib/authFlow', () => ({
  signIn: signInMock,
  signOut: signOutMock,
}));

const renderPreview = () =>
  render(
    <LangProvider>
      <DashboardV2AuthenticatedPreview />
    </LangProvider>
  );

describe('MAYS-UI-S3: authenticated dashboard preview', () => {
  beforeEach(() => {
    localStorage.setItem('mj-lang', 'de');
    authState.value = {
      isLoading: false,
      isAuthenticated: false,
      error: undefined,
      user: undefined,
      signinRedirect: vi.fn(),
      signoutRedirect: vi.fn(),
    };
    signInMock.mockClear();
    signOutMock.mockClear();
  });

  afterEach(() => cleanup());

  it('shows a login prompt without demo claims while signed out', () => {
    renderPreview();
    expect(screen.getByText('Du bist nicht angemeldet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(signInMock).toHaveBeenCalledWith(authState.value);
    expect(screen.queryByText('dev@example.com')).toBeNull();
  });

  it('renders existing claims and routes logout through signOut', () => {
    authState.value = {
      isLoading: false,
      isAuthenticated: true,
      error: undefined,
      user: { profile: { sub: 'auth-sub', email: 'auth@example.invalid', name: 'Auth Test User' } },
      signinRedirect: vi.fn(),
      signoutRedirect: vi.fn(),
    };
    renderPreview();
    expect(screen.getByText('auth@example.invalid')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(signOutMock).toHaveBeenCalledWith(authState.value);
    expect(screen.queryByText('DEV-MODUS: Demo-Daten')).toBeNull();
  });

  it('covers loading and auth-error states', () => {
    authState.value = { ...authState.value, isLoading: true };
    renderPreview();
    expect(screen.getByRole('status')).toHaveTextContent('Lade Benutzerdaten…');
    cleanup();

    authState.value = { ...authState.value, isLoading: false, error: new Error('mock') };
    renderPreview();
    expect(screen.getByRole('alert')).toHaveTextContent('Etwas ist schiefgelaufen.');
  });
});
