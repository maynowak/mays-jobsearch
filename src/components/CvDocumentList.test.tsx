import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import CvDocumentList from "./CvDocumentList";
import type { CvDocument } from "../types";

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

function makeDoc(id: string, name = `${id}.pdf`): CvDocument {
  const file = new File(["inhalt"], name, { type: "application/pdf" });
  return { id, name, size: file.size, selected: false, file };
}

function renderList(documents: CvDocument[]) {
  const props = {
    documents,
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    onAddFiles: vi.fn(),
    onProcess: vi.fn(),
    onSearch: vi.fn(),
    disabled: false,
    processing: false,
  };
  return render(
    <LangProvider>
      <CvDocumentList {...props} />
    </LangProvider>
  );
}

describe("BROWSER-BUG-08: Weitere CVs hochladen", () => {
  it("zeigt 'Weitere CVs hochladen', solange weniger als 10 CVs vorhanden sind", () => {
    renderList([makeDoc("cv-1")]);
    expect(screen.getByText("Weitere CVs hochladen")).toBeTruthy();
  });

  it("blendet den Upload-Button ab 10 CVs aus", () => {
    const docs = Array.from({ length: 10 }, (_, i) => makeDoc(`cv-${i}`));
    renderList(docs);
    expect(screen.queryByText("Weitere CVs hochladen")).toBeNull();
  });
});

describe("BROWSER-BUG-09: vollständiger Dateiname", () => {
  it("setzt den vollständigen Dateinamen als title-Attribut (Hover-Tooltip)", () => {
    renderList([makeDoc("cv-1", "Gregor_Nowak_2026-08-14_EN.pdf")]);
    const nameEl = screen.getByText("Gregor_Nowak_2026-08-14_EN.pdf");
    expect(nameEl.getAttribute("title")).toBe("Gregor_Nowak_2026-08-14_EN.pdf");
  });
});
