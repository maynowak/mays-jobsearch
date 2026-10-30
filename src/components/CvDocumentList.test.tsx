import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    onShowProfiles: vi.fn(),
    onRemoveData: vi.fn(),
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

  it("verarbeitet den ersten und zweiten Upload über denselben Input", () => {
    const onAddFiles = vi.fn();
    const first = new File(["first"], "first.pdf", { type: "application/pdf" });
    const second = new File(["second"], "second.pdf", { type: "application/pdf" });
    const props = {
      documents: [] as CvDocument[],
      onSelect: vi.fn(),
      onRemove: vi.fn(),
      onAddFiles,
      onProcess: vi.fn(),
      onSearch: vi.fn(),
      onShowProfiles: vi.fn(),
      onRemoveData: vi.fn(),
      disabled: false,
      processing: false,
    };
    const view = render(
      <LangProvider>
        <CvDocumentList {...props} />
      </LangProvider>
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [first] } });
    expect(onAddFiles).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");

    view.rerender(
      <LangProvider>
        <CvDocumentList {...props} documents={[makeDoc("cv-1", first.name)]} />
      </LangProvider>
    );
    const sameInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(sameInput).toBe(input);
    fireEvent.change(sameInput, { target: { files: [second] } });
    expect(onAddFiles).toHaveBeenCalledTimes(2);
    expect(onAddFiles.mock.calls[1][0][0]).toBe(second);
  });
});

describe("BROWSER-BUG-21A: CV Readiness im document-selected State", () => {
  it("zeigt je Dokument einen 'Bereit zur Verarbeitung'-Status", () => {
    renderList([makeDoc("cv-1"), makeDoc("cv-2")]);
    const statuses = screen.getAllByText("Bereit zur Verarbeitung");
    expect(statuses.length).toBe(2);
  });
});

describe("BROWSER-BUG-09: vollständiger Dateiname", () => {
  it("setzt den vollständigen Dateinamen als title-Attribut (Hover-Tooltip)", () => {
    renderList([makeDoc("cv-1", "Gregor_Nowak_2026-08-14_EN.pdf")]);
    const nameEl = screen.getByText("Gregor_Nowak_2026-08-14_EN.pdf");
    expect(nameEl.getAttribute("title")).toBe("Gregor_Nowak_2026-08-14_EN.pdf");
  });
});

// CV-FILESIZE-DISPLAY-01: Dateigroessen-Anzeige.
describe("CV-Dateigroessen werden einheitenkorrekt angezeigt", () => {
  function docWithSize(size: number): CvDocument {
    return {
      id: `cv-${size}`,
      name: `datei-${size}.pdf`,
      size,
      selected: false,
      file: new File([new Uint8Array(Math.min(size, 8))], `datei-${size}.pdf`, {
        type: "application/pdf",
      }),
    };
  }

  it.each([
    [0, "0 B"],
    [850, "850 B"],
    [25_600, "25,0 KB"],
    [524_288, "512,0 KB"],
    [1_572_864, "1,5 MB"],
  ])("zeigt %i Bytes als %s", (size, expected) => {
    renderList([docWithSize(size)]);
    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByText("0.0 MB")).toBeNull();
  });

  it("zeigt die Groesse unabhaengig vom Verarbeitungsstatus", () => {
    const processed = docWithSize(25_600);
    processed.hash = "hash-1";
    processed.skills = ["AWS"];
    renderList([processed]);
    expect(screen.getByText("25,0 KB")).toBeTruthy();
  });

  it("formatiert die Groesse in der englischen Oberflaeche mit Punkt", () => {
    localStorage.setItem("mj-lang", "en");
    renderList([docWithSize(1_572_864)]);
    expect(screen.getByText("1.5 MB")).toBeTruthy();
  });
});
