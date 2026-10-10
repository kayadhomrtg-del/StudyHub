import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModuleDatabase } from "../modules/moduleDatabase";
import { TopicRepository } from "./TopicRepository";
import { TopicService } from "./TopicService";

let database: ModuleDatabase;
let service: TopicService;
let id: number;

beforeEach(async () => {
  database = new ModuleDatabase(`topic-test-${crypto.randomUUID()}`);
  await database.open();
  await database.modules.add({
    id: "module-1",
    name: "History",
    code: "HIS-1",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  id = 0;
  service = new TopicService(
    new TopicRepository(database),
    () => `topic-${++id}`,
    () => "2026-01-02T00:00:00.000Z",
  );
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("TopicService", () => {
  it("creates, renames, reorders, and persists module topics", async () => {
    const first = await service.create("module-1", { title: "  Week one  ", description: "  Overview of the unit " });
    const second = await service.create("module-1", { title: "Week two" });
    expect(first.title).toBe("Week one");

    await service.rename(first.id, { title: "Introduction", description: "Introductory material" });
    await service.move(second.id, -1);

    expect(await service.getByModule("module-1")).toMatchObject([
      { id: second.id, title: "Week two", sortOrder: 0 },
      { id: first.id, title: "Introduction", description: "Introductory material", sortOrder: 1 },
    ]);
    expect(await database.topics.get(first.id)).toMatchObject({
      createdAt: first.createdAt,
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("rejects blank topic titles", async () => {
    await expect(service.create("module-1", { title: "  " })).rejects.toThrow(
      "Enter a topic name.",
    );
    await expect(service.getByModule("module-1")).resolves.toHaveLength(0);
  });

  it("validates and trims optional descriptions", async () => {
    const topic = await service.create("module-1", { title: "Climate", description: " Climate systems " });
    expect(topic.description).toBe("Climate systems");
    await expect(service.create("module-1", { title: "Invalid", description: "d".repeat(1001) }))
      .rejects.toThrow("Topic descriptions must be 1,000 characters or fewer.");
  });

  it("unassigns topic materials when deleting a topic", async () => {
    const topic = await service.create("module-1", { title: "Week one" });
    await database.materials.add({
      id: "material-1",
      title: "Lecture",
      originalFileName: "lecture.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      moduleId: "module-1",
      topicId: topic.id,
      tags: [],
      status: "not-started",
      isFavorite: false,
      createdAt: topic.createdAt,
      updatedAt: topic.createdAt,
    });

    await service.delete(topic.id);

    expect(await database.topics.get(topic.id)).toBeUndefined();
    const material = await database.materials.get("material-1");
    expect(material?.moduleId).toBe("module-1");
    expect(material?.topicId).toBeUndefined();
  });
});
