import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { BackupService } from "./BackupService";
import { ModuleDatabase } from "../modules/moduleDatabase";
import type { MaterialRecord } from "../materials/material";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";
import type { NoteRecord } from "../notes/note";
import type { TaskRecord } from "../tasks/task";
import type { StudySessionRecord } from "../studySessions/studySession";

const databases: ModuleDatabase[] = [];

function createDatabase(name: string) {
  const database = new ModuleDatabase(`backup-${name}-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

const moduleRecord: ModuleRecord = {
  id: "module-1",
  name: "Local History",
  code: "HIST-100",
  isArchived: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};
const topicRecord: TopicRecord = {
  id: "topic-1",
  moduleId: moduleRecord.id,
  title: "Week 1",
  sortOrder: 0,
  createdAt: moduleRecord.createdAt,
  updatedAt: moduleRecord.updatedAt,
};
const originalBytes = new TextEncoder().encode("private course file").buffer;
const materialRecord: MaterialRecord = {
  id: "material-1",
  title: "Lecture",
  originalFileName: "lecture.txt",
  mimeType: "text/plain",
  extension: "txt",
  sizeBytes: originalBytes.byteLength,
  moduleId: moduleRecord.id,
  topicId: topicRecord.id,
  tags: ["reading"],
  status: "in-progress",
  isFavorite: true,
  createdAt: moduleRecord.createdAt,
  updatedAt: moduleRecord.updatedAt,
};

async function seed(database: ModuleDatabase) {
  await database.modules.add(moduleRecord);
  await database.topics.add(topicRecord);
  await database.materials.add(materialRecord);
  await database.storedFiles.add({ id: materialRecord.id, bytes: originalBytes });
}

const noteRecord: NoteRecord = {
  id: "note-1",
  title: "Lecture notes",
  markdown: "## Main idea",
  tags: ["review"],
  isPinned: true,
  link: { type: "task", id: "task-1" },
  createdAt: moduleRecord.createdAt,
  updatedAt: moduleRecord.updatedAt,
};
const taskRecord: TaskRecord = {
  id: "task-1",
  title: "Review lecture",
  description: "Read the lecture notes.",
  moduleId: moduleRecord.id,
  topicId: topicRecord.id,
  priority: "high",
  status: "in-progress",
  type: "reading",
  linkedMaterialIds: [materialRecord.id],
  tags: ["review"],
  createdAt: moduleRecord.createdAt,
  updatedAt: moduleRecord.updatedAt,
};
const sessionRecord: StudySessionRecord = {
  id: "session-1",
  moduleId: moduleRecord.id,
  topicId: topicRecord.id,
  materialId: materialRecord.id,
  title: "Review week one",
  plannedStart: "2025-01-03T10:00:00.000Z",
  plannedDurationMinutes: 45,
  goal: "Summarize the lecture",
  status: "planned",
  actualDurationMinutes: null,
  createdAt: moduleRecord.createdAt,
  updatedAt: moduleRecord.updatedAt,
};

async function seedComplete(database: ModuleDatabase) {
  await seed(database);
  await database.notes.add(noteRecord);
  await database.tasks.add(taskRecord);
  await database.studySessions.add(sessionRecord);
  await database.appSettings.add({ id: "appearance", theme: "dark" });
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("BackupService", () => {
  it("exports and restores every table, settings, and all file bytes", async () => {
    const source = createDatabase("complete-source");
    await seedComplete(source);
    const service = new BackupService(source);
    const backup = await service.createFullBackup();
    const target = createDatabase("complete-target");
    const targetService = new BackupService(target);

    await expect(targetService.inspect(backup.slice(0))).resolves.toMatchObject({
      kind: "full",
      version: 2,
      appVersion: expect.any(String),
      summary: {
        modules: 1,
        topics: 1,
        materials: 1,
        notes: 1,
        tasks: 1,
        studySessions: 1,
        settings: 1,
        files: 1,
        bytes: originalBytes.byteLength,
        totalBytes: backup.byteLength,
      },
    });
    await expect(targetService.restore(backup.slice(0), "replace")).resolves.toMatchObject({
      modules: 1, topics: 1, materials: 1, notes: 1, tasks: 1,
      studySessions: 1, settings: 1, files: 1,
    });
    expect(await target.notes.get(noteRecord.id)).toEqual(noteRecord);
    expect(await target.tasks.get(taskRecord.id)).toEqual(taskRecord);
    expect(await target.studySessions.get(sessionRecord.id)).toEqual(sessionRecord);
    expect(await target.appSettings.get("appearance")).toEqual({ id: "appearance", theme: "dark" });
    expect((await target.storedFiles.get(materialRecord.id))?.bytes).toEqual(originalBytes);
  });

  it("creates a valid empty backup and reports every empty count", async () => {
    const database = createDatabase("empty");
    const service = new BackupService(database);
    const backup = await service.createFullBackup();

    await expect(service.inspect(backup)).resolves.toMatchObject({
      version: 2,
      summary: {
        modules: 0, topics: 0, materials: 0, notes: 0, tasks: 0,
        studySessions: 0, settings: 0, files: 0, bytes: 0,
      },
    });
  });

  it("merges an identical appearance setting without overwriting it and rejects a different value", async () => {
    const source = createDatabase("settings-merge-source");
    await seedComplete(source);
    const backup = await new BackupService(source).createFullBackup();

    const matchingTarget = createDatabase("settings-merge-match");
    await matchingTarget.appSettings.add({ id: "appearance", theme: "dark" });
    await expect(new BackupService(matchingTarget).restore(backup.slice(0), "merge"))
      .resolves.toMatchObject({ modules: 1, notes: 1, tasks: 1 });
    expect(await matchingTarget.appSettings.get("appearance")).toEqual({ id: "appearance", theme: "dark" });
    expect(await matchingTarget.modules.get(moduleRecord.id)).toEqual(moduleRecord);

    const conflictingTarget = createDatabase("settings-merge-conflict");
    await conflictingTarget.appSettings.add({ id: "appearance", theme: "light" });
    await expect(new BackupService(conflictingTarget).restore(backup.slice(0), "merge"))
      .rejects.toThrow(/appearance setting differs/i);
    expect(await conflictingTarget.modules.count()).toBe(0);
    expect(await conflictingTarget.appSettings.get("appearance")).toEqual({ id: "appearance", theme: "light" });
  });

  it("migrates a supported version 1 archive and rejects a future version", async () => {
    const legacyArchive = new JSZip();
    legacyArchive.file("manifest.json", JSON.stringify({
      format: "college-study-hub-backup",
      version: 1,
      kind: "full",
      exportedAt: moduleRecord.createdAt,
      counts: { modules: 1, topics: 1, materials: 0 },
    }));
    legacyArchive.file("records.json", JSON.stringify({
      modules: [moduleRecord],
      topics: [topicRecord],
      materials: [],
    }));
    const legacyBackup = await legacyArchive.generateAsync({ type: "arraybuffer" });
    const target = createDatabase("legacy-target");
    const service = new BackupService(target);

    await expect(service.inspect(legacyBackup)).resolves.toMatchObject({
      version: 1,
      summary: { modules: 1, notes: 0, tasks: 0, studySessions: 0, settings: 0, files: 0 },
    });
    await service.restore(legacyBackup, "replace");
    expect(await target.modules.get(moduleRecord.id)).toEqual(moduleRecord);
    expect(await target.notes.count()).toBe(0);

    const futureArchive = await JSZip.loadAsync(legacyBackup);
    const manifest = JSON.parse(await futureArchive.file("manifest.json")!.async("string")) as { version: number };
    manifest.version = 3;
    futureArchive.file("manifest.json", JSON.stringify(manifest));
    await expect(service.inspect(await futureArchive.generateAsync({ type: "arraybuffer" })))
      .rejects.toThrow(/not supported/i);
  });

  it("rejects broken record links before replacing any existing database data", async () => {
    const source = createDatabase("broken-link-source");
    await seedComplete(source);
    const archive = await JSZip.loadAsync(await new BackupService(source).createFullBackup());
    const records = JSON.parse(await archive.file("records.json")!.async("string")) as {
      modules: ModuleRecord[];
      topics: TopicRecord[];
      materials: MaterialRecord[];
      notes: NoteRecord[];
      tasks: TaskRecord[];
      studySessions: StudySessionRecord[];
      settings: { id: "appearance"; theme: "light" | "dark" }[];
    };
    records.tasks[0]!.topicId = "missing-topic";
    archive.file("records.json", JSON.stringify(records));
    const tamperedBackup = await archive.generateAsync({ type: "arraybuffer" });
    const target = createDatabase("broken-link-target");
    const existing = { ...moduleRecord, id: "preserved", code: "PRESERVE" };
    await target.modules.add(existing);

    await expect(new BackupService(target).restore(tamperedBackup, "replace"))
      .rejects.toThrow(/invalid task|broken task link/i);
    expect(await target.modules.toArray()).toEqual([existing]);
  });

  it("exports and restores all metadata, relationships, and original bytes", async () => {
    const source = createDatabase("source");
    await seed(source);
    const backup = await new BackupService(source).createFullBackup();
    const target = createDatabase("target");
    const service = new BackupService(target);

    await expect(service.inspect(backup.slice(0))).resolves.toMatchObject({
      kind: "full",
      summary: { modules: 1, topics: 1, materials: 1, bytes: originalBytes.byteLength },
    });
    await expect(service.restore(backup.slice(0), "replace")).resolves.toMatchObject({
      modules: 1,
      topics: 1,
      materials: 1,
      bytes: originalBytes.byteLength,
    });
    expect(await target.modules.get(moduleRecord.id)).toEqual(moduleRecord);
    expect(await target.topics.get(topicRecord.id)).toEqual(topicRecord);
    expect(await target.materials.get(materialRecord.id)).toEqual(materialRecord);
    expect([...new Uint8Array((await target.storedFiles.get(materialRecord.id))!.bytes)]).toEqual([
      ...new Uint8Array(originalBytes),
    ]);
  });

  it("exports a module package including its topics, assigned material, and file bytes", async () => {
    const database = createDatabase("module");
    await seed(database);
    const service = new BackupService(database);
    const backup = await service.createModuleBackup(moduleRecord.id);
    const target = createDatabase("module-target");

    await new BackupService(target).restore(backup.slice(0), "merge");
    expect(await target.topics.get(topicRecord.id)).toEqual(topicRecord);
    expect(await target.storedFiles.get(materialRecord.id)).toBeDefined();
  });

  it("rejects merge collisions without changing existing records", async () => {
    const source = createDatabase("collision-source");
    await seed(source);
    const backup = await new BackupService(source).createFullBackup();
    const target = createDatabase("collision-target");
    await target.modules.add({ ...moduleRecord, id: "existing-module", code: moduleRecord.code.toLowerCase() });

    await expect(new BackupService(target).restore(backup.slice(0), "merge"))
      .rejects.toThrow(/module code.*already exists/i);
    expect(await target.modules.count()).toBe(1);
    expect(await target.topics.count()).toBe(0);
  });

  it("normalizes module codes when checking merge conflicts", async () => {
    const source = createDatabase("trimmed-code-source");
    await seed(source);
    const archive = await JSZip.loadAsync(await new BackupService(source).createFullBackup());
    const records = JSON.parse(await archive.file("records.json")!.async("string")) as {
      modules: ModuleRecord[];
      topics: TopicRecord[];
      materials: MaterialRecord[];
    };
    records.modules[0]!.code = " HIST-100 ";
    archive.file("records.json", JSON.stringify(records));
    const backup = await archive.generateAsync({ type: "arraybuffer" });
    const target = createDatabase("trimmed-code-target");
    await target.modules.add({ ...moduleRecord, id: "existing-module", code: "hist-100" });

    await expect(new BackupService(target).restore(backup, "merge"))
      .rejects.toThrow(/module code.*already exists/i);
    expect(await target.modules.count()).toBe(1);
  });

  it("rejects invalid archives and refuses to silently export missing file data", async () => {
    const database = createDatabase("invalid");
    const service = new BackupService(database);
    await expect(service.inspect(new Uint8Array([1, 2, 3]).buffer)).rejects.toThrow(/backup archive/i);
    await seed(database);
    await database.storedFiles.delete(materialRecord.id);
    await expect(service.createFullBackup()).rejects.toThrow(/missing or unreferenced file records/i);
  });

  it("rejects declared ZIP expansion limits before inflating archive entries", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", "{}");
    zip.file("records.json", "{}");
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const view = new DataView(bytes);
    let endOffset = -1;
    for (let offset = bytes.byteLength - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }
    expect(endOffset).toBeGreaterThanOrEqual(0);
    const directoryOffset = view.getUint32(endOffset + 16, true);
    const entryCount = view.getUint16(endOffset + 10, true);
    let entryOffset = directoryOffset;
    for (let index = 0; index < entryCount; index += 1) {
      const nameLength = view.getUint16(entryOffset + 28, true);
      const extraLength = view.getUint16(entryOffset + 30, true);
      const commentLength = view.getUint16(entryOffset + 32, true);
      const name = new TextDecoder().decode(new Uint8Array(bytes, entryOffset + 46, nameLength));
      if (name === "records.json") view.setUint32(entryOffset + 24, 64 * 1024 * 1024 + 1, true);
      entryOffset += 46 + nameLength + extraLength + commentLength;
    }
    await expect(new BackupService(createDatabase("zip-bomb")).inspect(bytes))
      .rejects.toThrow(/safe import limit/i);
  });

  it("checks archive CRCs before accepting or restoring file bytes", async () => {
    const source = createDatabase("crc-source");
    await seed(source);
    const archive = await JSZip.loadAsync(await new BackupService(source).createFullBackup());
    archive.file(`files/${materialRecord.id}.bin`, originalBytes, { compression: "STORE" });
    const backup = await archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
    const mutableBytes = new Uint8Array(backup);
    const originalContent = new TextEncoder().encode("private course file");
    let contentOffset = -1;
    for (let offset = 0; offset <= mutableBytes.length - originalContent.length; offset += 1) {
      if (originalContent.every((byte, index) => mutableBytes[offset + index] === byte)) {
        contentOffset = offset;
        break;
      }
    }
    expect(contentOffset).toBeGreaterThanOrEqual(0);
    mutableBytes[contentOffset] = (mutableBytes[contentOffset] ?? 0) ^ 1;

    await expect(new BackupService(createDatabase("crc-target")).inspect(backup))
      .rejects.toThrow(/crc|checksum|corrupt/i);
  });

  it("rejects omitted or unreferenced archive files before replacing current data", async () => {
    const source = createDatabase("tampered-source");
    await seed(source);
    const fullBackup = await new BackupService(source).createFullBackup();
    const archive = await JSZip.loadAsync(fullBackup);
    archive.remove("files/material-1.bin");
    const missingFileArchive = await archive.generateAsync({ type: "arraybuffer" });
    const target = createDatabase("tampered-target");
    await target.modules.add({ ...moduleRecord, id: "existing", code: "EXISTING" });
    const service = new BackupService(target);

    await expect(service.restore(missingFileArchive, "replace")).rejects.toThrow(/does not contain the original file/i);
    expect(await target.modules.get("existing")).toBeDefined();

    const extraArchive = await JSZip.loadAsync(fullBackup);
    extraArchive.file("files/orphan.bin", new Uint8Array([1, 2, 3]));
    await expect(service.inspect(await extraArchive.generateAsync({ type: "arraybuffer" })))
      .rejects.toThrow(/unreferenced entry/i);
  });

  it("validates and rolls back quota-style failures during restoration", async () => {
    const source = createDatabase("quota-source");
    await seed(source);
    const backup = await new BackupService(source).createFullBackup();
    const target = createDatabase("quota-target");
    const existingModule = { ...moduleRecord, id: "preserved-module", code: "PRESERVED" };
    await target.modules.add(existingModule);
    const addFiles = target.storedFiles.bulkAdd.bind(target.storedFiles);
    target.storedFiles.bulkAdd = (() => Promise.reject(new DOMException("quota", "QuotaExceededError"))) as unknown as typeof target.storedFiles.bulkAdd;

    try {
      await expect(new BackupService(target).restore(backup.slice(0), "replace")).rejects.toThrow();
      expect(await target.modules.get(existingModule.id)).toEqual(existingModule);
      expect(await target.modules.count()).toBe(1);
    } finally {
      target.storedFiles.bulkAdd = addFiles;
    }
  });
});
