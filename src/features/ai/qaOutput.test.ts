import { describe, expect, it } from "vitest";

import { parseQaOutput } from "./qaOutput";

describe("parseQaOutput", () => {
  it("parses an answer with string references", () => {
    expect(
      parseQaOutput(
        JSON.stringify({
          answer: "  Clouds form as vapor cools.  ",
          references: [" Section 2 ", "Page 4"],
        }),
      ),
    ).toEqual({
      ok: true,
      content: {
        answer: "Clouds form as vapor cools.",
        references: ["Section 2", "Page 4"],
      },
    });
  });

  it("allows absent references and omits invalid reference entries", () => {
    expect(parseQaOutput('{"answer":"A valid answer."}')).toEqual({
      ok: true,
      content: { answer: "A valid answer." },
    });
    expect(
      parseQaOutput(
        JSON.stringify({ answer: "A valid answer.", references: [" Page 3 ", 4, " "] }),
      ),
    ).toEqual({
      ok: true,
      content: { answer: "A valid answer.", references: ["Page 3"] },
    });
  });

  it.each([
    ["empty output", ""],
    ["invalid JSON", "not JSON"],
    ["empty answer", '{"answer":"  "}'],
    ["non-string answer", '{"answer":3}'],
    ["unexpected field", '{"answer":"A","citations":[]}'],
  ])("returns raw output for %s", (_label, output) => {
    expect(parseQaOutput(output)).toMatchObject({ ok: false, rawText: output });
  });

  it("omits a malformed references field without discarding the answer", () => {
    expect(
      parseQaOutput(JSON.stringify({ answer: "A valid answer.", references: "Page 1" })),
    ).toEqual({ ok: true, content: { answer: "A valid answer." } });
  });
});
