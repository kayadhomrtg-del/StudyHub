import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { ModuleRepository } from "./ModuleRepository";
import { ModuleDatabase } from "./moduleDatabase";
import { ModuleService, ModuleValidationError } from "./ModuleService";
import type { ModuleInput } from "./module";

const validInput: ModuleInput = {
  name: "Foundations of Ecology",
  code: "ECO-101",
  semester: "Fall",
  academicYear: "2026–2027",
  lecturer: "Dr. Rivera",
  description: "Principles of ecological systems.",
  color: "#396f4e",
};

let database: ModuleDatabase;
let service: ModuleService;
let nextId: number;
let currentTime: number;

beforeEach(async () => {
  database = new ModuleDatabase(`module-service-test-${crypto.randomUUID()}`);
  await database.open();
  nextId = 0;
  currentTime = Date.parse("2026-01-01T10:00:00.000Z");
  service = new ModuleService(
    new ModuleRepository(database),
    () => `stable-id-${++nextId}`,
    () => new Date(currentTime).toISOString(),
  );
});

afterEach(async () => {
  database.close();
  await database.delete();
});

describe("ModuleService", () => {
  it("creates, reads, updates, and deletes module records", async () => {
    const created = await service.create(validInput);

    expect(created).toMatchObject({
      id: "stable-id-1",
      name: "Foundations of Ecology",
      code: "ECO-101",
      semester: "Fall",
      academicYear: "2026–2027",
      lecturer: "Dr. Rivera",
      description: "Principles of ecological systems.",
      color: "#396f4e",
      isArchived: false,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    });
    expect(await service.getById(created.id)).toEqual(created);
    expect(await service.getAll()).toEqual([created]);

    currentTime += 60_000;
    const updated = await service.update(created.id, {
      ...validInput,
      name: "Ecology and Environment",
      semester: "",
      academicYear: "",
      lecturer: "",
      description: "",
      color: "",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Ecology and Environment");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe("2026-01-01T10:01:00.000Z");
    expect(updated.semester).toBeUndefined();
    expect(await database.modules.get(created.id)).toEqual(updated);

    await service.delete(created.id);
    expect(await service.getById(created.id)).toBeUndefined();
  });

  it("persists records across database reopen", async () => {
    const created = await service.create(validInput);
    const databaseName = database.name;

    database.close();
    const reopenedDatabase = new ModuleDatabase(databaseName);
    await reopenedDatabase.open();
    try {
      expect(await reopenedDatabase.modules.get(created.id)).toEqual(created);
      expect(reopenedDatabase.verno).toBe(3);
    } finally {
      reopenedDatabase.close();
      await reopenedDatabase.delete();
    }
  });

  it("validates required fields and prevents duplicate codes without writing", async () => {
    await service.create(validInput);

    await expect(
      service.create({ ...validInput, name: "  ", code: " eco-101 " }),
    ).rejects.toMatchObject({
      fieldErrors: {
        name: "Enter a module name.",
        code: "A module with this code already exists.",
      },
    } satisfies Partial<ModuleValidationError>);
    await expect(service.getAll()).resolves.toHaveLength(1);
  });

  it("rejects invalid optional fields and allows a module to keep its own code", async () => {
    const created = await service.create(validInput);

    await expect(
      service.update(created.id, { ...validInput, color: "green" }),
    ).rejects.toMatchObject({
      fieldErrors: { color: "Choose a valid six-digit accent color." },
    });

    await expect(
      service.update(created.id, { ...validInput, name: "  Updated title  " }),
    ).resolves.toMatchObject({ name: "Updated title", code: validInput.code });
  });

  it("archives and restores a module without changing its identity", async () => {
    const created = await service.create(validInput);
    currentTime += 60_000;

    const archived = await service.setArchived(created.id, true);
    expect(archived).toMatchObject({
      id: created.id,
      isArchived: true,
      updatedAt: "2026-01-01T10:01:00.000Z",
    });

    currentTime += 60_000;
    const restored = await service.setArchived(created.id, false);
    expect(restored).toMatchObject({
      id: created.id,
      isArchived: false,
      createdAt: created.createdAt,
      updatedAt: "2026-01-01T10:02:00.000Z",
    });
  });

  it("upgrades a version 1 database without deleting existing modules", async () => {
    const legacyDatabase = new Dexie(`legacy-module-db-${crypto.randomUUID()}`);
    legacyDatabase.version(1).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
    });
    await legacyDatabase.open();
    const legacyModule = {
      id: "legacy-module",
      name: "Legacy course",
      code: "LEG-101",
      isArchived: false,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    await legacyDatabase.table("modules").add(legacyModule);
    const databaseName = legacyDatabase.name;
    legacyDatabase.close();

    const upgradedDatabase = new ModuleDatabase(databaseName);
    await upgradedDatabase.open();
    try {
      expect(upgradedDatabase.verno).toBe(3);
      expect(await upgradedDatabase.modules.get(legacyModule.id)).toEqual(legacyModule);
      expect(await upgradedDatabase.topics.count()).toBe(0);
      expect(await upgradedDatabase.materials.count()).toBe(0);
    } finally {
      upgradedDatabase.close();
      await upgradedDatabase.delete();
    }
  });

  it("upgrades version 2 without deleting existing materials or original bytes", async () => {
    const legacyDatabase = new Dexie(`legacy-material-db-${crypto.randomUUID()}`);
    legacyDatabase.version(2).stores({
      modules: "id, &code, name, semester, academicYear, isArchived, updatedAt",
      topics: "id, moduleId, sortOrder, updatedAt",
      materials:
        "id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt",
      storedFiles: "id",
    });
    await legacyDatabase.open();
    const module = {
      id: "old-module",
      name: "Legacy module",
      code: "OLD-101",
      isArchived: false,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const material = {
      id: "old-material",
      title: "Saved notes",
      originalFileName: "saved.txt",
      mimeType: "text/plain",
      extension: "txt",
      sizeBytes: 6,
      tags: [],
      status: "not-started",
      isFavorite: false,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const bytes = new ArrayBuffer(6);
    new Uint8Array(bytes).set(new TextEncoder().encode("stored"));
    await legacyDatabase.table("modules").add(module);
    await legacyDatabase.table("materials").add(material);
    await legacyDatabase.table("storedFiles").add({ id: material.id, bytes });
    const databaseName = legacyDatabase.name;
    legacyDatabase.close();

    const upgradedDatabase = new ModuleDatabase(databaseName);
    await upgradedDatabase.open();
    try {
      expect(upgradedDatabase.verno).toBe(3);
      expect(await upgradedDatabase.modules.get(module.id)).toEqual(module);
      expect(await upgradedDatabase.materials.get(material.id)).toEqual(material);
      expect(
        new TextDecoder().decode((await upgradedDatabase.storedFiles.get(material.id))?.bytes),
      ).toBe("stored");
    } finally {
      upgradedDatabase.close();
      await upgradedDatabase.delete();
    }
  });
});
