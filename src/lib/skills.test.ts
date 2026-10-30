import { describe, expect, it } from "vitest";
import { parseSkills, formatSkills, parseTargetRoles, formatTargetRoles } from "./skills";

describe("skills - quoted-phrase tokenization", () => {
  it("treats a \"...\" phrase as a single token", () => {
    expect(parseSkills('tokenwordA tokenwordB "token wordX tokenwordZ", nexttoken')).toEqual([
      "tokenwordA",
      "tokenwordB",
      "token wordX tokenwordZ",
      "nexttoken",
    ]);
  });

  it("splits unquoted text on whitespace, comma and semicolon", () => {
    expect(parseSkills("Java AWS Terraform")).toEqual(["Java", "AWS", "Terraform"]);
    expect(parseSkills("Java, AWS; Terraform")).toEqual(["Java", "AWS", "Terraform"]);
  });

  it("quotes whitespace tokens on format for stable round-trip", () => {
    expect(formatSkills(["tokenwordA", "token wordX tokenwordZ", "nexttoken"])).toBe(
      'tokenwordA, "token wordX tokenwordZ", nexttoken'
    );
    expect(parseSkills(formatSkills(["Spring Boot", "React"]))).toEqual([
      "Spring Boot",
      "React",
    ]);
  });

  it("deduplicates case-insensitively and drops empties", () => {
    expect(parseSkills('React, react,  , "React"')).toEqual(["React"]);
    expect(parseSkills("")).toEqual([]);
  });

  it("keeps an unterminated quote as one lossless term", () => {
    expect(parseSkills('"Spring Boot')).toEqual(['"Spring Boot']);
  });

  it("keeps bracket groups and technical terms intact", () => {
    expect(parseSkills("Senior DevOps Engineer (P4 Cloud), C++, C#, .NET, CI/CD, TCP/IP")).toEqual([
      "Senior",
      "DevOps",
      "Engineer",
      "(P4 Cloud)",
      "C++",
      "C#",
      ".NET",
      "CI/CD",
      "TCP/IP",
    ]);
  });

  it("keeps delimiters inside groups and quoted roles", () => {
    expect(parseSkills("AWS (P4; Cloud), \"Machine Learning\", [ISO 27001]")).toEqual([
      "AWS",
      "(P4; Cloud)",
      "Machine Learning",
      "[ISO 27001]",
    ]);
    expect(parseTargetRoles('"Senior DevOps Engineer (P4 Cloud)", Cloud Architect')).toEqual([
      "Senior DevOps Engineer (P4 Cloud)",
      "Cloud Architect",
    ]);
  });

  it("keeps nested and unclosed groups losslessly", () => {
    expect(parseSkills("AWS (P4 [Cloud])")).toEqual(["AWS", "(P4 [Cloud])"]);
    expect(parseSkills("AWS (P4 Cloud")).toEqual(["AWS", "(P4 Cloud"]);
  });
});

describe("skills - legacy helpers unchanged", () => {
  it("parseTargetRoles splits on comma", () => {
    expect(parseTargetRoles("a, b")).toEqual(["a", "b"]);
  });

  it("formatTargetRoles joins with comma+space", () => {
    expect(formatTargetRoles(["a", "b"])).toBe("a, b");
  });
});
