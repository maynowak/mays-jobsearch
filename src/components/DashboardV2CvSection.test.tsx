import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LangProvider } from '../i18n';
import {
  resetCvProfileLists,
  saveCvAtsProfile,
  saveCvSearchProfile,
} from '../lib/cvProfileStore';
import type { CvDocument } from '../types';
import DashboardV2CvSection from './DashboardV2CvSection';

const makeDocument = (id: string, name: string, hash: string, skills: string[]): CvDocument => ({
  id,
  name,
  size: 100,
  selected: id === 'cv-a',
  file: new File(['pdf'], `${name}.pdf`, { type: 'application/pdf' }),
  hash,
  skills,
});

const renderSection = (documents: CvDocument[]) => {
  const onSelectDocument = vi.fn();
  const onSelectSearchProfile = vi.fn();
  const onSelectAtsProfile = vi.fn();
  const view = render(
    <LangProvider>
      <DashboardV2CvSection
        documents={documents}
        selectedDocumentId={documents[0]?.id ?? null}
        selectedSearchProfileId={null}
        selectedAtsProfileId={null}
        processing={false}
        searching={false}
        onSelectDocument={onSelectDocument}
        onRemoveDocument={vi.fn()}
        onAddFiles={vi.fn()}
        onProcess={vi.fn()}
        onSearch={vi.fn()}
        onRemoveData={vi.fn()}
        onSelectSearchProfile={onSelectSearchProfile}
        onSelectAtsProfile={onSelectAtsProfile}
      />
    </LangProvider>
  );
  return { ...view, onSelectDocument, onSelectSearchProfile, onSelectAtsProfile };
};

describe('MAYS-UI-S5.2-A: Dashboard CV section', () => {
  beforeEach(() => {
    localStorage.setItem('mj-lang', 'de');
    resetCvProfileLists();
  });

  afterEach(() => {
    cleanup();
    resetCvProfileLists();
  });

  it('keeps parser and profile data isolated by selected CV hash', () => {
    const cvA = makeDocument('cv-a', 'A', 'hash-a', ['TypeScript']);
    const cvB = makeDocument('cv-b', 'B', 'hash-b', ['Python']);
    saveCvSearchProfile('hash-a', 'A Suche', {
      skills: 'TypeScript', targetRoles: ['Frontend'], city: 'Berlin', radiusKm: 25,
      workModes: ['hybrid'], employmentTypes: ['full_time'],
    });
    saveCvAtsProfile('hash-a', 'A ATS', ['TypeScript'], ['Frontend']);
    saveCvSearchProfile('hash-b', 'B Suche', {
      skills: 'Python', targetRoles: ['Backend'], city: 'Hamburg', radiusKm: 50,
      workModes: ['remote'], employmentTypes: ['part_time'],
    });

    const view = renderSection([cvA, cvB]);
    const { onSelectSearchProfile } = view;
    expect(screen.getByText('TypeScript')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'A Suche' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'B Suche' })).toBeNull();

    fireEvent.change(document.getElementById('dashboard-v2-cv-picker')!, { target: { value: 'cv-b' } });
    view.rerender(
      <LangProvider>
        <DashboardV2CvSection
          documents={[cvA, cvB]}
          selectedDocumentId="cv-b"
          selectedSearchProfileId={null}
          selectedAtsProfileId={null}
          processing={false}
          searching={false}
          onSelectDocument={view.onSelectDocument}
          onRemoveDocument={vi.fn()}
          onAddFiles={vi.fn()}
          onProcess={vi.fn()}
          onSearch={vi.fn()}
          onRemoveData={vi.fn()}
          onSelectSearchProfile={view.onSelectSearchProfile}
          onSelectAtsProfile={view.onSelectAtsProfile}
        />
      </LangProvider>
    );
    expect(screen.getByText('Python')).toBeTruthy();
    expect(screen.queryByText('TypeScript')).toBeNull();
    expect(screen.getByRole('option', { name: 'B Suche' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'A Suche' })).toBeNull();
    expect(onSelectSearchProfile).not.toHaveBeenCalled();
  });

  it('switches existing profile selections without starting analysis', () => {
    const cvA = makeDocument('cv-a', 'A', 'hash-a', ['TypeScript']);
    saveCvSearchProfile('hash-a', 'A Suche', {
      skills: 'TypeScript', targetRoles: ['Frontend'], city: 'Berlin', radiusKm: null,
      workModes: [], employmentTypes: ['full_time'],
    });
    saveCvAtsProfile('hash-a', 'A ATS', ['TypeScript'], ['Frontend']);
    const { onSelectSearchProfile, onSelectAtsProfile } = renderSection([cvA]);

    fireEvent.change(screen.getByLabelText('Suchprofil dieses Lebenslaufs'), { target: { value: 'entry-ignored' } });
    fireEvent.change(screen.getByLabelText('ATS-Profil dieses Lebenslaufs'), { target: { value: 'entry-ignored' } });
    expect(onSelectSearchProfile).toHaveBeenCalledTimes(1);
    expect(onSelectAtsProfile).toHaveBeenCalledTimes(1);
  });

  it('shows only the active CV profiles and has no dashboard checkboxes', () => {
    const cvA = makeDocument('cv-a', 'A', 'hash-a', ['TypeScript']);
    const cvB = makeDocument('cv-b', 'B', 'hash-b', ['Python']);
    const searchA1 = saveCvSearchProfile('hash-a', 'A Suche 1', {
      skills: 'TypeScript', targetRoles: ['Frontend'], city: 'Berlin', radiusKm: null,
      workModes: [], employmentTypes: ['full_time'],
    });
    saveCvSearchProfile('hash-a', 'A Suche 2', {
      skills: 'TypeScript, React', targetRoles: ['Full Stack'], city: 'Berlin', radiusKm: null,
      workModes: [], employmentTypes: ['full_time'],
    });
    saveCvAtsProfile('hash-a', 'A ATS 1', ['TypeScript'], ['Frontend'], searchA1?.id ?? null);
    saveCvAtsProfile('hash-a', 'A ATS 2', ['React'], ['Full Stack'], searchA1?.id ?? null);
    saveCvSearchProfile('hash-b', 'B Suche 1', {
      skills: 'Python', targetRoles: ['Backend'], city: 'Hamburg', radiusKm: null,
      workModes: [], employmentTypes: ['full_time'],
    });
    saveCvSearchProfile('hash-b', 'B Suche 2', {
      skills: 'Python, Django', targetRoles: ['API'], city: 'Hamburg', radiusKm: null,
      workModes: [], employmentTypes: ['full_time'],
    });

    const view = renderSection([cvA, cvB]);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Diesen CV verarbeiten' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'A Suche 1' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'A Suche 2' })).toBeTruthy();

    fireEvent.change(document.getElementById('dashboard-v2-cv-picker')!, { target: { value: 'cv-b' } });
    view.rerender(
      <LangProvider>
        <DashboardV2CvSection
          documents={[cvA, cvB]}
          selectedDocumentId="cv-b"
          selectedSearchProfileId={null}
          selectedAtsProfileId={null}
          processing={false}
          searching={false}
          onSelectDocument={view.onSelectDocument}
          onRemoveDocument={vi.fn()}
          onAddFiles={vi.fn()}
          onProcess={vi.fn()}
          onSearch={vi.fn()}
          onRemoveData={vi.fn()}
          onSelectSearchProfile={view.onSelectSearchProfile}
          onSelectAtsProfile={view.onSelectAtsProfile}
        />
      </LangProvider>
    );
    expect(screen.getByRole('option', { name: 'B Suche 1' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'B Suche 2' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'A Suche 1' })).toBeNull();
  });
});
