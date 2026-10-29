import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LangProvider } from '../i18n';
import DashboardV2 from './DashboardV2';

const renderDashboard = () =>
  render(
    <LangProvider>
      <DashboardV2 />
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
    expect(screen.queryByText(/(?:dashboard\.|profile\.)/)).toBeNull();
  });

  it('updates the active navigation item', () => {
    renderDashboard();

    const navigation = screen.getByRole('navigation', { name: 'Navigieren' });
    fireEvent.click(screen.getByRole('button', { name: 'Mein Profil' }));
    expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent('Mein Profil');
  });
});
