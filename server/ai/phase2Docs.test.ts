// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  AI_DISCLOSURES,
  AI_PREPARE_DISCLOSURE,
  type AiDisclosure,
} from "../../src/features/ai/disclosures";

interface DocumentedDisclosure {
  id: string;
  title: string;
  text: string;
}

function normalize(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readDisclosuresFromPlan(): Promise<DocumentedDisclosure[]> {
  const path = fileURLToPath(new URL("../../docs/AI_PLAN.md", import.meta.url));
  const text = await readFile(path, "utf8");
  const start = text.indexOf("### 8.2 Mandatory disclosures");
  const end = text.indexOf("### 8.3", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  const section = text.slice(start, end);
  const chunks = section.split(/\n(?=- \*\*M\d — )/).slice(1);
  return chunks.map((chunk) => {
    const match = /^- \*\*(M\d) — (.+?)\.\*\*\s+([\s\S]*)$/.exec(chunk);
    expect(match, `could not parse disclosure from ${chunk.slice(0, 80)}`).not.toBeNull();
    if (!match) {
      return { id: "", title: "", text: "" };
    }
    return {
      id: match[1],
      title: `${match[2]}.`,
      text: normalize(match[3]),
    };
  });
}

function expectedFromDocument(
  documented: DocumentedDisclosure[],
): Omit<AiDisclosure, "id">[] {
  return documented.map(({ title, text }) => ({ title, text }));
}

describe("Phase 2 disclosures", () => {
  it("keeps all eight mandatory disclosures verbatim against AI_PLAN.md section 8.2", async () => {
    const documented = await readDisclosuresFromPlan();

    expect(documented.map((entry) => entry.id)).toEqual([
      "M1",
      "M2",
      "M3",
      "M4",
      "M5",
      "M6",
      "M7",
      "M8",
    ]);
    expect(AI_DISCLOSURES.map(({ title, text }) => ({ title, text }))).toEqual(
      expectedFromDocument(documented),
    );
  });

  it("keeps the disclosure list immutable at runtime", () => {
    expect(Object.isFrozen(AI_DISCLOSURES)).toBe(true);
    for (const disclosure of AI_DISCLOSURES) {
      expect(Object.isFrozen(disclosure)).toBe(true);
      expect(disclosure.text.trim()).not.toBe("");
    }
  });

  it("keeps the loopback preparation explanation separate from M1-M8", () => {
    expect(AI_DISCLOSURES.some((entry) => entry.title === "Preparation")).toBe(
      false,
    );
    expect(AI_PREPARE_DISCLOSURE).toContain(
      "local StudyHub proxy on this computer",
    );
    expect(AI_PREPARE_DISCLOSURE).toContain(
      "No provider is contacted during preparation",
    );
    expect(AI_PREPARE_DISCLOSURE).toContain(
      "The local fallback makes no network request",
    );
  });
});
