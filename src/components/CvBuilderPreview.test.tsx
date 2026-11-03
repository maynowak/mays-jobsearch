import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvBuilderPreview from "./CvBuilderPreview";
import {
  createEmptyCvBuilderDraft,
  type CvBuilderDraftV1,
} from "../lib/cvBuilder/contractTypes";

function fullDraft(): CvBuilderDraftV1 {
  const draft = createEmptyCvBuilderDraft();
  draft.personal = {
    fullName: "Alex Beispiel",
    email: "alex@example.invalid",
    phone: "+49 30 123456",
    location: "Berlin",
  };
  draft.profile = {
    headline: "Senior Frontend Architektin",
    summary: "Schwerpunkt auf barrierefreien React-Anwendungen und Cloud-Architektur.",
  };
  draft.experience = [
    {
      id: "exp-1",
      employer: "Beispiel GmbH",
      position: "Senior Frontend Entwicklerin",
      startMonth: "2019-03",
      endMonth: "2024-10",
      current: false,
      description: "React, TypeScript und Designsysteme.",
    },
    {
      id: "exp-2",
      employer: "Vorherige AG",
      position: "Frontend Entwicklerin",
      startMonth: "2017-01",
      current: true,
      description: "Aufbau einer Komponentenbibliothek.",
    },
  ];
  draft.education = [{
    id: "edu-1",
    institution: "Beispiel-Universität",
    degree: "B.Sc. Informatik",
    startMonth: "2013-10",
    endMonth: "2017-09",
    current: false,
  }];
  draft.skills = ["React", "TypeScript", "Cloud Architecture"];
  draft.projects = [{
    id: "project-1",
    name: "Job Matcher",
    technologies: ["React", "Node.js"],
    description: "Strukturierte Jobsuche mit ATS-Unterstützung.",
  }];
  draft.certificates = [{
    id: "cert-1",
    name: "AWS Cloud Practitioner",
    issuer: "Amazon",
    date: "2023-05",
  }];
  draft.languages = [{ id: "lang-1", language: "Deutsch", level: "native" }];
  draft.links = [{
    id: "link-1",
    kind: "portfolio",
    label: "Portfolio",
    url: "https://example.invalid/portfolio",
  }];
  return draft;
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("CV-BUILDER-01B live preview", () => {
  it("shows an understandable empty state without empty section headings", () => {
    render(
      <LangProvider>
        <CvBuilderPreview draft={createEmptyCvBuilderDraft()} template="classic" />
      </LangProvider>
    );
    expect(screen.getByText(/Vorschau erscheint hier/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Berufserfahrung" })).not.toBeInTheDocument();
  });

  it("renders all present CV sections in the classic template", () => {
    render(
      <LangProvider>
        <CvBuilderPreview draft={fullDraft()} template="classic" />
      </LangProvider>
    );
    expect(screen.getByRole("heading", { name: "Alex Beispiel" })).toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Entwicklerin")).toBeInTheDocument();
    expect(screen.getByText("alex@example.invalid")).toBeInTheDocument();
    expect(screen.getByText("Beispiel GmbH")).toBeInTheDocument();
    expect(screen.getByText("Beispiel-Universität")).toBeInTheDocument();
    expect(screen.getByText("Job Matcher")).toBeInTheDocument();
    expect(screen.getByText("AWS Cloud Practitioner")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.invalid/portfolio" })).toHaveAttribute(
      "href",
      "https://example.invalid/portfolio"
    );
  });

  it("renders the same complete information in every template", () => {
    for (const template of ["classic", "modern", "compact"] as const) {
      const view = render(
        <LangProvider>
          <CvBuilderPreview draft={fullDraft()} template={template} />
        </LangProvider>
      );
      expect(screen.getByRole("heading", { name: "Alex Beispiel" })).toBeInTheDocument();
      expect(screen.getByText("Beispiel GmbH")).toBeInTheDocument();
      expect(screen.getByText("Beispiel-Universität")).toBeInTheDocument();
      expect(screen.getByText("Job Matcher")).toBeInTheDocument();
      expect(screen.getByText("AWS Cloud Practitioner")).toBeInTheDocument();
      expect(screen.getByText("Deutsch")).toBeInTheDocument();
      expect(screen.getByText("Cloud Architecture")).toBeInTheDocument();
      view.unmount();
    }
  });

  it("formats month/year ranges and current employment without dates or time zones", () => {
    render(
      <LangProvider>
        <CvBuilderPreview draft={fullDraft()} template="modern" />
      </LangProvider>
    );
    expect(screen.getByText("03/2019 – 10/2024")).toBeInTheDocument();
    expect(screen.getByText("01/2017 – heute")).toBeInTheDocument();
  });

  it("renders Present in English while keeping user content unchanged", () => {
    localStorage.setItem("mj-lang", "en");
    render(
      <LangProvider>
        <CvBuilderPreview draft={fullDraft()} template="compact" />
      </LangProvider>
    );
    expect(screen.getByText("01/2017 – Present")).toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Architektin")).toBeInTheDocument();
  });

  it("switches templates without mutating or dropping data", () => {
    const draft = fullDraft();
    const snapshot = JSON.stringify(draft);
    const view = render(
      <LangProvider>
        <CvBuilderPreview draft={draft} template="classic" />
      </LangProvider>
    );
    expect(document.querySelector(".cv-preview")).toHaveAttribute("data-template", "classic");

    view.rerender(
      <LangProvider>
        <CvBuilderPreview draft={draft} template="modern" />
      </LangProvider>
    );
    expect(document.querySelector(".cv-preview")).toHaveAttribute("data-template", "modern");
    expect(screen.getByText("Job Matcher")).toBeInTheDocument();
    expect(screen.getByText("AWS Cloud Practitioner")).toBeInTheDocument();

    view.rerender(
      <LangProvider>
        <CvBuilderPreview draft={draft} template="compact" />
      </LangProvider>
    );
    expect(document.querySelector(".cv-preview")).toHaveAttribute("data-template", "compact");
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it("does not invent invalid months or unsafe links and renders HTML-like text safely", () => {
    const draft = fullDraft();
    draft.experience[0].startMonth = "2020-13";
    draft.links = [{
      id: "link-unsafe",
      kind: "other",
      label: "<script>alert(1)</script>",
      url: "javascript:alert(1)",
    }];
    render(
      <LangProvider>
        <CvBuilderPreview draft={draft} template="classic" />
      </LangProvider>
    );
    expect(screen.queryByText("13/2020")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /javascript/i })).not.toBeInTheDocument();
    expect(screen.queryByText("<script>alert(1)</script>")).not.toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("keeps long URLs and descriptions complete", () => {
    const draft = fullDraft();
    const longUrl = `https://example.invalid/${"a".repeat(500)}`;
    draft.links[0].url = longUrl;
    draft.experience[0].description = "Lange Beschreibung ".repeat(120);
    render(
      <LangProvider>
        <CvBuilderPreview draft={draft} template="compact" />
      </LangProvider>
    );
    expect(screen.getByRole("link", { name: longUrl })).toBeInTheDocument();
    expect(screen.getByText(/Lange Beschreibung/)).toBeInTheDocument();
  });
});
