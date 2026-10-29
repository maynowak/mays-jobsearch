import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LangProvider } from '../i18n';
import DashboardV2, { DEMO_USER } from './DashboardV2';

const renderDashboard = () =>
  render(
    <LangProvider>
      <DashboardV2 user={DEMO_USER} isDemo />
    </LangProvider>
  );

describe('MAYS-UI-S2: Aurora dashboard preview', () => {
  beforeEach(() => {
    localStorage.setItem('mj-lang', 'de');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the complete translated demo content', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Profil' })).toBeTruthy();
    expect(screen.getByText('dev@example.com')).toBeTruthy();
    expect(screen.getByText('dev-demo-user-123')).toBeTruthy();
    expect(screen.getByText('Konto-Status')).toBeTruthy();
    expect(screen.getByText('Zukünftige Funktionen')).toBeTruthy();
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Authentifiziert')).toBeNull();
    expect(screen.queryByText('Modalität')).toBeNull();
    expect(screen.getByRole('button', { name: /Lebenslauf/ })).toBeDisabled();
    expect(screen.queryByText(/(?:dashboard\.|profile\.)/)).toBeNull();
  });

  it('updates the active navigation item', () => {
    renderDashboard();

    const navigation = screen.getByRole('navigation', { name: 'Navigieren' });
    fireEvent.click(screen.getByRole('button', { name: 'Mein Profil' }));
    expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent('Mein Profil');
  });

  it('keeps the demo status neutral in English as well', () => {
    localStorage.setItem('mj-lang', 'en');
    renderDashboard();

    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Authenticated')).toBeNull();
    expect(screen.queryByText('Modality')).toBeNull();
  });

  it('renders supplied authenticated claims and invokes logout without demo markers', () => {
    const onLogout = () => undefined;
    render(
      <LangProvider>
        <DashboardV2
          user={{ email: 'person@example.invalid', sub: 'subject-123', name: 'Realistic Test User' }}
          isDemo={false}
          onLogout={onLogout}
        />
      </LangProvider>
    );

    expect(screen.getByText('person@example.invalid')).toBeTruthy();
    expect(screen.getByText('subject-123')).toBeTruthy();
    expect(screen.getByText('Realistic Test User')).toBeTruthy();
    expect(screen.queryByText('DEV-MODUS: Demo-Daten')).toBeNull();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
  });

  it('renders a neutral fallback for missing claims', () => {
    render(
      <LangProvider>
        <DashboardV2 user={{}} isDemo={false} />
      </LangProvider>
    );

    expect(screen.getAllByText('-')).toHaveLength(3);
  });
});
