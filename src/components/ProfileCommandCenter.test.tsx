import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LangProvider } from '../i18n';
import DashboardV2, { DEMO_USER } from './DashboardV2';

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

const renderProfile = (lang = 'de') => {
  localStorage.setItem('mj-lang', lang);
  return render(
    <LangProvider>
      <DashboardV2
        user={DEMO_USER}
        isDemo
        cvSection={<section aria-label="Lebenslauf-Inhalt">CV</section>}
        applicationsSection={<section aria-label="Bewerbungen-Inhalt">Apps</section>}
        preferencesSection={<section aria-label="Suchprofil-Inhalt">Prefs</section>}
      />
    </LangProvider>
  );
};

describe('JM-PROFILE-UX-01: Profile Command Center shell', () => {
  beforeEach(() => {
    localStorage.setItem('mj-lang', 'de');
    window.history.replaceState({}, '', '/profil');
  });

  afterEach(() => cleanup());

  it('applies the shared command-center shell only to profile/dashboard routes', () => {
    expect(app.match(/layout-profile-command/g)).toHaveLength(3);
    expect(css).toContain('.container.layout-dashboard.layout-profile-command');
    expect(css).toContain('job-matcher-next-step-searchpage.webp');
    expect(css).toContain('.layout-profile-command .dashboard-v2__navigation-card');
    expect(css).toContain('.layout-profile-command .aurora-sidebar-item.aurora-sidebar-active');
    expect(css).toContain('.layout-profile-command .storage-consent');
    expect(css).toContain('.layout-profile-command .applications-section');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps the semantic active state while switching profile sections', () => {
    renderProfile();
    const navigation = screen.getByRole('navigation', { name: 'Navigieren' });
    expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent('Übersicht');

    fireEvent.click(screen.getByRole('button', { name: 'Bewerbungen' }));
    expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent('Bewerbungen');
    expect(screen.getByRole('region', { name: 'Bewerbungen-Inhalt' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(navigation.querySelector('[aria-current="page"]')).toHaveTextContent('Einstellungen');
  });

  it('provides native keyboard-focusable navigation buttons and the mobile switcher', () => {
    renderProfile();
    const navigation = screen.getByRole('navigation', { name: 'Navigieren' });
    for (const button of within(navigation).getAllByRole('button')) {
      expect(button).toHaveProperty('tabIndex', 0);
    }
    const switcher = screen.getByLabelText('Dashboard-Bereich wählen') as HTMLSelectElement;
    expect(switcher).toBeInTheDocument();
    fireEvent.change(switcher, { target: { value: 'preferences' } });
    expect(screen.getByRole('region', { name: 'Suchprofil-Inhalt' })).toBeInTheDocument();
  });

  it('keeps the English navigation labels available', () => {
    renderProfile('en');
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });
});
