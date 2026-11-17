// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/ai.mjs", () => ({
  chat: vi.fn(),
}));

import handler from "../../api/profile.mjs";
import { chat } from "../../api/_lib/ai.mjs";

function makeRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
    setHeader() {},
  };
  return res;
}

async function run(skills, targetRoles = ["Engineer"]) {
  vi.mocked(chat).mockResolvedValueOnce(JSON.stringify({
    skills,
    experienceLevel: "Senior",
    targetRoles,
    location: "",
  }));
  const res = makeRes();
  await handler(
    { method: "POST", headers: {}, body: { text: "Synthetic CV text with named technologies." } },
    res
  );
  return res;
}

describe("JM-TRANSLATION-ATS-ORCH-01: profile skill completeness", () => {
  beforeEach(() => {
    vi.mocked(chat).mockReset();
  });

  it("keeps more than the former 20-skill cap", async () => {
    const skills = Array.from({ length: 30 }, (_, index) => `Technology ${index + 1}`);
    const res = await run(skills);

    expect(res.statusCode).toBe(200);
    expect(res.data.skills).toHaveLength(30);
    expect(res.data.skills[29]).toBe("Technology 30");
  });

  it("still keeps target roles bounded", async () => {
    const skills = ["AWS"];
    const roles = Array.from({ length: 25 }, (_, index) => `Role ${index + 1}`);
    const res = await run(skills, roles);

    expect(res.statusCode).toBe(200);
    expect(res.data.targetRoles).toHaveLength(20);
  });
});
