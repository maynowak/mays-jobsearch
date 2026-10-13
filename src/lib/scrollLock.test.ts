import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
  __resetBodyScrollLockForTests,
} from "./scrollLock";

describe("SEARCH-SCROLL-REGRESSION-01: Body-Scroll-Lock", () => {
  beforeEach(() => {
    __resetBodyScrollLockForTests();
  });

  afterEach(() => {
    // Lock zurueckgeben, damit kein Folgetest beeinflusst wird.
    releaseBodyScrollLock();
    __resetBodyScrollLockForTests();
  });

  // Test 7: vorhandene Overflow-Werte bleiben erhalten
  it("speichert bestehende Inline-Overflow-Werte und stellt sie exakt wieder her", () => {
    document.body.style.overflow = "clip";
    document.documentElement.style.overflow = "auto";

    acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    releaseBodyScrollLock();
    expect(document.body.style.overflow).toBe("clip");
    expect(document.documentElement.style.overflow).toBe("auto");
  });

  // Test 2: Dialog öffnen aktiviert den Lock
  it("sperrt beim Erwerb und gibt beim Freigeben wieder frei", () => {
    acquireBodyScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");

    releaseBodyScrollLock();
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  // Test 3: mehrfaches Oeffnen/Schliessen (Lock-Zaehler)
  it("unterstuetzt wiederholtes Oeffnen und Schliessen ohne Rest-Lock", () => {
    for (let i = 0; i < 3; i += 1) {
      acquireBodyScrollLock();
      expect(document.body.style.overflow).toBe("hidden");
      releaseBodyScrollLock();
      expect(document.body.style.overflow).toBe("");
    }
  });

  // Test 6 / konkurrierende Locks (Dialog + Mobile-Menue)
  it("behandelt konkurrierende Locks: erst der letzte gibt frei", () => {
    acquireBodyScrollLock(); // CV-Dialog
    acquireBodyScrollLock(); // Navbar-Mobile-Menue

    releaseBodyScrollLock(); // Navbar schliesst zuerst
    expect(document.body.style.overflow).toBe("hidden"); // Dialog haelt noch

    releaseBodyScrollLock(); // Dialog schliesst
    expect(document.body.style.overflow).toBe("");
  });

  // Test 5 / Fehlerpfad: Release ohne vorheriges Acquire ist unschaedlich
  it("ignoriert Release ohne Gegenstueck (Fehlerpfad/Navigation)", () => {
    expect(() => releaseBodyScrollLock()).not.toThrow();
    expect(document.body.style.overflow).toBe("");
  });

  // Scrollposition: nur gesetzt, wenn wirklich gescrollt wurde
  it("setzt body nicht auf fixed, wenn die Seite nicht gescrollt ist", () => {
    window.scrollTo(0, 0);
    acquireBodyScrollLock();
    expect(document.body.style.position).toBe("");
    releaseBodyScrollLock();
  });
});
