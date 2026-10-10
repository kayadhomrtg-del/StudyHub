import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModuleDatabase } from "../modules/moduleDatabase";
import { ModuleRepository } from "../modules/ModuleRepository";
import { TopicRepository } from "../topics/TopicRepository";
import { MaterialRepository } from "../materials/MaterialRepository";
import { TaskRepository } from "../tasks/TaskRepository";
import { emptyTaskInput, TaskService } from "../tasks/TaskService";
import { NoteRepository } from "./NoteRepository";
import { NoteService } from "./NoteService";
import type { NoteRecord } from "./note";

let database: ModuleDatabase;
let service: NoteService;

beforeEach(async () => {
  database = new ModuleDatabase(`notes-test-${crypto.randomUUID()}`);
  await database.open();
  service = new NoteService(new NoteRepository(database), () => "note-1", () => "2026-02-03T12:00:00.000Z");
  await database.modules.add({
    id: "module-1",
    name: "Literature",
    code: "LIT-101",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await database.topics.add({
    id: "topic-1",
    moduleId: "module-1",
    title: "Week one",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await database.materials.add({
    id: "material-1",
    title: "Reading",
    originalFileName: "reading.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    sizeBytes: 10,
    moduleId: "module-1",
    topicId: "topic-1",
    tags: [],
    status: "not-started",
    isFavorite: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("NoteService", () => {
  it("creates, autosaves, searches, pins, and deletes a Markdown note", async () => {
    const created = await service.create();
    expect(created).toMatchObject({
      id: "note-1",
      markdown: "",
      isPinned: false,
      createdAt: "2026-02-03T12:00:00.000Z",
    });
    const saved = await service.saveDraft(created.id, {
      title: "  Close reading ",
      markdown: "# Character\nThe narrator is **unreliable**.",
      tags: [" literature ", "exam", "literature", ""],
      isPinned: false,
    });
    expect(saved).toMatchObject({
      title: "Close reading",
      tags: ["literature", "exam"],
      updatedAt: "2026-02-03T12:00:00.000Z",
    });
    await expect(service.search("unreliable")).resolves.toEqual([saved]);
    await expect(service.search("EXAM")).resolves.toEqual([saved]);
    expect(await service.setPinned(saved.id, true)).toMatchObject({ isPinned: true });
    await service.delete(saved.id);
    expect(await database.notes.count()).toBe(0);
  });

  it("saves module, topic, material, and task links and rejects missing local targets", async () => {
    const note = await service.create();
    const task = await new TaskService(new TaskRepository(database), () => "task-1").create({
      ...emptyTaskInput(),
      title: "Read chapter 2",
    });
    for (const link of [
      { type: "module", id: "module-1" },
      { type: "topic", id: "topic-1" },
      { type: "material", id: "material-1" },
      { type: "task", id: task.id, label: "Read chapter 2" },
    ] as const) {
      await service.saveDraft(note.id, {
        title: "Linked",
        markdown: "",
        tags: [],
        isPinned: false,
        link,
      });
      expect((await database.notes.get(note.id))?.link).toEqual(link);
    }
    await expect(service.saveDraft(note.id, {
      title: "Invalid",
      markdown: "",
      tags: [],
      isPinned: false,
      link: { type: "topic", id: "missing-topic" },
    })).rejects.toThrow(/linked topic no longer exists/i);
    await expect(service.saveDraft(note.id, {
      title: "Invalid",
      markdown: "",
      tags: [],
      isPinned: false,
      link: { type: "task", id: "missing-task" },
    })).rejects.toThrow(/linked task no longer exists/i);
    expect((await database.notes.get(note.id))?.link).toEqual({
      type: "task",
      id: task.id,
      label: "Read chapter 2",
    });
  });

  it("serializes rapid autosaves so the latest draft wins and survives reopening", async () => {
    const created = await service.create();
    const first = service.saveDraft(created.id, {
      title: "Draft 1",
      markdown: "first",
      tags: [],
      isPinned: false,
    });
    const latestDraft = {
      title: "Draft 2",
      markdown: "latest edit",
      tags: ["final"],
      isPinned: true,
    };
    const second = service.saveDraft(created.id, latestDraft);
    await Promise.all([first, second]);
    expect(await database.notes.get(created.id)).toMatchObject(latestDraft);

    const databaseName = database.name;
    database.close();
    const reopened = new ModuleDatabase(databaseName);
    await reopened.open();
    try {
      expect(await reopened.notes.get(created.id)).toMatchObject(latestDraft);
    } finally {
      reopened.close();
      await reopened.delete();
    }
  });

  it("clears deleted module/topic/material links but keeps linked notes and their content", async () => {
    const linkedNote: NoteRecord = {
      id: "note-1",
      title: "Keep my thought",
      markdown: "Saved locally.",
      tags: [],
      isPinned: true,
      link: { type: "topic", id: "topic-1" },
      createdAt: "2026-02-03T12:00:00.000Z",
      updatedAt: "2026-02-03T12:00:00.000Z",
    };
    await database.notes.add(linkedNote);
    await new TopicRepository(database).delete("topic-1");
    expect(await database.notes.get(linkedNote.id)).toMatchObject({
      title: linkedNote.title,
      markdown: linkedNote.markdown,
    });
    expect((await database.notes.get(linkedNote.id))?.link).toBeUndefined();

    await database.notes.update(linkedNote.id, { link: { type: "material", id: "material-1" } });
    await new MaterialRepository(database).delete("material-1");
    expect(await database.notes.get(linkedNote.id)).toMatchObject({ markdown: linkedNote.markdown });
    expect((await database.notes.get(linkedNote.id))?.link).toBeUndefined();

    await database.notes.update(linkedNote.id, { link: { type: "module", id: "module-1" } });
    await new ModuleRepository(database).delete("module-1");
    expect(await database.notes.get(linkedNote.id)).toMatchObject({ markdown: linkedNote.markdown });
    expect((await database.notes.get(linkedNote.id))?.link).toBeUndefined();
  });

  it("validates content, title, tag, and task-link bounds", async () => {
    const note = await service.create();
    await expect(service.saveDraft(note.id, {
      title: "n".repeat(201),
      markdown: "",
      tags: [],
      isPinned: false,
    })).rejects.toThrow(/note titles/i);
    await expect(service.saveDraft(note.id, {
      title: "Valid",
      markdown: "m".repeat(1_000_001),
      tags: [],
      isPinned: false,
    })).rejects.toThrow(/1,000,000 character/i);
    await expect(service.saveDraft(note.id, {
      title: "Valid",
      markdown: "",
      tags: ["t".repeat(51)],
      isPinned: false,
    })).rejects.toThrow(/tags/i);
  });
});
