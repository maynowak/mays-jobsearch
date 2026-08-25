import { describe, expect, it } from "vitest";
import { formatGermanLocation, parseGermanLocation } from "./location";

describe("parseGermanLocation", () => {
  it("parses nur Stadt", () => {
    expect(parseGermanLocation("Berlin")).toEqual({ city: "Berlin" });
  });

  it("parses nur PLZ", () => {
    expect(parseGermanLocation("10115")).toEqual({ postalCode: "10115" });
  });

  it("parses PLZ + Stadt", () => {
    expect(parseGermanLocation("10115 Berlin")).toEqual({ postalCode: "10115", city: "Berlin" });
  });

  it("parses Straße, PLZ Stadt", () => {
    expect(parseGermanLocation("Musterstraße 12, 10115 Berlin")).toEqual({
      street: "Musterstraße 12",
      postalCode: "10115",
      city: "Berlin",
    });
  });

  it("parses Straße, PLZ", () => {
    expect(parseGermanLocation("Musterstraße 12, 10115")).toEqual({
      street: "Musterstraße 12",
      postalCode: "10115",
    });
  });

  it("parses Straße, Stadt", () => {
    expect(parseGermanLocation("Musterstraße 12, Berlin")).toEqual({
      street: "Musterstraße 12",
      city: "Berlin",
    });
  });

  it("parses Mehrteilige Adresse mit PLZ Stadt", () => {
    expect(parseGermanLocation("Musterstraße 12, 3. OG, 10115 Berlin")).toEqual({
      street: "Musterstraße 12, 3. OG",
      postalCode: "10115",
      city: "Berlin",
    });
  });

  it("parses Mehrteilige Adresse mit nur PLZ", () => {
    expect(parseGermanLocation("Musterstraße 12, 3. OG, 10115")).toEqual({
      street: "Musterstraße 12, 3. OG",
      postalCode: "10115",
    });
  });

  it("gibt leeres Objekt bei leerem String zurück", () => {
    expect(parseGermanLocation("")).toEqual({});
    expect(parseGermanLocation("   ")).toEqual({});
  });
});

describe("formatGermanLocation", () => {
  it("formatiert nur Stadt", () => {
    expect(formatGermanLocation("Berlin")).toBe("Berlin");
    expect(formatGermanLocation(["Berlin"])).toBe("Berlin");
  });

  it("formatiert nur PLZ", () => {
    expect(formatGermanLocation("10115")).toBe("10115");
    expect(formatGermanLocation(["10115"])).toBe("10115");
  });

  it("formatiert PLZ + Stadt (bevorzugt: PLZ vor Stadt)", () => {
    expect(formatGermanLocation("10115 Berlin")).toBe("10115 Berlin");
    expect(formatGermanLocation(["10115 Berlin"])).toBe("10115 Berlin");
    expect(formatGermanLocation(["10115", "Berlin"])).toBe("10115 Berlin");
  });

  it("formatiert vollständige Adresse (einzeilig)", () => {
    expect(formatGermanLocation("Musterstraße 12, 10115 Berlin")).toBe("Musterstraße 12, 10115 Berlin");
    expect(formatGermanLocation(["Musterstraße 12", "10115 Berlin"])).toBe("Musterstraße 12, 10115 Berlin");
  });

  it("formatiert Straße + PLZ ohne Stadt", () => {
    expect(formatGermanLocation("Musterstraße 12, 10115")).toBe("Musterstraße 12, 10115");
  });

  it("formatiert Straße + Stadt ohne PLZ", () => {
    expect(formatGermanLocation("Musterstraße 12, Berlin")).toBe("Musterstraße 12, Berlin");
  });

  it("behandelt leere Eingabe", () => {
    expect(formatGermanLocation("")).toBe("");
    expect(formatGermanLocation([])).toBe("");
  });

  it("behandelt remote-only (fallback wird in Komponente gemacht)", () => {
    expect(formatGermanLocation("")).toBe("");
  });
});