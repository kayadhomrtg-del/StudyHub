import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleDatabase } from "../modules/moduleDatabase";
import { MaterialRepository } from "./MaterialRepository";
import { MaterialService } from "./MaterialService";

let database: ModuleDatabase;
let service: MaterialService;
let nextId: number;
const file = (name: string, content = "original bytes") =>
  new File([content], name, { type: "text/plain" });

beforeEach(async () => {
  database = new ModuleDatabase(`material-test-${crypto.randomUUID()}`);
  await database.open();
  nextId = 0;
  service = new MaterialService(
    new MaterialRepository(database),
    () => `material-${++nextId}`,
    () => "2026-02-01T12:00:00.000Z",
  );
  await database.modules.bulkAdd([
    {
      id: "module-1",
      name: "Literature",
      code: "LIT-101",
      isArchived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "module-2",
      name: "Physics",
      code: "PHY-102",
      isArchived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await database.topics.add({
    id: "topic-1",
    moduleId: "module-1",
    title: "Week one",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("MaterialService", () => {
  it("imports files with separate metadata and original bytes, including duplicate names", async () => {
    const results = await service.importFiles(
      [file("lecture.txt", "first bytes"), file("lecture.txt", "second bytes")],
      {
        assignment: { moduleId: "module-1", topicId: "topic-1" },
        tags: [" revision ", "lecture", "revision", ""],
      },
    );

    expect(results.map((result) => result.status)).toEqual(["success", "success"]);
    const successful = results.filter((result) => result.status === "success");
    expect(successful[0].material.id).not.toBe(successful[1].material.id);
    expect(successful[0].material.originalFileName).toBe("lecture.txt");
    expect(successful[0].material).toMatchObject({
      moduleId: "module-1",
      topicId: "topic-1",
      tags: ["revision", "lecture"],
      status: "not-started",
      isFavorite: false,
    });

    const firstBytes = await service.getFile(successful[0].material.id);
    const secondBytes = await service.getFile(successful[1].material.id);
    expect(new TextDecoder().decode(firstBytes?.bytes)).toBe("first bytes");
    expect(new TextDecoder().decode(secondBytes?.bytes)).toBe("second bytes");
    expect(await database.materials.count()).toBe(2);
    expect(await database.storedFiles.count()).toBe(2);
  });

  it("keeps material unassigned and preserves bytes across database reopen", async () => {
    const result = await service.importFiles([file("reading.txt")]);
    expect(result[0].status).toBe("success");
    if (result[0].status !== "success") throw new Error("Import should succeed.");
    expect(result[0].material.moduleId).toBeUndefined();
    expect(result[0].material.topicId).toBeUndefined();

    const id = result[0].material.id;
    const name = database.name;
    database.close();
    const reopened = new ModuleDatabase(name);
    await reopened.open();
    try {
      expect(await reopened.materials.get(id)).toEqual(result[0].material);
      expect(
        new TextDecoder().decode((await reopened.storedFiles.get(id))?.bytes),
      ).toBe("original bytes");
    } finally {
      reopened.close();
      await reopened.delete();
    }
  });

  it("rejects a topic from another module without storing either record", async () => {
    const results = await service.importFiles([file("invalid.txt")], {
      assignment: { moduleId: "module-2", topicId: "topic-1" },
    });

    expect(results[0]).toMatchObject({
      status: "failure",
      fileName: "invalid.txt",
      message: "Choose a topic that belongs to the selected module.",
    });
    expect(await database.materials.count()).toBe(0);
    expect(await database.storedFiles.count()).toBe(0);
  });

  it("rolls back file bytes when saving metadata fails with a quota error", async () => {
    vi.spyOn(database.materials, "add").mockRejectedValueOnce(
      new DOMException("Storage full", "QuotaExceededError"),
    );

    const results = await service.importFiles([file("too-large.txt")]);

    expect(results[0]).toMatchObject({
      status: "failure",
      message: expect.stringContaining("Not enough browser storage"),
    });
    expect(await database.materials.count()).toBe(0);
    expect(await database.storedFiles.count()).toBe(0);
  });

  it("reports results per file and continues after one file fails", async () => {
    vi.spyOn(database.materials, "add").mockRejectedValueOnce(
      new DOMException("Storage full", "QuotaExceededError"),
    );

    const results = await service.importFiles([
      file("first.txt"),
      file("second.txt"),
    ]);

    expect(results.map((result) => result.status)).toEqual(["failure", "success"]);
    expect(await database.materials.count()).toBe(1);
    expect(await database.storedFiles.count()).toBe(1);
  });

  it("persists material relationships, tags, favorites, and study status", async () => {
    const imported = await service.importFiles([file("study.txt")]);
    if (imported[0].status !== "success") throw new Error("Import should succeed.");
    const id = imported[0].material.id;

    await service.updateDetails(id, { moduleId: "module-1", topicId: "topic-1" }, [
      "reading",
      " reading ",
      "exam",
    ]);
    await service.setFavorite(id, true);
    await service.setStatus(id, "in-progress");

    expect(await service.getById(id)).toMatchObject({
      moduleId: "module-1",
      topicId: "topic-1",
      tags: ["reading", "exam"],
      isFavorite: true,
      status: "in-progress",
    });
  });

  it("removes material metadata and bytes together when explicitly deleted", async () => {
    const imported = await service.importFiles([file("remove.txt")]);
    if (imported[0].status !== "success") throw new Error("Import should succeed.");
    await service.delete(imported[0].material.id);

    expect(await database.materials.count()).toBe(0);
    expect(await database.storedFiles.count()).toBe(0);
  });
});
