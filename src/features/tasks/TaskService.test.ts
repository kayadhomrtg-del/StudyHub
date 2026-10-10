import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModuleDatabase } from "../modules/moduleDatabase";
import { ModuleRepository } from "../modules/ModuleRepository";
import { MaterialRepository } from "../materials/MaterialRepository";
import { TopicRepository } from "../topics/TopicRepository";
import { TaskRepository } from "./TaskRepository";
import { emptyTaskInput, TaskService } from "./TaskService";
import { filterTasks } from "./taskFilters";
import type { TaskRecord } from "./task";

let database: ModuleDatabase;
let service: TaskService;
let timestamp: number;
let id: number;

beforeEach(async () => {
  database = new ModuleDatabase(`task-test-${crypto.randomUUID()}`);
  await database.open();
  timestamp = Date.parse("2026-10-01T10:00:00.000Z");
  id = 0;
  service = new TaskService(new TaskRepository(database), () => `task-${++id}`, () => new Date(timestamp).toISOString());
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("TaskService", () => {
  it("creates, updates, and deletes tasks with stable IDs and timestamps", async () => {
    const created = await service.create({ ...emptyTaskInput(), title: "Read chapter" });
    expect(created).toMatchObject({
      id: "task-1",
      title: "Read chapter",
      priority: "medium",
      status: "not-started",
      type: "assignment",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    });
    timestamp += 60_000;
    const updated = await service.update(created.id, { ...emptyTaskInput(), ...created, moduleId: "", topicId: "", dueAt: "", title: "Read chapter 2" });
    expect(updated).toMatchObject({
      id: created.id,
      title: "Read chapter 2",
      createdAt: created.createdAt,
      updatedAt: "2026-10-01T10:01:00.000Z",
    });
    expect(await service.getAll()).toEqual([updated]);
    await service.delete(created.id);
    expect(await service.getAll()).toEqual([]);
  });

  it("validates titles, dates, tags, and optional missing dates", async () => {
    await expect(service.create({ ...emptyTaskInput(), title: "  " })).rejects.toThrow("Enter a task title.");
    await expect(service.create({ ...emptyTaskInput(), title: "Invalid date", dueAt: "not-a-date" })).rejects.toThrow("Enter a valid due date and time.");
    await expect(service.create({ ...emptyTaskInput(), title: "Impossible date", dueAt: "2026-02-31T10:00:00.000Z" })).rejects.toThrow("Enter a valid due date and time.");
    const undated = await service.create({ ...emptyTaskInput(), title: "No deadline" });
    expect(undated.dueAt).toBeUndefined();
    expect(filterTasks([undated], { search: "", status: "all", type: "all", moduleId: "all", date: "undated", sort: "due" }, {})).toEqual([undated]);
  });

  it("sets and reverses completion while maintaining completedAt correctly", async () => {
    const task = await service.create({ ...emptyTaskInput(), title: "Submit essay" });
    timestamp += 60_000;
    const completed = await service.setStatus(task.id, "completed");
    expect(completed).toMatchObject({ status: "completed", completedAt: "2026-10-01T10:01:00.000Z" });
    timestamp += 60_000;
    const reopened = await service.setStatus(task.id, "in-progress");
    expect(reopened.status).toBe("in-progress");
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.updatedAt).toBe("2026-10-01T10:02:00.000Z");
  });

  it("applies simultaneous status and priority changes without overwriting either", async () => {
    const task = await service.create({ ...emptyTaskInput(), title: "Combined changes" });
    await Promise.all([
      service.setStatus(task.id, "in-progress"),
      service.setPriority(task.id, "high"),
    ]);
    expect(await database.tasks.get(task.id)).toMatchObject({ status: "in-progress", priority: "high" });
  });

  it("validates optional module, topic, and material relationships", async () => {
    await expect(service.create({ ...emptyTaskInput(), title: "Bad link", moduleId: "missing" })).rejects.toThrow("selected module could not be found");
    await expect(service.create({ ...emptyTaskInput(), title: "Bad topic", topicId: "missing" })).rejects.toThrow("topic that belongs");
  });

  it("preserves a valid optional module and topic link", async () => {
    await database.modules.add({
      id: "module-1", name: "Local history", code: "HIST-101", isArchived: false,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    });
    await database.topics.add({
      id: "topic-1", moduleId: "module-1", title: "Archives", sortOrder: 0,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    });
    const task = await service.create({ ...emptyTaskInput(), title: "Research", moduleId: "module-1", topicId: "topic-1" });
    expect(task).toMatchObject({ moduleId: "module-1", topicId: "topic-1" });
  });

  it("clears stale record relationships without deleting task or note content", async () => {
    await database.modules.add({
      id: "module-1", name: "Local history", code: "HIST-101", isArchived: false,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    });
    await database.topics.add({
      id: "topic-1", moduleId: "module-1", title: "Archives", sortOrder: 0,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    });
    await database.materials.add({
      id: "material-1", title: "Source", originalFileName: "source.pdf", mimeType: "application/pdf",
      sizeBytes: 1, tags: [], status: "not-started", isFavorite: false,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    });
    const task = await service.create({
      ...emptyTaskInput(), title: "Research sources", moduleId: "module-1",
      topicId: "topic-1", linkedMaterialIds: ["material-1"],
    });
    await database.notes.add({
      id: "note-1", title: "Research notes", markdown: "Keep this text", tags: [], isPinned: false,
      link: { type: "task", id: task.id }, createdAt: new Date(timestamp).toISOString(), updatedAt: new Date(timestamp).toISOString(),
    });

    await new TopicRepository(database).delete("topic-1");
    expect(await database.tasks.get(task.id)).toMatchObject({ moduleId: "module-1", linkedMaterialIds: ["material-1"] });
    expect((await database.tasks.get(task.id))?.topicId).toBeUndefined();
    await new ModuleRepository(database).delete("module-1");
    expect(await database.tasks.get(task.id)).toMatchObject({ title: "Research sources", linkedMaterialIds: ["material-1"] });
    expect((await database.tasks.get(task.id))?.moduleId).toBeUndefined();
    await new MaterialRepository(database).delete("material-1");
    expect((await database.tasks.get(task.id))?.linkedMaterialIds).toEqual([]);

    await service.delete(task.id);
    expect(await database.tasks.get(task.id)).toBeUndefined();
    expect(await database.notes.get("note-1")).toMatchObject({ title: "Research notes", markdown: "Keep this text" });
    expect((await database.notes.get("note-1"))?.link).toBeUndefined();
  });

  it("returns only dated, future, open tasks for the dashboard", async () => {
    const dueSoon = await service.create({ ...emptyTaskInput(), title: "Due soon", dueAt: "2026-10-02T10:00:00.000Z" });
    await service.create({ ...emptyTaskInput(), title: "Overdue", dueAt: "2026-09-30T10:00:00.000Z" });
    const submitted = await service.create({ ...emptyTaskInput(), title: "Submitted", dueAt: "2026-10-03T10:00:00.000Z", status: "submitted" });
    await service.create({ ...emptyTaskInput(), title: "Undated" });
    expect(await service.getUpcoming(5, Date.parse("2026-10-01T10:00:00.000Z"))).toEqual([dueSoon]);
    expect(await service.setStatus(submitted.id, "completed")).toMatchObject({ completedAt: expect.any(String) });
  });

  it("filters and sorts by search, status, date state, and priority", async () => {
    const overdue = await service.create({ ...emptyTaskInput(), title: "Lab write-up", dueAt: "2026-09-30T10:00:00.000Z", priority: "high" });
    const upcoming = await service.create({ ...emptyTaskInput(), title: "Reading", dueAt: "2026-10-03T10:00:00.000Z", priority: "low" });
    const completed = await service.create({ ...emptyTaskInput(), title: "Done", dueAt: "2026-10-02T10:00:00.000Z", status: "completed" });
    const options = { search: "", status: "all", type: "all", moduleId: "all", date: "overdue" as const, sort: "priority" as const };
    expect(filterTasks([overdue, upcoming], options, {}, Date.parse("2026-10-01T10:00:00.000Z"))).toEqual([overdue]);
    expect(filterTasks([upcoming, overdue], { ...options, date: "all" }, {}, Date.parse("2026-10-01T10:00:00.000Z"))).toEqual([overdue, upcoming]);
    expect(filterTasks([overdue, upcoming], { ...options, search: "read", date: "all" }, {}, Date.parse("2026-10-01T10:00:00.000Z"))).toEqual([upcoming]);
    const records: TaskRecord[] = [overdue, upcoming, completed];
    expect(filterTasks(records, { ...options, status: "completed", date: "all" }, {})).toEqual([completed]);
  });
});
