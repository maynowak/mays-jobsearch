import { describe, expect, it } from 'vitest';
import { buildPdfDocument, type PdfSourcePage } from './documentStructure';
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


describe('CV-BUILDER-PARSER-02B structured document', () => {
  const pages: PdfSourcePage[] = [
    {
      page: 1,
      text: '',
      lines: [
        { text: 'MAY MUSTERMANN | ATS-PROFIL | 13.10.2026 Seite 1', order: 0 },
        { text: 'May Mustermann', order: 1 },
        { text: 'E-Mail: may@example.invalid', order: 2 },
        { text: 'PROFIL', order: 3 },
        { text: 'Cloud Architekt', order: 4 },
        { text: 'KERNKOMPETENZEN – ATS-SUCHBEGRIFFE', order: 5 },
        { text: 'AWS, Terraform', order: 6 },
      ],
    },
    {
      page: 2,
      text: '',
      lines: [
        { text: 'MAY MUSTERMANN | ATS-PROFIL | 13.10.2026 Seite 2', order: 0 },
        { text: 'AKTUELLE ARCHITEKTUR- UND SOFTWAREPROJEKTE', order: 1 },
        { text: '2026 – Projekt A', order: 2 },
        { text: 'Projektbeschreibung', order: 3 },
        { text: 'AWS QA LABS – PRAXISORIENTIERTE CLOUD-QUALIFIZIERUNG (2026)', order: 4 },
        { text: 'Praktische Übungen', order: 5 },
      ],
    },
    {
      page: 3,
      text: '',
      lines: [
        { text: 'MAY MUSTERMANN | ATS-PROFIL | 13.10.2026 Seite 3', order: 0 },
        { text: 'WEITERBILDUNG & ZERTIFIKATSSTATUS', order: 1 },
        { text: 'Zertifizierungsziel AWS', order: 2 },
        { text: 'BERUFLICHER WERDEGANG – LANGE TIMELINE', order: 3 },
        { text: '2020–2026 | Architekt | Beispiel GmbH', order: 4 },
        { text: 'BERUFLICHER WERDEGANG – FORTSETZUNG', order: 5 },
        { text: '2012–10/2019 | Freelance Software Developer | Enterprise Projects', order: 6 },
        { text: '• Projekt im Kundenauftrag', order: 7 },
        { text: '2008–2009 | Additional Enterprise Projects', order: 8 },
      ],
    },
    {
      page: 4,
      text: '',
      lines: [
        { text: 'MAY MUSTERMANN | ATS-PROFIL | 13.10.2026 Seite 4', order: 0 },
        { text: 'AUSBILDUNG, SPRACHEN & WEITERE QUALIFIKATIONEN', order: 1 },
        { text: 'Technische Universität Berlin', order: 2 },
        { text: 'M.Sc. Informatik', order: 3 },
        { text: 'Okt 2014 – Sep 2016', order: 4 },
        { text: 'Deutsch (Muttersprache)', order: 5 },
        { text: 'ATS- UND VERÖFFENTLICHUNGSSHINWEISE', order: 6 },
        { text: 'Dieses Dokument ist ein Bewerbungsprofil.', order: 7 },
      ],
    },
  ];

  it('keeps page ranges, composite sections and unknown content', () => {
    const pagesWithText = pages.map((page) => ({ ...page, text: page.lines.map((line) => line.text).join('\n') }));
    const document = buildPdfDocument(pagesWithText);
    const result = parseCvBuilderImportText(document.text, document);

    expect(result.structure.pageCount).toBe(4);
    expect(result.structure.sections.map((section) => section.category)).toEqual([
      'personal',
      'profile',
      'skills',
      'projects',
      'training',
      'certificates',
      'experience',
      'mixed',
      'document-notes',
    ]);
    expect(result.structure.sections.find((section) => section.category === 'experience')?.pageEnd).toBe(3);
    expect(result.structure.sections.find((section) => section.category === 'projects')?.pageStart).toBe(2);
    expect(result.structure.unknownBlocks.length).toBeGreaterThan(0);
    expect(result.structure.unusedBlocks).toEqual([]);
  });

  it('does not turn training, projects or certification goals into certificates or extra employment', () => {
    const pagesWithText = pages.map((page) => ({ ...page, text: page.lines.map((line) => line.text).join('\n') }));
    const document = buildPdfDocument(pagesWithText);
    const result = parseCvBuilderImportText(document.text, document);

    expect(result.draft.experience).toHaveLength(2);
    expect(result.draft.experience.some((entry) => `${entry.employer} ${entry.position}`.includes('Additional Enterprise Projects'))).toBe(false);
    expect(result.draft.certificates).toEqual([]);
    expect(result.uncertain.certificates).toBe(true);
    expect(result.uncertain.experience).toBe(true);
    expect(result.draft.projects[0].name).toBe('2026 – Projekt A');
    expect(result.draft.skills).toEqual(['AWS', 'Terraform']);
    expect(result.draft.education[0].institution).toBe('Technische Universität Berlin');
    expect(result.draft.languages[0].language).toBe('Deutsch');
    expect(result.unrecognized.join('\n')).toContain('Praktische Übungen');
    expect(result.unrecognized.join('\n')).toContain('Zertifizierungsziel AWS');
    expect(result.unrecognized.join('\n')).toContain('Dieses Dokument ist ein Bewerbungsprofil.');
    const freelance = result.draft.experience.find((entry) => `${entry.position} ${entry.employer}`.includes('Freelance'));
    expect(freelance?.description).toContain('Additional Enterprise Projects');
    const freelanceMapping = result.mapping.timeline.find((item) => item.kind === 'freelance');
    expect(freelanceMapping).toMatchObject({ included: true, entryIndex: 1 });
    expect(result.mapping.timeline.find((item) => item.kind === 'project')).toMatchObject({
      included: true,
      parentId: freelanceMapping?.itemId,
      entryIndex: 1,
    });
  });

  it('exposes section, page and unassigned provenance for review', () => {
    const pagesWithText = pages.map((page) => ({ ...page, text: page.lines.map((line) => line.text).join('\n') }));
    const document = buildPdfDocument(pagesWithText);
    const result = parseCvBuilderImportText(document.text, document);

    expect(result.mapping.sections.map((section) => section.category)).toEqual([
      'personal',
      'profile',
      'skills',
      'projects',
      'training',
      'certificates',
      'experience',
      'mixed',
      'document-notes',
    ]);
    expect(result.mapping.sections.find((section) => section.category === 'experience')).toMatchObject({
      targets: ['experience'],
      pageStart: 3,
      pageEnd: 3,
      confidence: 'confirmed',
    });
    expect(result.mapping.sections.find((section) => section.category === 'mixed')?.targets).toEqual(['education', 'languages']);
    expect(result.mapping.sections.find((section) => section.category === 'training')?.confidence).toBe('uncertain');
    expect(result.unrecognizedDetails).toHaveLength(result.unrecognized.length);
    const training = result.unrecognizedDetails.find((detail) => detail.line === 'Praktische Übungen');
    expect(training).toMatchObject({
      page: 2,
      suggestedTarget: 'education',
      reason: 'training',
    });
    const goal = result.unrecognizedDetails.find((detail) => detail.line === 'Zertifizierungsziel AWS');
    expect(goal).toMatchObject({
      page: 3,
      suggestedTarget: 'ignore',
      reason: 'certification-goal',
    });
  });
});


describe('CV-BUILDER-PARSER-02B project grouping', () => {
  it('splits dated dash projects without mixing them into one entry', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Projekte
2026 – Projekt A
Beschreibung A
Technologien: React, AWS
2025 – Projekt B
Beschreibung B
2024 – Projekt C
Beschreibung C
2023 – Projekt D
Beschreibung D`);
    expect(result.draft.projects.map((entry) => entry.name)).toEqual([
      '2026 – Projekt A',
      '2025 – Projekt B',
      '2024 – Projekt C',
      '2023 – Projekt D',
    ]);
    expect(result.draft.projects[0].technologies).toEqual(['React', 'AWS']);
  });
});

describe('CV-BUILDER-MAPPING-02C experience mapping', () => {
  it('keeps overlapping dates and exposes incomplete experience for review', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Berufserfahrung
2019–2021 | Senior Engineer | Beispiel GmbH
2020–2022 | Lead Engineer | Zweite AG

2023–2024
Nur ein Zeitraum und eine Beschreibung.`);
    expect(result.draft.experience).toHaveLength(2);
    expect(result.draft.experience.map((entry) => entry.startMonth)).toEqual(['', '']);
    expect(result.mapping.timeline.filter((item) => item.included).map((item) => item.dateText)).toEqual(['2019–2021', '2020–2022']);
    const incomplete = result.mapping.timeline.find((item) => !item.included);
    expect(incomplete?.reason).toBe('incomplete-experience');
    expect(result.unrecognizedDetails.find((detail) => detail.line.includes('Nur ein Zeitraum'))).toMatchObject({
      suggestedTarget: 'experience',
      reason: 'incomplete-experience',
    });
  });
});
