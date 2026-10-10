import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { BackupService } from "./BackupService";
import { ModuleDatabase } from "../modules/moduleDatabase";
import type { MaterialRecord } from "../materials/material";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";

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

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe("BackupService", () => {
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
    await expect(service.createFullBackup()).rejects.toThrow(/missing or damaged/i);
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
      if (name === "records.json") view.setUint32(entryOffset + 24, 16 * 1024 * 1024 + 1, true);
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
