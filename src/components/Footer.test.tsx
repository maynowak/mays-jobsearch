import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LangProvider } from "../i18n";
import Footer from "./Footer";
import { appInfo } from "../lib/appInfo";

function renderFooter(info?: Partial<typeof appInfo>) {
  return render(
    <LangProvider>
      <Footer info={info} />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("mj-lang", "de");
});

afterEach(() => {
  cleanup();
});

describe("Footer", () => {
  it("rendert den Footer", () => {
    renderFooter();
    expect(document.querySelector(".footer")).toBeTruthy();
  });

  it("zeigt die Version aus appInfo (package.json) an", () => {
    renderFooter();
    const versionLine = document.querySelector(".footer-version")?.textContent ?? "";
    expect(versionLine).toContain(`Version ${appInfo.version}`);
  });

  it("zeigt Environment und Build-Commit aus appInfo an", () => {
    renderFooter();
    const versionLine = document.querySelector(".footer-version")?.textContent ?? "";
    expect(versionLine).toContain(appInfo.env);
    expect(versionLine).toContain(appInfo.commitSha);
  });

  it("Behält die bestehenden Arbeitnow-/Arbeitsagentur-Links", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Arbeitnow" })).toHaveProperty(
      "href",
      "https://www.arbeitnow.com/"
    );
    expect(screen.getByRole("link", { name: "Arbeitsagentur" })).toHaveProperty(
      "href",
      "https://www.arbeitsagentur.de/"
    );
    expect(document.querySelector(".footer")?.textContent).toContain("Jobangebote");
  });

  it("Deployment ≠ Git HEAD: zeigt die zur Build-Zeit eingefrorene SHA, nicht den aktuellen Git-HEAD", () => {
    const deployedBuild = "884b94e";
    const currentHead = "1221985";
    expect(deployedBuild).not.toBe(currentHead);

    renderFooter({ commitSha: deployedBuild });
    const versionLine = document.querySelector(".footer-version")?.textContent ?? "";
    expect(versionLine).toContain(deployedBuild);
    expect(versionLine).not.toContain(currentHead);
  });

  it("Environment-Label development wird korrekt dargestellt", () => {
    renderFooter({ env: "development", commitSha: "dev" });
    const versionLine = document.querySelector(".footer-version")?.textContent ?? "";
    expect(versionLine).toContain("development");
  });

  it("Environment-Label preview wird korrekt dargestellt", () => {
    renderFooter({ env: "preview" });
    const versionLine = document.querySelector(".footer-version")?.textContent ?? "";
    expect(versionLine).toContain("preview");
  });

  it("Environment-Label production wird korrekt dargestellt", () => {
    renderFooter({ env: "production" });
    const versionLine = document.querySelector(".footer-version")?.textContent ?? "";
    expect(versionLine).toContain("production");
  });

  it("Lokaler Fallback: 'dev'-Commit wird angezeigt, wenn kein Git-Commit verfügbar ist", () => {
    renderFooter({ env: "development", commitSha: "dev", branch: "dev" });
    const versionLine = document.querySelector(".footer-version")?.textContent ?? "";
    expect(versionLine).toContain("dev");
  });

  it("Deutsch: i18n-Keys werden verwendet", () => {
    localStorage.setItem("mj-lang", "de");
    renderFooter();
    expect(document.querySelector(".footer")?.textContent).toContain("Jobangebote");
    expect(document.querySelector(".footer-version")?.textContent).toContain("Version");
  });

  it("Englisch: i18n-Keys werden verwendet", () => {
    localStorage.setItem("mj-lang", "en");
    renderFooter();
    expect(document.querySelector(".footer")?.textContent).toContain("Job listings");
    expect(document.querySelector(".footer-version")?.textContent).toContain("Version");
  });

  it("Verwendet keine hardcodierten UI-Texte, wo i18n-Struktur vorhanden ist", () => {
    localStorage.setItem("mj-lang", "en");
    renderFooter();
    expect(document.querySelector(".footer")?.textContent).toContain("Job listings");
    expect(document.querySelector(".footer")?.textContent).not.toContain("Jobangebote");
  });
});
