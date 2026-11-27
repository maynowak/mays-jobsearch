/**
 * JM-DEMO-01: Synthetic demo data for one-click demo mode.
 * All data is expressly fictitious - keine echten Benutzerdaten.
 * Demo-Modus — alle personenbezogenen Angaben sind fiktiv.
 */

// IT-Bewerberprofil - synthetic data
export const DEMO_IT_PROFILE = {
  skills: "Java, Python, AWS, Terraform, Docker, React, TypeScript",
  targetRoles: "Software Engineer, Full Stack Developer, Cloud Engineer",
  city: "Berlin, Germany",
  radiusKm: 50,
  workModes: ["remote", "hybrid"] as const,
  employmentTypes: ["full_time"] as const,
};

// Synthetic professional experience
export const DEMO_EXPERIENCE = [
  {
    id: "exp-1",
    title: "Senior Software Engineer",
    company: "Tech GmbH",
    location: "Berlin, Germany",
    startDate: "2023-01",
    endDate: "present",
    description: "Entwicklung und Wartung von Enterprise-Anwendungen mit Java und Spring Boot.",
  },
  {
    id: "exp-2",
    title: "DevOps Engineer",
    company: "Cloud Solutions Ltd.",
    location: "Munich, Germany",
    startDate: "2022-06",
    endDate: "2022-12",
    description: "CI/CD-Pipelines mit Terraform und Docker implemented und Cloud-Infrastruktur auf AWS bereitgestellt.",
  },
  {
    id: "exp-3",
    title: "Junior Developer",
    company: "Startup XY",
    location: "Hamburg, Germany",
    startDate: "2021-03",
    endDate: "2022-05",
    description: "Entwicklung von React-Komponenten und TypeScript-Utilities für interne Tools.",
  },
];

// Synthetic education
export const DEMO_EDUCATION = [
  {
    id: "edu-1",
    degree: "Bachelor of Science in Informatik",
    institution: "Technische Universität Berlin",
    field: "Software Engineering",
    graduation: "2021",
  },
  {
    id: "edu-2",
    degree: "AWS Certified Solutions Architect",
    institution: "Amazon Web Services",
    field: "Cloud Architecture",
    graduation: "2023",
  },
];

// Example ATS profile
export const DEMO_ATS_PROFILE = {
  skills: ["Java", "Python", "AWS", "Terraform", "Docker", "React", "TypeScript"],
  experienceLevel: "Senior",
  targetRoles: ["Software Engineer", "Full Stack Developer", "Cloud Engineer"],
  location: "Berlin, Germany",
};

// Example search profile
export const DEMO_SEARCH_PROFILE = {
  keywords: "Java Python AWS Terraform Docker",
  preferredLocations: ["Berlin", "Munich", "Hamburg"],
  desiredSalary: "80000-100000 EUR",
  workModePreferences: ["remote", "hybrid"],
};

// Example application
export const DEMO_APPLICATION = {
  id: "demo-app-1",
  jobTitle: "Software Engineer",
  company: "Tech GmbH",
  status: "saved",
  appliedDate: "2024-01-15",
  cvId: "demo-cv-1",
};

// Demo notice component - displayed in dashboard when isDemo is true
export const DEMO_NOTICE_TEXT = "Demo-Modus — alle personenbezogenen Angaben sind fiktiv.";

// Demo mode badge text
export const DEMO_BADGE_TEXT = "DEV MODE: Demo data";
