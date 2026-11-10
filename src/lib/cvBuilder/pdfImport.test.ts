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
    const firstUnassigned = result.unrecognized[0];
    const draft = selectCvBuilderImportDraft(result, ['personal', 'skills'], { 0: 'profile' });
    expect(draft.personal.fullName).toBe('Max Mustermann');
    expect(draft.skills).toEqual(['React', 'TypeScript', 'Node.js', 'AWS']);
    expect(draft.experience).toEqual([]);
    expect(draft.profile.summary).toBe(firstUnassigned);
    expect(hasCvBuilderImportContent(result, 'experience')).toBe(true);
  });
});

const reference01B = `Alex Beispiel
E-Mail: alex@example.invalid
GitHub: https://github.com/alex

Profil
Cloud Platform Engineer
Baut sichere Cloud-Plattformen.

Technical Skills
Java EE/J2EE, Spring Boot, REST APIs, PostgreSQL, AWS Lambda, Terraform
Developed a custom analytics dashboard with React and Node.js
2022

Selected Current Projects
RIS Integration
Mehrzeilige Projektbeschreibung für die Anbindung an das RIS.
Technologien: TypeScript, AWS Lambda, Terraform
https://github.com/alex/ris-integration

Professional Experience
Acme GmbH
Cloud Platform Engineer
Jan 2020 - Present
- Betrieb einer AWS-Plattform
- Terraform und Kubernetes

AI/Automation Lab
2023 - 2024
Entwicklung eines internen Automatisierungs-Labors.

Further Education
AWS Certified Solutions Architect | Amazon Web Services | 2023

Education and Qualifications
Technische Universitaet Berlin
M.Sc. Informatik
Okt 2014 - Sep 2016`;

describe('parseCvBuilderImportText 01B quality', () => {
  it('closes skills before a project section and filters sentence fragments', () => {
    const result = parseCvBuilderImportText(reference01B);
    expect(result.detected.projects).toBe(true);
    expect(result.detected.skills).toBe(true);
    expect(result.draft.projects).toHaveLength(1);
    expect(result.draft.projects[0].name).toBe('RIS Integration');
    expect(result.draft.projects[0].description).toContain('Mehrzeilige Projektbeschreibung');
    expect(result.draft.projects[0].technologies).toEqual([
      'TypeScript', 'AWS Lambda', 'Terraform',
    ]);
    expect(result.draft.skills).toEqual([
      'Java EE/J2EE', 'Spring Boot', 'REST APIs', 'PostgreSQL', 'AWS Lambda', 'Terraform',
    ]);
    expect(result.draft.skills).not.toContain('Developed a custom analytics dashboard with React and Node.js');
    expect(result.draft.skills).not.toContain('2022');
    expect(result.unrecognized.join('\n')).toContain('Developed a custom analytics dashboard');
  });

  it('does not classify a dated lab/course block as employment', () => {
    const result = parseCvBuilderImportText(reference01B);
    expect(result.draft.experience).toHaveLength(1);
    expect(result.draft.experience[0].employer).toBe('Acme GmbH');
    expect(result.unrecognized.join('\n')).toContain('AI/Automation Lab');
    expect(result.uncertain.experience).toBe(true);
  });

  it('recognises further education separately and keeps project links', () => {
    const result = parseCvBuilderImportText(reference01B);
    expect(result.draft.certificates[0].name).toBe('AWS Certified Solutions Architect');
    expect(result.draft.links.some((entry) => entry.url.includes('github.com/alex/ris-integration'))).toBe(true);
    expect(result.draft.education[0].institution).toBe('Technische Universitaet Berlin');
  });
});

describe('R1 real-CV quality rules', () => {
  it('does not turn continued page headings or incomplete dates into positions', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.com

Professional Experience
Acme GmbH
Senior Engineer
Jan 2020 - Present
- Built services

PROFESSIONAL EXPERIENCE (CONTINUED)
2023 - 2024
Only a date and description.

MAY NOWAK · PROFESSIONAL CV 2`);
    expect(result.draft.experience).toHaveLength(1);
    expect(result.draft.experience[0]).toMatchObject({
      employer: 'Acme GmbH',
      position: 'Senior Engineer',
    });
    expect(result.draft.experience.some((entry) =>
      `${entry.employer} ${entry.position}`.includes('CONTINUED')
    )).toBe(false);
    expect(result.unrecognized.join('\n')).not.toContain('PROFESSIONAL CV 2');
  });

  it('keeps incomplete experience blocks for manual assignment instead of inventing positions', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.com

Professional Experience
2023 - 2024
Nur ein Zeitraum und eine Beschreibung.`);
    expect(result.draft.experience).toEqual([]);
    expect(result.unrecognized.join('\n')).toContain('Nur ein Zeitraum');
  });

  it('assigns unassigned text manually to an existing builder section', () => {
    const result = parseCvBuilderImportText(germanCv + `\n\nSonstiges\nZusätzliche Information`);
    const index = result.unrecognized.findIndex((line) => line.includes('Zusätzliche Information'));
    expect(index).toBeGreaterThanOrEqual(0);
    const draft = selectCvBuilderImportDraft(result, ['personal'], { [index]: 'projects' });
    expect(draft.projects[0].name).toBe('Zusätzliche Information');
    expect(draft.profile.summary).toBeUndefined();
  });
});
