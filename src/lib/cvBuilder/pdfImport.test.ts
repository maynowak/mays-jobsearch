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
    expect(result.draft.projects[0].name).toBe('Projekt A');
    expect(result.draft.projects[0].description).toContain('Zeitraum: 2026');
    expect(result.draft.skills).toEqual(['AWS', 'Terraform']);
    const university = result.draft.education.find((entry) => entry.institution === 'Technische Universität Berlin');
    expect(university?.degree).toBe('M.Sc. Informatik');
    const training = result.draft.education.find((entry) => entry.institution.includes('AWS QA LABS'));
    expect(training?.description).toContain('Praktische Übungen');
    expect(result.draft.languages[0].language).toBe('Deutsch');
    expect(result.unrecognized.join('\n')).not.toContain('Praktische Übungen');
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
    expect(result.mapping.sections.find((section) => section.category === 'training')?.targets).toEqual(['education']);
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
      'Projekt A',
      'Projekt B',
      'Projekt C',
      'Projekt D',
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

describe('CV-BUILDER-MAPPING-02C projects and skills', () => {
  it('deduplicates technologies, strips skill category labels and keeps project links out of skills', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Fähigkeiten
Software & Architektur: Java, Spring Boot
AWS & Infrastruktur: AWS Lambda, AWS Lambda, Terraform

Projekte
2026 – Projekt A
Beschreibung mit React.
Technologien: React, React, AWS Lambda, AWS Lambda
https://github.com/example/project-a`);
    expect(result.draft.skills).toEqual(['Java', 'Spring Boot', 'AWS Lambda', 'Terraform']);
    expect(result.draft.projects[0].technologies).toEqual(['React', 'AWS Lambda']);
    expect(result.draft.projects[0].description).not.toContain('https://github.com/example/project-a');
    expect(result.draft.links.some((link) => link.url.includes('github.com/example/project-a'))).toBe(true);
  });
});

describe('CV-BUILDER-MAPPING-02C manual targets', () => {
  it('can explicitly assign an unassigned line to education or experience', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Sonstiges
Zusätzliche Information`);
    const index = result.unrecognized.findIndex((line) => line.includes('Zusätzliche Information'));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(result.unrecognizedDetails[index]).toMatchObject({
      suggestedTarget: 'ignore',
      reason: 'unknown-section',
    });
    const education = selectCvBuilderImportDraft(result, [], { [index]: 'education' });
    expect(education.education[0]).toMatchObject({ institution: 'Zusätzliche Information', degree: '' });
    const experience = selectCvBuilderImportDraft(result, [], { [index]: 'experience' });
    expect(experience.experience[0]).toMatchObject({ position: 'Zusätzliche Information', employer: '' });
  });
});

describe('CV-BUILDER-MAPPING-02C skill review', () => {
  it('flags a large ATS candidate list for review instead of treating it as final', () => {
    const skills = Array.from({ length: 26 }, (_, index) => `Skill ${index + 1}`).join(', ');
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Fähigkeiten
${skills}`);
    expect(result.draft.skills).toHaveLength(26);
    expect(result.uncertain.skills).toBe(true);
    expect(result.mapping.sections.find((section) => section.category === 'skills')?.notes).toContain('skill-candidates-review');
  });
});

describe('CV-BUILDER-IMPORT-UX-02D selection', () => {
  it('applies accepted corrected text but never pending or ignored decisions', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Sonstiges
Erste Angabe
Zweite Angabe`);
    const first = result.unrecognized.findIndex((line) => line.includes('Erste'));
    const second = result.unrecognized.findIndex((line) => line.includes('Zweite'));
    const draft = selectCvBuilderImportDraft(result, [], {
      [first]: { target: 'projects', status: 'accepted', text: 'Korrigiertes Projekt' },
      [second]: { target: 'projects', status: 'pending', text: 'Nicht übernehmen' },
    });
    expect(draft.projects.map((entry) => entry.name)).toEqual(['Korrigiertes Projekt']);
  });

  it('filters skills only through the explicit skill selection', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Fähigkeiten
React, TypeScript, Terraform`);
    const draft = selectCvBuilderImportDraft(result, ['skills'], {}, {
      selectedSkills: ['React', 'Terraform'],
    });
    expect(draft.skills).toEqual(['React', 'Terraform']);
  });
});


describe('CV-BUILDER-02D-FINAL-MERGE-REVIEW-01 empty corrections', () => {
  it('never falls back to the original line for explicit empty or whitespace corrections', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Sonstiges
Originalzeile`);
    const index = result.unrecognized.findIndex((line) => line === 'Originalzeile');
    expect(index).toBeGreaterThanOrEqual(0);
    const empty = selectCvBuilderImportDraft(result, [], {
      [index]: { target: 'projects', status: 'accepted', text: '' },
    });
    const whitespace = selectCvBuilderImportDraft(result, [], {
      [index]: { target: 'projects', status: 'accepted', text: '   ' },
    });
    expect(empty.projects).toEqual([]);
    expect(whitespace.projects).toEqual([]);
  });

  it('keeps old callers without correction text backward-compatible', () => {
    const result = parseCvBuilderImportText(`Max Mustermann
E-Mail: max@example.invalid

Sonstiges
Originalzeile`);
    const index = result.unrecognized.findIndex((line) => line === 'Originalzeile');
    const stringCaller = selectCvBuilderImportDraft(result, [], { [index]: 'projects' });
    const objectWithoutText = selectCvBuilderImportDraft(result, [], {
      [index]: { target: 'projects', status: 'accepted' },
    });
    expect(stringCaller.projects[0].name).toBe('Originalzeile');
    expect(objectWithoutText.projects[0].name).toBe('Originalzeile');
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E skills sections', () => {
  it('keeps skills from separate architecture/cloud/technology sections apart', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

PROFIL
Cloud Solution Architect
Architecture & Cloud
AWS, Azure, Terraform, Kubernetes
Software Architecture
Event-driven Architecture, API Design, Microservices
Technical Skills
Java, Spring Boot, TypeScript, PostgreSQL
Technologies
Docker, GitHub Actions, Linux`);
    expect(result.draft.skills).toEqual([
      'AWS', 'Azure', 'Terraform', 'Kubernetes', 'Software Architecture',
      'Event-driven Architecture', 'API Design', 'Microservices',
      'Java', 'Spring Boot', 'TypeScript', 'PostgreSQL',
      'Docker', 'GitHub Actions', 'Linux',
    ]);
    expect(result.draft.skills).not.toContain('Kubernetes Event-driven Architecture');
    expect(result.draft.skills).not.toContain('PostgreSQL Docker');
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E certification goals', () => {
  it('does not create certificates for goals or preparations in DE and EN', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

CERTIFICATIONS
AWS Solutions Architect – in preparation
Azure Fundamentals – planned
CKA – in progress
Security+ – pursuing
AWS Cloud Practitioner | Amazon Web Services | 2023
Deutsch B2 – in Vorbereitung
ITIL Foundation – angestrebt`);
    expect(result.draft.certificates.map((entry) => entry.name)).toEqual(['AWS Cloud Practitioner']);
    const goalLines = result.unrecognizedDetails.filter((detail) => detail.reason === 'certification-goal');
    expect(goalLines.map((detail) => detail.line)).toEqual(expect.arrayContaining([
      'AWS Solutions Architect – in preparation',
      'Azure Fundamentals – planned',
      'CKA – in progress',
      'Security+ – pursuing',
      'Deutsch B2 – in Vorbereitung',
      'ITIL Foundation – angestrebt',
    ]));
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E personal details', () => {
  it('keeps name/contact separate and extracts a short location from the personal block', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
nora.beispiel@example.invalid
+49 170 1234567
Berlin

PROFIL
Cloud Solution Architect
Entwickelt sichere Cloud-Plattformen.`);
    expect(result.draft.personal).toMatchObject({
      fullName: 'Nora Beispiel',
      email: 'nora.beispiel@example.invalid',
      phone: '+49 170 1234567',
      location: 'Berlin',
    });
    expect(result.draft.profile).toMatchObject({
      headline: 'Cloud Solution Architect',
      summary: 'Entwickelt sichere Cloud-Plattformen.',
    });
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E training in experience', () => {
  it('keeps undated training/lab lines out of an employment description', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

BERUFLICHER WERDEGANG
2020–2024 | Solution Architect | Acme GmbH
Entwicklung von Cloud-Plattformen.
AWS QA LAB – in progress
Praktische Cloud-Übungen.`);
    expect(result.draft.experience).toHaveLength(1);
    expect(result.draft.experience[0].description).not.toContain('AWS QA LAB');
    expect(result.unrecognized.join('\n')).toContain('AWS QA LAB – in progress');
    expect(result.mapping.timeline.find((item) => item.kind === 'training')).toMatchObject({
      included: false,
      reason: 'training',
    });
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E review reasons', () => {
  it('carries the training reason to all lines of a training block', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

BERUFLICHER WERDEGANG
2020–2024 | Solution Architect | Acme GmbH
Entwicklung von Cloud-Plattformen.
AWS QA LAB – in progress
Praktische Cloud-Übungen.`);
    const training = result.unrecognizedDetails.find((detail) => detail.line === 'Praktische Cloud-Übungen.');
    expect(training).toMatchObject({ reason: 'training', suggestedTarget: 'education', page: 1 });
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E experience fields', () => {
  it('separates role-like values from employers instead of relying on word order', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

BERUFLICHER WERDEGANG
2019–2021 | DevOps | Unternehmensbezeichnung GmbH
2018–2019 | BaFin | Web Services
2017–2018 | Contenido | E-Commerce`);
    expect(result.draft.experience[0]).toMatchObject({ position: 'DevOps', employer: 'Unternehmensbezeichnung GmbH' });
    expect(result.draft.experience[1]).toMatchObject({ position: 'Web Services', employer: 'BaFin' });
    expect(result.draft.experience[2]).toMatchObject({ position: 'E-Commerce', employer: 'Contenido' });
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E education fields', () => {
  it('keeps institution, field, degree and period separate', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

AUSBILDUNG
Computer Science
Bachelor of Science (B.Sc.)
Technische Hochschule Berlin
Okt 2014 – Sep 2017
Schwerpunkt verteilte Systeme.`);
    expect(result.draft.education[0]).toMatchObject({
      institution: 'Technische Hochschule Berlin',
      degree: 'Computer Science – Bachelor of Science (B.Sc.)',
      startMonth: '2014-10',
      endMonth: '2017-09',
    });
    expect(result.draft.education[0].description).toBe('Schwerpunkt verteilte Systeme.');
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E project fields', () => {
  it('cleans dated project names, preserves the period and extracts evidenced technologies', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

PROJEKTE
2026 | Projekt Cloud
Beschreibung mit React, TypeScript und AWS.
Technologien: Terraform, Docker
https://github.com/example/cloud`);
    expect(result.draft.projects[0]).toMatchObject({
      name: 'Projekt Cloud',
      technologies: ['React', 'TypeScript', 'AWS', 'Terraform', 'Docker'],
    });
    expect(result.draft.projects[0].description).toContain('Zeitraum: 2026');
    expect(result.draft.projects[0].description).toContain('Beschreibung mit React');
    expect(result.draft.projects[0].description).not.toContain('https://github.com/example/cloud');
  });
});

describe('CV-BUILDER-REAL-WORLD-QA-02E link labels', () => {
  it('uses repository/profile names instead of identical generic labels', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: may@example.invalid

LINKS
https://github.com/may/one
https://github.com/may/two
https://www.linkedin.com/in/may-nowak
https://example.invalid/portfolio`);
    expect(result.draft.links.map((link) => link.label)).toEqual([
      'GitHub · may/one',
      'GitHub · may/two',
      'LinkedIn · may-nowak',
      'Portfolio · example.invalid/portfolio',
    ]);
  });
});

describe('CV-BUILDER-02F-CORRECTION-01 real field fixes', () => {
  it('splits separate vocational and bachelor qualifications into separate education entries', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

AUSBILDUNG
Bachelor of Science (B.Sc.) – Computer Science
Hochschule Darmstadt, Germany
Industrial Mechanic – Vocational Qualification
Completed vocational training.`);
    expect(result.draft.education.map((entry) => entry.degree)).toEqual([
      'Bachelor of Science (B.Sc.) – Computer Science',
      'Industrial Mechanic – Vocational Qualification',
    ]);
    expect(result.draft.education[0].institution).toBe('Hochschule Darmstadt, Germany');
    expect(result.draft.education[1].institution).toBe('');
    expect(result.draft.education[1].description).toBe('Completed vocational training.');
    expect(result.uncertain.education).toBe(true);
  });

  it('keeps a vocational qualification without a proven institution empty and reviewable', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

AUSBILDUNG
Industrial Mechanic – Vocational Qualification
Completed vocational training.`);
    expect(result.draft.education).toHaveLength(1);
    expect(result.draft.education[0].institution).toBe('');
    expect(result.draft.education[0].degree).toBe('Industrial Mechanic – Vocational Qualification');
    expect(result.uncertain.education).toBe(true);
  });

  it('assigns two qualifications with different institutions to the matching entries', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

AUSBILDUNG
Hochschule A
Bachelor of Science (B.Sc.) – Computer Science
Fachschule B
Industrial Mechanic – Vocational Qualification`);
    expect(result.draft.education.map((entry) => [entry.institution, entry.degree])).toEqual([
      ['Hochschule A', 'Bachelor of Science (B.Sc.) – Computer Science'],
      ['Fachschule B', 'Industrial Mechanic – Vocational Qualification'],
    ]);
  });

  it('uses an institution before multiple qualifications only as an explicit shared institution', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

AUSBILDUNG
Hochschule A
Bachelor of Science (B.Sc.) – Computer Science
Master of Science (M.Sc.) – Distributed Systems`);
    expect(result.draft.education.map((entry) => entry.institution)).toEqual(['Hochschule A', 'Hochschule A']);
    expect(result.uncertain.education).toBe(false);
  });

  it('does not copy one qualification period to another qualification', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

AUSBILDUNG
10/2020–09/2024 | Hochschule A
Bachelor of Science (B.Sc.) – Computer Science
Industrial Mechanic – Vocational Qualification`);
    expect(result.draft.education[0]).toMatchObject({ institution: 'Hochschule A', startMonth: '2020-10', endMonth: '2024-09' });
    expect(result.draft.education[1].startMonth).toBe('');
    expect(result.draft.education[1].endMonth).toBeUndefined();
  });

  it('keeps an unclear education block reviewable without inventing a degree', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

AUSBILDUNG
Weiterbildung Cloud
ohne Abschluss`);
    const entry = result.draft.education[0];
    expect(entry?.degree ?? '').toBe('');
    expect(result.uncertain.education).toBe(true);
  });

  it('extracts evidenced technologies from project descriptions', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

PROJEKTE
2026 | Agent Platform
AWS-based modular agent platform: registry, discovery, routing and asynchronous work processing.
Cognito, Lambda, SQS, ${"Dynamo" + "DB"}, IAM, CloudWatch and Terraform; ongoing verification and development.`);
    expect(result.draft.projects[0].technologies).toEqual(expect.arrayContaining([
      'Cognito', 'Lambda', 'SQS', 'Dynamo' + 'DB', 'IAM', 'CloudWatch', 'Terraform',
    ]));
  });
});

describe('CV-BUILDER-02F-CORRECTION-01 document structure', () => {
  it('ignores repeated profile headers and recovers contact fields', () => {
    const pages = [
      {
        page: 1,
        text: '',
        lines: [
          { text: 'MAY MUSTERMANN • PROFESSIONAL PROFILE 1', order: 0 },
          { text: 'May Mustermann', order: 1 },
          { text: 'Senior Software Architect', order: 2 },
          { text: 'Berlin, Germany | +49 170 1234567', order: 3 },
          { text: 'may@example.invalid', order: 4 },
          { text: 'PROFESSIONAL SUMMARY', order: 5 },
          { text: 'Synthetic profile summary.', order: 6 },
        ],
      },
      {
        page: 2,
        text: '',
        lines: [
          { text: 'MAY MUSTERMANN • PROFESSIONAL PROFILE 2', order: 0 },
          { text: 'PROFESSIONAL EXPERIENCE', order: 1 },
          { text: '2020–2024 | Architect | Beispiel GmbH', order: 2 },
        ],
      },
    ];
    const document = buildPdfDocument(pages.map((page) => ({ ...page, text: page.lines.map((line) => line.text).join('\n') })));
    const result = parseCvBuilderImportText(document.text, document);
    expect(result.draft.personal).toMatchObject({
      fullName: 'May Mustermann',
      email: 'may@example.invalid',
      phone: '+49 170 1234567',
      location: 'Berlin, Germany',
    });
    expect(result.draft.profile.summary).toBe('Synthetic profile summary.');
    expect(result.draft.profile.headline).toBe('Senior Software Architect');
  });

  it('does not turn professional development into skills', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

PROFESSIONAL DEVELOPMENT
2026 | Cloud Training
AWS, Terraform and Docker exercises.`);
    expect(result.draft.skills).toEqual([]);
    const trainingEvidence = [...result.draft.education.map((entry) => `${entry.institution} ${entry.degree} ${entry.description ?? ""}`), ...result.unrecognized].join(" ");
    expect(trainingEvidence).toContain('PROFESSIONAL DEVELOPMENT');
  });
});

describe('CV-BUILDER-02F-CORRECTION-01 profile notes', () => {
  it('keeps publication/profile notes out of the professional summary', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel
E-Mail: nora.beispiel@example.invalid

PROFESSIONAL SUMMARY
Cloud architect.

PROFILE NOTE
ATS publication note and general document instruction.`);
    expect(result.draft.profile.summary).toBe('Cloud architect.');
    expect(result.unrecognized.join('\n')).toContain('ATS publication note');
  });
});

describe('CV-BUILDER-03B real-world import quality', () => {
  it('parses month-name dates and a date-first multi-line station without losing the entry', () => {
    const document = buildPdfDocument([{ page: 1, text: '', lines: [
      { text: 'BERUFSERFAHRUNG', order: 0 },
      { text: 'Januar 2020 – Dezember 2021', order: 1 },
      { text: 'Senior Engineer', order: 2 },
      { text: 'Acme GmbH', order: 3 },
      { text: 'Led migration.', order: 4 },
      { text: '2022 – 2024 | Developer | Beta AG', order: 5 },
      { text: 'Built APIs.', order: 6 },
    ] }]);
    const result = parseCvBuilderImportText(document.text, document);
    expect(result.draft.experience).toHaveLength(2);
    expect(result.draft.experience[0]).toMatchObject({ position: 'Senior Engineer', employer: 'Acme GmbH', startMonth: '2020-01', endMonth: '2021-12' });
    expect(result.draft.experience[1]).toMatchObject({ position: 'Developer', employer: 'Beta AG' });
  });

  it('parses a single month date at the end of a station header', () => {
    const document = buildPdfDocument([{ page: 1, text: '', lines: [
      { text: 'BERUFSERFAHRUNG', order: 0 },
      { text: 'Senior Engineer | Acme GmbH | 03/2021', order: 1 },
      { text: 'Built APIs.', order: 2 },
    ] }]);
    const result = parseCvBuilderImportText(document.text, document);
    expect(result.draft.experience[0]).toMatchObject({ position: 'Senior Engineer', employer: 'Acme GmbH', startMonth: '2021-03' });
  });

  it('splits a single-line degree and institution without duplicating them', () => {
    const result = parseCvBuilderImportText(`Nora Beispiel\nE-Mail: nora.beispiel@example.invalid\n\nAUSBILDUNG\nB.Sc. Computer Science – Hochschule Musterstadt`);
    expect(result.draft.education[0]).toMatchObject({ degree: 'B.Sc. Computer Science', institution: 'Hochschule Musterstadt' });
    expect(result.draft.education[0].degree).not.toBe(result.draft.education[0].institution);
  });

  it('keeps contact fields and dot-separated location while rejecting birth dates as phone', () => {
    const result = parseCvBuilderImportText(`NORA BEISPIEL\nSENIOR SOFTWARE ARCHITECT\nBerlin · Deutschland · +49 170 1234567\nnora.beispiel@example.invalid\nGeburtsdatum: 01.01.1990`);
    expect(result.draft.personal).toMatchObject({ fullName: 'Nora Beispiel', email: 'nora.beispiel@example.invalid', phone: '+49 170 1234567', location: 'Berlin, Deutschland' });
    expect(result.draft.personal.phone).not.toContain('1990');
  });

  it('ignores repeated profile headers without a page number', () => {
    const pages = [
      { page: 1, text: '', lines: [
        { text: 'NORA BEISPIEL • PROFESSIONAL PROFILE', order: 0 },
        { text: 'Nora Beispiel', order: 1 },
        { text: 'Berlin, Deutschland', order: 2 },
        { text: 'nora.beispiel@example.invalid', order: 3 },
        { text: 'PROFESSIONAL SUMMARY', order: 4 },
        { text: 'Synthetic summary.', order: 5 },
      ] },
      { page: 2, text: '', lines: [
        { text: 'NORA BEISPIEL • PROFESSIONAL PROFILE', order: 0 },
        { text: 'PROFESSIONAL EXPERIENCE', order: 1 },
        { text: '2020 – 2024 | Engineer | Acme GmbH', order: 2 },
      ] },
    ];
    const document = buildPdfDocument(pages.map((page) => ({ ...page, text: page.lines.map((line) => line.text).join('\n') })));
    const result = parseCvBuilderImportText(document.text, document);
    expect(result.draft.personal).toMatchObject({ fullName: 'Nora Beispiel', email: 'nora.beispiel@example.invalid', location: 'Berlin, Deutschland' });
    expect(result.structure.sections.filter((section) => section.category === 'unknown')).toHaveLength(0);
  });
});
