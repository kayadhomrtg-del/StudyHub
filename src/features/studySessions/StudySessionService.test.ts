import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModuleDatabase } from "../modules/moduleDatabase";
import { ModuleRepository } from "../modules/ModuleRepository";
import { MaterialRepository } from "../materials/MaterialRepository";
import { TopicRepository } from "../topics/TopicRepository";
import { StudySessionRepository } from "./StudySessionRepository";
import { StudySessionService } from "./StudySessionService";
import { emptyStudySessionInput } from "./studySession";

let database: ModuleDatabase;
let service: StudySessionService;
let currentTime: number;

const timestamp = "2026-01-01T10:00:00.000Z";
const plannedStart = "2026-06-15T14:00";
const validInput = {
  ...emptyStudySessionInput(),
  moduleId: "module-1",
  title: "Review lecture notes",
  plannedStart,
};

beforeEach(async () => {
  database = new ModuleDatabase(`study-session-test-${crypto.randomUUID()}`);
  await database.open();
  await database.modules.add({
    id: "module-1",
    name: "Biology",
    code: "BIO-101",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await database.modules.add({
    id: "module-2",
    name: "Physics",
    code: "PHY-101",
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await database.topics.add({
    id: "topic-1",
    moduleId: "module-1",
    title: "Cell biology",
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  currentTime = Date.parse(timestamp);
  let id = 0;
  service = new StudySessionService(
    new StudySessionRepository(database),
    () => `session-${++id}`,
    () => new Date(currentTime).toISOString(),
  );
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("StudySessionService", () => {
  it("creates, reads, updates, completes, skips, and deletes sessions", async () => {
    const created = await service.create({
      ...validInput,
      topicId: "topic-1",
      goal: "Finish reading",
      actualDurationMinutes: null,
    });
    expect(created).toMatchObject({
      id: "session-1",
      moduleId: "module-1",
      topicId: "topic-1",
      title: "Review lecture notes",
      plannedStart: localTimeToExpectedIso(plannedStart),
      status: "planned",
      actualDurationMinutes: null,
      goal: "Finish reading",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(await service.getAll()).toEqual([created]);

    currentTime += 60_000;
    const updated = await service.update(created.id, { ...validInput, title: "Revise lecture notes" });
    expect(updated).toMatchObject({
      id: created.id,
      title: "Revise lecture notes",
      createdAt: created.createdAt,
      updatedAt: new Date(currentTime).toISOString(),
    });

    const completed = await service.setStatus(created.id, "completed", 45);
    expect(completed).toMatchObject({ status: "completed", actualDurationMinutes: 45 });
    expect(await service.setStatus(created.id, "skipped")).toMatchObject({ status: "skipped" });

    await service.delete(created.id);
    await expect(service.getById(created.id)).resolves.toBeUndefined();
  });

  it("rejects invalid fields before writing a record", async () => {
    await expect(service.create({ ...validInput, title: "  " })).rejects.toThrow("Enter a study session title.");
    await expect(service.create({ ...validInput, plannedDurationMinutes: 0 })).rejects.toThrow("at least one minute");
    await expect(service.create({ ...validInput, actualDurationMinutes: -1 })).rejects.toThrow("zero or more whole minutes");
    await expect(service.create({ ...validInput, plannedStart: "" })).rejects.toThrow("valid planned start");
    await expect(service.getAll()).resolves.toEqual([]);
  });

  it("checks module and topic relationships before saving", async () => {
    await expect(service.create({ ...validInput, moduleId: "missing-module" })).rejects.toThrow("existing module");
    await expect(service.create({ ...validInput, moduleId: "module-2", topicId: "topic-1" })).rejects.toThrow("belongs to the selected module");
    await expect(service.getAll()).resolves.toEqual([]);
  });

  it("allows optional topic, material, and goal fields to be omitted", async () => {
    const created = await service.create({ ...validInput, topicId: "", materialId: "", goal: "" });
    expect(created.topicId).toBeUndefined();
    expect(created.materialId).toBeUndefined();
    expect(created.goal).toBeUndefined();
  });

  it("retains deleted-module sessions and allows their status to be updated", async () => {
    const created = await service.create({ ...validInput, topicId: "topic-1" });
    await new ModuleRepository(database).delete("module-1");

    const unlinked = await service.getById(created.id);
    expect(unlinked?.moduleId).toBeUndefined();
    expect(unlinked?.topicId).toBeUndefined();
    const completed = await service.setStatus(created.id, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.moduleId).toBeUndefined();
  });

  it("clears deleted topic and material links without deleting the session", async () => {
    await database.materials.add({
      id: "material-1",
      title: "Cell notes",
      originalFileName: "cells.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      moduleId: "module-1",
      topicId: "topic-1",
      tags: [],
      status: "not-started",
      isFavorite: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const created = await service.create({
      ...validInput,
      topicId: "topic-1",
      materialId: "material-1",
    });

    await new TopicRepository(database).delete("topic-1");
    const afterTopicDelete = await service.getById(created.id);
    expect(afterTopicDelete?.id).toBe(created.id);
    expect(afterTopicDelete?.topicId).toBeUndefined();

    await new MaterialRepository(database).delete("material-1");
    const retained = await service.getById(created.id);
    expect(retained?.id).toBe(created.id);
    expect(retained?.materialId).toBeUndefined();
  });
});

function localTimeToExpectedIso(localDateTime: string): string {
  return new Date(Number(localDateTime.slice(0, 4)), Number(localDateTime.slice(5, 7)) - 1, Number(localDateTime.slice(8, 10)),
    Number(localDateTime.slice(11, 13)), Number(localDateTime.slice(14, 16))).toISOString();
}
