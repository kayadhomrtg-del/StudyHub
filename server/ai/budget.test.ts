// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AiBudget, localDateKey } from "./budget";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const TODAY = localDateKey(NOW);
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "study-hub-ai-budget-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeUsageFile(
  path: string,
  contents: unknown,
): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(
    path,
    typeof contents === "string" ? contents : JSON.stringify(contents),
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("local request budget", () => {
  it("fails closed when the usage counter is missing", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");
    const budget = new AiBudget(path, () => NOW);

    const state = await budget.read(20);
    expect(state.status).toBe("missing");

    const charged = await budget.charge(20);
    expect(charged.ok).toBe(false);
    if (!charged.ok) {
      expect(charged.code).toBe("local_limit");
      expect(charged.reason).toContain("never reset silently");
    }
  });

  it("fails closed when the usage counter is malformed", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");

    for (const contents of [
      "not json",
      JSON.stringify({ schemaVersion: 2, windowStart: TODAY, used: 0 }),
      JSON.stringify({ schemaVersion: 1, windowStart: "22-10-2026", used: 0 }),
      JSON.stringify({ schemaVersion: 1, windowStart: TODAY, used: -3 }),
      JSON.stringify({ schemaVersion: 1, windowStart: TODAY, used: 1.5 }),
      JSON.stringify({ schemaVersion: 1, windowStart: TODAY, used: "1" }),
      JSON.stringify([1, 2, 3]),
    ]) {
      await writeUsageFile(path, contents);
      const budget = new AiBudget(path, () => NOW);
      const state = await budget.read(20);

      expect(state.status).toBe("malformed");
      const charged = await budget.charge(20);
      expect(charged.ok).toBe(false);
    }
  });

  it("fails closed when the usage counter cannot be read", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");
    await mkdir(path, { recursive: true });

    const budget = new AiBudget(path, () => NOW);
    const state = await budget.read(20);

    expect(state.status).toBe("unreadable");
    const charged = await budget.charge(20);
    expect(charged.ok).toBe(false);
  });

  it("fails closed when the usage window starts in the future", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");
    await writeUsageFile(path, {
      schemaVersion: 1,
      windowStart: "2026-11-01",
      used: 0,
      updatedAt: NOW.toISOString(),
    });

    const budget = new AiBudget(path, () => NOW);
    const state = await budget.read(20);

    expect(state.status).toBe("clock");
    const charged = await budget.charge(20);
    expect(charged.ok).toBe(false);
  });

  it("starts a fresh count on a new local calendar day", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");
    await writeUsageFile(path, {
      schemaVersion: 1,
      windowStart: "2026-10-21",
      used: 18,
      updatedAt: NOW.toISOString(),
    });

    const budget = new AiBudget(path, () => NOW);
    const state = await budget.read(20);

    expect(state.status).toBe("ok");
    if (state.status !== "ok") {
      return;
    }
    expect(state.windowStart).toBe(TODAY);
    expect(state.used).toBe(0);
    expect(state.remaining).toBe(20);

    const charged = await budget.charge(20);
    expect(charged.ok).toBe(true);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.windowStart).toBe(TODAY);
    expect(written.used).toBe(1);
  });

  it("charges exactly one unit per dispatch and refuses past the cap", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");
    await writeUsageFile(path, {
      schemaVersion: 1,
      windowStart: TODAY,
      used: 2,
      updatedAt: NOW.toISOString(),
    });

    const budget = new AiBudget(path, () => NOW);
    const charged = await budget.charge(20);
    expect(charged.ok).toBe(true);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.used).toBe(3);

    await writeUsageFile(path, {
      schemaVersion: 1,
      windowStart: TODAY,
      used: 20,
      updatedAt: NOW.toISOString(),
    });

    const exhausted = await budget.read(20);
    expect(exhausted.status).toBe("ok");
    if (exhausted.status === "ok") {
      expect(exhausted.remaining).toBe(0);
    }

    const refused = await budget.charge(20);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe("local_limit");
    }
  });

  it("writes the counter atomically and leaves no temporary files", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");
    await writeUsageFile(path, {
      schemaVersion: 1,
      windowStart: TODAY,
      used: 0,
      updatedAt: NOW.toISOString(),
    });

    const budget = new AiBudget(path, () => NOW);
    await budget.charge(20);

    const files = await readdir(join(directory, ".study-hub"));
    expect(files).toEqual(["ai-usage.json"]);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.schemaVersion).toBe(1);
    expect(written.updatedAt).toBe(NOW.toISOString());
  });

  it("keeps a corrupted counter from granting extra capacity", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, ".study-hub", "ai-usage.json");
    await writeUsageFile(path, "{ broken");

    const budget = new AiBudget(path, () => NOW);
    const state = await budget.read(20);

    expect(state.status).not.toBe("ok");
    expect(state.status === "ok" ? state.remaining : 0).toBe(0);
  });
});
