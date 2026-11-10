import { describe, expect, it } from 'vitest';
import {
  hasCvBuilderImportContent,
  parseCvBuilderImportText,
  selectCvBuilderImportDraft,
} from './pdfImport';

const germanCv = `Max Mustermann
E-Mail: max@example.com
Telefon: +49 170 1234567
Ort: Berlin

Profil
Senior Frontend Engineer
Entwickelt barrierefreie React-Anwendungen.

Berufserfahrung
Acme GmbH
Senior Frontend Engineer
Jan 2020 – Present
- React und TypeScript
- Barrierefreie Komponenten

Beta AG
Frontend Developer
2018 – 2019
- Vue und CSS

Ausbildung
Technische Universität Berlin
M.Sc. Informatik
Okt 2014 – Sep 2016

Fähigkeiten
React, TypeScript, Node.js, AWS

Projekte
Job Matcher
Barrierefreie Suchoberfläche.
Technologien: React, TypeScript

Zertifikate
AWS Certified Developer | Amazon Web Services | Mär 2022

Sprachen
Deutsch (Muttersprache)
Englisch (fließend)

Links
https://github.com/max
https://www.linkedin.com/in/max`;

describe('parseCvBuilderImportText', () => {
  it('parses German CV sections without inventing missing data', () => {
    const result = parseCvBuilderImportText(germanCv);
    expect(result.draft.personal).toEqual({
      fullName: 'Max Mustermann',
      email: 'max@example.com',
      phone: '+49 170 1234567',
      location: 'Berlin',
    });
    expect(result.draft.profile.headline).toBe('Senior Frontend Engineer');
    expect(result.draft.experience).toHaveLength(2);
    expect(result.draft.experience[0]).toMatchObject({
      employer: 'Acme GmbH',
      position: 'Senior Frontend Engineer',
      startMonth: '2020-01',
      current: true,
    });
    expect(result.draft.experience[1].startMonth).toBe('');
    expect(result.uncertain.education).toBe(false);
    expect(result.draft.education[0]).toMatchObject({
      institution: 'Technische Universität Berlin',
      degree: 'M.Sc. Informatik',
      startMonth: '2014-10',
      endMonth: '2016-09',
    });
    expect(result.draft.skills).toEqual(['React', 'TypeScript', 'Node.js', 'AWS']);
    expect(result.draft.projects[0]).toMatchObject({
      name: 'Job Matcher',
      technologies: ['React', 'TypeScript'],
    });
    expect(result.draft.certificates[0]).toMatchObject({
      name: 'AWS Certified Developer',
      issuer: 'Amazon Web Services',
      date: '2022-03',
    });
    expect(result.draft.languages.map((entry) => [entry.language, entry.level])).toEqual([
      ['Deutsch', 'native'],
      ['Englisch', 'fluent'],
    ]);
    expect(result.draft.links.map((entry) => entry.kind)).toEqual(['github', 'linkedin']);
  });

  it('parses English headings and marks an incomplete date as uncertain', () => {
    const result = parseCvBuilderImportText(`Jane Doe
Email: jane@example.com

Profile
Backend Engineer
Builds reliable services.

Work Experience
Acme Ltd
Backend Engineer
2021 - 2022
- Node.js

Education
University of Berlin
B.Sc. Computer Science
2017 - 2020

Skills
Node.js; PostgreSQL; AWS

Projects
API Platform
Internal API.
Tech: Node.js, PostgreSQL

Certifications
AWS Certified Developer | Amazon Web Services | 2022

Languages
English (native)
German (professional)

Links
https://github.com/jane`);

    expect(result.draft.personal.fullName).toBe('Jane Doe');
    expect(result.draft.profile.headline).toBe('Backend Engineer');
    expect(result.draft.experience[0].startMonth).toBe('');
    expect(result.uncertain.experience).toBe(true);
    expect(result.draft.education[0].startMonth).toBe('');
    expect(result.draft.projects[0].technologies).toEqual(['Node.js', 'PostgreSQL']);
    expect(result.draft.certificates[0].date).toBeUndefined();
    expect(result.draft.languages).toHaveLength(2);
  });

  it('keeps unknown and ambiguous lines separate', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.com

Sonstiges
Publiziert gelegentlich Fachartikel.

Sprachen
Deutsch ohne Niveauangabe`);
    expect(result.draft.languages).toHaveLength(0);
    expect(result.unrecognized.join('\n')).toContain('Deutsch ohne Niveauangabe');
    expect(result.unrecognized.join('\n')).toContain('Publiziert gelegentlich Fachartikel.');
  });

  it('returns an empty draft for text without recognisable sections', () => {
    const result = parseCvBuilderImportText('Nur ein unstrukturierter Satz.');
    expect(result.draft.personal).toEqual({});
    expect(result.draft.experience).toEqual([]);
    expect(result.unrecognized).toContain('Nur ein unstrukturierter Satz.');
  });

  it('selects only confirmed sections and optionally appends unassigned lines', () => {
    const result = parseCvBuilderImportText(`${germanCv}

Sonstiges
Zusätzliche Information`);
    const draft = selectCvBuilderImportDraft(result, ['personal', 'skills'], true);
    expect(draft.personal.fullName).toBe('Max Mustermann');
    expect(draft.skills).toEqual(['React', 'TypeScript', 'Node.js', 'AWS']);
    expect(draft.experience).toEqual([]);
    expect(draft.profile.summary).toContain('Weitere Angaben aus dem Import');
    expect(hasCvBuilderImportContent(result, 'experience')).toBe(true);
  });
});
