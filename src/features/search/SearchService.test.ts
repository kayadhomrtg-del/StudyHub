import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleDatabase } from "../modules/moduleDatabase";
import { TaskRepository } from "../tasks/TaskRepository";
import { SearchRepository } from "./SearchRepository";
import { SearchService } from "./SearchService";
import { emptyTaskInput, TaskService } from "../tasks/TaskService";

let database: ModuleDatabase;
let service: SearchService;

beforeEach(async () => {
  database = new ModuleDatabase(`search-test-${crypto.randomUUID()}`);
  await database.open();
  service = new SearchService(new SearchRepository(database));
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("SearchService", () => {
  it("searches every requested category and creates relevant detail links", async () => {
    const timestamp = "2026-10-01T10:00:00.000Z";
    await database.modules.add({
      id: "module-1", name: "Cellular Biology", code: "BIO-220", isArchived: false,
      createdAt: timestamp, updatedAt: timestamp,
    });
    await database.topics.add({
      id: "topic-1", moduleId: "module-1", title: "Mitosis", description: "Cell division", sortOrder: 0,
      createdAt: timestamp, updatedAt: timestamp,
    });
    await database.materials.add({
      id: "material-1", title: "Mitosis", originalFileName: "cell-cycle.pdf", mimeType: "application/pdf",
      sizeBytes: 10, tags: ["cellular"], status: "not-started", isFavorite: false,
      createdAt: timestamp, updatedAt: timestamp,
    });
    await database.notes.add({
      id: "note-1", title: "Lab observations", markdown: "Cell samples under the microscope",
      tags: ["biology"], isPinned: false, createdAt: timestamp, updatedAt: timestamp,
    });
    const taskService = new TaskService(new TaskRepository(database), () => "task-1", () => timestamp);
    await taskService.create({ ...emptyTaskInput(), title: "Cell report", description: "Write up the cell culture results" });

    const result = await service.search("cell");
    expect(result.modules.map((item) => [item.title, item.href])).toEqual([["Cellular Biology", "/modules/module-1"]]);
    expect(result.topics.map((item) => [item.title, item.href])).toEqual([["Mitosis", "/modules/module-1"]]);
    expect(result.materials.map((item) => [item.title, item.href])).toEqual([["Mitosis", "/materials/material-1"]]);
    expect(result.notes.map((item) => [item.title, item.href])).toEqual([["Lab observations", "/notes/note-1"]]);
    expect(result.tasks.map((item) => [item.title, item.href])).toEqual([["Cell report", "/tasks?taskId=task-1"]]);
  });

  it("searches codes, tags, filenames, Markdown, and task descriptions case-insensitively", async () => {
    const timestamp = "2026-10-01T10:00:00.000Z";
    await database.modules.add({
      id: "m", name: "Ecology", code: "ENV-333", isArchived: false, createdAt: timestamp, updatedAt: timestamp,
    });
    await database.materials.add({
      id: "mat", title: "Lecture slides", originalFileName: "Climate-Change.PDF", mimeType: "application/pdf",
      sizeBytes: 1, tags: ["CarbonCycle"], status: "not-started", isFavorite: false, createdAt: timestamp, updatedAt: timestamp,
    });
    await database.notes.add({
      id: "n", title: "Field notes", markdown: "Observe the CANOPY", tags: ["fieldwork"],
      isPinned: false, createdAt: timestamp, updatedAt: timestamp,
    });
    expect((await service.search("env-333")).modules).toHaveLength(1);
    expect((await service.search("carboncycle")).materials).toHaveLength(1);
    expect((await service.search("climate-change")).materials).toHaveLength(1);
    expect((await service.search("canopy")).notes).toHaveLength(1);
  });

  it("restricts database reads to a selected category and never reads file blobs", async () => {
    const taskRows = vi.spyOn(database.tasks, "toArray");
    const materialRows = vi.spyOn(database.materials, "toArray");
    const blobRows = vi.spyOn(database.storedFiles, "toArray");
    await service.search("biology", "modules");
    expect(taskRows).not.toHaveBeenCalled();
    expect(materialRows).not.toHaveBeenCalled();
    expect(blobRows).not.toHaveBeenCalled();
  });

  it("returns no results for an empty database and an empty query", async () => {
    expect(await service.search("not here")).toEqual({
      modules: [], topics: [], materials: [], notes: [], tasks: [],
    });
    expect(await service.search("   ")).toEqual({
      modules: [], topics: [], materials: [], notes: [], tasks: [],
    });
  });
});
