// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/ai.mjs", () => ({ chat: vi.fn() }));

import { chat } from "../../api/_lib/ai.mjs";
import handler from "../../api/cover-letter.mjs";

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

const req = (body) => ({ method: "POST", headers: {}, body });

const validBody = {
  job: {
    title: "Frontend Engineer",
    company_name: "Example GmbH",
    location: ["Berlin"],
    url: "https://example.invalid/job",
    tags: ["React", "TypeScript"],
    description: "Du entwickelst React-Anwendungen. Du hast Erfahrung mit TypeScript.",
    description_origin: "enriched",
  },
  candidate: {
    mode: "cv",
    skills: ["React"],
    experience: "4 Jahre Frontend",
    qualifications: "Bachelor Informatik",
    motivation: "Ich möchte Produkte verbessern.",
    cv_text: "Synthetic CV with React and TypeScript.",
    cv_anonymized: true,
    start_date: "01/2027",
    salary_expectation: "60.000 EUR",
  },
  options: {
    language: "German",
    style: "professional",
    length: "one_page",
    target_roles: ["Frontend Engineer", "Web Developer"],
  },
};

beforeEach(() => {
  vi.mocked(chat).mockReset();
  vi.mocked(chat).mockResolvedValue("Sehr geehrte Damen und Herren,\n\nvielen Dank.");
});

describe("/api/cover-letter typed generation", () => {
  it("uses selected job description, CV text and target roles", async () => {
    const res = makeRes();
    await handler(req(validBody), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.letter).toContain("Sehr geehrte");
    expect(vi.mocked(chat)).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(chat).mock.calls[0][0].prompt;
    expect(prompt).toContain("Du entwickelst React-Anwendungen");
    expect(prompt).toContain("Synthetic CV with React");
    expect(prompt).toContain("Frontend Engineer, Web Developer");
    expect(prompt).toContain("anonymized: yes");
    expect(prompt).not.toContain("PRAKTISCHE FRAGE");
    expect(prompt).not.toContain("ANTWORTSKIZZE");
  });

  it("does not add interview preparation to the returned letter", async () => {
    vi.mocked(chat).mockResolvedValue(
      "Sehr geehrte Damen und Herren.\n\nPRAKTISCHE FRAGE:\nWas ist Ihre Stärke?\nANTWORTSKIZZE:\nTeamarbeit."
    );
    const res = makeRes();
    await handler(req(validBody), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.letter).toBe("Sehr geehrte Damen und Herren.");
    expect(res.body.letter).not.toContain("PRAKTISCHE FRAGE");
  });

  it("strips HTML and script from untrusted description/CV text", async () => {
    const res = makeRes();
    await handler(
      req({
        ...validBody,
        job: {
          ...validBody.job,
          description: "<p>React</p><script>alert('x')</script>",
        },
        candidate: {
          ...validBody.candidate,
          cv_text: "<b>TypeScript</b><script>alert('y')</script>",
        },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    const prompt = vi.mocked(chat).mock.calls[0][0].prompt;
    expect(prompt).toContain("React");
    expect(prompt).toContain("TypeScript");
    expect(prompt).not.toContain("<script");
    expect(prompt).not.toContain("alert");
  });

  it("keeps legacy targetRole compatible without losing target roles", async () => {
    const res = makeRes();
    await handler(
      req({
        ...validBody,
        options: undefined,
        targetRole: "Legacy Role",
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    const prompt = vi.mocked(chat).mock.calls[0][0].prompt;
    expect(prompt).toContain("Legacy Role");
  });

  it("rejects invalid candidate mode", async () => {
    const res = makeRes();
    await handler(req({ ...validBody, candidate: { ...validBody.candidate, mode: "other" } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("bad_request");
  });

  it("rejects a CV mode without CV text", async () => {
    const res = makeRes();
    await handler(req({ ...validBody, candidate: { ...validBody.candidate, cv_text: "" } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("bad_request");
  });

  it("requires a job title and company", async () => {
    const res = makeRes();
    await handler(req({ ...validBody, job: { ...validBody.job, company_name: "" } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("bad_request");
  });

  it("does not copy a prepareQuestion into the prompt", async () => {
    const res = makeRes();
    await handler(req({ ...validBody, prepareQuestion: "Secret interview question" }), res);
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(chat).mock.calls[0][0].prompt).not.toContain("Secret interview question");
  });
});
